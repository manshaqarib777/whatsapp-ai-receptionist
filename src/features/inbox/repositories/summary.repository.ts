import type { Scope } from '@/lib/db/scope';

import { InboxBaseRepository } from './inbox.base';
import type { SummaryRow } from './inbox.types';

/**
 * Conversation-summary data access.
 */
export class InboxSummaryRepository extends InboxBaseRepository {
  constructor(scope: Scope) {
    super(scope);
  }

  async getSummary(conversationId: string): Promise<SummaryRow | null> {
    const row = await this.db.conversationSummary.findFirst({
      where: { conversationId, status: 'current' },
      orderBy: { version: 'desc' },
      select: {
        summary: true,
        model: true,
        version: true,
        status: true,
        updatedAt: true,
      },
    });
    return row ?? null;
  }

  async upsertSummary(
    conversationId: string,
    summary: string,
    model = 'heuristic',
  ): Promise<void> {
    await this.assertConversation(conversationId);
    await this.db.conversationSummary.create({
      data: {
        organizationId: this.organizationId,
        conversationId,
        summary,
        model,
        version: 1,
        status: 'current',
      },
    });
  }
}
