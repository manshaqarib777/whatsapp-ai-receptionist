/**
 * Inbox row types shared by the aggregate repositories — Milestone 6.
 *
 * Split out of inbox.repository.ts so each aggregate repository stays under the
 * 300-line architecture rule while every consumer keeps one import surface.
 */

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
    downloadUrl: string;
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
