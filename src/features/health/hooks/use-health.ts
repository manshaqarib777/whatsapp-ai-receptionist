'use client';

import { useQuery } from '@tanstack/react-query';

import type { HealthReport } from '@/features/health/services/health.service';

/**
 * Query keys are centralised per feature rather than written inline, so that
 * invalidation cannot silently miss a cache entry
 * (.claude/CODING_STANDARDS.md → React Query).
 */
export const healthKeys = {
  all: ['health'] as const,
  status: () => [...healthKeys.all, 'status'] as const,
};

async function fetchHealth(): Promise<HealthReport> {
  const response = await fetch('/api/health', {
    headers: { accept: 'application/json' },
    cache: 'no-store',
  });

  if (!response.ok) {
    const error = new Error('Health check failed') as Error & { status?: number };
    error.status = response.status;
    throw error;
  }

  const payload = (await response.json()) as { data: HealthReport };
  return payload.data;
}

export function useHealth() {
  return useQuery({
    queryKey: healthKeys.status(),
    queryFn: fetchHealth,
    staleTime: 10_000,
  });
}
