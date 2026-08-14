'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

/**
 * React Query hooks for the AI Engine (M8).
 */

export const aiKeys = {
  all: ['ai'] as const,
  runs: (conversationId?: string) =>
    [...aiKeys.all, 'runs', conversationId ?? 'org'] as const,
  templates: () => [...aiKeys.all, 'templates'] as const,
  template: (id: string) => [...aiKeys.all, 'template', id] as const,
};

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
  method: 'POST' | 'PATCH',
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

export type AiRun = {
  id: string;
  conversationId: string | null;
  model: string;
  intent: string | null;
  confidence: number | null;
  inputTokens: number;
  outputTokens: number;
  costAmount: number;
  costCurrency: string;
  latencyMs: number;
  outcome: string;
  createdAt: string;
};

export function useAiRuns(conversationId?: string) {
  return useQuery({
    queryKey: aiKeys.runs(conversationId),
    queryFn: () =>
      fetchJson<{ runs: AiRun[] }>(
        conversationId
          ? `/api/ai/runs?conversationId=${encodeURIComponent(conversationId)}`
          : '/api/ai/runs',
      ),
  });
}

export type PromptTemplate = {
  id: string;
  key: string;
  name: string;
  currentVersionId: string | null;
  version: number;
  createdAt: string;
};

export function useTemplates() {
  return useQuery({
    queryKey: aiKeys.templates(),
    queryFn: () => fetchJson<{ templates: PromptTemplate[] }>('/api/ai/templates'),
  });
}

export function useRunTurn() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { conversationId: string; message: string }) =>
      sendJson<{ run: RunTurnResult }>('/api/ai/runs', 'POST', input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: aiKeys.all });
    },
  });
}

export type RunTurnResult = {
  intent: { label: string; confidence: number; model: string };
  reply: string;
  outcome: 'answered' | 'escalated' | 'refused' | 'failed';
  runId: string;
  latencyMs: number;
};
