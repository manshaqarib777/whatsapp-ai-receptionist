import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import { LoyaltyAccountList } from '@/features/loyalty/components/account-list';
import { ProgramList } from '@/features/loyalty/components/program-list';
import { CouponList } from '@/features/loyalty/components/coupon-list';

/**
 * Loyalty component tests (M17) — account/program/coupon states and axe-clean.
 */

const ACCOUNT = {
  id: 'account-1',
  contactId: 'contact-1',
  contactDisplayName: 'Aisha Khan',
  programId: 'program-1',
  programName: 'Smile Rewards',
  balance: 1000,
  totalEarned: 1000,
  tier: 'silver' as const,
  createdAt: '2026-08-17T09:00:00.000Z',
};

const PROGRAM = {
  id: 'program-1',
  name: 'Smile Rewards',
  pointsPerCurrency: 1,
  isEnabled: true,
  createdAt: '2026-08-17T09:00:00.000Z',
};

const COUPON = {
  id: 'coupon-1',
  code: 'WELCOME10',
  type: 'percent' as const,
  value: 10,
  expiresAt: null,
  maxRedemptions: 1,
  redemptionCount: 0,
  createdAt: '2026-08-17T09:00:00.000Z',
};

function renderWithQuery(ui: ReactNode) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

function ok(payload: unknown) {
  return {
    ok: true,
    status: 200,
    json: () => Promise.resolve(payload),
  };
}

beforeEach(() => {
  vi.restoreAllMocks();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('LoyaltyAccountList', () => {
  it('renders accounts with tier and balance', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => ok({ data: { accounts: [ACCOUNT] } })),
    );
    renderWithQuery(<LoyaltyAccountList />);

    expect(await screen.findByText('Aisha Khan')).toBeInTheDocument();
    expect(screen.getByText('silver')).toBeInTheDocument();
    expect(screen.getByText(/1000 points/)).toBeInTheDocument();
  });

  it('renders an empty state', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => ok({ data: { accounts: [] } })),
    );
    renderWithQuery(<LoyaltyAccountList />);

    expect(await screen.findByText('No loyalty accounts yet')).toBeInTheDocument();
  });

  it('has no accessibility violations', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => ok({ data: { accounts: [ACCOUNT] } })),
    );
    const { container } = renderWithQuery(<LoyaltyAccountList />);
    await screen.findByText('Aisha Khan');
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});

describe('ProgramList', () => {
  it('renders programs with the earn rate', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => ok({ data: { programs: [PROGRAM] } })),
    );
    renderWithQuery(<ProgramList />);

    expect(await screen.findByText('Smile Rewards')).toBeInTheDocument();
    expect(screen.getByText('Enabled')).toBeInTheDocument();
  });

  it('has no accessibility violations', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => ok({ data: { programs: [PROGRAM] } })),
    );
    const { container } = renderWithQuery(<ProgramList />);
    await screen.findByText('Smile Rewards');
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});

describe('CouponList', () => {
  it('renders coupons with type and usage', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => ok({ data: { coupons: [COUPON] } })),
    );
    renderWithQuery(<CouponList />);

    expect(await screen.findByText('WELCOME10')).toBeInTheDocument();
    expect(screen.getByText(/0\/1 used/)).toBeInTheDocument();
  });

  it('has no accessibility violations', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => ok({ data: { coupons: [COUPON] } })),
    );
    const { container } = renderWithQuery(<CouponList />);
    await screen.findByText('WELCOME10');
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
