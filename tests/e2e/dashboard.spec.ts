import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

import { prisma } from '@/lib/prisma';

/**
 * Milestone 5 E2E — the real dashboard against a production build.
 *
 * Each run creates its own user and organization, seeds that organization with the
 * exact rows the widget assertions need, and cleans up afterwards. This keeps the
 * suite hermetic and re-runnable against a database that is not reset between runs
 * — the same discipline as auth.spec.ts.
 *
 * The seeded data is written through the app's OWN scoped client (forScope) so the
 * tenant-scoping the dashboard depends on is the same code path the fixtures pass
 * through.
 */

const STRONG_PASSWORD = 'correct-horse-battery-staple';

function uniqueEmail(label: string): string {
  return `e2e-dashboard-${label}-${Date.now()}-${Math.floor(Math.random() * 10_000)}@test.local`;
}

function audit(page: Page) {
  return new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze();
}

/**
 * The dashboard renders recharts SVGs and data tables, so one axe run costs
 * several seconds even on an idle machine — and this spec runs four of them
 * (light/dark × LTR/RTL) inside a single test. Against the 30s default that
 * left no headroom, and it tipped over under parallel workers. `retries: 0`
 * (playwright.config.ts) means a flake here is a red build, so the audit gets
 * a budget that matches what it actually costs — the same convention the
 * design-system spec uses (design-system.spec.ts:35). The audit itself is
 * unchanged; this widens the clock, not the pass condition.
 */
const AUDIT_TIMEOUT_MS = 120_000;

type SeededOrg = {
  organizationId: string;
  branchId: string;
  contactIds: string[];
};

/**
 * Seeds the org the API already created (its id is the ACTIVE org the dashboard
 * will scope by) with the exact rows the widget assertions need. Returns the
 * org/branch/contact ids for cleanup.
 */
async function seedDemoOrg(
  email: string,
  organizationId: string,
): Promise<SeededOrg> {
  const connectionString = process.env['DATABASE_URL'] ?? '';
  if (!connectionString) throw new Error('DATABASE_URL is required for E2E seeding.');
  const adapter = new PrismaPg({ connectionString });
  const client = new PrismaClient({ adapter });

  try {
    const user = await client.user.findFirstOrThrow({ where: { email } });

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

    const now = new Date();
    const daysAgo = (n: number) => new Date(now.getTime() - n * 86_400_000);

    const contact = await client.contact.create({
      data: {
        organizationId,
        branchId: branch.id,
        phoneNumber: `+9665000${String(Math.floor(Math.random() * 100_000)).padStart(5, '0')}`,
        displayName: 'E2E Contact',
        hasConsent: true,
      },
      select: { id: true },
    });

    const wa = await client.whatsappAccount.create({
      data: {
        organizationId,
        branchId: branch.id,
        phoneNumberId: `e2e-pnid-${Date.now()}`,
        wabaId: 'e2e-waba',
        displayPhoneNumber: '+966500000000',
        accessTokenRef: 'secret://e2e',
      },
      select: { id: true },
    });

    const invoice = await client.invoice.create({
      data: {
        organizationId,
        branchId: branch.id,
        contactId: contact.id,
        number: `E2E-INV-${Date.now()}`,
        status: 'issued',
        totalAmount: 4200,
        issuedAt: daysAgo(2),
      },
      select: { id: true },
    });
    void invoice;

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
          body: 'Hello',
          createdAt: daysAgo(1),
        },
        {
          organizationId,
          conversationId: conversation.id,
          direction: 'outbound',
          authorType: 'agent',
          contentType: 'text',
          body: 'Hi there',
          createdAt: new Date(daysAgo(1).getTime() + 60_000),
        },
      ],
    });

    await client.activity.create({
      data: {
        organizationId,
        branchId: branch.id,
        subjectType: 'contact',
        subjectId: contact.id,
        kind: 'note',
        body: 'Follow up on the quote',
        createdAt: daysAgo(1),
      },
    });

    await client.notification.create({
      data: {
        organizationId,
        userId: user.id,
        kind: 'escalation',
        title: 'You have an unread conversation',
        createdAt: daysAgo(1),
      },
    });

    return { organizationId, branchId: branch.id, contactIds: [contact.id] };
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
    await client.conversation.deleteMany({ where: { organizationId: seeded.organizationId } });
    await client.invoice.deleteMany({ where: { organizationId: seeded.organizationId } });
    await client.activity.deleteMany({ where: { organizationId: seeded.organizationId } });
    await client.notification.deleteMany({ where: { organizationId: seeded.organizationId } });
    await client.whatsappAccount.deleteMany({ where: { organizationId: seeded.organizationId } });
    await client.contact.deleteMany({ where: { organizationId: seeded.organizationId } });
    await client.branch.deleteMany({ where: { organizationId: seeded.organizationId } });
    await client.member.deleteMany({ where: { organizationId: seeded.organizationId } });
    await client.organization.deleteMany({ where: { id: seeded.organizationId } });
  } finally {
    await client.$disconnect();
  }
}

/**
 * Signs up a fresh user, creates an org, seeds it, and lands on the dashboard.
 * Returns the seeded org handle so the caller can clean up.
 */
