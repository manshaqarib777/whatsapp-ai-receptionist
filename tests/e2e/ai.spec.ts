import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

import { prisma } from '@/lib/prisma';

/**
 * Milestone 8 E2E — the AI Engine against a production build.
 *
 * Each run creates its own user + org, seeds a prompt template (active version)
 * and a conversation, and cleans up afterwards. The run log renders after the
 * engine records a turn.
 */

const STRONG_PASSWORD = 'correct-horse-battery-staple';

function uniqueEmail(label: string): string {
  return `e2e-ai-${label}-${Date.now()}-${Math.floor(Math.random() * 10_000)}@test.local`;
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

async function seedAiOrg(email: string, organizationId: string): Promise<SeededOrg> {
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
        displayName: 'AI E2E Contact',
        hasConsent: true,
      },
      select: { id: true },
    });

    const wa = await client.whatsappAccount.create({
      data: {
        organizationId,
        branchId: branch.id,
        phoneNumberId: `e2e-ai-pnid-${Date.now()}`,
        wabaId: 'e2e-ai-waba',
        displayPhoneNumber: '+966500000000',
        accessTokenRef: 'secret://e2e-ai',
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
        lastMessageAt: new Date(),
      },
      select: { id: true },
    });

    await client.message.create({
      data: {
        organizationId,
        conversationId: conversation.id,
        direction: 'inbound',
        authorType: 'contact',
        contentType: 'text',
        body: 'Hello, do you have any appointments tomorrow?',
        createdAt: new Date(),
      },
    });

    // An active prompt template the engine resolves.
    await client.promptTemplate.create({
      data: {
        organizationId,
        branchId: branch.id,
        key: 'receptionist.faq',
        name: 'FAQ',
        version: 1,
        versions: {
          create: {
            organizationId,
            versionNumber: 1,
            body: 'You are the receptionist. Answer briefly.',
            status: 'active',
          },
        },
      },
    });

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
    await client.aiRunCitation.deleteMany({
      where: { organizationId: seeded.organizationId },
    });
    await client.aiRun.deleteMany({ where: { organizationId: seeded.organizationId } });
    await client.promptTemplateVersion.deleteMany({
      where: { organizationId: seeded.organizationId },
    });
    await client.promptTemplate.deleteMany({
      where: { organizationId: seeded.organizationId },
    });
    await client.message.deleteMany({ where: { organizationId: seeded.organizationId } });
    await client.conversation.deleteMany({
      where: { organizationId: seeded.organizationId },
    });
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

async function openAi(page: Page): Promise<SeededOrg> {
  const email = uniqueEmail('main');

  const signup = await page.request.post('/api/auth/sign-up/email', {
    data: { name: 'E2E AI', email, password: STRONG_PASSWORD },
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
    data: { name: `E2E AI ${Date.now()} ${Math.floor(Math.random() * 10_000)}` },
  });
  expect(orgResponse.status()).toBe(201);
  const orgPayload = (await orgResponse.json()) as { data?: { id?: string } };
  const organizationId = orgPayload.data?.id;
  if (!organizationId) throw new Error('Organization creation did not return an id.');

  const switchResponse = await page.request.patch('/api/organizations/active', {
    data: { organizationId },
  });
  expect(switchResponse.status()).toBe(200);

  const seeded = await seedAiOrg(email, organizationId);

  await page.goto('/ai');
  await expect(page.getByRole('heading', { name: 'AI Engine' })).toBeVisible();

  return seeded;
}

test.describe('ai engine', () => {
  test('renders the run log and templates from seeded data', async ({ page }) => {
    const seeded = await openAi(page);

    try {
      await page.getByRole('tab', { name: 'Templates' }).click();
      await expect(page.getByText('receptionist.faq')).toBeVisible();
      await expect(page.getByText('FAQ').first()).toBeVisible();
    } finally {
      await cleanupOrg(seeded);
    }
  });

  test('runs a turn and records it in the run log', async ({ page }) => {
    const seeded = await openAi(page);

    try {
      await page.getByLabel('Conversation id').fill(seeded.conversationId);
      await page.getByLabel('Customer message').fill('How much does a check-up cost?');
      await page.getByRole('button', { name: 'Run turn' }).click();
      await expect(page.getByText(/answered|escalated|refused/)).toBeVisible({
        timeout: 10_000,
      });
    } finally {
      await cleanupOrg(seeded);
    }
  });

  test('has no accessibility violations on the AI pages', async ({ page }) => {
    test.setTimeout(120_000);
    const seeded = await openAi(page);

    try {
      const results = await audit(page);
      expect(results.violations, 'ai runs page').toEqual([]);

      await page.getByRole('tab', { name: 'Templates' }).click();
      const templateResults = await audit(page);
      expect(templateResults.violations, 'ai templates page').toEqual([]);
    } finally {
      await cleanupOrg(seeded);
    }
  });
});
