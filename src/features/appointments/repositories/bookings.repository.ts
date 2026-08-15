import { ConflictError, NotFoundError } from '@/lib/errors';
import type { Scope } from '@/lib/db/scope';

import { AppointmentsBaseRepository } from './appointments.base';
import type { AppointmentRow } from './appointments.types';

const APPOINTMENT_SELECT = {
  id: true,
  contactId: true,
  serviceId: true,
  resourceId: true,
  startsAt: true,
  endsAt: true,
  timezone: true,
  status: true,
  notes: true,
  rescheduledFromId: true,
} as const;

/**
 * Appointment + reminder data access.
 *
 * Booking writes go through the branch scope; the double-booking exclusion
 * constraint is the authoritative conflict guard, and its error is mapped to a
 * 409 `ConflictError`. Reschedule keeps linked history via `rescheduledFromId`.
 */
export class AppointmentsRepository extends AppointmentsBaseRepository {
  constructor(scope: Scope) {
    super(scope);
  }

  /** Existing appointments in a range, excluding cancelled (they don't block). */
  async listAppointmentsInRange(
    branchId: string,
    from: Date,
    to: Date,
  ): Promise<AppointmentRow[]> {
    const rows = await this.db.appointment.findMany({
      where: {
        branchId,
        deletedAt: null,
        status: { not: 'cancelled' },
        startsAt: { lt: to },
        endsAt: { gt: from },
      },
      select: APPOINTMENT_SELECT,
    });
    return rows as AppointmentRow[];
  }

  async book(input: {
    branchId: string;
    contactId: string;
    serviceId: string;
    resourceId: string;
    startsAt: Date;
    endsAt: Date;
    timezone: string;
    notes?: string;
  }): Promise<AppointmentRow> {
    const db = this.writeScope(input.branchId);
    try {
      const row = await db.appointment.create({
        data: {
          organizationId: this.organizationId,
          branchId: input.branchId,
          contactId: input.contactId,
          serviceId: input.serviceId,
          resourceId: input.resourceId,
          startsAt: input.startsAt,
          endsAt: input.endsAt,
          timezone: input.timezone,
          status: 'booked',
          notes: input.notes,
        },
        select: APPOINTMENT_SELECT,
      });
      return row as AppointmentRow;
    } catch (error) {
      // P2002 (unique), 23P01, and P2039 (exclusion constraint) all mean the
      // slot is taken. The exclusion constraint is the authoritative backstop.
      const code = (error as { code?: string })?.code;
      if (code === 'P2002' || code === '23P01' || code === 'P2039') {
        throw new ConflictError('This time slot is already booked.');
      }
      throw error;
    }
  }

  async getAppointment(id: string): Promise<AppointmentRow> {
    const row = await this.db.appointment.findFirst({
      where: { id, deletedAt: null },
      select: APPOINTMENT_SELECT,
    });
    if (!row) throw new NotFoundError('Appointment not found.');
    return row as AppointmentRow;
  }

  async updateStatus(
    id: string,
    status:
      'booked' | 'confirmed' | 'cancelled' | 'rescheduled' | 'completed' | 'no_show',
  ): Promise<void> {
    await this.db.appointment.updateMany({
      where: { id },
      data: { status },
    });
  }

  async linkReschedule(newId: string, originalId: string): Promise<void> {
    await this.db.appointment.updateMany({
      where: { id: newId },
      data: { rescheduledFromId: originalId },
    });
    await this.db.appointment.updateMany({
      where: { id: originalId },
      data: { status: 'rescheduled' },
    });
  }

  async cancelReminders(appointmentId: string): Promise<void> {
    await this.db.appointmentReminder.updateMany({
      where: { appointmentId, status: 'scheduled' },
      data: { status: 'cancelled' },
    });
  }

  async createReminders(appointmentId: string, sendAts: Date[]): Promise<void> {
    await this.db.appointmentReminder.createMany({
      data: sendAts.map((sendAt) => ({
        organizationId: this.organizationId,
        appointmentId,
        sendAt,
        channel: 'whatsapp',
        status: 'scheduled',
      })),
    });
  }
}