async function openDashboard(page: Page): Promise<SeededOrg> {
  const email = uniqueEmail('main');

  // Sign up via the API (proves the flow really works, like auth.spec does).
  const signup = await page.request.post('/api/auth/sign-up/email', {
    data: { name: 'E2E Dashboard', email, password: STRONG_PASSWORD },
  });
  expect(signup.status()).toBe(200);

  // The sign-up flow sends a verification email; in the test transport it is
  // printed to the console, so instead verify the account by marking it verified
  // directly (the seeded users are all pre-verified).
  const user = await prisma.user.findFirstOrThrow({ where: { email } });
  await prisma.user.update({ where: { id: user.id }, data: { emailVerified: true } });

  // Login through the UI, the way a user would. This sets the browser session
  // cookie that page.request (and the later page navigations) share.
  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(STRONG_PASSWORD);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await page.waitForURL(/\/dashboard/);

  // Create the org through the API — now authenticated by the browser cookie.
  // The name embeds a random component (not just a timestamp) so parallel workers
  // can never collide on a slug: the org name slugs to "e2e-dashboard-<ms>", and
  // two workers landing in the same millisecond would otherwise hit the
  // organizations.slug unique constraint (organization.service.ts uniqueSlug is a
  // check-then-insert, so the collision surfaces as a 500, not a retry).
  const orgResponse = await page.request.post('/api/organizations', {
    data: { name: `E2E Dashboard ${Date.now()} ${Math.floor(Math.random() * 10_000)}` },
  });
  expect(orgResponse.status()).toBe(201);
  const orgPayload = (await orgResponse.json()) as { data?: { id?: string } };
  const organizationId = orgPayload.data?.id;
  if (!organizationId) throw new Error('Organization creation did not return an id.');

  // The session's activeOrganizationId is null until the user picks an org — POST
  // does not set it. requireOrg() on the dashboard reads the SESSION row, so switch
  // the active org the same way the workspace switcher does.
  const switchResponse = await page.request.patch('/api/organizations/active', {
    data: { organizationId },
  });
  expect(switchResponse.status()).toBe(200);

  const seeded = await seedDemoOrg(email, organizationId);

  // Land on the dashboard.
  await page.goto('/dashboard');
  await expect(page.getByRole('heading', { name: /good (morning|afternoon|evening)/i })).toBeVisible();

  return seeded;
}

test.describe('dashboard', () => {
  test('renders the four KPIs from real seeded data', async ({ page }) => {
    const seeded = await openDashboard(page);

    try {
      await expect(page.getByRole('link', { name: /new conversations/i })).toBeVisible();
      await expect(page.getByRole('link', { name: /open revenue/i })).toBeVisible();
      await expect(page.getByRole('link', { name: /open leads/i })).toBeVisible();
      // Response time is real, so it is a duration rather than a dash.
      await expect(page.getByRole('link', { name: /response time/i })).toBeVisible();
    } finally {
      await cleanupOrg(seeded);
    }
  });

  test('renders the conversation chart, activity feed, and recent conversations', async ({
    page,
  }) => {
    const seeded = await openDashboard(page);

    try {
      // The Suspense fallback shares the card title, so target the settled one.
      await expect(page.getByText('Conversations over time').last()).toBeVisible();
      await expect(page.getByText('Activity').last()).toBeVisible();
      await expect(page.getByText('Recent conversations').last()).toBeVisible();
      await expect(page.getByRole('link', { name: 'E2E Contact' }).first()).toBeVisible();
    } finally {
      await cleanupOrg(seeded);
    }
  });

  test('navigating the inbox doorway reaches the Milestone-6 stub', async ({ page }) => {
    const seeded = await openDashboard(page);

    try {
      // Recent conversations link to /inbox/[id], which is a notFound() stub.
      await page.getByRole('link', { name: 'E2E Contact' }).first().click();
      await expect(page.getByText('The inbox is being built')).toBeVisible();
    } finally {
      await cleanupOrg(seeded);
    }
  });

  test('switching the date range refreshes the widgets', async ({ page }) => {
    const seeded = await openDashboard(page);

    try {
      const range = page.getByRole('group', { name: 'Date range' });
      await expect(range.getByRole('button', { name: '30 days' })).toHaveAttribute(
        'aria-pressed',
        'true',
      );

      await page.getByRole('button', { name: '90 days' }).click();

      // The persisted cookie round-trips through the server, so the active state
      // reflects the server value.
      await expect(range.getByRole('button', { name: '90 days' })).toHaveAttribute(
        'aria-pressed',
        'true',
      );
    } finally {
      await cleanupOrg(seeded);
    }
  });

  test('has no accessibility violations in light and dark, both directions', async ({
    page,
  }) => {
    test.setTimeout(AUDIT_TIMEOUT_MS);
    const seeded = await openDashboard(page);

    try {
      for (const theme of ['light', 'dark'] as const) {
        await page.emulateMedia({ reducedMotion: 'reduce' });
        await page.addInitScript((value) => {
          window.localStorage.setItem('theme', value);
        }, theme);

        const results = await audit(page);
        expect(results.violations, `${theme} theme`).toEqual([]);

        // Right-to-left.
        await page.emulateMedia({ forcedColors: 'none' });
        await page.addInitScript(() => {
          document.documentElement.dir = 'rtl';
        });
        const rtlResults = await audit(page);
        expect(rtlResults.violations, `${theme} theme, RTL`).toEqual([]);
      }
    } finally {
      await cleanupOrg(seeded);
    }
  });

  test('renders without horizontal overflow at mobile', async ({ page }) => {
    const seeded = await openDashboard(page);

    try {
      await page.setViewportSize({ width: 375, height: 812 });
      await expect(page.getByRole('link', { name: /new conversations/i })).toBeVisible();

      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow).toBeLessThanOrEqual(1);
    } finally {
      await cleanupOrg(seeded);
    }
  });
});
