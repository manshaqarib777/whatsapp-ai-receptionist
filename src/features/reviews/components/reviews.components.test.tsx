import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import { ReviewList } from '@/features/reviews/components/review-list';
import { ReviewPlatformList } from '@/features/reviews/components/review-platform-list';

/**
 * Reviews component tests (M16) — list/platform states and axe-clean.
 */

const REVIEW = {
  id: 'review-1',
  contactId: 'contact-1',
  contactDisplayName: 'Aisha Khan',
  platformId: 'platform-1',
  platformName: 'Google',
  platformProvider: 'google',
  requestId: null,
  rating: 2,
  text: 'Slow service',
  externalReviewId: null,
  receivedAt: '2026-08-16T09:00:00.000Z',
  createdAt: '2026-08-16T09:00:00.000Z',
  needsAttention: true,
};

const PLATFORM = {
  id: 'platform-1',
  name: 'Google',
  provider: 'google',
  isConnected: false,
  createdAt: '2026-08-16T09:00:00.000Z',
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

describe('ReviewList', () => {
  it('renders reviews with the needs-attention badge', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => ok({ data: { reviews: [REVIEW] } })),
    );
    renderWithQuery(<ReviewList />);

    expect(await screen.findByText('Aisha Khan')).toBeInTheDocument();
    expect(screen.getAllByText('Needs attention').length).toBeGreaterThan(0);
  });

  it('renders an empty state', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => ok({ data: { reviews: [] } })),
    );
    renderWithQuery(<ReviewList />);

    expect(await screen.findByText('No reviews yet')).toBeInTheDocument();
  });

  it('has no accessibility violations', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => ok({ data: { reviews: [REVIEW] } })),
    );
    const { container } = renderWithQuery(<ReviewList />);
    await screen.findByText('Aisha Khan');
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});

describe('ReviewPlatformList', () => {
  it('renders platforms with connection state', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => ok({ data: { platforms: [PLATFORM] } })),
    );
    renderWithQuery(<ReviewPlatformList />);

    expect(await screen.findByText('Google')).toBeInTheDocument();
    expect(screen.getByText('Not configured')).toBeInTheDocument();
  });

  it('renders an empty state', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => ok({ data: { platforms: [] } })),
    );
    renderWithQuery(<ReviewPlatformList />);

    expect(await screen.findByText('No review platforms')).toBeInTheDocument();
  });

  it('has no accessibility violations', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => ok({ data: { platforms: [PLATFORM] } })),
    );
    const { container } = renderWithQuery(<ReviewPlatformList />);
    await screen.findByText('Google');
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
