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
  agents: () => [...aiKeys.all, 'agents'] as const,
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
    mutationFn: (input: { inputMessageId: string }) =>
      sendJson<{ job: AiTurnJob }>('/api/ai/runs', 'POST', input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: aiKeys.all });
    },
  });
}

export type AiTurnJob = {
  id: string;
  status: 'queued' | 'running' | 'succeeded' | 'failed';
  runId: string | null;
};

export type AiAgent = {
  id: string;
  kind: string;
  displayName: string;
  description: string;
  purpose: string;
  enabled: boolean;
  tools: readonly string[];
  promptTemplateId: string | null;
  version: number;
};

export function useAiAgents() {
  return useQuery({
    queryKey: aiKeys.agents(),
    queryFn: () => fetchJson<{ agents: AiAgent[] }>('/api/ai/agents'),
  });
}

export function useUpdateAiAgent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      ...input
    }: {
      id: string;
      version: number;
      displayName?: string;
      description?: string;
      enabled?: boolean;
    }) => sendJson<{ agent: AiAgent }>(`/api/ai/agents/${id}`, 'PATCH', input),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: aiKeys.agents() }),
  });
}

export function useTestAiAgent() {
  return useMutation({
    mutationFn: ({ id, message }: { id: string; message: string }) =>
      sendJson<{
        result: { routedKind: string | null; wouldHandle: boolean; reply: string };
      }>(`/api/ai/agents/${id}/test`, 'POST', { message }),
  });
}
