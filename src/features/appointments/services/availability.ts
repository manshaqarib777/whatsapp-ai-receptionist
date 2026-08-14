import type { AppointmentsRepository } from '@/features/appointments/repositories/appointments.repository';

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

  // Parse the date in the branch timezone (approximated by treating the date
  // string as UTC-local-to-zone — full IANA math lands with M9's timezone util).
  const dayStartUtc = new Date(`${input.date}T00:00:00.000Z`);
  const dayEndUtc = new Date(`${input.date}T23:59:59.999Z`);

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
      dayStartUtc,
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
  dayStartUtc: Date,
  busy: Slot[],
): Slot[] {
  const weekday = dayStartUtc.getUTCDay();
  const rule = rules.find((r) => r.weekday === weekday);
  if (!rule) return [];

  const [startHour, startMinute] = rule.startTime.split(':').map(Number);
  const [endHour, endMinute] = rule.endTime.split(':').map(Number);

  const openStart = new Date(dayStartUtc);
  openStart.setUTCHours(startHour ?? 0, startMinute ?? 0, 0, 0);
  const openEnd = new Date(dayStartUtc);
  openEnd.setUTCHours(endHour ?? 0, endMinute ?? 0, 0, 0);

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
