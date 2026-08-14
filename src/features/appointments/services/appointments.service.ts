import {
  AppointmentsRepository,
  type AppointmentRow,
  type ResourceRow,
  type ServiceRow,
} from '@/features/appointments/repositories/appointments.repository';
import { computeSlots } from '@/features/appointments/services/availability';
import {
  expandRecurrence,
  parseRecurrenceRule,
} from '@/features/appointments/services/recurrence';
import { ConflictError, UnprocessableError } from '@/lib/errors';

/**
 * Appointment Engine orchestration — Milestone 9.
 *
 * Pure orchestration over the repository: availability, booking, cancel,
 * reschedule, recurring series, and reminder scheduling. The database exclusion
 * constraint is the authoritative double-booking backstop; the repository maps
 * the conflict to a 409.
 *
 * Timezone handling: appointments store the IANA zone (the booking intent).
 * Availability is computed on the requested date and the slots are UTC instants.
 */

const REMINDER_LEADS_HOURS = [24, 1];

export class AppointmentsService {
  private readonly repo: AppointmentsRepository;
  readonly organizationId: string;

  constructor(repo: AppointmentsRepository) {
    this.repo = repo;
    this.organizationId = repo.organizationId;
  }

  static forOrganization(organizationId: string): AppointmentsService {
    return new AppointmentsService(
      AppointmentsRepository.forOrganization(organizationId),
    );
  }

  // -------------------------------------------------------------------------
  // Services + resources
  // -------------------------------------------------------------------------

  async listServices(): Promise<ServiceRow[]> {
    const branchId = await this.repo.resolveDefaultBranch();
    return this.repo.listServices(branchId);
  }

  async createService(input: {
    name: string;
    description?: string;
    durationMinutes: number;
    priceAmount: number;
    priceCurrency?: string;
  }): Promise<ServiceRow> {
    const branchId = await this.repo.resolveDefaultBranch();
    if (input.durationMinutes < 5 || input.durationMinutes > 480) {
      throw new UnprocessableError('Service duration must be between 5 and 480 minutes.');
    }
    return this.repo.createService({ branchId, ...input });
  }

  async listResources(): Promise<ResourceRow[]> {
    const branchId = await this.repo.resolveDefaultBranch();
    return this.repo.listResources(branchId);
  }

  async createResource(input: {
    kind: 'staff' | 'room' | 'equipment';
    name: string;
    userId?: string;
  }): Promise<{ id: string }> {
    const branchId = await this.repo.resolveDefaultBranch();
    return this.repo.createResource({ branchId, ...input });
  }

  async addAvailabilityRule(
    resourceId: string,
    input: { weekday: number; startTime: string; endTime: string },
  ): Promise<void> {
    const branchId = await this.repo.resolveDefaultBranch();
    await this.repo.addAvailabilityRule({ branchId, resourceId, ...input });
  }

  // -------------------------------------------------------------------------
  // Availability
  // -------------------------------------------------------------------------

  async availability(input: {
    serviceId: string;
    resourceId?: string;
    date: string;
    timezone: string;
  }): Promise<{ resourceId: string; slots: { startsAt: string; endsAt: string }[] }[]> {
    const branchId = await this.repo.resolveDefaultBranch();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) {
      throw new UnprocessableError('Date must be YYYY-MM-DD.');
    }

    const service = await this.repo.getService(input.serviceId);
    const results = await computeSlots(this.repo, {
      branchId,
      serviceId: input.serviceId,
      durationMinutes: service.durationMinutes,
      resourceId: input.resourceId,
      date: input.date,
      timezone: input.timezone,
    });

