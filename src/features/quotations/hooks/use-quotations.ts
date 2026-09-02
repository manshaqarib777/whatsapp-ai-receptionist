'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

/**
 * React Query hooks for quotes (M11).
 */

export const quoteKeys = {
  all: ['quotes'] as const,
  list: (status?: string) => [...quoteKeys.all, 'list', status ?? 'all'] as const,
  detail: (id: string) => [...quoteKeys.all, 'detail', id] as const,
  templates: () => [...quoteKeys.all, 'templates'] as const,
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
// Types
// ---------------------------------------------------------------------------

export type QuoteStatus = 'draft' | 'sent' | 'accepted' | 'rejected' | 'expired';

export type QuoteLineItem = {
  id: string;
  position: number;
  description: string;
  quantity: number;
  unitPriceAmount: number;
  taxRate: number;
  taxAmount: number;
  lineTotalAmount: number;
};

export type Quote = {
  id: string;
  number: string;
  contactId: string;
  contactName: string | null;
  dealId: string | null;
  templateId: string | null;
  status: QuoteStatus;
  subtotalAmount: number;
  taxAmount: number;
  totalAmount: number;
  currency: string;
  validUntil: string | null;
  sentAt: string | null;
  acceptedAt: string | null;
  createdAt: string;
  updatedAt: string;
  version: number;
  lineItems: QuoteLineItem[];
};

export type QuoteTemplate = {
  id: string;
  name: string;
  bodyTemplate: string;
  branding: {
    logoKey?: string | null;
    colors?: Record<string, string> | null;
    footer?: string | null;
  } | null;
};

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export function useQuotes(status?: string) {
  return useQuery({
    queryKey: quoteKeys.list(status),
    queryFn: () =>
      fetchJson<{ quotes: Quote[] }>(
        `/api/quotes${status && status !== 'all' ? `?status=${encodeURIComponent(status)}` : ''}`,
      ),
  });
}

export function useQuote(id: string) {
  return useQuery({
    queryKey: quoteKeys.detail(id),
    queryFn: () =>
      fetchJson<{
        quote: Quote;
        versions: { versionNumber: number; createdAt: string }[];
      }>(`/api/quotes/${id}`),
    enabled: id.length > 0,
  });
}

export function useQuoteTemplates() {
  return useQuery({
    queryKey: quoteKeys.templates(),
    queryFn: () => fetchJson<{ templates: QuoteTemplate[] }>('/api/quotes/templates'),
  });
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

export function useCreateQuote() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      contactId: string;
      validUntil?: string;
      lineItems: { description: string; quantity: number; unitPriceAmount: number }[];
    }) => sendJson<{ quote: Quote }>('/api/quotes', 'POST', input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: quoteKeys.list() });
    },
  });
}

export function useTransitionQuote() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      id: string;
      action: 'send' | 'accept' | 'reject' | 'expire' | 'mark_draft';
    }) =>
      sendJson<{ quote: Quote }>(`/api/quotes/${input.id}`, 'PATCH', {
        action: input.action,
      }),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: quoteKeys.detail(variables.id) });
      void queryClient.invalidateQueries({ queryKey: quoteKeys.list() });
    },
  });
}

export function useCreateTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { name: string; bodyTemplate: string; footer?: string }) =>
      sendJson<{ template: QuoteTemplate }>('/api/quotes/templates', 'POST', {
        name: input.name,
        bodyTemplate: input.bodyTemplate,
        branding: input.footer ? { footer: input.footer } : undefined,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: quoteKeys.templates() });
    },
  });
}
