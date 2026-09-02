'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { uploadDirectlyWhenConfigured } from '@/lib/storage-upload.client';

import type {
  LabelRow,
  MessageRow,
  NoteRow,
} from '@/features/inbox/repositories/inbox.repository';
import { inboxKeys, sendJson } from './use-inbox';

function useInboxMutation<TInput, TResult>(
  mutationFn: (input: TInput) => Promise<TResult>,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: inboxKeys.all }),
  });
}

export function useSendMessage(conversationId: string) {
  return useInboxMutation((body: string) =>
    sendJson<MessageRow>(`/api/inbox/conversations/${conversationId}/messages`, 'POST', {
      body,
    }),
  );
}

export function useCreateNote(conversationId: string) {
  return useInboxMutation((body: string) =>
    sendJson<NoteRow>(`/api/inbox/conversations/${conversationId}/notes`, 'POST', {
      body,
    }),
  );
}

export function useMarkRead(conversationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () =>
      sendJson<void>(`/api/inbox/conversations/${conversationId}/read`, 'POST'),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: inboxKeys.all }),
  });
}

export function useSetTyping(conversationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () =>
      sendJson<void>(`/api/inbox/conversations/${conversationId}/typing`, 'POST'),
    onSuccess: () =>
      void queryClient.invalidateQueries({ queryKey: inboxKeys.thread(conversationId) }),
  });
}

export function useArchiveConversation(conversationId: string) {
  return useInboxMutation((archive: boolean) =>
    sendJson<void>(`/api/inbox/conversations/${conversationId}/archive`, 'POST', {
      archive,
    }),
  );
}

export function useUpdateConversation(conversationId: string) {
  return useInboxMutation((patch: { assigneeId?: string | null; isPinned?: boolean }) =>
    sendJson<void>(`/api/inbox/conversations/${conversationId}`, 'PATCH', patch),
  );
}

export function useAddLabel(conversationId: string) {
  return useInboxMutation((labelId: string) =>
    sendJson<void>(`/api/inbox/conversations/${conversationId}/labels`, 'POST', {
      labelId,
    }),
  );
}

export function useRemoveLabel(conversationId: string) {
  return useInboxMutation((labelId: string) =>
    sendJson<void>(
      `/api/inbox/conversations/${conversationId}/labels/${labelId}`,
      'DELETE',
    ),
  );
}

export function useCreateLabel() {
  return useInboxMutation((input: { name: string; color: string }) =>
    sendJson<LabelRow>('/api/inbox/labels', 'POST', input),
  );
}

export function useUploadAttachment(conversationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (file: File) => {
      const direct = await uploadDirectlyWhenConfigured({
        file,
        purpose: 'inbox',
        resourceId: conversationId,
      });
      if (direct) {
        const response = await fetch(
          `/api/inbox/conversations/${conversationId}/attachments`,
          {
            method: 'POST',
            body: JSON.stringify(direct),
            headers: { 'content-type': 'application/json', accept: 'application/json' },
          },
        );
        if (!response.ok)
          throw new Error(`Upload finalization failed (${response.status})`);
        return (await response.json()) as { data: unknown };
      }
      const form = new FormData();
      form.set('file', file);
      const response = await fetch(
        `/api/inbox/conversations/${conversationId}/attachments`,
        { method: 'POST', body: form, headers: { accept: 'application/json' } },
      );
      if (!response.ok) throw new Error(`Upload failed (${response.status})`);
      return (await response.json()) as { data: unknown };
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: inboxKeys.all }),
  });
}
