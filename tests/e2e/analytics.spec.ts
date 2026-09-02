import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

import { prisma } from '@/lib/prisma';

/**
 * Milestone 15 E2E — analytics against a production build.
 *
 * Each run creates its own user + org, seeds a paid invoice, an open deal with
 * a win probability, and a completed appointment, then verifies the analytics
 * page renders the revenue, forecast, and bookings sections, that the range
 * picker works, and that axe is clean.
 */

const STRONG_PASSWORD = 'correct-horse-battery-staple';

function uniqueEmail(label: string): string {
  return `e2e-analytics-${label}-${Date.now()}-${Math.floor(Math.random() * 10_000)}@test.local`;
}

function audit(page: Page) {
  return new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze();
}

const AUDIT_TIMEOUT_MS = 120_000;

type SeededOrg = {
  organizationId: string;
};

async function seedAnalyticsOrg(organizationId: string): Promise<SeededOrg> {
  const connectionString = process.env['DATABASE_URL'] ?? '';
  if (!connectionString) throw new Error('DATABASE_URL is required for E2E seeding.');
  const adapter = new PrismaPg({ connectionString });
  const client = new PrismaClient({ adapter });

  try {
    const branch = await client.branch.findFirstOrThrow({
      where: { organizationId, isDefault: true, deletedAt: null },
      select: { id: true },
    });

    const contact = await client.contact.create({
      data: {
        organizationId,
        branchId: branch.id,
        phoneNumber: `+9665000${Math.floor(10000 + Math.random() * 89999)}`,
        displayName: 'E2E Analytics Contact',
        hasConsent: true,
      },
      select: { id: true },
    });

    // A paid invoice → revenue section shows collected value.
    await client.invoice.create({
      data: {
        organizationId,
        branchId: branch.id,
        contactId: contact.id,
        number: `INV-E2E-${Math.floor(Math.random() * 100_000)}`,
        status: 'paid',
        subtotalAmount: 1000,
        taxAmount: 150,
        totalAmount: 1150,
        amountPaid: 1150,
        currency: 'SAR',
        issuedAt: new Date(),
        paidAt: new Date(),
      },
    });

    // A pipeline + open deal → funnel and forecast sections show data.
    const pipeline = await client.pipeline.create({
      data: {
        organizationId,
        branchId: branch.id,
        name: 'E2E Pipeline',
        isDefault: true,
      },
      select: { id: true },
    });
    const stage = await client.pipelineStage.create({
      data: {
        organizationId,
        pipelineId: pipeline.id,
        name: 'Qualified',
        position: 0,
        winProbability: '0.5',
      },
      select: { id: true },
    });
    await client.deal.create({
      data: {
        organizationId,
        branchId: branch.id,
        stageId: stage.id,
        title: 'E2E Deal',
        valueAmount: 2000,
        status: 'open',
      },
    });

    // A completed appointment → bookings section shows data.
    const service = await client.service.create({
      data: {
        organizationId,
        branchId: branch.id,
        name: 'E2E Service',
        durationMinutes: 30,
        priceAmount: 150,
      },
      select: { id: true },
    });
    const resource = await client.resource.create({
      data: {
        organizationId,
        branchId: branch.id,
        kind: 'staff',
        name: 'E2E Staff',
      },
      select: { id: true },
    });
    await client.appointment.create({
      data: {
        organizationId,
        branchId: branch.id,
        contactId: contact.id,
        serviceId: service.id,
        resourceId: resource.id,
        status: 'completed',
        startsAt: new Date(Date.now() - 24 * 3_600_000),
        endsAt: new Date(Date.now() - 24 * 3_600_000 + 1_800_000),
        timezone: 'Asia/Riyadh',
      },
    });

    return { organizationId };
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
    const { organizationId } = seeded;
    await client.appointmentReminder.deleteMany({ where: { organizationId } });
    await client.appointment.deleteMany({ where: { organizationId } });
    await client.availabilityException.deleteMany({ where: { organizationId } });
    await client.availabilityRule.deleteMany({ where: { organizationId } });
    await client.resource.deleteMany({ where: { organizationId } });
    await client.service.deleteMany({ where: { organizationId } });
    await client.deal.deleteMany({ where: { organizationId } });
    await client.pipelineStage.deleteMany({ where: { organizationId } });
    await client.pipeline.deleteMany({ where: { organizationId } });
    await client.invoice.deleteMany({ where: { organizationId } });
    await client.contact.deleteMany({ where: { organizationId } });
    await client.branch.deleteMany({ where: { organizationId } });
    await client.member.deleteMany({ where: { organizationId } });
    await client.organization.deleteMany({ where: { id: organizationId } });
  } finally {
    await client.$disconnect();
  }
}

async function openAnalytics(page: Page): Promise<SeededOrg> {
  const email = uniqueEmail('main');

  const signup = await page.request.post('/api/auth/sign-up/email', {
    data: { name: 'E2E Analytics', email, password: STRONG_PASSWORD },
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
      name: `E2E Analytics ${Date.now()} ${Math.floor(Math.random() * 10_000)}`,
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

  const seeded = await seedAnalyticsOrg(organizationId);

  await page.goto('/analytics');
  await expect(page.getByRole('heading', { name: 'Analytics' })).toBeVisible();

  return seeded;
}

test.describe('analytics', () => {
  test('renders revenue, funnel, bookings, and forecast sections from seeded data', async ({
    page,
  }) => {
    test.setTimeout(120_000);
    const seeded = await openAnalytics(page);

    try {
      await expect(page.getByText('Revenue', { exact: true }).first()).toBeVisible();
      await expect(page.getByText('SAR 1,150').first()).toBeVisible();
      await expect(
        page.getByRole('main').getByText('Funnels', { exact: true }),
      ).toBeVisible();
      await expect(page.getByText('Qualified', { exact: true })).toBeVisible();
      await expect(page.getByText('Bookings', { exact: true })).toBeVisible();
      await expect(page.getByText('Forecast', { exact: true })).toBeVisible();
      await expect(page.getByText('SAR 1,000').first()).toBeVisible();
    } finally {
      await cleanupOrg(seeded);
    }
  });

  test('switches the date range', async ({ page }) => {
    test.setTimeout(120_000);
    const seeded = await openAnalytics(page);

    try {
      await page.getByRole('button', { name: '90 days' }).click();
      await expect(page.getByRole('button', { name: '90 days' })).toHaveAttribute(
        'aria-pressed',
        'true',
      );
    } finally {
      await cleanupOrg(seeded);
    }
  });

  test('has no accessibility violations on the analytics page', async ({ page }) => {
    test.setTimeout(AUDIT_TIMEOUT_MS);
    const seeded = await openAnalytics(page);

    try {
      await page.emulateMedia({ reducedMotion: 'reduce' });
      const results = await audit(page);
      expect(results.violations).toEqual([]);
    } finally {
      await cleanupOrg(seeded);
    }
  });
});
