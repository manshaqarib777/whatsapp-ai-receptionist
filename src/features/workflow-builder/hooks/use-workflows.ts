'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type {
  WorkflowRow,
  WorkflowRunRow,
  WorkflowVersionRow,
} from '@/features/workflow-builder/repositories/workflows.repository';
import type {
  WorkflowDefinition,
  WorkflowTriggerKind,
} from '@/features/workflow-builder/services/graph';

/**
 * React Query hooks for the workflow builder (M13).
 */

export const workflowKeys = {
  all: ['workflows'] as const,
  list: () => [...workflowKeys.all, 'list'] as const,
  detail: (id: string) => [...workflowKeys.all, id] as const,
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

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export type WorkflowDetail = {
  workflow: WorkflowRow;
  versions: WorkflowVersionRow[];
  runs: WorkflowRunRow[];
};

export function useWorkflows() {
  return useQuery({
    queryKey: workflowKeys.list(),
    queryFn: () => fetchJson<{ workflows: WorkflowRow[] }>('/api/workflows'),
  });
}

export function useWorkflow(id: string) {
  return useQuery({
    queryKey: workflowKeys.detail(id),
    queryFn: () => fetchJson<WorkflowDetail>(`/api/workflows/${id}`),
    enabled: id.length > 0,
  });
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

export function useCreateWorkflow() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { name: string }) =>
      sendJson<{ workflow: WorkflowRow }>('/api/workflows', 'POST', input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: workflowKeys.list() });
    },
  });
}

export function useUpdateWorkflow() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { id: string; name?: string; isEnabled?: boolean }) =>
      sendJson<{ workflow: WorkflowRow }>(`/api/workflows/${input.id}`, 'PATCH', {
        name: input.name,
        isEnabled: input.isEnabled,
      }),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: workflowKeys.list() });
      void queryClient.invalidateQueries({ queryKey: workflowKeys.detail(variables.id) });
    },
  });
}

export function useSaveVersion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      workflowId: string;
      definition: WorkflowDefinition;
      triggerKind: WorkflowTriggerKind;
    }) =>
      sendJson<{ version: WorkflowVersionRow }>(
        `/api/workflows/${input.workflowId}/versions`,
        'POST',
        { definition: input.definition, triggerKind: input.triggerKind },
      ),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({
        queryKey: workflowKeys.detail(variables.workflowId),
      });
    },
  });
}

export function useCreateRun() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (workflowId: string) =>
      sendJson<{ run: WorkflowRunRow; steps: { nodeId: string; status: string }[] }>(
        `/api/workflows/${workflowId}/runs`,
        'POST',
      ),
    onSuccess: (_data, workflowId) => {
      void queryClient.invalidateQueries({ queryKey: workflowKeys.detail(workflowId) });
    },
  });
}
