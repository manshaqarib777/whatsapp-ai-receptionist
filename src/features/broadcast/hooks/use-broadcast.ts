'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { CampaignAnalytics } from '@/features/broadcast/services/broadcast.service';
import type { SegmentDefinition } from '@/features/broadcast/services/segments';
import type {
  CampaignRow,
  RecipientRow,
  SegmentRow,
  TemplateRow,
} from '@/features/broadcast/repositories/broadcast.types';

/**
 * React Query hooks for the broadcast system (M14).
 */

export const broadcastKeys = {
  all: ['broadcast'] as const,
  segments: () => [...broadcastKeys.all, 'segments'] as const,
  templates: () => [...broadcastKeys.all, 'templates'] as const,
  campaigns: (status?: string) =>
    [...broadcastKeys.all, 'campaigns', status ?? 'all'] as const,
  campaign: (id: string) => [...broadcastKeys.all, 'campaign', id] as const,
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

export function useSegments() {
  return useQuery({
    queryKey: broadcastKeys.segments(),
    queryFn: () => fetchJson<{ segments: SegmentRow[] }>('/api/broadcast/segments'),
  });
}

export function useTemplates() {
  return useQuery({
    queryKey: broadcastKeys.templates(),
    queryFn: () => fetchJson<{ templates: TemplateRow[] }>('/api/broadcast/templates'),
  });
}

export function useCampaigns(status?: string) {
  return useQuery({
    queryKey: broadcastKeys.campaigns(status),
    queryFn: () =>
      fetchJson<{ campaigns: CampaignRow[] }>(
        `/api/broadcast/campaigns${status && status !== 'all' ? `?status=${encodeURIComponent(status)}` : ''}`,
      ),
  });
}

export function useCampaign(id: string) {
  return useQuery({
    queryKey: broadcastKeys.campaign(id),
    queryFn: () =>
      fetchJson<{
        campaign: CampaignRow;
        analytics: CampaignAnalytics;
        recipients: RecipientRow[];
      }>(`/api/broadcast/campaigns/${id}`),
    enabled: id.length > 0,
  });
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

export function useCreateSegment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { name: string; definition: SegmentDefinition }) =>
      sendJson<{ segment: SegmentRow }>('/api/broadcast/segments', 'POST', input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: broadcastKeys.segments() });
    },
  });
}

export function useSegmentPreview() {
  return useMutation({
    mutationFn: (segmentId: string) =>
      sendJson<{ count: number }>(`/api/broadcast/segments/${segmentId}/preview`, 'POST'),
  });
}

export function useCreateTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { name: string; language: string; body: unknown }) =>
      sendJson<{ template: TemplateRow }>('/api/broadcast/templates', 'POST', input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: broadcastKeys.templates() });
    },
  });
}

export function useCreateCampaign() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      name: string;
      segmentId: string;
      templateId: string;
      scheduledFor?: string;
    }) => sendJson<{ campaign: CampaignRow }>('/api/broadcast/campaigns', 'POST', input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: broadcastKeys.campaigns() });
    },
  });
}

export function useCampaignTransition() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      id: string;
      action: 'schedule' | 'send' | 'cancel';
      scheduledFor?: string;
    }) =>
      sendJson<{ campaign: CampaignRow }>(
        `/api/broadcast/campaigns/${input.id}`,
        'PATCH',
        {
          action: input.action,
          scheduledFor: input.scheduledFor,
        },
      ),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({
        queryKey: broadcastKeys.campaign(variables.id),
      });
      void queryClient.invalidateQueries({ queryKey: broadcastKeys.campaigns() });
    },
  });
}
