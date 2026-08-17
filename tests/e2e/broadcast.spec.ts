import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

import { prisma } from '@/lib/prisma';

/**
 * Milestone 14 E2E — broadcast against a production build.
 *
 * Each run creates its own user + org, seeds a segment, an approved template,
 * and a sent campaign with materialised recipients, then exercises the
 * campaign list, the campaign detail (analytics + recipients), the segment
 * preview, and axe.
 */

const STRONG_PASSWORD = 'correct-horse-battery-staple';

function uniqueEmail(label: string): string {
  return `e2e-broadcast-${label}-${Date.now()}-${Math.floor(Math.random() * 10_000)}@test.local`;
}

function audit(page: Page) {
  return new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze();
}

const AUDIT_TIMEOUT_MS = 120_000;

type SeededOrg = {
  organizationId: string;
  segmentId: string;
  templateId: string;
  campaignId: string;
};

async function seedBroadcastOrg(
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

    const segment = await client.segment.create({
      data: {
        organizationId,
        branchId: branch.id,
        name: 'E2E segment',
        definition: { locale: 'en' },
      },
      select: { id: true },
    });

    const template = await client.whatsappMessageTemplate.create({
      data: {
        organizationId,
        branchId: branch.id,
        name: 'E2E template',
        language: 'en',
        metaStatus: 'approved',
        body: { body: 'Hi {{1}}, a message from the E2E suite.' },
      },
      select: { id: true },
    });

    const campaign = await client.campaign.create({
      data: {
        organizationId,
        branchId: branch.id,
        segmentId: segment.id,
        templateId: template.id,
        name: 'E2E campaign',
        status: 'sent',
        startedAt: new Date(),
        finishedAt: new Date(),
      },
      select: { id: true },
    });

    const contact = await client.contact.create({
      data: {
        organizationId,
        branchId: branch.id,
        phoneNumber: `+9665000${Math.floor(10000 + Math.random() * 89999)}`,
        displayName: 'E2E Recipient',
        locale: 'en',
        hasConsent: true,
      },
      select: { id: true },
    });

    await client.campaignRecipient.create({
      data: {
        organizationId,
        campaignId: campaign.id,
        contactId: contact.id,
        status: 'delivered',
      },
    });

    return {
      organizationId,
      segmentId: segment.id,
      templateId: template.id,
      campaignId: campaign.id,
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
    await client.campaignRecipient.deleteMany({
      where: { organizationId: seeded.organizationId },
    });
    await client.campaign.deleteMany({
      where: { organizationId: seeded.organizationId },
    });
    await client.whatsappMessageTemplate.deleteMany({
      where: { organizationId: seeded.organizationId },
    });
    await client.segment.deleteMany({
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

async function openBroadcast(page: Page): Promise<SeededOrg> {
  const email = uniqueEmail('main');

  const signup = await page.request.post('/api/auth/sign-up/email', {
    data: { name: 'E2E Broadcast', email, password: STRONG_PASSWORD },
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
      name: `E2E Broadcast ${Date.now()} ${Math.floor(Math.random() * 10_000)}`,
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

  const seeded = await seedBroadcastOrg(email, organizationId);

  await page.goto('/broadcast');
  await expect(page.getByRole('heading', { name: 'Broadcast' })).toBeVisible();

  return seeded;
}

test.describe('broadcast', () => {
  test('renders the seeded campaign on the list', async ({ page }) => {
    const seeded = await openBroadcast(page);

    try {
      await expect(page.getByText('E2E campaign')).toBeVisible();
      await expect(page.getByText('sent', { exact: true })).toBeVisible();
    } finally {
      await cleanupOrg(seeded);
    }
  });

  test('opens the campaign detail and shows analytics and recipients', async ({
    page,
  }) => {
    const seeded = await openBroadcast(page);

    try {
      await page.getByText('E2E campaign').click();
      await expect(page.getByText('Analytics')).toBeVisible();
      await expect(page.getByText('E2E Recipient')).toBeVisible();
      await expect(page.getByText('delivered').first()).toBeVisible();
    } finally {
      await cleanupOrg(seeded);
    }
  });

  test('previews a segment count', async ({ page }) => {
    const seeded = await openBroadcast(page);

    try {
      await page.goto('/broadcast/segments');
      await expect(page.getByRole('heading', { name: 'Segments' })).toBeVisible();
      await expect(page.getByText('E2E segment')).toBeVisible();

      await page.getByRole('button', { name: 'Preview' }).click();
      await expect(page.getByText(/1 eligible/)).toBeVisible();
    } finally {
      await cleanupOrg(seeded);
    }
  });

  test('has no accessibility violations on the broadcast pages', async ({ page }) => {
    test.setTimeout(AUDIT_TIMEOUT_MS);
    const seeded = await openBroadcast(page);

    try {
      await page.emulateMedia({ reducedMotion: 'reduce' });
      const results = await audit(page);
      expect(results.violations).toEqual([]);

      await page.getByText('E2E campaign').click();
      const detailResults = await audit(page);
      expect(detailResults.violations).toEqual([]);
    } finally {
      await cleanupOrg(seeded);
    }
  });
});
