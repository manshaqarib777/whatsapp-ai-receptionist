'use client';

import { useQuery, type QueryKey } from '@tanstack/react-query';

import type {
  ConversationDetail,
  ConversationRow,
  LabelRow,
  MessageRow,
  NoteRow,
  SearchHit,
} from '@/features/inbox/repositories/inbox.repository';

/**
 * React Query hooks for the inbox (AD-3).
 *
 * Query keys are centralised per feature rather than written inline, so that
 * invalidation cannot silently miss a cache entry
 * (.claude/CODING_STANDARDS.md → React Query). Real-time behaviour is polling via
 * `refetchInterval`, which stops when the tab is hidden (AD-3, R-2).
 */

export const inboxKeys = {
  all: ['inbox'] as const,
  conversations: (params: Record<string, unknown> = {}) =>
    [...inboxKeys.all, 'conversations', params] as const,
  conversation: (id: string) => [...inboxKeys.all, 'conversation', id] as const,
  thread: (id: string) => [...inboxKeys.all, 'thread', id] as const,
  labels: () => [...inboxKeys.all, 'labels'] as const,
  members: () => [...inboxKeys.all, 'members'] as const,
  search: (q: string) => [...inboxKeys.all, 'search', q] as const,
};

// ---------------------------------------------------------------------------
// Fetch helpers
// ---------------------------------------------------------------------------

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    headers: { accept: 'application/json' },
    cache: 'no-store',
  });
  if (!response.ok) {
    const error = new Error(`Request failed (${response.status})`) as Error & {
      status?: number;
    };
    error.status = response.status;
    throw error;
  }
  const payload = (await response.json()) as { data: T };
  return payload.data;
}

/**
 * The API serialises Dates to ISO strings over JSON; the row types declare
 * `Date`. Rehydrate the fields the components call date methods on, or a row
 * crashes with `lastMessageAt.toISOString is not a function`.
 */
function rehydrateConversationRows(rows: ConversationRow[]): ConversationRow[] {
  return rows.map((row) => ({
    ...row,
    lastMessageAt: new Date(row.lastMessageAt),
    typing: row.typing.map((t) => ({ ...t, expiresAt: new Date(t.expiresAt) })),
  }));
}

export async function sendJson<T>(
  url: string,
  method: 'POST' | 'PATCH' | 'DELETE',
  body?: unknown,
): Promise<T> {
  const response = await fetch(url, {
    method,
    headers: { 'content-type': 'application/json', accept: 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!response.ok) {
    const error = new Error(`Request failed (${response.status})`) as Error & {
      status?: number;
    };
    error.status = response.status;
    throw error;
  }
  const payload = (await response.json()) as { data: T };
  return payload.data;
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export type ConversationListResponse = {
  rows: ConversationRow[];
  nextCursor: string | null;
};

export function useConversations(params: Record<string, unknown> = {}) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue;
    query.set(key, String(value));
  }
  const qs = query.toString();

  return useQuery({
    queryKey: inboxKeys.conversations(params),
    queryFn: async () => {
      const data = await fetchJson<ConversationListResponse>(
        `/api/inbox/conversations${qs ? `?${qs}` : ''}`,
      );
      return { ...data, rows: rehydrateConversationRows(data.rows) };
    },
    refetchInterval: (query) => (query.state.data ? 5000 : false),
  });
}

export function useConversation(id: string) {
  return useQuery({
    queryKey: inboxKeys.conversation(id),
    queryFn: () => fetchJson<ConversationDetail>(`/api/inbox/conversations/${id}`),
  });
}

export type ThreadResponse = {
  conversation: ConversationDetail;
  messages: MessageRow[];
  notes: NoteRow[];
  summary: {
    summary: string;
    model: string;
    version: number;
    status: string;
    updatedAt: Date;
  };
  suggestions: {
    kind: 'escalate' | 'resolve' | 'reply' | 'follow-up' | 'label' | 'faq';
    title: string;
    description: string;
    action: string;
  }[];
  typing: { userId: string; expiresAt: Date }[];
};

export function useThread(id: string) {
  return useQuery({
    queryKey: inboxKeys.thread(id),
    queryFn: async () => {
      const data = await fetchJson<ThreadResponse>(`/api/inbox/conversations/${id}`);
      return rehydrateThread(data);
    },
    refetchInterval: (query) => (query.state.data ? 4000 : false),
  });
}

/**
 * Rehydrates the Date fields on a thread response (see rehydrateConversationRows).
 */
function rehydrateThread(data: ThreadResponse): ThreadResponse {
  return {
    ...data,
    conversation: {
      ...data.conversation,
      lastMessageAt: new Date(data.conversation.lastMessageAt),
    },
    messages: data.messages.map((message) => ({
      ...message,
      createdAt: new Date(message.createdAt),
      readAt: message.readAt ? new Date(message.readAt) : null,
    })),
    notes: data.notes.map((note) => ({ ...note, createdAt: new Date(note.createdAt) })),
    summary: { ...data.summary, updatedAt: new Date(data.summary.updatedAt) },
    typing: data.typing.map((t) => ({ ...t, expiresAt: new Date(t.expiresAt) })),
  };
}

export function useLabels() {
  return useQuery({
    queryKey: inboxKeys.labels(),
    queryFn: async () => {
      const data = await fetchJson<{ labels: LabelRow[] }>('/api/inbox/labels');
      return data.labels;
    },
  });
}

export type AssignableMember = { userId: string; name: string; email: string };

export function useAssignableMembers() {
  return useQuery({
    queryKey: inboxKeys.members(),
    queryFn: () => fetchJson<AssignableMember[]>('/api/members'),
  });
}

export function useSearch(q: string) {
  return useQuery({
    queryKey: inboxKeys.search(q),
    queryFn: () => fetchJson<SearchHit[]>(`/api/inbox/search?q=${encodeURIComponent(q)}`),
    enabled: q.trim().length > 0,
  });
}

export {
  useAddLabel,
  useArchiveConversation,
  useCreateLabel,
  useCreateNote,
  useMarkRead,
  useRemoveLabel,
  useSendMessage,
  useSetTyping,
  useUpdateConversation,
  useUploadAttachment,
} from './use-inbox-mutations';

// ---------------------------------------------------------------------------
// Type helpers for invalidating a specific conversation
// ---------------------------------------------------------------------------

export function conversationKey(id: string): QueryKey {
  return inboxKeys.conversation(id);
}
