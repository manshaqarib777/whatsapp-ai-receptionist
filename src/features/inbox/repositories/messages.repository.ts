import { NotFoundError } from '@/lib/errors';
import type { Scope } from '@/lib/db/scope';

import { InboxBaseRepository } from './inbox.base';
import { mapMessageRow, messageSelect } from './inbox.mappers';
import type { MessageRow, SearchHit } from './inbox.types';

/**
 * Message data access — history, sending, attachments, and search.
 */
export class InboxMessagesRepository extends InboxBaseRepository {
  constructor(scope: Scope) {
    super(scope);
  }

  /**
   * Message history for a conversation, newest-first cursor page (the client
   * reverses for display). `before` is an ISO timestamp cursor; the first page
   * returns the most recent messages.
   */
  async listMessages(
    conversationId: string,
    before?: string,
    limit = 30,
  ): Promise<{ rows: MessageRow[]; nextCursor: string | null }> {
    await this.assertConversation(conversationId);

    const where: Record<string, unknown> = { conversationId };
    if (before) where['createdAt'] = { lt: new Date(before) };

    const rows = await this.db.message.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit + 1,
      select: messageSelect,
    });

    const hasNext = rows.length > limit;
    const page = hasNext ? rows.slice(0, limit) : rows;
    const last = page[page.length - 1];

    return {
      rows: page.map(mapMessageRow),
      nextCursor: hasNext && last ? last.createdAt.toISOString() : null,
    };
  }

  /** All messages of a conversation, oldest first (for summaries / suggestions). */
  async listAllMessages(conversationId: string): Promise<MessageRow[]> {
    const rows = await this.db.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'asc' },
      select: messageSelect,
    });
    return rows.map(mapMessageRow);
  }

  /**
   * Sends an agent reply. Persists the message, bumps `lastMessageAt`, and clears
   * unread. Runs in one transaction so a crash cannot leave the list and thread
   * disagreeing.
   */
  async sendMessage(input: {
    conversationId: string;
    authorId: string;
    body: string;
    contentType?: string;
  }): Promise<MessageRow> {
    await this.assertConversation(input.conversationId);

    const created = await this.db.$transaction(async (tx) => {
      const message = await tx.message.create({
        data: {
          organizationId: this.organizationId,
          conversationId: input.conversationId,
          direction: 'outbound',
          authorType: 'agent',
          authorId: input.authorId,
          contentType: (input.contentType ?? 'text') as never,
          body: input.body,
          deliveryStatus: 'sent',
        },
        select: { ...messageSelect, author: { select: { name: true } } },
      });

      await tx.conversation.updateMany({
        where: { id: input.conversationId },
        data: { lastMessageAt: message.createdAt, unreadCount: 0 },
      });

      return message;
    });

    return mapMessageRow(created as never);
  }

  /** Attaches a stored file to an existing message. */
  async attachToMessage(
    messageId: string,
    input: { storageKey: string; mimeType: string; sizeBytes: bigint; fileName?: string },
  ): Promise<void> {
    const message = await this.db.message.findFirst({
      where: { id: messageId },
      select: { id: true },
    });
    if (!message) throw new NotFoundError('Message not found.');

    await this.db.messageAttachment.create({
      data: {
        organizationId: this.organizationId,
        messageId,
        storageKey: input.storageKey,
        mimeType: input.mimeType,
        sizeBytes: input.sizeBytes,
        fileName: input.fileName ?? null,
      },
    });
  }

  /** Searches message bodies + contact display names, org-scoped. */
  async search(q: string, limit = 20): Promise<SearchHit[]> {
    const trimmed = q.trim();
    if (!trimmed) return [];

    const rows = await this.db.message.findMany({
      where: {
        body: { contains: trimmed, mode: 'insensitive' },
        deletedAt: null,
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true,
        body: true,
        direction: true,
        contentType: true,
        createdAt: true,
        conversation: {
          select: {
            id: true,
            contact: { select: { displayName: true } },
          },
        },
      },
    });

    return rows
      .filter((row) => row.body !== null)
      .map((row) => ({
        conversationId: row.conversation.id,
        messageId: row.id,
        body: row.body as string,
        direction: row.direction,
        contentType: row.contentType,
        createdAt: row.createdAt,
        contactDisplayName: row.conversation.contact.displayName,
      }));
  }
}
