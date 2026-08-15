import type { Scope } from '@/lib/db/scope';

import { InboxBaseRepository } from './inbox.base';
import type { NoteRow } from './inbox.types';

/**
 * Conversation-note data access.
 */
export class InboxNotesRepository extends InboxBaseRepository {
  constructor(scope: Scope) {
    super(scope);
  }

  async listNotes(conversationId: string): Promise<NoteRow[]> {
    const rows = await this.db.conversationNote.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        body: true,
        createdAt: true,
        authorId: true,
        author: { select: { name: true } },
      },
    });
    return rows.map((row) => ({
      id: row.id,
      authorId: row.authorId,
      authorName: row.author?.name ?? null,
      body: row.body,
      createdAt: row.createdAt,
    }));
  }

  async createNote(
    conversationId: string,
    authorId: string,
    body: string,
  ): Promise<NoteRow> {
    await this.assertConversation(conversationId);
    const row = await this.db.conversationNote.create({
      data: {
        organizationId: this.organizationId,
        conversationId,
        authorId,
        body,
      },
      select: {
        id: true,
        body: true,
        createdAt: true,
        authorId: true,
        author: { select: { name: true } },
      },
    });
    return {
      id: row.id,
      authorId: row.authorId,
      authorName: row.author?.name ?? null,
      body: row.body,
      createdAt: row.createdAt,
    };
  }
}
