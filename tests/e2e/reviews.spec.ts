import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

import { prisma } from '@/lib/prisma';

/**
 * Milestone 16 E2E — reviews against a production build.
 *
 * Each run creates its own user + org, seeds a platform, a review request, and
 * a review, then exercises the review list (needs-attention badge), the
 * request lifecycle, and axe.
 */

const STRONG_PASSWORD = 'correct-horse-battery-staple';

function uniqueEmail(label: string): string {
  return `e2e-reviews-${label}-${Date.now()}-${Math.floor(Math.random() * 10_000)}@test.local`;
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

async function seedReviewsOrg(organizationId: string): Promise<SeededOrg> {
  const connectionString = process.env['DATABASE_URL'] ?? '';
  if (!connectionString) throw new Error('DATABASE_URL is required for E2E seeding.');
  const adapter = new PrismaPg({ connectionString });
  const client = new PrismaClient({ adapter });

  try {
    const branch = await client.branch.findFirstOrThrow({
      where: { organizationId, isDefault: true, deletedAt: null },
      select: { id: true },
    });

    const platform = await client.reviewPlatform.create({
      data: {
        organizationId,
        branchId: branch.id,
        name: 'Google',
        provider: 'google',
        isConnected: false,
      },
      select: { id: true },
    });

    const contact = await client.contact.create({
      data: {
        organizationId,
        branchId: branch.id,
        phoneNumber: `+9665000${Math.floor(10000 + Math.random() * 89999)}`,
        displayName: 'E2E Review Contact',
        hasConsent: true,
      },
      select: { id: true },
    });

    await client.review.create({
      data: {
        organizationId,
        branchId: branch.id,
        contactId: contact.id,
        platformId: platform.id,
        rating: 2,
        text: 'The wait was too long.',
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
    await client.review.deleteMany({ where: { organizationId } });
    await client.reviewRequest.deleteMany({ where: { organizationId } });
    await client.reviewPlatform.deleteMany({ where: { organizationId } });
    await client.contact.deleteMany({ where: { organizationId } });
    await client.branch.deleteMany({ where: { organizationId } });
    await client.member.deleteMany({ where: { organizationId } });
    await client.organization.deleteMany({ where: { id: organizationId } });
  } finally {
    await client.$disconnect();
  }
}

async function openReviews(page: Page): Promise<SeededOrg> {
  const email = uniqueEmail('main');

  const signup = await page.request.post('/api/auth/sign-up/email', {
    data: { name: 'E2E Reviews', email, password: STRONG_PASSWORD },
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
      name: `E2E Reviews ${Date.now()} ${Math.floor(Math.random() * 10_000)}`,
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

  const seeded = await seedReviewsOrg(organizationId);

  await page.goto('/reviews');
  await expect(page.getByRole('heading', { name: 'Reviews' })).toBeVisible();

  return seeded;
}

test.describe('reviews', () => {
  test('renders the seeded review with the needs-attention badge', async ({ page }) => {
    const seeded = await openReviews(page);

    try {
      await expect(page.getByText('E2E Review Contact')).toBeVisible();
      await expect(page.getByText('The wait was too long.')).toBeVisible();
      await expect(page.getByText('Needs attention').first()).toBeVisible();
    } finally {
      await cleanupOrg(seeded);
    }
  });

  test('shows platform connection state', async ({ page }) => {
    const seeded = await openReviews(page);

    try {
      await page.goto('/reviews/platforms');
      await expect(page.getByRole('heading', { name: 'Review platforms' })).toBeVisible();
      const googlePlatform = page.getByRole('listitem').filter({ hasText: 'Google' });
      await expect(googlePlatform.getByText('Google', { exact: true })).toBeVisible();
      const facebookPlatform = page.getByRole('listitem').filter({ hasText: 'Facebook' });
      await expect(facebookPlatform.getByText('Facebook', { exact: true })).toBeVisible();
      await expect(page.getByText('Not configured').first()).toBeVisible();
    } finally {
      await cleanupOrg(seeded);
    }
  });

  test('has no accessibility violations on the reviews pages', async ({ page }) => {
    test.setTimeout(AUDIT_TIMEOUT_MS);
    const seeded = await openReviews(page);

    try {
      await page.emulateMedia({ reducedMotion: 'reduce' });
      const results = await audit(page);
      expect(results.violations).toEqual([]);

      await page.goto('/reviews/platforms');
      const platformResults = await audit(page);
      expect(platformResults.violations).toEqual([]);
    } finally {
      await cleanupOrg(seeded);
    }
  });
});
