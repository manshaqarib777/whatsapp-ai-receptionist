'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { uploadDirectlyWhenConfigured } from '@/lib/storage-upload.client';

import type {
  KnowledgeDocumentDetail,
  KnowledgeJobRow,
  KnowledgeSourceRow,
  SourceWithDocuments,
} from '@/features/knowledge/repositories/knowledge.repository';
import type { SearchHit } from '@/features/knowledge/lib/retrieval';

/**
 * React Query hooks for the knowledge base (AD-3).
 *
 * Query keys are centralised per feature so invalidation cannot silently miss a
 * cache entry. Job status is polled while a job is running (`refetchInterval`
 * stops when the tab is hidden).
 */

export const knowledgeKeys = {
  all: ['knowledge'] as const,
  sources: () => [...knowledgeKeys.all, 'sources'] as const,
  source: (id: string) => [...knowledgeKeys.all, 'source', id] as const,
  document: (id: string) => [...knowledgeKeys.all, 'document', id] as const,
  job: (id: string) => [...knowledgeKeys.all, 'job', id] as const,
  jobs: () => [...knowledgeKeys.all, 'jobs'] as const,
  search: (q: string) => [...knowledgeKeys.all, 'search', q] as const,
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

async function sendJson<T>(
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

export function useSources() {
  return useQuery({
    queryKey: knowledgeKeys.sources(),
    queryFn: () => fetchJson<{ sources: KnowledgeSourceRow[] }>('/api/knowledge/sources'),
  });
}

export function useSource(id: string) {
  return useQuery({
    queryKey: knowledgeKeys.source(id),
    queryFn: () =>
      fetchJson<{ source: SourceWithDocuments }>(`/api/knowledge/sources/${id}`),
    enabled: id.length > 0,
  });
}

export function useDocument(id: string) {
  return useQuery({
    queryKey: knowledgeKeys.document(id),
    queryFn: () =>
      fetchJson<{ document: KnowledgeDocumentDetail }>(`/api/knowledge/documents/${id}`),
    enabled: id.length > 0,
  });
}

export function useJob(id: string) {
  return useQuery({
    queryKey: knowledgeKeys.job(id),
    queryFn: () => fetchJson<{ job: KnowledgeJobRow }>(`/api/knowledge/jobs/${id}`),
    enabled: id.length > 0,
    refetchInterval: (query) => {
      const status = query.state.data?.job.status;
      return status === 'queued' || status === 'running' ? 2000 : false;
    },
  });
}

export function useKnowledgeSearch(q: string, enabled: boolean) {
  return useQuery({
    queryKey: knowledgeKeys.search(q),
    queryFn: () =>
      fetchJson<{ hits: SearchHit[] }>(
        `/api/knowledge/search?q=${encodeURIComponent(q)}`,
      ),
    enabled: enabled && q.trim().length > 0,
  });
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

function invalidateKnowledge(queryClient: ReturnType<typeof useQueryClient>) {
  void queryClient.invalidateQueries({ queryKey: knowledgeKeys.all });
}

export type CreateSourceInput = {
  kind: 'upload' | 'pdf' | 'docx' | 'csv' | 'website' | 'faq';
  name: string;
  url?: string;
  faq?: { question: string; answer: string }[];
};

export function useCreateSource() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateSourceInput) =>
      sendJson<{
        source: KnowledgeSourceRow;
        documentId?: string;
        versionId?: string;
        jobId?: string;
      }>('/api/knowledge/sources', 'POST', input),
    onSuccess: () => invalidateKnowledge(queryClient),
  });
}

export function useUploadDocument(sourceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { title: string; file: File }) => {
      const direct = await uploadDirectlyWhenConfigured({
        file: input.file,
        purpose: 'knowledge',
        resourceId: sourceId,
      });
      if (direct) {
        const response = await fetch(`/api/knowledge/sources/${sourceId}/documents`, {
          method: 'POST',
          body: JSON.stringify({ ...direct, title: input.title }),
          headers: { 'content-type': 'application/json', accept: 'application/json' },
        });
        if (!response.ok)
          throw new Error(`Upload finalization failed (${response.status})`);
        const payload = (await response.json()) as {
          data: { documentId: string; versionId: string; jobId: string };
        };
        return payload.data;
      }
      const form = new FormData();
      form.set('title', input.title);
      form.set('file', input.file);
      return fetch(`/api/knowledge/sources/${sourceId}/documents`, {
        method: 'POST',
        body: form,
        headers: { accept: 'application/json' },
      })
        .then((response) => {
          if (!response.ok) {
            const error = new Error(`Upload failed (${response.status})`) as Error & {
              status?: number;
            };
            error.status = response.status;
            throw error;
          }
          return response.json() as Promise<{
            data: { documentId: string; versionId: string; jobId: string };
          }>;
        })
        .then((payload) => payload.data);
    },
    onSuccess: () => invalidateKnowledge(queryClient),
  });
}

export function useSubmitVersion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { documentId: string; versionId: string }) =>
      sendJson<{ ok: true }>(
        `/api/knowledge/documents/${input.documentId}/versions/${input.versionId}/submit`,
        'POST',
      ),
    onSuccess: () => invalidateKnowledge(queryClient),
  });
}

export function useApproveVersion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { documentId: string; versionId: string }) =>
      sendJson<{ ok: true }>(
        `/api/knowledge/documents/${input.documentId}/versions/${input.versionId}/approve`,
        'POST',
      ),
    onSuccess: () => invalidateKnowledge(queryClient),
  });
}

export function useArchiveVersion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { documentId: string; versionId: string }) =>
      sendJson<{ ok: true }>(
        `/api/knowledge/documents/${input.documentId}/versions/${input.versionId}/archive`,
        'POST',
      ),
    onSuccess: () => invalidateKnowledge(queryClient),
  });
}
