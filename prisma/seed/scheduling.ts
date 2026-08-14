import type { PrismaClient } from '@prisma/client';

import { SEED_NOW, daysFromNow, seedId } from './support';
import type { SeededContacts } from './contacts';
import type { SeededTenants } from './tenants';

/**
 * Services, resources, availability, and appointments.
 *
 * DATABASE_RULES.md → Seed Data: "Appointments past, upcoming, cancelled,
 * rescheduled, recurring, across timezones."
 *
 * Every appointment slot is deliberately non-overlapping per resource. The
 * `excl_appointments_resource_overlap` constraint is real, so a careless seed does not
 * produce bad data — it fails to insert. Slots are laid out on a grid for that reason.
 */

const SERVICES = [
  { name: 'Routine check-up', minutes: 30, price: '150.0000' },
  { name: 'Scale and polish', minutes: 45, price: '320.0000' },
  { name: 'Root canal — first visit', minutes: 90, price: '1450.0000' },
  { name: 'Orthodontic consultation', minutes: 60, price: '250.0000' },
] as const;

export type SeededScheduling = Awaited<ReturnType<typeof seedScheduling>>;

export async function seedScheduling(
  prisma: PrismaClient,
  tenants: SeededTenants,
  contacts: SeededContacts,
) {
  const services: string[] = [];

  for (const [index, service] of SERVICES.entries()) {
    const row = await prisma.service.create({
      data: {
        id: seedId('service', index + 1),
        organizationId: tenants.northwind.id,
        branchId: index < 3 ? tenants.northwind.riyadh : tenants.northwind.jeddah,
        name: service.name,
        durationMinutes: service.minutes,
        priceAmount: service.price,
        priceCurrency: 'SAR',
        createdAt: SEED_NOW,
        updatedAt: SEED_NOW,
      },
    });
    services.push(row.id);
  }

  // A dentist, a hygienist, and a room. The room is why `resources.user_id` is
  // nullable — a treatment room has no login, and a schema that assumed every
  // bookable thing is a person would have no way to represent it.
  const resources: string[] = [];
  const resourceSpecs = [
    { kind: 'staff' as const, name: 'Dr. Amina Farouk', userId: tenants.staff.member },
    { kind: 'staff' as const, name: 'Hygienist — Rob Neale', userId: null },
    { kind: 'room' as const, name: 'Surgery 2', userId: null },
  ];

  for (const [index, spec] of resourceSpecs.entries()) {
    const row = await prisma.resource.create({
      data: {
        id: seedId('resource', index + 1),
        organizationId: tenants.northwind.id,
        branchId: tenants.northwind.riyadh,
        userId: spec.userId,
        kind: spec.kind,
        name: spec.name,
        createdAt: SEED_NOW,
        updatedAt: SEED_NOW,
      },
    });
    resources.push(row.id);

    // Sunday–Thursday is the Saudi working week. Encoding Monday–Friday here would be
    // a quiet localisation bug that only shows up as an empty calendar.
    for (const weekday of [0, 1, 2, 3, 4]) {
      await prisma.availabilityRule.create({
        data: {
          id: seedId(`availability-${index}`, weekday + 1),
          organizationId: tenants.northwind.id,
          resourceId: row.id,
          weekday,
          startTime: new Date('1970-01-01T08:00:00.000Z'),
          endTime: new Date('1970-01-01T17:00:00.000Z'),
          createdAt: SEED_NOW,
          updatedAt: SEED_NOW,
        },
      });
    }
  }

  await prisma.availabilityException.create({
    data: {
      id: seedId('availability-exception', 1),
      organizationId: tenants.northwind.id,
      resourceId: resources[0] as string,
      startsAt: daysFromNow(9, 0),
      endsAt: daysFromNow(12, 0),
      reason: 'Annual leave',
      createdAt: SEED_NOW,
      updatedAt: SEED_NOW,
    },
  });

  const appointments = await seedAppointments(
    prisma,
    tenants,
    contacts,
    services,
    resources,
  );

  // Reminder rows for the upcoming confirmed appointment (24h and 1h before),
  // so the M9 reminder worker has due work and the status column is real.
  const upcoming = await prisma.appointment.findFirst({
    where: {
      organizationId: tenants.northwind.id,
      status: 'confirmed',
      startsAt: { gt: SEED_NOW },
    },
    orderBy: { startsAt: 'asc' },
    select: { id: true, startsAt: true },
  });
  if (upcoming) {
    for (const [index, leadHours] of [24, 1].entries()) {
      await prisma.appointmentReminder.create({
        data: {
          id: seedId('reminder', index + 1),
          organizationId: tenants.northwind.id,
          appointmentId: upcoming.id,
          sendAt: new Date(upcoming.startsAt.getTime() - leadHours * 3_600_000),
          channel: 'whatsapp',
          status: 'scheduled',
          createdAt: SEED_NOW,
          updatedAt: SEED_NOW,
        },
      });
    }
  }

  return { services, resources, appointments };
}

