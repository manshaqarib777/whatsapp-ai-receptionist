import { forScope } from '@/lib/db/scoped-prisma';
import type { BranchScope, Scope } from '@/lib/db/scope';
import { NotFoundError, ConflictError } from '@/lib/errors';
import { resolveScope } from '@/server/scope';

/**
 * Appointment Engine data access — Milestone 9.
 *
 * The only layer that touches the database for appointment reads and writes.
 * Every query runs through `forScope(scope)` — the tenant isolation control.
 *
 * `Service`, `Resource`, `AvailabilityRule`, `Appointment`, and
 * `AppointmentReminder` are BRANCH-scoped, so writes need a branch scope. The
 * repository holds the org-level scope for reads and derives a branch scope
 * (`writeScope`) for writes — the branch always comes from the session's active
 * branch resolution, never from a request parameter.
 *
 * The double-booking exclusion constraint is the authoritative conflict guard;
 * the API maps the resulting Prisma error to a 409 `ConflictError`.
 */

export type ServiceRow = {
  id: string;
  name: string;
  description: string | null;
  durationMinutes: number;
  priceAmount: number;
  priceCurrency: string;
};

export type ResourceRow = {
  id: string;
  kind: string;
  name: string;
  userId: string | null;
  rules: { weekday: number; startTime: string; endTime: string }[];
};

export type AppointmentRow = {
  id: string;
  contactId: string;
  serviceId: string;
  resourceId: string;
  startsAt: Date;
  endsAt: Date;
  timezone: string;
  status: string;
  notes: string | null;
  rescheduledFromId: string | null;
};

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

export class AppointmentsRepository {
  private readonly db: ReturnType<typeof forScope>;
  readonly organizationId: string;

  constructor(scope: Scope) {
    this.db = forScope(scope);
    this.organizationId = scope.organizationId;
  }

  /** Builds a repository from an organization id (org-level scope, all branches). */
  static forOrganization(organizationId: string): AppointmentsRepository {
    return new AppointmentsRepository(resolveScope(organizationId));
  }

  private writeScope(branchId: string): ReturnType<typeof forScope> {
    const branchScope: BranchScope = { organizationId: this.organizationId, branchId };
    return forScope(branchScope);
  }

  async resolveDefaultBranch(): Promise<string> {
    const branch = await this.db.branch.findFirst({
      where: { isDefault: true },
      select: { id: true },
    });
    if (!branch) throw new NotFoundError('No default branch for this organization.');
    return branch.id;
  }

  // -------------------------------------------------------------------------
  // Services
  // -------------------------------------------------------------------------

  async listServices(branchId?: string): Promise<ServiceRow[]> {
    const rows = await this.db.service.findMany({
      where: { deletedAt: null, ...(branchId ? { branchId } : {}) },
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        description: true,
        durationMinutes: true,
        priceAmount: true,
        priceCurrency: true,
      },
    });
    return rows.map((row) => ({ ...row, priceAmount: Number(row.priceAmount) }));
  }

  async createService(input: {
    branchId: string;
    name: string;
    description?: string;
    durationMinutes: number;
    priceAmount: number;
    priceCurrency?: string;
  }): Promise<ServiceRow> {
    const db = this.writeScope(input.branchId);
    const row = await db.service.create({
      data: {
        organizationId: this.organizationId,
        branchId: input.branchId,
        name: input.name,
        description: input.description,
        durationMinutes: input.durationMinutes,
        priceAmount: input.priceAmount,
        priceCurrency: input.priceCurrency ?? 'SAR',
      },
      select: {
        id: true,
        name: true,
        description: true,
        durationMinutes: true,
        priceAmount: true,
        priceCurrency: true,
      },
    });
    return { ...row, priceAmount: Number(row.priceAmount) };
  }

  async getService(id: string): Promise<ServiceRow> {
    const row = await this.db.service.findFirst({
      where: { id, deletedAt: null },
      select: {
        id: true,
        name: true,
        description: true,
        durationMinutes: true,
        priceAmount: true,
        priceCurrency: true,
      },
    });
    if (!row) throw new NotFoundError('Service not found.');
    return { ...row, priceAmount: Number(row.priceAmount) };
  }

  // -------------------------------------------------------------------------
  // Resources + availability
  // -------------------------------------------------------------------------

  async listResources(branchId?: string): Promise<ResourceRow[]> {
    const rows = await this.db.resource.findMany({
      where: { deletedAt: null, ...(branchId ? { branchId } : {}) },
      orderBy: { name: 'asc' },
      select: {
        id: true,
        kind: true,
        name: true,
        userId: true,
        availabilityRules: {
          select: { weekday: true, startTime: true, endTime: true },
        },
      },
    });
    return rows.map((row) => ({
      id: row.id,
      kind: row.kind,
      name: row.name,
      userId: row.userId,
      rules: row.availabilityRules.map((r) => ({
        weekday: r.weekday,
        startTime: r.startTime.toISOString().slice(11, 16),
        endTime: r.endTime.toISOString().slice(11, 16),
      })),
    }));
  }

  async createResource(input: {
    branchId: string;
    kind: 'staff' | 'room' | 'equipment';
    name: string;
    userId?: string;
  }): Promise<{ id: string }> {
    const db = this.writeScope(input.branchId);
    const row = await db.resource.create({
      data: {
        organizationId: this.organizationId,
        branchId: input.branchId,
        kind: input.kind,
        name: input.name,
        userId: input.userId ?? null,
      },
      select: { id: true },
    });
    return row;
  }

  async addAvailabilityRule(input: {
    branchId: string;
    resourceId: string;
    weekday: number;
    startTime: string; // "08:00"
    endTime: string; // "17:00"
  }): Promise<void> {
    const db = this.writeScope(input.branchId);
    await db.availabilityRule.create({
      data: {
        organizationId: this.organizationId,
        resourceId: input.resourceId,
        weekday: input.weekday,
        startTime: timeOnlyToDate(input.startTime),
        endTime: timeOnlyToDate(input.endTime),
      },
    });
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

  async listExceptions(
    from: Date,
    to: Date,
  ): Promise<
    { resourceId: string; startsAt: Date; endsAt: Date; reason: string | null }[]
  > {
    const rows = await this.db.availabilityException.findMany({
      where: { startsAt: { lt: to }, endsAt: { gt: from } },
      select: { resourceId: true, startsAt: true, endsAt: true, reason: true },
    });
    return rows;
  }

  // -------------------------------------------------------------------------
  // Appointments
  // -------------------------------------------------------------------------

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
      // Checked structurally — the scoped extension wraps the error.
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

/** "08:00" → a Time column value (date part is arbitrary). */
function timeOnlyToDate(time: string): Date {
  const [hours, minutes] = time.split(':').map(Number);
  const date = new Date('1970-01-01T00:00:00.000Z');
  date.setUTCHours(hours ?? 0, minutes ?? 0, 0, 0);
  return date;
}
