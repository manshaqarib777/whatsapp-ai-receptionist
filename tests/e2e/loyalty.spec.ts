import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

import { prisma } from '@/lib/prisma';

/**
 * Milestone 17 E2E — loyalty against a production build.
 *
 * Each run creates its own user + org, seeds a program and a loyalty account
 * with a balance, then exercises the account list (tier + balance), the
 * program list, and axe.
 */

const STRONG_PASSWORD = 'correct-horse-battery-staple';

function uniqueEmail(label: string): string {
  return `e2e-loyalty-${label}-${Date.now()}-${Math.floor(Math.random() * 10_000)}@test.local`;
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

async function seedLoyaltyOrg(organizationId: string): Promise<SeededOrg> {
  const connectionString = process.env['DATABASE_URL'] ?? '';
  if (!connectionString) throw new Error('DATABASE_URL is required for E2E seeding.');
  const adapter = new PrismaPg({ connectionString });
  const client = new PrismaClient({ adapter });

  try {
    const branch = await client.branch.findFirstOrThrow({
      where: { organizationId, isDefault: true, deletedAt: null },
      select: { id: true },
    });

    const program = await client.loyaltyProgram.create({
      data: {
        organizationId,
        branchId: branch.id,
        name: 'E2E Rewards',
        pointsPerCurrency: 1,
        isEnabled: true,
      },
      select: { id: true },
    });

    const contact = await client.contact.create({
      data: {
        organizationId,
        branchId: branch.id,
        phoneNumber: `+9665000${Math.floor(10000 + Math.random() * 89999)}`,
        displayName: 'E2E Loyalty Contact',
        hasConsent: true,
      },
      select: { id: true },
    });

    await client.loyaltyAccount.create({
      data: {
        organizationId,
        branchId: branch.id,
        contactId: contact.id,
        programId: program.id,
        balance: 1200,
        totalEarned: 1200,
        tier: 'silver',
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
    await client.loyaltyTransaction.deleteMany({ where: { organizationId } });
    await client.loyaltyAccount.deleteMany({ where: { organizationId } });
    await client.loyaltyProgram.deleteMany({ where: { organizationId } });
    await client.couponRedemption.deleteMany({ where: { organizationId } });
    await client.coupon.deleteMany({ where: { organizationId } });
    await client.referral.deleteMany({ where: { organizationId } });
    await client.contact.deleteMany({ where: { organizationId } });
    await client.branch.deleteMany({ where: { organizationId } });
    await client.member.deleteMany({ where: { organizationId } });
    await client.organization.deleteMany({ where: { id: organizationId } });
  } finally {
    await client.$disconnect();
  }
}

async function openLoyalty(page: Page): Promise<SeededOrg> {
  const email = uniqueEmail('main');

  const signup = await page.request.post('/api/auth/sign-up/email', {
    data: { name: 'E2E Loyalty', email, password: STRONG_PASSWORD },
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
      name: `E2E Loyalty ${Date.now()} ${Math.floor(Math.random() * 10_000)}`,
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

  const seeded = await seedLoyaltyOrg(organizationId);

  await page.goto('/loyalty');
  await expect(page.getByRole('heading', { name: 'Loyalty' })).toBeVisible();

  return seeded;
}

test.describe('loyalty', () => {
  test('renders the seeded account with tier and balance', async ({ page }) => {
    const seeded = await openLoyalty(page);

    try {
      await expect(page.getByText('E2E Loyalty Contact')).toBeVisible();
      await expect(page.getByText('silver', { exact: true })).toBeVisible();
      await expect(page.getByText(/1200 points/)).toBeVisible();
    } finally {
      await cleanupOrg(seeded);
    }
  });

  test('shows the program list', async ({ page }) => {
    const seeded = await openLoyalty(page);

    try {
      await page.goto('/loyalty/programs');
      await expect(page.getByRole('heading', { name: 'Programs' })).toBeVisible();
      await expect(page.getByText('E2E Rewards')).toBeVisible();
      await expect(page.getByText('Enabled')).toBeVisible();
    } finally {
      await cleanupOrg(seeded);
    }
  });

  test('has no accessibility violations on the loyalty pages', async ({ page }) => {
    test.setTimeout(AUDIT_TIMEOUT_MS);
    const seeded = await openLoyalty(page);

    try {
      await page.emulateMedia({ reducedMotion: 'reduce' });
      const results = await audit(page);
      expect(results.violations).toEqual([]);

      await page.goto('/loyalty/programs');
      const programResults = await audit(page);
      expect(programResults.violations).toEqual([]);
    } finally {
      await cleanupOrg(seeded);
    }
  });
});
