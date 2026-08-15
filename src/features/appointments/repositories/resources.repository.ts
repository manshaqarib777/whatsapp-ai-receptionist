import type { Scope } from '@/lib/db/scope';

import { AppointmentsBaseRepository, timeOnlyToDate } from './appointments.base';
import type { ResourceRow } from './appointments.types';

/**
 * Resource + availability data access.
 *
 * Resources (staff/rooms/equipment) carry weekly availability rules and are
 * the conflict boundary: a booked slot disappears from availability, and the
 * exclusion constraint is the authoritative backstop.
 */
export class AppointmentsResourcesRepository extends AppointmentsBaseRepository {
  constructor(scope: Scope) {
    super(scope);
  }

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
    return db.resource.create({
      data: {
        organizationId: this.organizationId,
        branchId: input.branchId,
        kind: input.kind,
        name: input.name,
        userId: input.userId ?? null,
      },
      select: { id: true },
    });
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

  async listExceptions(
    from: Date,
    to: Date,
  ): Promise<
    { resourceId: string; startsAt: Date; endsAt: Date; reason: string | null }[]
  > {
    return this.db.availabilityException.findMany({
      where: { startsAt: { lt: to }, endsAt: { gt: from } },
      select: { resourceId: true, startsAt: true, endsAt: true, reason: true },
    });
  }
}
