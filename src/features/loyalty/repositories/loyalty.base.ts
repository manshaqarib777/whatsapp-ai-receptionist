import { NotFoundError } from '@/lib/errors';
import { forScope } from '@/lib/db/scoped-prisma';
import type { BranchScope, Scope } from '@/lib/db/scope';
import { resolveScope } from '@/server/scope';

/**
 * Shared loyalty repository plumbing — Milestone 17.
 *
 * Owns the scoped client, org-level scope, and branch-scope derivation so the
 * tenant isolation control is defined once (same pattern as broadcast.base.ts
 * and reviews.base.ts).
 */

export abstract class LoyaltyBaseRepository {
  protected readonly db: ReturnType<typeof forScope>;
  readonly organizationId: string;

  constructor(scope: Scope) {
    this.db = forScope(scope);
    this.organizationId = scope.organizationId;
  }

  /** Builds a repository from an organization id (org-level scope, all branches). */
  static forOrganization<T extends LoyaltyBaseRepository>(
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
