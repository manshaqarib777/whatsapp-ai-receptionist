import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

import { prisma } from '@/lib/prisma';

/**
 * Milestone 11 E2E — quotes against a production build.
 *
 * Each run creates its own user + org, seeds a contact, a draft quote with line
 * items, and exercises the list, the create flow, the lifecycle (send →
 * accept), the PDF endpoint, and axe.
 */

const STRONG_PASSWORD = 'correct-horse-battery-staple';

function uniqueEmail(label: string): string {
  return `e2e-quote-${label}-${Date.now()}-${Math.floor(Math.random() * 10_000)}@test.local`;
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
  contactId: string;
  quoteId: string;
};

async function seedQuoteOrg(email: string, organizationId: string): Promise<SeededOrg> {
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
        phoneNumber: `+9665000${String(Math.floor(Math.random() * 100_000)).padStart(5, '0')}`,
        displayName: 'E2E Quote Contact',
        hasConsent: true,
      },
      select: { id: true },
    });

    const quote = await client.quote.create({
      data: {
        organizationId,
        branchId: branch.id,
        contactId: contact.id,
        number: `Q-${Date.now()}`,
        status: 'draft',
        subtotalAmount: 1000,
        taxAmount: 150,
        totalAmount: 1150,
        currency: 'SAR',
      },
      select: { id: true },
    });

    await client.quoteLineItem.create({
      data: {
        organizationId,
        quoteId: quote.id,
        position: 0,
        description: 'E2E Crown fitting',
        quantity: 1,
        unitPriceAmount: 1000,
        taxRate: 0.15,
        taxAmount: 150,
        lineTotalAmount: 1150,
      },
    });

    return {
      organizationId,
      branchId: branch.id,
      contactId: contact.id,
      quoteId: quote.id,
    };
  } finally {
    await client.$disconnect();
  }
}

async function cleanupOrg(
  seeded: SeededOrg,
  createdQuoteId?: string | null,
): Promise<void> {
  const connectionString = process.env['DATABASE_URL'] ?? '';
  if (!connectionString) throw new Error('DATABASE_URL is required for cleanup.');
  const adapter = new PrismaPg({ connectionString });
  const client = new PrismaClient({ adapter });

  try {
    if (createdQuoteId) {
      // The dialog-created quote is a row this test owns; delete it by id so
      // cleanup never depends on the org-switch having settled first.
      await client.quote.deleteMany({ where: { id: createdQuoteId } });
    }
    await client.quoteVersion.deleteMany({
      where: { organizationId: seeded.organizationId },
    });
    await client.quoteLineItem.deleteMany({
      where: { organizationId: seeded.organizationId },
    });
    await client.quote.deleteMany({
      where: { organizationId: seeded.organizationId },
    });
    await client.quoteTemplate.deleteMany({
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

async function openQuotes(page: Page): Promise<SeededOrg> {
  const email = uniqueEmail('main');

  const signup = await page.request.post('/api/auth/sign-up/email', {
    data: { name: 'E2E Quotes', email, password: STRONG_PASSWORD },
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
      name: `E2E Quotes ${Date.now()} ${Math.floor(Math.random() * 10_000)}`,
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

  const seeded = await seedQuoteOrg(email, organizationId);

  await page.goto('/quotes');
  await expect(page.getByRole('heading', { name: 'Quotes' })).toBeVisible();

  return seeded;
}

test.describe('quotes', () => {
  test('renders the seeded quote on the list', async ({ page }) => {
    const seeded = await openQuotes(page);

    try {
      await expect(page.getByText('E2E Quote Contact')).toBeVisible();
      await expect(page.getByText('draft').last()).toBeVisible();
    } finally {
      await cleanupOrg(seeded);
    }
  });

  test('creates a quote from the dialog', async ({ page }) => {
    const seeded = await openQuotes(page);

    let createdQuoteId: string | null = null;

    try {
      await page.getByRole('button', { name: 'New quote' }).click();
      await page.getByLabel('Contact id').fill(seeded.contactId);
      await page.getByLabel('Line 1 description').fill('E2E Scale and polish');
      await page.getByLabel('Line 1 unit price').fill('320');
      const createdResponse = page.waitForResponse(
        (response) =>
          response.url().includes('/api/quotes') &&
          response.request().method() === 'POST',
      );
      await page.getByRole('button', { name: 'Create quote' }).click();
      const payload = (await (await createdResponse).json()) as {
        data?: { quote?: { id?: string } };
      };
      createdQuoteId = payload.data?.quote?.id ?? null;

      // The created quote (320 SAR + 15% VAT = 368) appears in the list; the
      // seeded quote totals 1,150, so this assertion is unambiguous.
      await expect(page.getByText('368.00 SAR')).toBeVisible();
    } finally {
      await cleanupOrg(seeded, createdQuoteId);
    }
  });

  test('opens the seeded quote and sends it', async ({ page }) => {
    const seeded = await openQuotes(page);

    try {
      await page.getByText('E2E Quote Contact').click();
      await expect(page.getByText('E2E Crown fitting')).toBeVisible();

      await page.getByRole('button', { name: 'Send quote' }).click();
      await expect(page.getByText('sent').first()).toBeVisible();

      await page.getByRole('button', { name: 'Accept' }).click();
      await expect(page.getByText('accepted').first()).toBeVisible();
    } finally {
      await cleanupOrg(seeded);
    }
  });

  test('downloads the quote PDF', async ({ page }) => {
    const seeded = await openQuotes(page);

    try {
      await page.getByText('E2E Quote Contact').click();
      const downloadPromise = page.waitForEvent('download');
      await page.getByRole('link', { name: 'PDF' }).click();
      const download = await downloadPromise;

      expect(download.suggestedFilename()).toMatch(/quote-.*\.pdf/);
    } finally {
      await cleanupOrg(seeded);
    }
  });

  test('has no accessibility violations on the quote pages', async ({ page }) => {
    test.setTimeout(AUDIT_TIMEOUT_MS);
    const seeded = await openQuotes(page);

    try {
      await page.emulateMedia({ reducedMotion: 'reduce' });
      const results = await audit(page);
      expect(results.violations).toEqual([]);

      await page.getByText('E2E Quote Contact').click();
      const detailResults = await audit(page);
      expect(detailResults.violations).toEqual([]);
    } finally {
      await cleanupOrg(seeded);
    }
  });
});
