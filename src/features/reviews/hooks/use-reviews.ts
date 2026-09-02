'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type {
  ReviewPlatformRow,
  ReviewRequestRow,
  ReviewRow,
} from '@/features/reviews/repositories/reviews.types';

/**
 * React Query hooks for the reviews system (M16).
 */

export const reviewKeys = {
  all: ['reviews'] as const,
  reviews: (status?: string) => [...reviewKeys.all, 'list', status ?? 'all'] as const,
  requests: (status?: string) =>
    [...reviewKeys.all, 'requests', status ?? 'all'] as const,
  platforms: () => [...reviewKeys.all, 'platforms'] as const,
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

export type ReviewWithAttention = ReviewRow & { needsAttention: boolean };

export function useReviews(status?: string) {
  return useQuery({
    queryKey: reviewKeys.reviews(status),
    queryFn: () =>
      fetchJson<{ reviews: ReviewWithAttention[] }>(
        `/api/reviews${status && status !== 'all' ? `?status=${encodeURIComponent(status)}` : ''}`,
      ),
  });
}

export function useReviewRequests(status?: string) {
  return useQuery({
    queryKey: reviewKeys.requests(status),
    queryFn: () =>
      fetchJson<{ requests: ReviewRequestRow[] }>(
        `/api/reviews/requests${status && status !== 'all' ? `?status=${encodeURIComponent(status)}` : ''}`,
      ),
  });
}

export function useReviewPlatforms() {
  return useQuery({
    queryKey: reviewKeys.platforms(),
    queryFn: () =>
      fetchJson<{ platforms: ReviewPlatformRow[] }>('/api/reviews/platforms'),
  });
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

export function useCreateReview() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      contactId: string;
      platformId: string;
      requestId?: string;
      rating: number;
      text?: string;
    }) => sendJson<{ review: ReviewRow }>('/api/reviews', 'POST', input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: reviewKeys.reviews() });
      void queryClient.invalidateQueries({ queryKey: reviewKeys.requests() });
    },
  });
}

export function useCreateReviewRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      contactId: string;
      appointmentId: string;
      platformId: string;
    }) => sendJson<{ request: ReviewRequestRow }>('/api/reviews/requests', 'POST', input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: reviewKeys.requests() });
    },
  });
}

export function useReviewRequestTransition() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { id: string; action: 'send' | 'cancel' }) =>
      sendJson<{ request: ReviewRequestRow }>(
        `/api/reviews/requests/${input.id}`,
        'PATCH',
        { action: input.action },
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: reviewKeys.requests() });
    },
  });
}
