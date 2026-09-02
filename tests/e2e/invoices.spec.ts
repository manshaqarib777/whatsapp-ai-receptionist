import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

import { prisma } from '@/lib/prisma';

/**
 * Milestone 12 E2E — invoices against a production build.
 *
 * Each run creates its own user + org, seeds a contact and an issued invoice
 * with a line item, and exercises the list, the create flow, the lifecycle
 * (issue → record payment → paid), the PDF endpoint, and axe.
 */

const STRONG_PASSWORD = 'correct-horse-battery-staple';

function uniqueEmail(label: string): string {
  return `e2e-invoice-${label}-${Date.now()}-${Math.floor(Math.random() * 10_000)}@test.local`;
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
  invoiceId: string;
};

async function seedInvoiceOrg(email: string, organizationId: string): Promise<SeededOrg> {
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
        displayName: 'E2E Invoice Contact',
        hasConsent: true,
      },
      select: { id: true },
    });

    const invoice = await client.invoice.create({
      data: {
        organizationId,
        branchId: branch.id,
        contactId: contact.id,
        number: `INV-${Date.now()}`,
        status: 'issued',
        subtotalAmount: 1000,
        taxAmount: 150,
        totalAmount: 1150,
        amountPaid: 0,
        currency: 'SAR',
        issuedAt: new Date(),
      },
      select: { id: true },
    });

    await client.invoiceLineItem.create({
      data: {
        organizationId,
        invoiceId: invoice.id,
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
      invoiceId: invoice.id,
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
    await client.paymentEvent.deleteMany({
      where: { organizationId: seeded.organizationId },
    });
    await client.refund.deleteMany({ where: { organizationId: seeded.organizationId } });
    await client.payment.deleteMany({ where: { organizationId: seeded.organizationId } });
    await client.invoiceLineItem.deleteMany({
      where: { organizationId: seeded.organizationId },
    });
    await client.invoice.deleteMany({ where: { organizationId: seeded.organizationId } });
    await client.contact.deleteMany({ where: { organizationId: seeded.organizationId } });
    await client.branch.deleteMany({ where: { organizationId: seeded.organizationId } });
    await client.member.deleteMany({ where: { organizationId: seeded.organizationId } });
    await client.organization.deleteMany({ where: { id: seeded.organizationId } });
  } finally {
    await client.$disconnect();
  }
}

async function openInvoices(page: Page): Promise<SeededOrg> {
  const email = uniqueEmail('main');

  const signup = await page.request.post('/api/auth/sign-up/email', {
    data: { name: 'E2E Invoices', email, password: STRONG_PASSWORD },
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
      name: `E2E Invoices ${Date.now()} ${Math.floor(Math.random() * 10_000)}`,
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

  const seeded = await seedInvoiceOrg(email, organizationId);

  await page.goto('/invoices');
  await expect(page.getByRole('heading', { name: 'Invoices' })).toBeVisible();

  return seeded;
}

test.describe('invoices', () => {
  test('renders the seeded invoice on the list', async ({ page }) => {
    const seeded = await openInvoices(page);

    try {
      await expect(page.getByText('E2E Invoice Contact')).toBeVisible();
      await expect(page.getByText('issued').last()).toBeVisible();
    } finally {
      await cleanupOrg(seeded);
    }
  });

  test('creates an invoice from the dialog', async ({ page }) => {
    const seeded = await openInvoices(page);

    let createdInvoiceId: string | null = null;

    try {
      await page.getByRole('button', { name: 'New invoice' }).click();
      await page.getByLabel('Contact id').fill(seeded.contactId);
      await page.getByLabel('Line 1 description').fill('E2E Scale and polish');
      await page.getByLabel('Line 1 unit price').fill('320');
      const createdResponse = page.waitForResponse(
        (response) =>
          response.url().includes('/api/invoices') &&
          response.request().method() === 'POST',
      );
      await page.getByRole('button', { name: 'Create invoice' }).click();
      const payload = (await (await createdResponse).json()) as {
        data?: { invoice?: { id?: string } };
      };
      createdInvoiceId = payload.data?.invoice?.id ?? null;

      // The created invoice (320 + 15% VAT = 368) appears in the list.
      await expect(page.getByText('368.00 SAR')).toBeVisible();
    } finally {
      if (createdInvoiceId) {
        const connectionString = process.env['DATABASE_URL'] ?? '';
        const adapter = new PrismaPg({ connectionString });
        const client = new PrismaClient({ adapter });
        await client.invoice.deleteMany({ where: { id: createdInvoiceId } });
        await client.$disconnect();
      }
      await cleanupOrg(seeded);
    }
  });

  test('opens the seeded invoice and marks it paid (offline)', async ({ page }) => {
    const seeded = await openInvoices(page);

    try {
      await page.getByText('E2E Invoice Contact').click();
      await expect(page.getByText('E2E Crown fitting')).toBeVisible();

      // The seeded invoice is issued with a balance, so the manual (offline)
      // "Mark paid" override is available without a gateway.
      await page.getByRole('button', { name: 'Mark paid' }).click();

      // The lifecycle transition flips the invoice to paid with a paidAt.
      await expect(page.getByText('paid', { exact: true }).first()).toBeVisible();
      await expect(page.getByText('0.00', { exact: true }).first()).toBeVisible();
    } finally {
      await cleanupOrg(seeded);
    }
  });

  test('opens the record-payment dialog', async ({ page }) => {
    const seeded = await openInvoices(page);

    try {
      await page.getByText('E2E Invoice Contact').click();

      await page.getByRole('button', { name: 'Record payment' }).click();
      await expect(page.getByRole('heading', { name: 'Record payment' })).toBeVisible();
      await page.getByRole('button', { name: 'Cancel' }).click();
    } finally {
      await cleanupOrg(seeded);
    }
  });

  test('downloads the invoice PDF', async ({ page }) => {
    const seeded = await openInvoices(page);

    try {
      await page.getByText('E2E Invoice Contact').click();
      const downloadPromise = page.waitForEvent('download');
      await page.getByRole('link', { name: 'PDF' }).click();
      const download = await downloadPromise;

      expect(download.suggestedFilename()).toMatch(/invoice-.*\.pdf/);
    } finally {
      await cleanupOrg(seeded);
    }
  });

  test('has no accessibility violations on the invoice pages', async ({ page }) => {
    test.setTimeout(AUDIT_TIMEOUT_MS);
    const seeded = await openInvoices(page);

    try {
      await page.emulateMedia({ reducedMotion: 'reduce' });
      const results = await audit(page);
      expect(results.violations).toEqual([]);

      await page.getByText('E2E Invoice Contact').click();
      const detailResults = await audit(page);
      expect(detailResults.violations).toEqual([]);
    } finally {
      await cleanupOrg(seeded);
    }
  });
});
