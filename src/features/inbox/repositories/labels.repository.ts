import { NotFoundError } from '@/lib/errors';
import type { Scope } from '@/lib/db/scope';

import { InboxBaseRepository } from './inbox.base';
import type { LabelRow } from './inbox.types';

/**
 * Label data access.
 *
 * Labels are branch-scoped; the list reads through the org scope, and creates
 * resolve the default branch. Adding/removing a label writes the polymorphic
 * `conversation_labels` join, idempotently.
 */
export class InboxLabelsRepository extends InboxBaseRepository {
  constructor(scope: Scope) {
    super(scope);
  }

  async listLabels(): Promise<LabelRow[]> {
    return this.db.label.findMany({
      orderBy: { name: 'asc' },
      select: { id: true, name: true, color: true },
    });
  }

  async createLabel(name: string, color: string): Promise<LabelRow> {
    const branchId = await this.resolveDefaultBranch();
    const branchDb = this.writeScope(branchId);
    return branchDb.label.create({
      data: { organizationId: this.organizationId, branchId, name, color },
      select: { id: true, name: true, color: true },
    });
  }

  async addLabel(conversationId: string, labelId: string): Promise<void> {
    await this.assertConversation(conversationId);
    // The label must belong to the same tenant; scoped findFirst enforces it.
    const label = await this.db.label.findFirst({
      where: { id: labelId },
      select: { id: true },
    });
    if (!label) throw new NotFoundError('Label not found.');

    // upsert is refused on scoped models (UNIQUE_OPERATIONS), so check-then-create.
    const existing = await this.db.conversationLabel.findFirst({
      where: { conversationId, labelId },
      select: { id: true },
    });
    if (existing) return;

    await this.db.conversationLabel.create({
      data: { organizationId: this.organizationId, conversationId, labelId },
    });
  }

  async removeLabel(conversationId: string, labelId: string): Promise<void> {
    await this.db.conversationLabel.deleteMany({
      where: { conversationId, labelId },
    });
  }
}
