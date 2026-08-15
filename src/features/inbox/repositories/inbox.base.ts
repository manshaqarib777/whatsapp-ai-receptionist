import { NotFoundError } from '@/lib/errors';
import { forScope } from '@/lib/db/scoped-prisma';
import type { BranchScope, Scope } from '@/lib/db/scope';
import { resolveScope } from '@/server/scope';

/**
 * Shared inbox repository plumbing — Milestone 6.
 *
 * Owns the scoped client, org-level scope, branch-scope derivation, and the
 * conversation-existence guard used by every aggregate. The tenant isolation
 * control is defined once and cannot drift between aggregates.
 */

export abstract class InboxBaseRepository {
  protected readonly db: ReturnType<typeof forScope>;
  protected readonly organizationId: string;

  constructor(scope: Scope) {
    this.db = forScope(scope);
    this.organizationId = scope.organizationId;
  }

  /** Builds a repository from an organization id (org-level scope, all branches). */
  static forOrganization<T extends InboxBaseRepository>(
    this: new (scope: Scope) => T,
    organizationId: string,
  ): T {
    return new this(resolveScope(organizationId));
  }

  protected writeScope(branchId: string): ReturnType<typeof forScope> {
    const branchScope: BranchScope = { organizationId: this.organizationId, branchId };
    return forScope(branchScope);
  }

  /** Asserts the conversation exists in this tenant; returns it. */
  protected async assertConversation(conversationId: string) {
    const conversation = await this.db.conversation.findFirst({
      where: { id: conversationId },
      select: { id: true, status: true, branchId: true },
    });
    if (!conversation) throw new NotFoundError('Conversation not found.');
    return conversation;
  }

  /** Resolves the org's default branch (needed for branch-scoped creates). */
  protected async resolveDefaultBranch(): Promise<string> {
    const branch = await this.db.branch.findFirst({
      where: { isDefault: true },
      select: { id: true },
    });
    if (!branch) throw new NotFoundError('No default branch for this organization.');
    return branch.id;
  }
}
