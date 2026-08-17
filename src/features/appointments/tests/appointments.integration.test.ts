// @vitest-environment node
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';

import { prisma } from '@/lib/prisma';
import { AppointmentsRepository } from '@/features/appointments/repositories/appointments.repository';
import { AppointmentsService } from '@/features/appointments/services/appointments.service';
import { computeSlots } from '@/features/appointments/services/availability';
import {
  expandRecurrence,
  parseRecurrenceRule,
} from '@/features/appointments/services/recurrence';

/**
 * Appointment Engine integration tests — real Postgres.
 *
 * The non-negotiable: org A never sees org B's appointments, and the database
 * exclusion constraint is the authoritative double-booking backstop (mapped to
 * a 409). Booking, cancel, reschedule, reminders, and recurring series are
 * exercised against the real database.
 */

type Fixture = {
  orgA: string;
  orgB: string;
  branchA: string;
  branchB: string;
  serviceId: string;
  resourceId: string;
  contactId: string;
};

let f: Fixture;
let suffix = 0;

async function makeOrg(orgLabel: string): Promise<string> {
  suffix += 1;
  const org = await prisma.organization.create({
    data: { name: orgLabel, slug: `appt-${orgLabel}-${Date.now()}-${suffix}` },
    select: { id: true },
  });
  return org.id;
}

async function makeBranch(orgId: string, label: string): Promise<string> {
  suffix += 1;
  const branch = await prisma.branch.create({
    data: {
      organizationId: orgId,
      name: label,
      slug: `appt-${label}-${Date.now()}-${suffix}`,
      timezone: 'Asia/Riyadh',
      isDefault: true,
    },
    select: { id: true },
  });
  return branch.id;
}

async function makeContact(orgId: string, branchId: string): Promise<string> {
  suffix += 1;
  const contact = await prisma.contact.create({
    data: {
      organizationId: orgId,
      branchId,
      phoneNumber: `+9665000${String(Math.floor(Math.random() * 100_000)).padStart(5, '0')}`,
      displayName: `Appt Contact ${suffix}`,
      hasConsent: true,
    },
    select: { id: true },
  });
  return contact.id;
}

/** A working service + resource with a daily 08:00–17:00 rule. */
async function seedWorkingFixture(): Promise<{
  serviceId: string;
  resourceId: string;
  contactId: string;
}> {
  const repo = AppointmentsRepository.forOrganization(f.orgA);
  const service = await repo.createService({
    branchId: f.branchA,
    name: 'Check-up',
    durationMinutes: 30,
    priceAmount: 150,
  });
  const resource = await repo.createResource({
    branchId: f.branchA,
    kind: 'staff',
    name: 'Dr. Test',
  });
  await repo.addAvailabilityRule({
    branchId: f.branchA,
    resourceId: resource.id,
    weekday: 0,
    startTime: '08:00',
    endTime: '17:00',
  });
  const contactId = await makeContact(f.orgA, f.branchA);
  return { serviceId: service.id, resourceId: resource.id, contactId };
}

beforeEach(async () => {
  f = {
    orgA: await makeOrg('A'),
    orgB: await makeOrg('B'),
    branchA: '',
    branchB: '',
    serviceId: '',
    resourceId: '',
    contactId: '',
  };
  f.branchA = await makeBranch(f.orgA, 'Main');
  f.branchB = await makeBranch(f.orgB, 'Main');
  const seeded = await seedWorkingFixture();
  f.serviceId = seeded.serviceId;
  f.resourceId = seeded.resourceId;
  f.contactId = seeded.contactId;
});

