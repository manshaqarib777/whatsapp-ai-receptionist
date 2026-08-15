'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

/**
 * React Query hooks for the CRM (M10).
 */

export const crmKeys = {
  all: ['crm'] as const,
  pipelines: () => [...crmKeys.all, 'pipelines'] as const,
  deals: (filter: Record<string, string> = {}) =>
    [...crmKeys.all, 'deals', filter] as const,
  deal: (id: string) => [...crmKeys.all, 'deals', id] as const,
  companies: () => [...crmKeys.all, 'companies'] as const,
  tags: () => [...crmKeys.all, 'tags'] as const,
  tasks: (status?: string) => [...crmKeys.all, 'tasks', status ?? 'all'] as const,
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
// Types
// ---------------------------------------------------------------------------

export type Pipeline = {
  id: string;
  name: string;
  isDefault: boolean;
  stages: {
    id: string;
    pipelineId: string;
    name: string;
    position: number;
    winProbability: number;
    dealCount: number;
  }[];
};

export type Deal = {
  id: string;
  contactId: string | null;
  companyId: string | null;
  stageId: string;
  stageName: string;
  title: string;
  valueAmount: number;
  valueCurrency: string;
  status: 'open' | 'won' | 'lost';
  closedAt: string | null;
  createdAt: string;
  updatedAt: string;
  version: number;
  contactName: string | null;
  companyName: string | null;
  tags: { id: string; name: string; color: string }[];
};

export type Activity = {
  id: string;
  subjectType: 'contact' | 'deal' | 'conversation';
  subjectId: string;
  kind: string;
  body: string | null;
  actorName: string | null;
  createdAt: string;
};

export type Company = {
  id: string;
  name: string;
  vatNumber: string | null;
  createdAt: string;
  contactCount: number;
  dealCount: number;
};

export type Tag = {
  id: string;
  name: string;
  color: string;
};

export type Task = {
  id: string;
  title: string;
  description: string | null;
  dueAt: string | null;
  status: 'open' | 'in_progress' | 'done' | 'cancelled';
  assigneeName: string | null;
  createdAt: string;
  updatedAt: string;
};

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export function usePipelines() {
  return useQuery({
    queryKey: crmKeys.pipelines(),
    queryFn: () => fetchJson<{ pipelines: Pipeline[] }>('/api/crm/pipelines'),
  });
}

export function useDeals(filter: Record<string, string> = {}) {
  const params = new URLSearchParams(filter);
  const query = params.toString();
  return useQuery({
    queryKey: crmKeys.deals(filter),
    queryFn: () =>
      fetchJson<{ deals: Deal[] }>(`/api/crm/deals${query ? `?${query}` : ''}`),
  });
}

export function useDeal(id: string) {
  return useQuery({
    queryKey: crmKeys.deal(id),
    queryFn: () =>
      fetchJson<{ deal: Deal; activities: Activity[] }>(`/api/crm/deals/${id}`),
    enabled: id.length > 0,
  });
}

export function useCompanies() {
  return useQuery({
    queryKey: crmKeys.companies(),
    queryFn: () => fetchJson<{ companies: Company[] }>('/api/crm/companies'),
  });
}

export function useTags() {
  return useQuery({
    queryKey: crmKeys.tags(),
    queryFn: () => fetchJson<{ tags: Tag[] }>('/api/crm/tags'),
  });
}

export function useTasks(status?: string) {
  return useQuery({
    queryKey: crmKeys.tasks(status),
    queryFn: () =>
      fetchJson<{ tasks: Task[] }>(
        `/api/crm/tasks${status && status !== 'all' ? `?status=${encodeURIComponent(status)}` : ''}`,
      ),
  });
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

export function useCreateDeal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      title: string;
      stageId: string;
      valueAmount?: number;
      valueCurrency?: string;
      contactId?: string;
      companyId?: string;
    }) => sendJson<{ deal: Deal }>('/api/crm/deals', 'POST', input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: crmKeys.deals() });
      void queryClient.invalidateQueries({ queryKey: crmKeys.pipelines() });
    },
  });
}

export function useMoveDeal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { id: string; stageId: string }) =>
      sendJson<{ deal: Deal }>(`/api/crm/deals/${input.id}`, 'PATCH', {
        stageId: input.stageId,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: crmKeys.deals() });
      void queryClient.invalidateQueries({ queryKey: crmKeys.pipelines() });
    },
  });
}

export function useCloseDeal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { id: string; status: 'won' | 'lost' }) =>
      sendJson<{ deal: Deal }>(`/api/crm/deals/${input.id}`, 'PATCH', {
        status: input.status,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: crmKeys.deals() });
      void queryClient.invalidateQueries({ queryKey: crmKeys.pipelines() });
    },
  });
}

export function useAddActivity() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      dealId: string;
      kind: 'note' | 'call' | 'email' | 'meeting';
      body: string;
    }) =>
      sendJson<{ activity: Activity }>(
        `/api/crm/deals/${input.dealId}/activities`,
        'POST',
        { kind: input.kind, body: input.body },
      ),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: crmKeys.deal(variables.dealId) });
    },
  });
}

export function useCreateCompany() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { name: string; vatNumber?: string }) =>
      sendJson<{ company: Company }>('/api/crm/companies', 'POST', input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: crmKeys.companies() });
    },
  });
}

export function useCreateTag() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { name: string; color: string }) =>
      sendJson<{ tag: Tag }>('/api/crm/tags', 'POST', input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: crmKeys.tags() });
    },
  });
}

export function useAssignTag() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      tagId: string;
      taggableType: 'contact' | 'deal' | 'conversation';
      taggableId: string;
    }) =>
      sendJson<{ ok: true }>(`/api/crm/tags/${input.tagId}/assign`, 'POST', {
        taggableType: input.taggableType,
        taggableId: input.taggableId,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: crmKeys.deals() });
      void queryClient.invalidateQueries({ queryKey: crmKeys.all });
    },
  });
}

export function useCreateTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { title: string; description?: string; dueAt?: string }) =>
      sendJson<{ task: Task }>('/api/crm/tasks', 'POST', input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: crmKeys.tasks() });
    },
  });
}

export function useUpdateTaskStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      id: string;
      status: 'open' | 'in_progress' | 'done' | 'cancelled';
    }) =>
      sendJson<{ task: Task }>(`/api/crm/tasks/${input.id}`, 'PATCH', {
        status: input.status,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: crmKeys.tasks() });
    },
  });
}
