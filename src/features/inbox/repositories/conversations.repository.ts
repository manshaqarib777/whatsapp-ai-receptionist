import { NotFoundError } from '@/lib/errors';
import type { Scope } from '@/lib/db/scope';

import { InboxBaseRepository } from './inbox.base';
import {
  decodeCursor,
  encodeCursor,
  mapConversationDetail,
  mapConversationRow,
} from './inbox.mappers';
import type {
  ConversationDetail,
  ConversationRow,
  InboxListFilter,
  TypingRow,
} from './inbox.types';

/**
 * Conversation data access — the list, detail, and state mutations.
 *
 * The cursor-paginated list is the inbox's primary surface. Ordering: pinned
 * first, then unread (unreadCount desc), then lastMessageAt desc — a stable,
 * indexed sort matching the inbox "most important first" rule.
 */
export class InboxConversationsRepository extends InboxBaseRepository {
  constructor(scope: Scope) {
    super(scope);
  }

  async listConversations(filter: InboxListFilter = {}): Promise<{
    rows: ConversationRow[];
    nextCursor: string | null;
  }> {
    const limit = Math.min(filter.limit ?? 25, 50);
    // Built with bracket access so the partial-where type stays open; the scoped
    // client ANDs the tenant predicate on top, so the org can never be widened.
    const where: Record<string, unknown> = {};

    if (filter.status) where['status'] = filter.status;
    if (filter.pinned !== undefined) where['isPinned'] = filter.pinned;
    if (filter.assignee === 'me') where['assigneeId'] = { not: null };
    if (filter.assignee === 'unassigned') where['assigneeId'] = null;
    if (filter.labelId) {
      where['labels'] = { some: { labelId: filter.labelId } };
    }
    if (filter.q) {
      where['OR'] = [
        { contact: { displayName: { contains: filter.q, mode: 'insensitive' } } },
        { messages: { some: { body: { contains: filter.q, mode: 'insensitive' } } } },
      ];
    }
    if (filter.cursor) {
      const [cursorLast, cursorId] = decodeCursor(filter.cursor);
      where['OR'] = [
        { lastMessageAt: { lt: cursorLast } },
        { lastMessageAt: cursorLast, id: { lt: cursorId } },
      ];
    }

    const rows = await this.db.conversation.findMany({
      where,
      orderBy: [{ isPinned: 'desc' }, { unreadCount: 'desc' }, { lastMessageAt: 'desc' }],
      take: limit + 1, // one extra row to detect the next page
      select: {
        id: true,
        contactId: true,
        status: true,
        isPinned: true,
        isEscalated: true,
        unreadCount: true,
        lastMessageAt: true,
        branchId: true,
        assigneeId: true,
        assignee: { select: { name: true } },
        contact: {
          select: { displayName: true, locale: true, phoneNumber: true, email: true },
        },
        labels: {
          select: { label: { select: { id: true, name: true, color: true } } },
        },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { body: true },
        },
        typing: {
          where: { expiresAt: { gt: new Date() } },
          select: { userId: true, expiresAt: true },
        },
      },
    });

    const hasNext = rows.length > limit;
    const page = hasNext ? rows.slice(0, limit) : rows;
    const last = page[page.length - 1];

    return {
      rows: page.map(mapConversationRow),
      nextCursor: hasNext && last ? encodeCursor(last.lastMessageAt, last.id) : null,
    };
  }

  /**
   * A single conversation's header + labels. 404 when it does not exist in this
   * tenant (cross-tenant access returns 404, never 403 — SECURITY_RULES.md).
   */
  async getConversation(conversationId: string): Promise<ConversationDetail> {
    const row = await this.db.conversation.findFirst({
      where: { id: conversationId },
      select: {
        id: true,
        contactId: true,
        status: true,
        isPinned: true,
        isEscalated: true,
        unreadCount: true,
        lastMessageAt: true,
        branchId: true,
        assigneeId: true,
        assignee: { select: { name: true } },
        contact: {
          select: { displayName: true, locale: true, phoneNumber: true, email: true },
        },
        labels: {
          select: { label: { select: { id: true, name: true, color: true } } },
        },
      },
    });

    if (!row) throw new NotFoundError('Conversation not found.');
    return mapConversationDetail(row);
  }

  /** Marks the conversation read for a user (idempotent), zeroing unreadCount. */
  async markRead(conversationId: string, userId: string): Promise<void> {
    await this.assertConversation(conversationId);

    await this.db.$transaction(async (tx) => {
      // Per-user read receipt — upsert is refused on scoped models, so
      // check-then-update/create.
      const existing = await tx.conversationRead.findFirst({
        where: { conversationId, userId },
        select: { id: true },
      });

      if (existing) {
        await tx.conversationRead.updateMany({
          where: { conversationId, userId },
          data: { lastReadAt: new Date() },
        });
      } else {
        await tx.conversationRead.create({
          data: {
            organizationId: this.organizationId,
            conversationId,
            userId,
            lastReadAt: new Date(),
          },
        });
      }

      // Zero the denormalised counter.
      await tx.conversation.updateMany({
        where: { id: conversationId, unreadCount: { gt: 0 } },
        data: { unreadCount: 0 },
      });
    });
  }

  /** Writes/refreshes a typing row with a TTL; expired rows self-clean. */
  async setTyping(
    conversationId: string,
    userId: string,
    ttlSeconds = 10,
  ): Promise<void> {
    await this.assertConversation(conversationId);
    const now = new Date();
    const expiresAt = new Date(now.getTime() + ttlSeconds * 1000);

    await this.db.$transaction(async (tx) => {
      await tx.conversationTyping.deleteMany({ where: { expiresAt: { lt: now } } });

      const existing = await tx.conversationTyping.findFirst({
        where: { conversationId, userId },
        select: { id: true },
      });

      if (existing) {
        await tx.conversationTyping.updateMany({
          where: { conversationId, userId },
          data: { expiresAt, startedAt: now },
        });
      } else {
        await tx.conversationTyping.create({
          data: {
            organizationId: this.organizationId,
            conversationId,
            userId,
            expiresAt,
          },
        });
      }
    });
  }

  async listTyping(conversationId: string): Promise<TypingRow[]> {
    await this.assertConversation(conversationId);
    const rows = await this.db.conversationTyping.findMany({
      where: { conversationId, expiresAt: { gt: new Date() } },
      select: { userId: true, expiresAt: true },
    });
    return rows;
  }

  async archiveConversation(conversationId: string, archive: boolean): Promise<void> {
    const conversation = await this.assertConversation(conversationId);
    const target = archive
      ? 'archived'
      : conversation.status === 'archived'
        ? 'open'
        : conversation.status;
    await this.db.conversation.updateMany({
      where: { id: conversationId },
      data: { status: target as never },
    });
  }

  async updateConversation(input: {
    conversationId: string;
    assigneeId?: string | null;
    isPinned?: boolean;
  }): Promise<void> {
    await this.assertConversation(input.conversationId);
    const data: Record<string, unknown> = {};
    if (input.assigneeId !== undefined) data['assigneeId'] = input.assigneeId;
    if (input.isPinned !== undefined) data['isPinned'] = input.isPinned;

    await this.db.conversation.updateMany({
      where: { id: input.conversationId },
      data,
    });
  }
}
