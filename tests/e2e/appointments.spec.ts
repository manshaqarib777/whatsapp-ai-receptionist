import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

import { prisma } from '@/lib/prisma';

/**
 * Milestone 9 E2E — the appointment engine against a production build.
 *
 * Each run creates its own user + org, seeds a service, resource, availability
 * rule, contact, and an upcoming appointment (so the calendar has something to
 * render), and cleans up afterwards. The same hermetic discipline as
 * dashboard.spec.ts.
 */

const STRONG_PASSWORD = 'correct-horse-battery-staple';

function uniqueEmail(label: string): string {
  return `e2e-appt-${label}-${Date.now()}-${Math.floor(Math.random() * 10_000)}@test.local`;
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
  serviceId: string;
  resourceId: string;
};

/**
 * Seeds the org the API created with a service + resource + rule + contact and
 * an upcoming confirmed appointment, so the calendar renders real data.
 */
async function seedAppointmentOrg(
  email: string,
  organizationId: string,
): Promise<SeededOrg> {
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
        displayName: 'Appt Contact',
        hasConsent: true,
      },
      select: { id: true },
    });

    const service = await client.service.create({
      data: {
        organizationId,
        branchId: branch.id,
        name: 'E2E Check-up',
        durationMinutes: 30,
        priceAmount: 150,
        priceCurrency: 'SAR',
      },
      select: { id: true },
    });

    const resource = await client.resource.create({
      data: {
        organizationId,
        branchId: branch.id,
        kind: 'staff',
        name: 'E2E Clinician',
      },
      select: { id: true },
    });

    // Sunday–Thursday, 08:00–17:00 — the Saudi working week.
    for (const weekday of [0, 1, 2, 3, 4]) {
      await client.availabilityRule.create({
        data: {
          organizationId,
          resourceId: resource.id,
          weekday,
          startTime: new Date('1970-01-01T08:00:00.000Z'),
          endTime: new Date('1970-01-01T17:00:00.000Z'),
        },
      });
    }

    const tomorrow = new Date(Date.now() + 86_400_000);
    await client.appointment.create({
      data: {
        organizationId,
        branchId: branch.id,
        contactId: contact.id,
        serviceId: service.id,
        resourceId: resource.id,
        startsAt: new Date(tomorrow.setUTCHours(9, 0, 0, 0)),
        endsAt: new Date(tomorrow.getTime() + 30 * 60_000),
        timezone: 'Asia/Riyadh',
        status: 'confirmed',
      },
    });

    return {
      organizationId,
      branchId: branch.id,
      contactId: contact.id,
      serviceId: service.id,
      resourceId: resource.id,
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
    await client.appointmentReminder.deleteMany({
      where: { organizationId: seeded.organizationId },
    });
    await client.appointment.deleteMany({
      where: { organizationId: seeded.organizationId },
    });
    await client.availabilityException.deleteMany({
      where: { organizationId: seeded.organizationId },
    });
    await client.availabilityRule.deleteMany({
      where: { organizationId: seeded.organizationId },
    });
    await client.service.deleteMany({
      where: { organizationId: seeded.organizationId },
    });
    await client.resource.deleteMany({
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

async function openAppointments(page: Page): Promise<SeededOrg> {
  const email = uniqueEmail('main');

  const signup = await page.request.post('/api/auth/sign-up/email', {
    data: { name: 'E2E Appointments', email, password: STRONG_PASSWORD },
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
      name: `E2E Appointments ${Date.now()} ${Math.floor(Math.random() * 10_000)}`,
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

  const seeded = await seedAppointmentOrg(email, organizationId);

  await page.goto('/appointments');
  await expect(page.getByRole('heading', { name: 'Appointments' })).toBeVisible();

  return seeded;
}

test.describe('appointments', () => {
  test('renders the seeded appointment on the calendar', async ({ page }) => {
    const seeded = await openAppointments(page);

    try {
      await expect(page.getByText('confirmed').first()).toBeVisible();
      await expect(page.getByText(/Asia\/Riyadh/).first()).toBeVisible();
    } finally {
      await cleanupOrg(seeded);
    }
  });

  test('the services tab lists the seeded service', async ({ page }) => {
    const seeded = await openAppointments(page);

    try {
      await page.getByRole('tab', { name: 'Services & resources' }).click();
      await expect(page.getByText('E2E Check-up')).toBeVisible();
      await expect(page.getByText('30 min')).toBeVisible();
      await expect(page.getByText(/150 SAR/)).toBeVisible();
    } finally {
      await cleanupOrg(seeded);
    }
  });

  test('books an appointment from an open slot', async ({ page }) => {
    const seeded = await openAppointments(page);

    try {
      await page.getByRole('tab', { name: 'Book' }).click();

      // Choose the seeded service.
      await page.getByRole('combobox', { name: 'Service' }).click();
      await page.getByRole('option', { name: /E2E Check-up/ }).click();

      // A future Sunday — the seeded rule covers weekdays 0–4.
      const nextSunday = nextWeekday(0);
      await page.getByLabel('Date').fill(nextSunday);

      await expect(page.getByText(/Resource /).first()).toBeVisible();

      // Pick the first slot and book with the seeded contact. Slot buttons show
      // a localised time ("9:00 AM"), so match any time-looking button.
      await page
        .locator('button')
        .filter({ hasText: /^\d{1,2}:\d{2}\s*(AM|PM)$/ })
        .first()
        .click();
      await page.getByLabel('Contact id').fill(seeded.contactId);
      await page.getByRole('button', { name: 'Book appointment' }).click();

      await expect(page.getByText('Booked.')).toBeVisible();
    } finally {
      await cleanupOrg(seeded);
    }
  });

  test('has no accessibility violations on the appointment pages', async ({ page }) => {
    test.setTimeout(AUDIT_TIMEOUT_MS);
    const seeded = await openAppointments(page);

    try {
      await page.emulateMedia({ reducedMotion: 'reduce' });
      const results = await audit(page);
      expect(results.violations).toEqual([]);

      await page.getByRole('tab', { name: 'Book' }).click();
      const bookResults = await audit(page);
      expect(bookResults.violations).toEqual([]);
    } finally {
      await cleanupOrg(seeded);
    }
  });
});

/** The ISO date (YYYY-MM-DD) of the next weekday matching `day` (0 = Sunday). */
function nextWeekday(day: number): string {
  const date = new Date();
  const today = date.getUTCDay();
  const daysUntil = (day - today + 7) % 7;
  date.setUTCDate(date.getUTCDate() + (daysUntil === 0 ? 7 : daysUntil));
  return date.toISOString().slice(0, 10);
}
