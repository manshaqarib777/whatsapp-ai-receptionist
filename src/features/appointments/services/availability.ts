import type { AppointmentsRepository } from '@/features/appointments/repositories/appointments.repository';
import {
  addLocalDays,
  weekdayForLocalDate,
  zonedDateTimeToUtc,
} from '@/features/appointments/services/timezone';

/**
 * Availability computation — Milestone 9 (AD-2).
 *
 * Weekly rules + exceptions define a resource's open slots; existing
 * non-cancelled appointments subtract from them. Slots are computed in the
 * appointment timezone then returned as UTC instants for storage.
 *
 * The computation is deliberately simple and bounded: a day's slots for a
 * resource, on a grid of the service's duration. Recurring expansion and
 * timezone DST math live in the service that calls this.
 */

export type Slot = {
  startsAt: Date;
  endsAt: Date;
};

export type AvailabilityInput = {
  branchId: string;
  serviceId: string;
  durationMinutes: number;
  resourceId?: string;
  date: string; // "YYYY-MM-DD" in the branch timezone
  timezone: string;
};

/**
 * Computes open slots for one date. `resourceId` optional — when omitted, slots
 * from every resource are returned with the resource id.
 */
export async function computeSlots(
  repo: AppointmentsRepository,
  input: AvailabilityInput,
): Promise<{ resourceId: string; slots: Slot[] }[]> {
  const resources = await repo.listResources(input.branchId);
  const filtered = input.resourceId
    ? resources.filter((r) => r.id === input.resourceId)
    : resources;

  const dayStartUtc = zonedDateTimeToUtc(input.date, '00:00', input.timezone);
  const dayEndUtc = zonedDateTimeToUtc(
    addLocalDays(input.date, 1),
    '00:00',
    input.timezone,
  );

  const booked = await repo.listAppointmentsInRange(
    input.branchId,
    dayStartUtc,
    dayEndUtc,
  );
  const exceptions = await repo.listExceptions(dayStartUtc, dayEndUtc);

  const busy = new Map<string, Slot[]>();
  for (const appointment of booked) {
    const list = busy.get(appointment.resourceId) ?? [];
    list.push({ startsAt: appointment.startsAt, endsAt: appointment.endsAt });
    busy.set(appointment.resourceId, list);
  }
  for (const exception of exceptions) {
    const list = busy.get(exception.resourceId) ?? [];
    list.push({ startsAt: exception.startsAt, endsAt: exception.endsAt });
    busy.set(exception.resourceId, list);
  }

  const results: { resourceId: string; slots: Slot[] }[] = [];

  for (const resource of filtered) {
    const slots = slotsForResource(
      resource.rules,
      resource.id,
      input.durationMinutes,
      input.date,
      input.timezone,
      busy.get(resource.id) ?? [],
    );
    results.push({ resourceId: resource.id, slots });
  }

  return results;
}

function slotsForResource(
  rules: { weekday: number; startTime: string; endTime: string }[],
  resourceId: string,
  durationMinutes: number,
  localDate: string,
  timezone: string,
  busy: Slot[],
): Slot[] {
  const weekday = weekdayForLocalDate(localDate);
  const rule = rules.find((r) => r.weekday === weekday);
  if (!rule) return [];

  const [startHour, startMinute] = rule.startTime.split(':').map(Number);
  const [endHour, endMinute] = rule.endTime.split(':').map(Number);

  const openStart = zonedDateTimeToUtc(
    localDate,
    `${String(startHour ?? 0).padStart(2, '0')}:${String(startMinute ?? 0).padStart(2, '0')}`,
    timezone,
  );
  const openEnd = zonedDateTimeToUtc(
    localDate,
    `${String(endHour ?? 0).padStart(2, '0')}:${String(endMinute ?? 0).padStart(2, '0')}`,
    timezone,
  );

  const slots: Slot[] = [];
  const stepMs = durationMinutes * 60_000;
  for (
    let cursor = openStart.getTime();
    cursor + stepMs <= openEnd.getTime();
    cursor += stepMs
  ) {
    const start = new Date(cursor);
    const end = new Date(cursor + stepMs);
    if (isFree(start, end, busy)) {
      slots.push({ startsAt: start, endsAt: end });
    }
  }

  void resourceId;
  return slots;
}

function isFree(start: Date, end: Date, busy: Slot[]): boolean {
  return !busy.some((b) => start < b.endsAt && end > b.startsAt);
}
