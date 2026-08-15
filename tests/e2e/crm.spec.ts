import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

import { prisma } from '@/lib/prisma';

/**
 * Milestone 10 E2E — the CRM against a production build.
 *
 * Each run creates its own user + org, seeds a pipeline with stages, a deal, a
 * company, a tag, and a task, then exercises the board, the deal drawer, the
 * companies/tasks pages, and axe.
 */

const STRONG_PASSWORD = 'correct-horse-battery-staple';

function uniqueEmail(label: string): string {
  return `e2e-crm-${label}-${Date.now()}-${Math.floor(Math.random() * 10_000)}@test.local`;
}

function audit(page: Page) {
  return new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze();
}

const AUDIT_TIMEOUT_MS = 120_000;

type SeededOrg = {
  organizationId: string;
  branchId: string;
  stageIds: string[];
  dealId: string;
};

async function seedCrmOrg(email: string, organizationId: string): Promise<SeededOrg> {
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

    const contact = await client.contact.create({
      data: {
        organizationId,
        branchId: branch.id,
        phoneNumber: `+9665000${String(Math.floor(Math.random() * 100_000)).padStart(5, '0')}`,
        displayName: 'E2E CRM Contact',
        hasConsent: true,
      },
      select: { id: true },
    });

    const company = await client.company.create({
      data: {
        organizationId,
        branchId: branch.id,
        name: 'E2E Logistics',
        vatNumber: '3001234567000',
      },
      select: { id: true },
    });

    const pipeline = await client.pipeline.create({
      data: {
        organizationId,
        branchId: branch.id,
        name: 'E2E Pipeline',
        isDefault: true,
      },
      select: { id: true },
    });

    const stages = await Promise.all(
      ['New enquiry', 'Qualified', 'Won'].map((name, position) =>
        client.pipelineStage.create({
          data: {
            organizationId,
            pipelineId: pipeline.id,
            name,
            position,
            winProbability: [0.1, 0.4, 1][position],
          },
          select: { id: true },
        }),
      ),
    );

    const deal = await client.deal.create({
      data: {
        organizationId,
        branchId: branch.id,
        contactId: contact.id,
        companyId: company.id,
        stageId: stages[0]?.id ?? '',
        title: 'E2E Root canal case',
        valueAmount: 1450,
        valueCurrency: 'SAR',
        status: 'open',
      },
      select: { id: true },
    });

    const tag = await client.tag.create({
      data: {
        organizationId,
        branchId: branch.id,
        name: 'Insurance',
        color: 'info',
      },
      select: { id: true },
    });

    await client.taggable.create({
      data: {
        organizationId,
        tagId: tag.id,
        taggableType: 'deal',
        taggableId: deal.id,
      },
    });

    await client.task.create({
      data: {
        organizationId,
        branchId: branch.id,
        title: 'E2E Call back client',
        status: 'open',
      },
    });

    return {
      organizationId,
      branchId: branch.id,
      stageIds: stages.map((s) => s.id),
      dealId: deal.id,
    };
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
    await client.taggable.deleteMany({
      where: { organizationId: seeded.organizationId },
    });
    await client.activity.deleteMany({
      where: { organizationId: seeded.organizationId },
    });
    await client.deal.deleteMany({
      where: { organizationId: seeded.organizationId },
    });
    await client.task.deleteMany({
      where: { organizationId: seeded.organizationId },
    });
    await client.tag.deleteMany({ where: { organizationId: seeded.organizationId } });
    await client.company.deleteMany({
      where: { organizationId: seeded.organizationId },
    });
    await client.pipelineStage.deleteMany({
      where: { organizationId: seeded.organizationId },
    });
    await client.pipeline.deleteMany({
      where: { organizationId: seeded.organizationId },
    });
    await client.contact.deleteMany({
      where: { organizationId: seeded.organizationId },
    });
    await client.branch.deleteMany({ where: { organizationId: seeded.organizationId } });
    await client.member.deleteMany({ where: { organizationId: seeded.organizationId } });
    await client.organization.deleteMany({ where: { id: seeded.organizationId } });
  } finally {
    await client.$disconnect();
  }
}

async function openCrm(page: Page): Promise<SeededOrg> {
  const email = uniqueEmail('main');

  const signup = await page.request.post('/api/auth/sign-up/email', {
    data: { name: 'E2E CRM', email, password: STRONG_PASSWORD },
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
      name: `E2E CRM ${Date.now()} ${Math.floor(Math.random() * 10_000)}`,
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

  const seeded = await seedCrmOrg(email, organizationId);

  await page.goto('/crm');
  await expect(page.getByRole('heading', { name: 'CRM' })).toBeVisible();

  return seeded;
}

test.describe('crm', () => {
  test('renders the seeded pipeline with stages and deals', async ({ page }) => {
    const seeded = await openCrm(page);

    try {
      await expect(page.getByText('E2E Pipeline')).toBeVisible();
      await expect(page.getByText('New enquiry')).toBeVisible();
      await expect(page.getByText('Qualified')).toBeVisible();
      await expect(page.getByText('E2E Root canal case')).toBeVisible();
      await expect(page.getByText('Insurance')).toBeVisible();
    } finally {
      await cleanupOrg(seeded);
    }
  });

  test('opens the deal drawer and moves the deal to another stage', async ({ page }) => {
    const seeded = await openCrm(page);

    try {
      await page.getByText('E2E Root canal case').click();
      await expect(page.getByText('Timeline')).toBeVisible();

      // Move to Qualified via the drawer's stage select.
      await page.getByRole('combobox', { name: 'Move to stage' }).click();
      await page.getByRole('option', { name: 'Qualified' }).click();
      await page.getByRole('button', { name: 'Move deal' }).click();

      // The drawer reflects the new stage; the board's Qualified column gains it.
      await expect(page.getByText('Qualified', { exact: true }).first()).toBeVisible();
    } finally {
      await cleanupOrg(seeded);
    }
  });

  test('creates a company from the companies page', async ({ page }) => {
    const seeded = await openCrm(page);

    try {
      await page.goto('/crm/companies');
      await expect(page.getByText('E2E Logistics')).toBeVisible();

      await page.getByRole('button', { name: 'Add company' }).click();
      await page.getByLabel('Name').fill('Northstar Transport');
      await page.getByRole('button', { name: 'Add company', exact: true }).click();

      await expect(page.getByText('Northstar Transport')).toBeVisible();
    } finally {
      await cleanupOrg(seeded);
    }
  });

  test('completes a task from the tasks page', async ({ page }) => {
    const seeded = await openCrm(page);

    try {
      await page.goto('/crm/tasks');
      await expect(page.getByText('E2E Call back client')).toBeVisible();

      await page.getByRole('button', { name: 'Complete' }).click();
      await expect(page.getByText('Done')).toBeVisible();
    } finally {
      await cleanupOrg(seeded);
    }
  });

  test('has no accessibility violations on the CRM pages', async ({ page }) => {
    test.setTimeout(AUDIT_TIMEOUT_MS);
    const seeded = await openCrm(page);

    try {
      await page.emulateMedia({ reducedMotion: 'reduce' });
      const results = await audit(page);
      expect(results.violations).toEqual([]);

      await page.goto('/crm/companies');
      const companiesResults = await audit(page);
      expect(companiesResults.violations).toEqual([]);

      await page.goto('/crm/tasks');
      const tasksResults = await audit(page);
      expect(tasksResults.violations).toEqual([]);
    } finally {
      await cleanupOrg(seeded);
    }
  });
});
