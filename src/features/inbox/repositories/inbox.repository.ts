import { NotFoundError } from '@/lib/errors';
import { forScope } from '@/lib/db/scoped-prisma';
import type { Scope } from '@/lib/db/scope';
import { resolveScope } from '@/server/scope';

/**
 * Inbox data access — Milestone 6.
 *
 * The only layer that touches the database for inbox reads and writes. Every query
 * runs through `forScope(scope)` — the tenant isolation control — with the scope
 * built by `resolveScope` from the session-derived organization id. No inbox query
 * may hand-write its own `where.organizationId`.
 *
 * The repository returns raw rows and bounded lists; the service layer owns
 * presentation concerns (view-model shaping, heuristic suggestions, formatting)
 * so they are unit-testable without a database.
 *
 * Scoped-model rule: never `findUnique` on a scoped model (see
 * src/lib/db/scope.ts) — use `findFirst` + `expectOne`.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type InboxListFilter = {
  status?: 'open' | 'pending' | 'resolved' | 'archived';
  assignee?: 'me' | 'unassigned';
  labelId?: string;
  pinned?: boolean;
  q?: string;
  cursor?: string;
  limit?: number;
};

export type ConversationRow = {
  id: string;
  contactId: string;
  contactDisplayName: string;
  contactLocale: string;
  contactPhone: string;
  contactEmail: string | null;
  assigneeId: string | null;
  assigneeName: string | null;
  status: string;
  isPinned: boolean;
  isEscalated: boolean;
  unreadCount: number;
  lastMessageAt: Date;
  branchId: string;
  preview: string | null;
  labels: { id: string; name: string; color: string }[];
  typing: { userId: string; expiresAt: Date }[];
};

export type MessageRow = {
  id: string;
  conversationId: string;
  direction: string;
  authorType: string;
  authorId: string | null;
  authorName: string | null;
  contentType: string;
  body: string | null;
  deliveryStatus: string;
  readAt: Date | null;
  createdAt: Date;
  attachments: {
    id: string;
    storageKey: string;
    mimeType: string;
    sizeBytes: string;
    fileName: string | null;
  }[];
};

export type NoteRow = {
  id: string;
  authorId: string | null;
  authorName: string | null;
  body: string;
  createdAt: Date;
};

export type LabelRow = { id: string; name: string; color: string };

export type ConversationDetail = {
  id: string;
  contactId: string;
  contactDisplayName: string;
  contactLocale: string;
  contactPhone: string;
  contactEmail: string | null;
  assigneeId: string | null;
  assigneeName: string | null;
  status: string;
  isPinned: boolean;
  isEscalated: boolean;
  unreadCount: number;
  lastMessageAt: Date;
  branchId: string;
  labels: LabelRow[];
};

export type SearchHit = {
  conversationId: string;
  messageId: string;
  body: string;
  direction: string;
  contentType: string;
  createdAt: Date;
  contactDisplayName: string;
};

export type TypingRow = { userId: string; expiresAt: Date };

export type SummaryRow = {
  summary: string;
  model: string;
  version: number;
  status: string;
  updatedAt: Date;
};

// ---------------------------------------------------------------------------
// Repository
// ---------------------------------------------------------------------------

export class InboxRepository {
  private readonly db: ReturnType<typeof forScope>;
  private readonly organizationId: string;

  constructor(scope: Scope) {
    this.db = forScope(scope);
    this.organizationId = scope.organizationId;
  }

  /** Builds a repository from an organization id (org-level scope, all branches). */
  static forOrganization(organizationId: string): InboxRepository {
    return new InboxRepository(resolveScope(organizationId));
  }

  // -- Conversation list -----------------------------------------------------

  /**
   * Cursor-paginated conversation list, newest activity first.
   *
   * Ordering: pinned first, then unread (unreadCount desc, NULLs never here since
   * the column is NOT NULL default 0), then lastMessageAt desc — a stable, indexed
   * sort that matches the inbox "most important first" rule.
   */
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
      orderBy: [
        { isPinned: 'desc' },
        { unreadCount: 'desc' },
        { lastMessageAt: 'desc' },
      ],
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

  // -- Conversation detail ---------------------------------------------------

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

  // -- Messages --------------------------------------------------------------

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

  // -- Notes ----------------------------------------------------------------

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

  // -- Labels ----------------------------------------------------------------

  async listLabels(): Promise<LabelRow[]> {
    const rows = await this.db.label.findMany({
      orderBy: { name: 'asc' },
      select: { id: true, name: true, color: true },
    });
    return rows;
  }

  async createLabel(name: string, color: string): Promise<LabelRow> {
    const branchId = await this.resolveDefaultBranch();
    const row = await this.db.label.create({
      data: { organizationId: this.organizationId, branchId, name, color },
      select: { id: true, name: true, color: true },
    });
    return row;
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

  // -- Mutations -------------------------------------------------------------

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
    const conversation = await this.assertConversation(input.conversationId);

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

    void conversation;
    return mapMessageRow(created as never);
  }

  /** Marks the conversation read for a user (idempotent), zeroing unreadCount. */
  async markRead(conversationId: string, userId: string): Promise<void> {
    const conversation = await this.assertConversation(conversationId);

    await this.db.$transaction(async (tx) => {
      // Upsert the per-user read receipt.
      await tx.conversationRead.upsert({
        where: {
          conversationId_userId: { conversationId, userId },
        },
        create: {
          organizationId: this.organizationId,
          conversationId,
          userId,
          lastReadAt: new Date(),
        },
        update: { lastReadAt: new Date() },
      });

      // Zero the denormalised counter (only if the reader is the assignee or there
      // is no assignee — the counter is org-level, so clear it for the org).
      await tx.conversation.updateMany({
        where: { id: conversationId, unreadCount: { gt: 0 } },
        data: { unreadCount: 0 },
      });
    });

    void conversation;
  }

  /** Writes/refreshes a typing row with a TTL; expired rows self-clean. */
  async setTyping(conversationId: string, userId: string, ttlSeconds = 10): Promise<void> {
    await this.assertConversation(conversationId);
    const now = new Date();
    const expiresAt = new Date(now.getTime() + ttlSeconds * 1000);

    await this.db.$transaction(async (tx) => {
      await tx.conversationTyping.deleteMany({ where: { expiresAt: { lt: now } } });
      await tx.conversationTyping.upsert({
        where: { conversationId_userId: { conversationId, userId } },
        create: {
          organizationId: this.organizationId,
          conversationId,
          userId,
          expiresAt,
        },
        update: { expiresAt, startedAt: now },
      });
    });
  }

  async archiveConversation(conversationId: string, archive: boolean): Promise<void> {
    const conversation = await this.assertConversation(conversationId);
    const target = archive ? 'archived' : conversation.status === 'archived' ? 'open' : conversation.status;
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

  async createNote(conversationId: string, authorId: string, body: string): Promise<NoteRow> {
    const conversation = await this.assertConversation(conversationId);
    void conversation;
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

  // -- Summary ---------------------------------------------------------------

  async getSummary(conversationId: string): Promise<SummaryRow | null> {
    const row = await this.db.conversationSummary.findFirst({
      where: { conversationId, status: 'current' },
      orderBy: { version: 'desc' },
      select: { summary: true, model: true, version: true, status: true, updatedAt: true },
    });
    return row ?? null;
  }

  async upsertSummary(conversationId: string, summary: string, model = 'heuristic'): Promise<void> {
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

  // -- Search ----------------------------------------------------------------

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

  // -- Typing ----------------------------------------------------------------

  async listTyping(conversationId: string): Promise<TypingRow[]> {
    await this.assertConversation(conversationId);
    const rows = await this.db.conversationTyping.findMany({
      where: { conversationId, expiresAt: { gt: new Date() } },
      select: { userId: true, expiresAt: true },
    });
    return rows;
  }

  // -- Internal --------------------------------------------------------------

  /** Asserts the conversation exists in this tenant; returns it. */
  private async assertConversation(conversationId: string) {
    const conversation = await this.db.conversation.findFirst({
      where: { id: conversationId },
      select: { id: true, status: true, branchId: true },
    });
    if (!conversation) throw new NotFoundError('Conversation not found.');
    return conversation;
  }

  /** Resolves the org's default branch (needed for branch-scoped creates). */
  private async resolveDefaultBranch(): Promise<string> {
    const branch = await this.db.branch.findFirst({
      where: { isDefault: true },
      select: { id: true },
    });
    if (!branch) throw new NotFoundError('No default branch for this organization.');
    return branch.id;
  }
}

// ---------------------------------------------------------------------------
// Mappers & helpers
// ---------------------------------------------------------------------------

const messageSelect = {
  id: true,
  conversationId: true,
  direction: true,
  authorType: true,
  authorId: true,
  author: { select: { name: true } },
  contentType: true,
  body: true,
  deliveryStatus: true,
  readAt: true,
  createdAt: true,
  attachments: {
    select: {
      id: true,
      storageKey: true,
      mimeType: true,
      sizeBytes: true,
      fileName: true,
    },
  },
} as const;

function mapMessageRow(row: {
  id: string;
  conversationId: string;
  direction: string;
  authorType: string;
  authorId: string | null;
  author: { name: string | null } | null;
  contentType: string;
  body: string | null;
  deliveryStatus: string;
  readAt: Date | null;
  createdAt: Date;
  attachments: {
    id: string;
    storageKey: string;
    mimeType: string;
    sizeBytes: bigint;
    fileName: string | null;
  }[];
}): MessageRow {
  return {
    id: row.id,
    conversationId: row.conversationId,
    direction: row.direction,
    authorType: row.authorType,
    authorId: row.authorId,
    authorName: row.author?.name ?? null,
    contentType: row.contentType,
    body: row.body,
    deliveryStatus: row.deliveryStatus,
    readAt: row.readAt,
    createdAt: row.createdAt,
    attachments: row.attachments.map((a) => ({
      id: a.id,
      storageKey: a.storageKey,
      mimeType: a.mimeType,
      sizeBytes: a.sizeBytes.toString(),
      fileName: a.fileName,
    })),
  };
}

function mapConversationRow(row: {
  id: string;
  contactId: string;
  status: string;
  isPinned: boolean;
  isEscalated: boolean;
  unreadCount: number;
  lastMessageAt: Date;
  branchId: string;
  assigneeId: string | null;
  assignee: { name: string | null } | null;
  contact: { displayName: string; locale: string; phoneNumber: string; email: string | null };
  labels: { label: { id: string; name: string; color: string } }[];
  messages: { body: string | null }[];
  typing: { userId: string; expiresAt: Date }[];
}): ConversationRow {
  return {
    id: row.id,
    contactId: row.contactId,
    contactDisplayName: row.contact.displayName,
    contactLocale: row.contact.locale,
    contactPhone: row.contact.phoneNumber,
    contactEmail: row.contact.email,
    assigneeId: row.assigneeId,
    assigneeName: row.assignee?.name ?? null,
    status: row.status,
    isPinned: row.isPinned,
    isEscalated: row.isEscalated,
    unreadCount: row.unreadCount,
    lastMessageAt: row.lastMessageAt,
    branchId: row.branchId,
    preview: row.messages[0]?.body ?? null,
    labels: row.labels.map((l) => l.label),
    typing: row.typing,
  };
}

function mapConversationDetail(row: {
  id: string;
  contactId: string;
  status: string;
  isPinned: boolean;
  isEscalated: boolean;
  unreadCount: number;
  lastMessageAt: Date;
  branchId: string;
  assigneeId: string | null;
  assignee: { name: string | null } | null;
  contact: { displayName: string; locale: string; phoneNumber: string; email: string | null };
  labels: { label: { id: string; name: string; color: string } }[];
}): ConversationDetail {
  return {
    id: row.id,
    contactId: row.contactId,
    contactDisplayName: row.contact.displayName,
    contactLocale: row.contact.locale,
    contactPhone: row.contact.phoneNumber,
    contactEmail: row.contact.email,
    assigneeId: row.assigneeId,
    assigneeName: row.assignee?.name ?? null,
    status: row.status,
    isPinned: row.isPinned,
    isEscalated: row.isEscalated,
    unreadCount: row.unreadCount,
    lastMessageAt: row.lastMessageAt,
    branchId: row.branchId,
    labels: row.labels.map((l) => l.label),
  };
}

/** Stable cursor: `${lastMessageAt.getTime()}|${id}`. */
function encodeCursor(lastMessageAt: Date, id: string): string {
  return `${lastMessageAt.getTime()}|${id}`;
}

function decodeCursor(cursor: string): [Date, string] {
  const [time, id] = cursor.split('|');
  return [new Date(Number(time)), id ?? ''];
}
