import { NotFoundError } from '@/lib/errors';
import { forScope } from '@/lib/db/scoped-prisma';
import type { BranchScope, Scope } from '@/lib/db/scope';
import { resolveScope } from '@/server/scope';

/**
 * Shared appointments repository plumbing — Milestone 9.
 *
 * Owns the scoped client, org-level scope, and branch-scope derivation so the
 * tenant isolation control is defined once across the aggregate repositories.
 */

export abstract class AppointmentsBaseRepository {
  protected readonly db: ReturnType<typeof forScope>;
  readonly organizationId: string;
  readonly branchId: string | null;

  constructor(scope: Scope) {
    this.db = forScope(scope);
    this.organizationId = scope.organizationId;
    this.branchId = scope.branchId;
  }

  /** Builds a repository from an organization id (org-level scope, all branches). */
  static forOrganization<T extends AppointmentsBaseRepository>(
    this: new (scope: Scope) => T,
    organizationId: string,
  ): T {
    return new this(resolveScope(organizationId));
  }

  protected writeScope(branchId: string): ReturnType<typeof forScope> {
    const branchScope: BranchScope = { organizationId: this.organizationId, branchId };
    return forScope(branchScope);
  }

  async resolveDefaultBranch(): Promise<string> {
    if (this.branchId) return this.branchId;
    const branch = await this.db.branch.findFirst({
      where: { isDefault: true },
      select: { id: true },
    });
    if (!branch) throw new NotFoundError('No default branch for this organization.');
    return branch.id;
  }
}

/** "08:00" → a Time column value (date part is arbitrary). */
export function timeOnlyToDate(time: string): Date {
  const [hours, minutes] = time.split(':').map(Number);
  const date = new Date('1970-01-01T00:00:00.000Z');
  date.setUTCHours(hours ?? 0, minutes ?? 0, 0, 0);
  return date;
}
