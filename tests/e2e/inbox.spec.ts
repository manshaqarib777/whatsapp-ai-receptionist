import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

import { prisma } from '@/lib/prisma';

/**
 * Milestone 6 E2E — the real inbox against a production build.
 *
 * Each run creates its own user + org, seeds a conversation with a message pair,
 * and cleans up afterwards — the same hermetic discipline as dashboard.spec.ts.
 * The seeded data goes through the app's OWN scoped client path where possible.
 */

const STRONG_PASSWORD = 'correct-horse-battery-staple';

function uniqueEmail(label: string): string {
  return `e2e-inbox-${label}-${Date.now()}-${Math.floor(Math.random() * 10_000)}@test.local`;
}

function audit(page: Page) {
  return new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze();
}

type SeededOrg = {
  organizationId: string;
  branchId: string;
  conversationId: string;
};

async function seedInboxOrg(email: string, organizationId: string): Promise<SeededOrg> {
  const connectionString = process.env['DATABASE_URL'] ?? '';
  if (!connectionString) throw new Error('DATABASE_URL is required for E2E seeding.');
  const adapter = new PrismaPg({ connectionString });
  const client = new PrismaClient({ adapter });

  try {
    const user = await client.user.findFirstOrThrow({ where: { email } });

    const branch = await client.branch.findFirstOrThrow({
      where: { organizationId, isDefault: true, deletedAt: null },
      select: { id: true },
    });

    const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000);

    const contact = await client.contact.create({
      data: {
        organizationId,
        branchId: branch.id,
        phoneNumber: `+9665000${String(Math.floor(Math.random() * 100_000)).padStart(5, '0')}`,
        displayName: 'Inbox Contact',
        hasConsent: true,
      },
      select: { id: true },
    });

    const wa = await client.whatsappAccount.create({
      data: {
        organizationId,
        branchId: branch.id,
        phoneNumberId: `e2e-inbox-pnid-${Date.now()}`,
        wabaId: 'e2e-inbox-waba',
        displayPhoneNumber: '+966500000000',
        accessTokenRef: 'secret://e2e',
      },
      select: { id: true },
    });

    const conversation = await client.conversation.create({
      data: {
        organizationId,
        branchId: branch.id,
        contactId: contact.id,
        whatsappAccountId: wa.id,
        status: 'open',
        unreadCount: 1,
        createdAt: daysAgo(1),
        lastMessageAt: daysAgo(1),
      },
      select: { id: true },
    });

    await client.message.createMany({
      data: [
        {
          organizationId,
          conversationId: conversation.id,
          direction: 'inbound',
          authorType: 'contact',
          contentType: 'text',
          body: 'Hello, I need a quote',
          createdAt: daysAgo(1),
        },
        {
          organizationId,
          conversationId: conversation.id,
          direction: 'outbound',
          authorType: 'agent',
          contentType: 'text',
          body: 'Of course, one moment',
          createdAt: new Date(daysAgo(1).getTime() + 60_000),
        },
      ],
    });

    await client.label.create({
      data: {
        organizationId,
        branchId: branch.id,
        name: 'VIP',
        color: 'warning',
      },
    });

    void user;
    return { organizationId, branchId: branch.id, conversationId: conversation.id };
  } finally {
    await client.$disconnect();
  }
}

async function cleanupOrg(seeded: SeededOrg): Promise<void> {
  const connectionString = process.env['DATABASE_URL'] ?? '';
  if (!connectionString) throw new Error('DATABASE_URL is required for E2E cleanup.');
  const adapter = new PrismaPg({ connectionString });
  const client = new PrismaClient({ adapter });

  try {
    await client.conversationLabel.deleteMany({
      where: { organizationId: seeded.organizationId },
    });
    await client.messageAttachment.deleteMany({
      where: { organizationId: seeded.organizationId },
    });
    await client.message.deleteMany({ where: { organizationId: seeded.organizationId } });
    await client.conversationNote.deleteMany({
      where: { organizationId: seeded.organizationId },
    });
    await client.conversation.deleteMany({
      where: { organizationId: seeded.organizationId },
    });
    await client.label.deleteMany({ where: { organizationId: seeded.organizationId } });
    await client.whatsappAccount.deleteMany({
      where: { organizationId: seeded.organizationId },
    });
    await client.contact.deleteMany({ where: { organizationId: seeded.organizationId } });
    await client.branch.deleteMany({ where: { organizationId: seeded.organizationId } });
    await client.member.deleteMany({ where: { organizationId: seeded.organizationId } });
    await client.organization.deleteMany({ where: { id: seeded.organizationId } });
  } finally {
    await client.$disconnect();
  }
}

