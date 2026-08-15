import type { Scope } from '@/lib/db/scope';

import { CrmBaseRepository } from './crm.base';
import type { ActivityKind, ActivityRow, TaggableType } from './crm.types';

/**
 * Activity data access.
 *
 * Activities form a timeline per subject (deal/company/contact). Every mutation
 * on a subject is written through the service's `recordActivity` seam, which
 * lands here. The idempotency marker `hasActivityOfKind` keeps automation from
 * double-applying on re-runs.
 */
export class CrmActivitiesRepository extends CrmBaseRepository {
  constructor(scope: Scope) {
    super(scope);
  }

  async listActivities(
    subjectType: TaggableType,
    subjectId: string,
  ): Promise<ActivityRow[]> {
    const rows = await this.db.activity.findMany({
      where: { subjectType, subjectId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        subjectType: true,
        subjectId: true,
        kind: true,
        body: true,
        actor: { select: { name: true } },
        createdAt: true,
      },
    });
    return rows.map(({ actor, ...row }) => ({
      ...row,
      actorName: actor?.name ?? null,
    }));
  }

  async createActivity(input: {
    branchId: string;
    subjectType: TaggableType;
    subjectId: string;
    kind: ActivityKind;
    body?: string;
    actorId?: string | null;
  }): Promise<ActivityRow> {
    const db = this.writeScope(input.branchId);
    const row = await db.activity.create({
      data: {
        organizationId: this.organizationId,
        branchId: input.branchId,
        subjectType: input.subjectType,
        subjectId: input.subjectId,
        kind: input.kind,
        body: input.body ?? null,
        actorId: input.actorId ?? null,
      },
      select: {
        id: true,
        subjectType: true,
        subjectId: true,
        kind: true,
        body: true,
        actor: { select: { name: true } },
        createdAt: true,
      },
    });
    const { actor, ...rest } = row;
    return { ...rest, actorName: actor?.name ?? null };
  }

  /** Idempotency marker: has this subject already had this kind of activity? */
  async hasActivityOfKind(
    subjectId: string,
    subjectType: TaggableType,
    kind: ActivityKind,
  ): Promise<boolean> {
    const row = await this.db.activity.findFirst({
      where: { subjectId, subjectType, kind },
      select: { id: true },
    });
    return row !== null;
  }
}