    return results.map((r) => ({
      resourceId: r.resourceId,
      slots: r.slots.map((s) => ({
        startsAt: s.startsAt.toISOString(),
        endsAt: s.endsAt.toISOString(),
      })),
    }));
  }

  // -------------------------------------------------------------------------
  // Booking / cancel / reschedule
  // -------------------------------------------------------------------------

  async book(input: {
    contactId: string;
    serviceId: string;
    resourceId: string;
    startsAt: string;
    timezone: string;
    notes?: string;
    recurrenceRule?: string;
  }): Promise<AppointmentRow> {
    const branchId = await this.repo.resolveDefaultBranch();
    const service = await this.repo.getService(input.serviceId);
    const startsAt = new Date(input.startsAt);
    const endsAt = new Date(startsAt.getTime() + service.durationMinutes * 60_000);

    // Availability check before insert (the DB constraint is the backstop).
    const date = startsAt.toISOString().slice(0, 10);
    const slots = await computeSlots(this.repo, {
      branchId,
      serviceId: input.serviceId,
      durationMinutes: service.durationMinutes,
      resourceId: input.resourceId,
      date,
      timezone: input.timezone,
    });
    const free = slots.some((r) =>
      r.slots.some((s) => s.startsAt.getTime() === startsAt.getTime()),
    );
    if (!free) {
      throw new ConflictError('This time slot is not available.');
    }

    const appointment = await this.repo.book({
      branchId,
      contactId: input.contactId,
      serviceId: input.serviceId,
      resourceId: input.resourceId,
      startsAt,
      endsAt,
      timezone: input.timezone,
      notes: input.notes,
    });

    // Schedule reminders: 24h and 1h before.
    const reminderLeads = REMINDER_LEADS_HOURS.map(
      (hours) => new Date(startsAt.getTime() - hours * 3_600_000),
    ).filter((sendAt) => sendAt > new Date());
    if (reminderLeads.length > 0) {
      await this.repo.createReminders(appointment.id, reminderLeads);
    }

    // Recurring series: expand and book children under the parent link.
    if (input.recurrenceRule) {
      const rule = parseRecurrenceRule(input.recurrenceRule);
      const occurrences = expandRecurrence(rule, startsAt).slice(1); // skip the parent
      for (const occurrence of occurrences) {
        await this.repo.book({
          branchId,
          contactId: input.contactId,
          serviceId: input.serviceId,
          resourceId: input.resourceId,
          startsAt: occurrence,
          endsAt: new Date(occurrence.getTime() + service.durationMinutes * 60_000),
          timezone: input.timezone,
        });
      }
    }

    return appointment;
  }

  async cancel(id: string): Promise<void> {
    const appointment = await this.repo.getAppointment(id);
    if (appointment.status === 'cancelled') {
      throw new ConflictError('This appointment is already cancelled.');
    }
    await this.repo.updateStatus(id, 'cancelled');
    await this.repo.cancelReminders(id);
  }

  async reschedule(id: string, newStartsAt: string): Promise<AppointmentRow> {
    const appointment = await this.repo.getAppointment(id);
    if (appointment.status === 'cancelled') {
      throw new ConflictError('A cancelled appointment cannot be rescheduled.');
    }

    const branchId = await this.repo.resolveDefaultBranch();
    const service = await this.repo.getService(appointment.serviceId);
    const startsAt = new Date(newStartsAt);
    const endsAt = new Date(startsAt.getTime() + service.durationMinutes * 60_000);

    const replacement = await this.repo.book({
      branchId,
      contactId: appointment.contactId,
      serviceId: appointment.serviceId,
      resourceId: appointment.resourceId,
      startsAt,
      endsAt,
      timezone: appointment.timezone,
      notes: appointment.notes ?? undefined,
    });

    await this.repo.linkReschedule(replacement.id, appointment.id);
    await this.repo.cancelReminders(id);

    return replacement;
  }

  // -------------------------------------------------------------------------
  // Calendar
  // -------------------------------------------------------------------------

  async listAppointments(from: string, to: string): Promise<AppointmentRow[]> {
    const branchId = await this.repo.resolveDefaultBranch();
    return this.repo.listAppointmentsInRange(branchId, new Date(from), new Date(to));
  }

  async getAppointment(id: string): Promise<AppointmentRow> {
    return this.repo.getAppointment(id);
  }
}
