'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

/**
 * React Query hooks for invoices (M12).
 */

export const invoiceKeys = {
  all: ['invoices'] as const,
  list: (status?: string) => [...invoiceKeys.all, 'list', status ?? 'all'] as const,
  detail: (id: string) => [...invoiceKeys.all, 'detail', id] as const,
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

export type InvoiceStatus =
  'draft' | 'issued' | 'partially_paid' | 'paid' | 'overdue' | 'void';
export type PaymentGateway =
  'manual' | 'stripe' | 'hyperpay' | 'paytabs' | 'stcpay' | 'applepay';

export type InvoiceLineItem = {
  id: string;
  position: number;
  description: string;
  quantity: number;
  unitPriceAmount: number;
  taxRate: number;
  taxAmount: number;
  lineTotalAmount: number;
};

export type Invoice = {
  id: string;
  number: string;
  contactId: string;
  contactName: string | null;
  quoteId: string | null;
  status: InvoiceStatus;
  subtotalAmount: number;
  taxAmount: number;
  discountAmount: number;
  totalAmount: number;
  amountPaid: number;
  currency: string;
  issuedAt: string | null;
  dueAt: string | null;
  paidAt: string | null;
  createdAt: string;
  updatedAt: string;
  version: number;
  lineItems: InvoiceLineItem[];
};

export type Payment = {
  id: string;
  invoiceId: string;
  gateway: PaymentGateway;
  gatewayPaymentId: string;
  amount: number;
  currency: string;
  status: 'pending' | 'succeeded' | 'failed';
  capturedAt: string | null;
  createdAt: string;
};

export type Refund = {
  id: string;
  paymentId: string;
  gatewayRefundId: string;
  amount: number;
  currency: string;
  reason: string | null;
  createdAt: string;
};

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export function useInvoices(status?: string) {
  return useQuery({
    queryKey: invoiceKeys.list(status),
    queryFn: () =>
      fetchJson<{ invoices: Invoice[] }>(
        `/api/invoices${status && status !== 'all' ? `?status=${encodeURIComponent(status)}` : ''}`,
      ),
  });
}

export function useInvoice(id: string) {
  return useQuery({
    queryKey: invoiceKeys.detail(id),
    queryFn: () =>
      fetchJson<{ invoice: Invoice; payments: Payment[]; refunds: Refund[] }>(
        `/api/invoices/${id}`,
      ),
    enabled: id.length > 0,
  });
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

export function useCreateInvoice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      contactId: string;
      quoteId?: string;
      dueAt?: string;
      lineItems: { description: string; quantity: number; unitPriceAmount: number }[];
    }) => sendJson<{ invoice: Invoice }>('/api/invoices', 'POST', input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: invoiceKeys.list() });
    },
  });
}

export function useInvoiceTransition() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { id: string; action: 'issue' | 'void' | 'mark_paid' }) =>
      sendJson<{ invoice: Invoice }>(`/api/invoices/${input.id}`, 'PATCH', {
        action: input.action,
      }),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: invoiceKeys.detail(variables.id) });
      void queryClient.invalidateQueries({ queryKey: invoiceKeys.list() });
    },
  });
}

export function useCreatePayment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { invoiceId: string; gateway: PaymentGateway; amount: number }) =>
      sendJson<{ payment: Payment }>(
        `/api/invoices/${input.invoiceId}/payments`,
        'POST',
        {
          gateway: input.gateway,
          amount: input.amount,
        },
      ),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({
        queryKey: invoiceKeys.detail(variables.invoiceId),
      });
      void queryClient.invalidateQueries({ queryKey: invoiceKeys.list() });
    },
  });
}

export function useCreateRefund() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { paymentId: string; amount: number; reason?: string }) =>
      sendJson<{ refund: Refund }>(`/api/payments/${input.paymentId}/refunds`, 'POST', {
        amount: input.amount,
        reason: input.reason,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: invoiceKeys.all });
    },
  });
}