afterEach(async () => {
  const orgIds = [f.orgA, f.orgB];
  for (const orgId of orgIds) {
    await prisma.appointmentReminder.deleteMany({ where: { organizationId: orgId } });
    await prisma.appointment.deleteMany({ where: { organizationId: orgId } });
    await prisma.availabilityException.deleteMany({ where: { organizationId: orgId } });
    await prisma.availabilityRule.deleteMany({ where: { organizationId: orgId } });
    await prisma.resource.deleteMany({ where: { organizationId: orgId } });
    await prisma.service.deleteMany({ where: { organizationId: orgId } });
    await prisma.contact.deleteMany({ where: { organizationId: orgId } });
    await prisma.branch.deleteMany({ where: { organizationId: orgId } });
    await prisma.organization.deleteMany({ where: { id: orgId } });
  }
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('availability (AD-2)', () => {
  it('computes slots from rules and excludes booked ones', async () => {
    const repo = AppointmentsRepository.forOrganization(f.orgA);
    const slots = await computeSlots(repo, {
      branchId: f.branchA,
      serviceId: f.serviceId,
      durationMinutes: 30,
      date: '2026-08-16', // a Sunday
      timezone: 'Asia/Riyadh',
    });

    const total = slots.reduce((sum, r) => sum + r.slots.length, 0);
    expect(total).toBeGreaterThan(0);
    // 08:00–17:00 at 30min = 18 slots, minus nothing booked.
    expect(slots[0]?.slots).toHaveLength(18);
  });

  it('excludes an overlapping booked slot', async () => {
    const repo = AppointmentsRepository.forOrganization(f.orgA);
    const day = '2026-08-16';
    await repo.book({
      branchId: f.branchA,
      contactId: f.contactId,
      serviceId: f.serviceId,
      resourceId: f.resourceId,
      startsAt: new Date('2026-08-16T08:00:00.000Z'),
      endsAt: new Date('2026-08-16T08:30:00.000Z'),
      timezone: 'Asia/Riyadh',
    });

    const slots = await computeSlots(repo, {
      branchId: f.branchA,
      serviceId: f.serviceId,
      durationMinutes: 30,
      date: day,
      timezone: 'Asia/Riyadh',
    });
    const first = slots[0];
    expect(
      first?.slots.some(
        (s) => s.startsAt.getTime() === new Date('2026-08-16T08:00:00.000Z').getTime(),
      ),
    ).toBe(false);
  });
});

describe('booking (AD-3)', () => {
  it('books an appointment and schedules reminders', async () => {
    const service = AppointmentsService.forOrganization(f.orgA);
    // Reminders are only scheduled when their lead time is still in the
    // future, so the booking must always be ahead of "now". The fixture's
    // availability rule is a Sunday 08:00–17:00; book the nearest Sunday 09:00
    // UTC that has not passed.
    const now = new Date();
    const booked = new Date('2026-08-16T09:00:00.000Z');
    const startsAt =
      booked > now ? booked : new Date(booked.getTime() + 7 * 24 * 3_600_000);
    const appointment = await service.book({
      contactId: f.contactId,
      serviceId: f.serviceId,
      resourceId: f.resourceId,
      startsAt: startsAt.toISOString(),
      timezone: 'Asia/Riyadh',
    });

    expect(appointment.id).toBeTruthy();
    expect(appointment.status).toBe('booked');

    const reminders = await prisma.appointmentReminder.count({
      where: { appointmentId: appointment.id },
    });
    expect(reminders).toBeGreaterThan(0);
  });

  it('rejects a double booking with a conflict (the DB constraint backstops)', async () => {
    const service = AppointmentsService.forOrganization(f.orgA);
    const startsAt = '2026-08-16T10:00:00.000Z';
    await service.book({
      contactId: f.contactId,
      serviceId: f.serviceId,
      resourceId: f.resourceId,
      startsAt,
      timezone: 'Asia/Riyadh',
    });

    // Direct repository insert bypasses the availability check — the exclusion
    // constraint must still reject the overlap.
    const repo = AppointmentsRepository.forOrganization(f.orgA);
    await expect(
      repo.book({
        branchId: f.branchA,
        contactId: f.contactId,
        serviceId: f.serviceId,
        resourceId: f.resourceId,
        startsAt: new Date('2026-08-16T10:00:00.000Z'),
        endsAt: new Date('2026-08-16T10:30:00.000Z'),
        timezone: 'Asia/Riyadh',
      }),
    ).rejects.toThrow(/already booked|Conflict/);
  });

  it('cancels an appointment and cancels its reminders', async () => {
    const service = AppointmentsService.forOrganization(f.orgA);
    const appointment = await service.book({
      contactId: f.contactId,
      serviceId: f.serviceId,
      resourceId: f.resourceId,
      startsAt: '2026-08-16T11:00:00.000Z',
      timezone: 'Asia/Riyadh',
    });

    await service.cancel(appointment.id);

    const updated = await service.getAppointment(appointment.id);
    expect(updated.status).toBe('cancelled');

    const activeReminders = await prisma.appointmentReminder.count({
      where: { appointmentId: appointment.id, status: { not: 'cancelled' } },
    });
    expect(activeReminders).toBe(0);
  });

  it('reschedules by linking a replacement to the original', async () => {
    const service = AppointmentsService.forOrganization(f.orgA);
    const original = await service.book({
      contactId: f.contactId,
      serviceId: f.serviceId,
      resourceId: f.resourceId,
      startsAt: '2026-08-16T12:00:00.000Z',
      timezone: 'Asia/Riyadh',
    });

    const replacement = await service.reschedule(original.id, '2026-08-16T13:00:00.000Z');

    const replacementFromDb = await service.getAppointment(replacement.id);
    expect(replacementFromDb.rescheduledFromId).toBe(original.id);
    const originalNow = await service.getAppointment(original.id);
    expect(originalNow.status).toBe('rescheduled');
  });
});

describe('org isolation', () => {
  it('org A never sees org B appointments', async () => {
    const service = AppointmentsService.forOrganization(f.orgA);
    await service.book({
      contactId: f.contactId,
      serviceId: f.serviceId,
      resourceId: f.resourceId,
      startsAt: '2026-08-16T14:00:00.000Z',
      timezone: 'Asia/Riyadh',
    });

    const bRepo = AppointmentsRepository.forOrganization(f.orgB);
    const bAppointments = await bRepo.listAppointmentsInRange(
      f.branchB,
      new Date('2026-08-16T00:00:00.000Z'),
      new Date('2026-08-16T23:59:59.999Z'),
    );
    expect(bAppointments).toHaveLength(0);
  });
});

describe('recurrence (AD-4)', () => {
  it('parses and expands a weekly rule', () => {
    const rule = parseRecurrenceRule('FREQ=WEEKLY;INTERVAL=1;COUNT=4');
    const occurrences = expandRecurrence(rule, new Date('2026-08-16T09:00:00.000Z'));
    expect(occurrences).toHaveLength(4);
    const first = occurrences[0] as Date;
    const second = occurrences[1] as Date;
    expect(second.getTime() - first.getTime()).toBe(7 * 86_400_000);
  });

  it('books a recurring series under the parent', async () => {
    const service = AppointmentsService.forOrganization(f.orgA);
    const appointment = await service.book({
      contactId: f.contactId,
      serviceId: f.serviceId,
      resourceId: f.resourceId,
      startsAt: '2026-08-16T15:00:00.000Z',
      timezone: 'Asia/Riyadh',
      recurrenceRule: 'FREQ=WEEKLY;COUNT=3',
    });

    const series = await prisma.appointment.findMany({
      where: { contactId: f.contactId, status: 'booked' },
    });
    // Parent + 2 weekly children.
    expect(series.length).toBe(3);
    expect(series.some((a) => a.id === appointment.id)).toBe(true);
  });
});
