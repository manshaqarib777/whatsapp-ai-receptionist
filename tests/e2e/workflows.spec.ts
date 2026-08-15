import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

import { prisma } from '@/lib/prisma';

/**
 * Milestone 13 E2E — workflows against a production build.
 *
 * Each run creates its own user + org, seeds a workflow with a saved version
 * and a run, and exercises the list, the builder (add node → save version →
 * enable), the run history, and axe.
 */

const STRONG_PASSWORD = 'correct-horse-battery-staple';

function uniqueEmail(label: string): string {
  return `e2e-workflow-${label}-${Date.now()}-${Math.floor(Math.random() * 10_000)}@test.local`;
}

function audit(page: Page) {
  return new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze();
}

const AUDIT_TIMEOUT_MS = 120_000;

type SeededOrg = {
  organizationId: string;
  workflowId: string;
};

async function seedWorkflowOrg(
  email: string,
  organizationId: string,
): Promise<SeededOrg> {
  const connectionString = process.env['DATABASE_URL'] ?? '';
  if (!connectionString) throw new Error('DATABASE_URL is required for E2E seeding.');
  const adapter = new PrismaPg({ connectionString });
  const client = new PrismaClient({ adapter });

  try {
    const branch = await client.branch.create({
      data: {
        organizationId,
        name: 'Main',
        slug: 'main',
        timezone: 'Asia/Riyadh',
        isDefault: true,
      },
      select: { id: true },
    });

    const workflow = await client.workflow.create({
      data: {
        organizationId,
        branchId: branch.id,
        name: 'E2E Welcome flow',
        isEnabled: true,
      },
      select: { id: true },
    });

    const version = await client.workflowVersion.create({
      data: {
        organizationId,
        workflowId: workflow.id,
        versionNumber: 1,
        triggerKind: 'manual',
        definition: {
          nodes: [
            { id: 'trigger-1', type: 'trigger', config: {} },
            {
              id: 'action-1',
              type: 'action',
              actionKind: 'send_message',
              config: { text: 'Hello from E2E' },
            },
          ],
          edges: [{ id: 'edge-1', from: 'trigger-1', to: 'action-1' }],
          variables: [],
        },
      },
      select: { id: true },
    });

    await client.workflow.update({
      where: { id: workflow.id },
      data: { currentVersionId: version.id },
    });

    return { organizationId, workflowId: workflow.id };
  } finally {
    await client.$disconnect();
  }
}

async function cleanupOrg(seeded: SeededOrg): Promise<void> {
  const connectionString = process.env['DATABASE_URL'] ?? '';
  if (!connectionString) throw new Error('DATABASE_URL is required for cleanup.');
  const adapter = new PrismaPg({ connectionString });
  const client = new PrismaClient({ adapter });

  try {
    await client.workflowRunStep.deleteMany({
      where: { organizationId: seeded.organizationId },
    });
    await client.workflowRun.deleteMany({
      where: { organizationId: seeded.organizationId },
    });
    await client.workflowVersion.deleteMany({
      where: { organizationId: seeded.organizationId },
    });
    await client.workflow.deleteMany({
      where: { organizationId: seeded.organizationId },
    });
    await client.branch.deleteMany({ where: { organizationId: seeded.organizationId } });
    await client.member.deleteMany({ where: { organizationId: seeded.organizationId } });
    await client.organization.deleteMany({ where: { id: seeded.organizationId } });
  } finally {
    await client.$disconnect();
  }
}

async function openWorkflows(page: Page): Promise<SeededOrg> {
  const email = uniqueEmail('main');

  const signup = await page.request.post('/api/auth/sign-up/email', {
    data: { name: 'E2E Workflows', email, password: STRONG_PASSWORD },
  });
  expect(signup.status()).toBe(200);

  const user = await prisma.user.findFirstOrThrow({ where: { email } });
  await prisma.user.update({ where: { id: user.id }, data: { emailVerified: true } });

  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(STRONG_PASSWORD);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await page.waitForURL(/\/dashboard/);

  const orgResponse = await page.request.post('/api/organizations', {
    data: {
      name: `E2E Workflows ${Date.now()} ${Math.floor(Math.random() * 10_000)}`,
    },
  });
  expect(orgResponse.status()).toBe(201);
  const orgPayload = (await orgResponse.json()) as { data?: { id?: string } };
  const organizationId = orgPayload.data?.id;
  if (!organizationId) throw new Error('Organization creation did not return an id.');

  const switchResponse = await page.request.patch('/api/organizations/active', {
    data: { organizationId },
  });
  expect(switchResponse.status()).toBe(200);

  const seeded = await seedWorkflowOrg(email, organizationId);

  await page.goto('/workflows');
  await expect(page.getByRole('heading', { name: 'Workflows' })).toBeVisible();

  return seeded;
}

test.describe('workflows', () => {
  test('renders the seeded workflow on the list', async ({ page }) => {
    const seeded = await openWorkflows(page);

    try {
      await expect(page.getByText('E2E Welcome flow')).toBeVisible();
      await expect(page.getByText('Enabled')).toBeVisible();
    } finally {
      await cleanupOrg(seeded);
    }
  });

  test('opens the builder and saves a new version', async ({ page }) => {
    const seeded = await openWorkflows(page);

    try {
      await page.getByText('E2E Welcome flow').click();
      await expect(page.getByRole('heading', { name: 'Workflow builder' })).toBeVisible();

      // The seeded graph has a trigger + action; add a delay node and save.
      await page.getByRole('button', { name: '+ Delay' }).click();
      await page.getByRole('button', { name: 'Save version' }).click();

      await expect(page.getByText('Saved')).toBeVisible();
    } finally {
      await cleanupOrg(seeded);
    }
  });

  test('runs the workflow and shows history', async ({ page }) => {
    const seeded = await openWorkflows(page);

    try {
      await page.getByText('E2E Welcome flow').click();
      await page.getByRole('button', { name: 'Test run' }).click();

      await expect(page.getByText('Run history')).toBeVisible();
      await expect(page.getByText('succeeded').first()).toBeVisible();
    } finally {
      await cleanupOrg(seeded);
    }
  });

  test('has no accessibility violations on the workflow pages', async ({ page }) => {
    test.setTimeout(AUDIT_TIMEOUT_MS);
    const seeded = await openWorkflows(page);

    try {
      await page.emulateMedia({ reducedMotion: 'reduce' });
      const results = await audit(page);
      expect(results.violations).toEqual([]);

      await page.getByText('E2E Welcome flow').click();
      const builderResults = await audit(page);
      expect(builderResults.violations).toEqual([]);
    } finally {
      await cleanupOrg(seeded);
    }
  });
});
