import type { ConversationDetail, ConversationRow, MessageRow } from './inbox.types';
import { signStorageKey } from '@/lib/storage';

export const messageSelect = {
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

export function mapMessageRow(row: {
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
      downloadUrl: `/api/storage/${signStorageKey(a.storageKey)}`,
      mimeType: a.mimeType,
      sizeBytes: a.sizeBytes.toString(),
      fileName: a.fileName,
    })),
  };
}

export function mapConversationRow(row: {
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
  contact: {
    displayName: string;
    locale: string;
    phoneNumber: string;
    email: string | null;
  };
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

export function mapConversationDetail(row: {
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
  contact: {
    displayName: string;
    locale: string;
    phoneNumber: string;
    email: string | null;
  };
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
export function encodeCursor(lastMessageAt: Date, id: string): string {
  return `${lastMessageAt.getTime()}|${id}`;
}

export function decodeCursor(cursor: string): [Date, string] {
  const [time, id] = cursor.split('|');
  return [new Date(Number(time)), id ?? ''];
}
