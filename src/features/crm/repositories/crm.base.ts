import { NotFoundError } from '@/lib/errors';
import { forScope } from '@/lib/db/scoped-prisma';
import type { BranchScope, Scope } from '@/lib/db/scope';
import { resolveScope } from '@/server/scope';

/**
 * Shared CRM repository plumbing — Milestone 10.
 *
 * Every aggregate repository derives from this: it owns the scoped client, the
 * org-level scope, and the write-scope derivation, so the tenant isolation
 * control is defined once and cannot drift between aggregates.
 */

export abstract class CrmBaseRepository {
  protected readonly db: ReturnType<typeof forScope>;
  readonly organizationId: string;

  constructor(scope: Scope) {
    this.db = forScope(scope);
    this.organizationId = scope.organizationId;
  }

  /** Builds a repository from an organization id (org-level scope, all branches). */
  static forOrganization<T extends CrmBaseRepository>(
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
    const branch = await this.db.branch.findFirst({
      where: { isDefault: true },
      select: { id: true },
    });
    if (!branch) throw new NotFoundError('No default branch for this organization.');
    return branch.id;
  }
}