type AppointmentPlan = {
  dayOffset: number;
  hour: number;
  status: 'booked' | 'confirmed' | 'cancelled' | 'completed' | 'no_show';
  resourceIndex: number;
};

/**
 * Laid out on a per-resource grid so no two live appointments collide. Cancelled rows
 * are excluded from the exclusion constraint by its WHERE clause, so they may sit on
 * top of a live slot — which is realistic, and worth having in the data.
 */
const PLANS: readonly AppointmentPlan[] = [
  { dayOffset: -21, hour: 9, status: 'completed', resourceIndex: 0 },
  { dayOffset: -14, hour: 11, status: 'completed', resourceIndex: 1 },
  { dayOffset: -7, hour: 13, status: 'no_show', resourceIndex: 0 },
  { dayOffset: -3, hour: 10, status: 'cancelled', resourceIndex: 2 },
  { dayOffset: 1, hour: 9, status: 'confirmed', resourceIndex: 0 },
  { dayOffset: 1, hour: 11, status: 'booked', resourceIndex: 1 },
  { dayOffset: 2, hour: 14, status: 'booked', resourceIndex: 2 },
  { dayOffset: 5, hour: 10, status: 'booked', resourceIndex: 0 },
];

async function seedAppointments(
  prisma: PrismaClient,
  tenants: SeededTenants,
  contacts: SeededContacts,
  services: string[],
  resources: string[],
): Promise<number> {
  let created = 0;

  for (const [index, plan] of PLANS.entries()) {
    const contactId = contacts.riyadhContacts[index % contacts.riyadhContacts.length];
    if (!contactId) continue;

    created += 1;
    await prisma.appointment.create({
      data: {
        id: seedId('appointment', created),
        organizationId: tenants.northwind.id,
        branchId: tenants.northwind.riyadh,
        contactId,
        serviceId: services[index % 3] as string,
        resourceId: resources[plan.resourceIndex] as string,
        startsAt: daysFromNow(plan.dayOffset, plan.hour),
        endsAt: daysFromNow(plan.dayOffset, plan.hour, 45),
        timezone: 'Asia/Riyadh',
        status: plan.status,
        createdAt: daysFromNow(plan.dayOffset - 4),
        updatedAt: SEED_NOW,
      },
    });
  }

  // A rescheduled pair: the original is cancelled and the replacement points back at
  // it, so the history is navigable rather than inferred from timestamps.
  const originalId = seedId('appointment', 90);
  await prisma.appointment.create({
    data: {
      id: originalId,
      organizationId: tenants.northwind.id,
      branchId: tenants.northwind.riyadh,
      contactId: contacts.riyadhContacts[0] as string,
      serviceId: services[0] as string,
      resourceId: resources[1] as string,
      startsAt: daysFromNow(3, 9),
      endsAt: daysFromNow(3, 9, 30),
      timezone: 'Asia/Riyadh',
      status: 'cancelled',
      createdAt: daysFromNow(-2),
      updatedAt: SEED_NOW,
    },
  });

  await prisma.appointment.create({
    data: {
      id: seedId('appointment', 91),
      organizationId: tenants.northwind.id,
      branchId: tenants.northwind.riyadh,
      contactId: contacts.riyadhContacts[0] as string,
      serviceId: services[0] as string,
      resourceId: resources[1] as string,
      startsAt: daysFromNow(4, 15),
      endsAt: daysFromNow(4, 15, 30),
      timezone: 'Asia/Riyadh',
      status: 'confirmed',
      rescheduledFromId: originalId,
      createdAt: daysFromNow(-2),
      updatedAt: SEED_NOW,
    },
  });

  // A weekly recurring series: a parent carrying the RRULE plus two materialised
  // occurrences. Milestone 9 expands the rest; the shape has to exist now so it can.
  const parentId = seedId('appointment', 95);
  await prisma.appointment.create({
    data: {
      id: parentId,
      organizationId: tenants.northwind.id,
      branchId: tenants.northwind.riyadh,
      contactId: contacts.riyadhContacts[1] as string,
      serviceId: services[1] as string,
      resourceId: resources[2] as string,
      startsAt: daysFromNow(7, 8),
      endsAt: daysFromNow(7, 8, 45),
      timezone: 'Asia/Riyadh',
      status: 'confirmed',
      recurrenceRule: 'FREQ=WEEKLY;BYDAY=SU;COUNT=6',
      createdAt: SEED_NOW,
      updatedAt: SEED_NOW,
    },
  });

  for (const [offset, week] of [14, 21].entries()) {
    await prisma.appointment.create({
      data: {
        id: seedId('appointment', 96 + offset),
        organizationId: tenants.northwind.id,
        branchId: tenants.northwind.riyadh,
        contactId: contacts.riyadhContacts[1] as string,
        serviceId: services[1] as string,
        resourceId: resources[2] as string,
        startsAt: daysFromNow(week, 8),
        endsAt: daysFromNow(week, 8, 45),
        timezone: 'Asia/Riyadh',
        status: 'booked',
        recurrenceParentId: parentId,
        createdAt: SEED_NOW,
        updatedAt: SEED_NOW,
      },
    });
  }

  // Tenant 2 books in Europe/London. Two tenants in one zone would hide any bug where
  // the branch timezone is ignored in favour of the server's.
  await prisma.appointment.create({
    data: {
      id: seedId('appointment', 99),
      organizationId: tenants.beacon.id,
      branchId: tenants.beacon.main,
      contactId: contacts.beaconContacts[0] as string,
      serviceId: await beaconService(prisma, tenants),
      resourceId: await beaconResource(prisma, tenants),
      startsAt: daysFromNow(2, 9),
      endsAt: daysFromNow(2, 10),
      timezone: 'Europe/London',
      status: 'confirmed',
      createdAt: SEED_NOW,
      updatedAt: SEED_NOW,
    },
  });

  return created + 5;
}

async function beaconService(
  prisma: PrismaClient,
  tenants: SeededTenants,
): Promise<string> {
  const row = await prisma.service.create({
    data: {
      id: seedId('beacon-service', 1),
      organizationId: tenants.beacon.id,
      branchId: tenants.beacon.main,
      name: 'Full vehicle inspection',
      durationMinutes: 60,
      priceAmount: '89.0000',
      // A second currency, so any hardcoded "SAR" in a formatter shows up immediately.
      priceCurrency: 'GBP',
      createdAt: SEED_NOW,
      updatedAt: SEED_NOW,
    },
  });
  return row.id;
}

async function beaconResource(
  prisma: PrismaClient,
  tenants: SeededTenants,
): Promise<string> {
  const row = await prisma.resource.create({
    data: {
      id: seedId('beacon-resource', 1),
      organizationId: tenants.beacon.id,
      branchId: tenants.beacon.main,
      kind: 'equipment',
      name: 'Ramp 1',
      createdAt: SEED_NOW,
      updatedAt: SEED_NOW,
    },
  });
  return row.id;
}