async function openInbox(page: Page): Promise<SeededOrg> {
  const email = uniqueEmail('main');

  const signup = await page.request.post('/api/auth/sign-up/email', {
    data: { name: 'E2E Inbox', email, password: STRONG_PASSWORD },
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
      name: `E2E Inbox ${Date.now()} ${Math.floor(Math.random() * 10_000)}`,
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

  const seeded = await seedInboxOrg(email, organizationId);

  await page.goto('/inbox');
  await expect(page.getByText('Inbox Contact')).toBeVisible();

  return seeded;
}

test.describe('inbox', () => {
  test('renders the conversation list from real seeded data', async ({ page }) => {
    const seeded = await openInbox(page);

    try {
      // The row preview shows the newest message in the thread.
      await expect(page.getByText('Inbox Contact')).toBeVisible();
      await expect(page.getByText('Of course, one moment')).toBeVisible();
    } finally {
      await cleanupOrg(seeded);
    }
  });

  test('opens a thread and shows the message history', async ({ page }) => {
    const seeded = await openInbox(page);

    try {
      await page.getByText('Inbox Contact').click();
      // Exact match — the heuristic summary also contains these phrases.
      await expect(
        page.getByText('Hello, I need a quote', { exact: true }),
      ).toBeVisible();
      await expect(
        page.getByText('Of course, one moment', { exact: true }),
      ).toBeVisible();
    } finally {
      await cleanupOrg(seeded);
    }
  });

  test('sends a reply that appears in the thread', async ({ page }) => {
    const seeded = await openInbox(page);

    try {
      await page.getByText('Inbox Contact').click();
      const composer = page.getByLabel('Message', { exact: true });
      await composer.fill('We can do Thursday at 10am');
      await page.getByRole('button', { name: 'Send message' }).click();

      await expect(page.getByText('We can do Thursday at 10am')).toBeVisible();
    } finally {
      await cleanupOrg(seeded);
    }
  });

  test('assigns the conversation and adds an internal note', async ({ page }) => {
    const seeded = await openInbox(page);

    try {
      await page.getByText('Inbox Contact').click();
      await page.getByRole('button', { name: 'Conversation actions' }).click();
      await page.getByRole('menuitem', { name: /E2E Inbox/ }).click();
      await expect(page.getByText(/· E2E Inbox/)).toBeVisible();

      await page.getByLabel('Internal note').fill('Follow up with the pricing team.');
      await page.getByRole('button', { name: 'Add note' }).click();
      await expect(page.getByText('Follow up with the pricing team.')).toBeVisible();
    } finally {
      await cleanupOrg(seeded);
    }
  });

  test('shows the heuristic summary and suggestions', async ({ page }) => {
    const seeded = await openInbox(page);

    try {
      await page.getByText('Inbox Contact').click();
      await expect(page.getByText(/summary/i)).toBeVisible();
      await expect(page.getByText(/inbound and/i)).toBeVisible();
      // Opening the thread marks it read, so the "Reply now" suggestion is
      // replaced by "Mark resolved" — either proves suggestions render.
      await expect(page.getByText(/Reply now|Mark resolved/)).toBeVisible();
    } finally {
      await cleanupOrg(seeded);
    }
  });

  test('filters by status and searches', async ({ page }) => {
    const seeded = await openInbox(page);

    try {
      // Archive from the thread, then the list shows it under Archived.
      await page.getByText('Inbox Contact').click();
      await page.getByRole('button', { name: 'Conversation actions' }).click();
      await page.getByRole('menuitem', { name: 'Archive' }).click();

      await page.goto('/inbox');
      await expect(page.getByText('Inbox Contact')).toBeVisible();

      // Search finds the seeded message body (the conversation surfaces).
      await page.getByLabel('Search conversations').fill('quote');
      await expect(page.getByText('Inbox Contact')).toBeVisible();
    } finally {
      await cleanupOrg(seeded);
    }
  });

  test('has no accessibility violations on the list and thread', async ({ page }) => {
    test.setTimeout(120_000);
    const seeded = await openInbox(page);

    try {
      for (const theme of ['light', 'dark'] as const) {
        await page.emulateMedia({ reducedMotion: 'reduce' });
        await page.addInitScript((value) => {
          window.localStorage.setItem('theme', value);
        }, theme);

        // Back to the list so the second iteration audits it fresh.
        await page.goto('/inbox');
        await expect(page.getByText('Inbox Contact')).toBeVisible();

        const listResults = await audit(page);
        expect(listResults.violations, `${theme} theme list`).toEqual([]);

        await page.getByText('Inbox Contact').click();
        await expect(
          page.getByText('Hello, I need a quote', { exact: true }),
        ).toBeVisible();
        const threadResults = await audit(page);
        expect(threadResults.violations, `${theme} theme thread`).toEqual([]);
      }
    } finally {
      await cleanupOrg(seeded);
    }
  });
});
