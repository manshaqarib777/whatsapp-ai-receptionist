'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type {
  CouponRedemptionRow,
  CouponRow,
  LoyaltyAccountRow,
  LoyaltyProgramRow,
  LoyaltyTransactionRow,
  ReferralRow,
} from '@/features/loyalty/repositories/loyalty.types';

/**
 * React Query hooks for the loyalty system (M17).
 */

export const loyaltyKeys = {
  all: ['loyalty'] as const,
  accounts: (tier?: string) => [...loyaltyKeys.all, 'accounts', tier ?? 'all'] as const,
  account: (id: string) => [...loyaltyKeys.all, 'account', id] as const,
  programs: () => [...loyaltyKeys.all, 'programs'] as const,
  coupons: () => [...loyaltyKeys.all, 'coupons'] as const,
  referrals: () => [...loyaltyKeys.all, 'referrals'] as const,
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

export function useLoyaltyAccounts(tier?: string) {
  return useQuery({
    queryKey: loyaltyKeys.accounts(tier),
    queryFn: () =>
      fetchJson<{ accounts: LoyaltyAccountRow[] }>(
        `/api/loyalty/accounts${tier && tier !== 'all' ? `?tier=${encodeURIComponent(tier)}` : ''}`,
      ),
  });
}

export function useLoyaltyAccount(id: string) {
  return useQuery({
    queryKey: loyaltyKeys.account(id),
    queryFn: () =>
      fetchJson<{ account: LoyaltyAccountRow; transactions: LoyaltyTransactionRow[] }>(
        `/api/loyalty/accounts/${id}`,
      ),
    enabled: id.length > 0,
  });
}

export function useLoyaltyPrograms() {
  return useQuery({
    queryKey: loyaltyKeys.programs(),
    queryFn: () => fetchJson<{ programs: LoyaltyProgramRow[] }>('/api/loyalty/programs'),
  });
}

export function useLoyaltyCoupons() {
  return useQuery({
    queryKey: loyaltyKeys.coupons(),
    queryFn: () => fetchJson<{ coupons: CouponRow[] }>('/api/loyalty/coupons'),
  });
}

export function useLoyaltyReferrals() {
  return useQuery({
    queryKey: loyaltyKeys.referrals(),
    queryFn: () => fetchJson<{ referrals: ReferralRow[] }>('/api/loyalty/referrals'),
  });
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

export function useCreateLoyaltyProgram() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { name: string; pointsPerCurrency: number }) =>
      sendJson<{ program: LoyaltyProgramRow }>('/api/loyalty/programs', 'POST', input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: loyaltyKeys.programs() });
    },
  });
}

export function useRedeemPoints() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { accountId: string; points: number; reason?: string }) =>
      sendJson<{ account: LoyaltyAccountRow; transaction: LoyaltyTransactionRow }>(
        `/api/loyalty/accounts/${input.accountId}/redeem`,
        'POST',
        { points: input.points, reason: input.reason },
      ),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({
        queryKey: loyaltyKeys.account(variables.accountId),
      });
      void queryClient.invalidateQueries({ queryKey: loyaltyKeys.accounts() });
    },
  });
}

export function useCreateCoupon() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      code: string;
      type: 'percent' | 'fixed';
      value: number;
      expiresAt?: string;
      maxRedemptions?: number;
    }) => sendJson<{ coupon: CouponRow }>('/api/loyalty/coupons', 'POST', input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: loyaltyKeys.coupons() });
    },
  });
}

export function useRedeemCoupon() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { couponId: string; contactId: string; invoiceId: string }) =>
      sendJson<{ redemption: CouponRedemptionRow }>(
        `/api/loyalty/coupons/${input.couponId}/redeem`,
        'POST',
        { contactId: input.contactId, invoiceId: input.invoiceId },
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: loyaltyKeys.coupons() });
    },
  });
}
