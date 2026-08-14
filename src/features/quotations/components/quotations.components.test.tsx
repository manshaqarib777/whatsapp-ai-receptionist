import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import { QuoteList } from '@/features/quotations/components/quote-list';
import { QuoteDetail } from '@/features/quotations/components/quote-detail';

/**
 * Quote component tests (M11) — list and detail states, transitions, axe-clean.
 */

const QUOTE = {
  id: 'quote-1',
  number: 'Q-1001',
  contactId: 'contact-1',
  contactName: 'Aisha Khan',
  dealId: null,
  templateId: null,
  status: 'draft' as const,
  subtotalAmount: 3650,
  taxAmount: 547.5,
  totalAmount: 4197.5,
  currency: 'SAR',
  validUntil: '2026-09-01T00:00:00.000Z',
  sentAt: null,
  acceptedAt: null,
  createdAt: '2026-08-14T09:00:00.000Z',
  updatedAt: '2026-08-14T09:00:00.000Z',
  version: 1,
  lineItems: [
    {
      id: 'line-1',
      position: 0,
      description: 'Root canal',
      quantity: 1,
      unitPriceAmount: 1450,
      taxRate: 0.15,
      taxAmount: 217.5,
      lineTotalAmount: 1667.5,
    },
  ],
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

describe('QuoteList', () => {
  it('renders quotes with status and totals', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => ok({ data: { quotes: [QUOTE] } })),
    );
    renderWithQuery(<QuoteList />);

    expect(await screen.findByText('Q-1001')).toBeInTheDocument();
    // "draft" appears both as a filter button and the quote's status badge.
    expect(screen.getAllByText('draft').length).toBeGreaterThan(0);
    expect(screen.getByText('Aisha Khan')).toBeInTheDocument();
  });

  it('shows an empty state', async () => {
    vi.stubGlobal('fetch', vi.fn(() => ok({ data: { quotes: [] } })));
    renderWithQuery(<QuoteList />);

    expect(await screen.findByText('No quotes yet')).toBeInTheDocument();
  });

  it('shows an error state with retry', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve({ ok: false, status: 500, json: () => Promise.resolve({}) })),
    );
    renderWithQuery(<QuoteList />);

    expect(await screen.findByRole('alert')).toBeInTheDocument();
  });

  it('has no accessibility violations', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => ok({ data: { quotes: [QUOTE] } })),
    );
    const { container } = renderWithQuery(<QuoteList />);
    await screen.findByText('Q-1001');

    expect(await axe(container)).toHaveNoViolations();
  });
});

describe('QuoteDetail', () => {
  it('renders line items and totals', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => ok({ data: { quote: QUOTE, versions: [] } })),
    );
    renderWithQuery(<QuoteDetail quoteId="quote-1" />);

    expect(await screen.findByText('Q-1001')).toBeInTheDocument();
    expect(screen.getByText('Root canal')).toBeInTheDocument();
    // The total renders with locale grouping in the header and toFixed in the
    // footer; match either by testing every element's text content.
    expect(
      screen.getAllByText((_, element) => element?.textContent?.includes('197.50') ?? false)
        .length,
    ).toBeGreaterThan(0);
  });

  it('shows send for a draft and accept/reject for a sent quote', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => ok({ data: { quote: QUOTE, versions: [] } })),
    );
    renderWithQuery(<QuoteDetail quoteId="quote-1" />);

    expect(await screen.findByRole('button', { name: 'Send quote' })).toBeInTheDocument();

    vi.stubGlobal(
      'fetch',
      vi.fn(() => ok({ data: { quote: { ...QUOTE, status: 'sent' }, versions: [] } })),
    );
    renderWithQuery(<QuoteDetail quoteId="quote-1" />);
    expect(await screen.findByRole('button', { name: 'Accept' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reject' })).toBeInTheDocument();
  });

  it('sends the quote via the lifecycle action', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => ok({ data: { quote: QUOTE, versions: [] } })),
    );
    renderWithQuery(<QuoteDetail quoteId="quote-1" />);

    await userEvent.click(await screen.findByRole('button', { name: 'Send quote' }));

    expect(fetch).toHaveBeenCalledWith(
      '/api/quotes/quote-1',
      expect.objectContaining({ method: 'PATCH' }),
    );
  });

  it('shows an error state', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve({ ok: false, status: 500, json: () => Promise.resolve({}) })),
    );
    renderWithQuery(<QuoteDetail quoteId="missing" />);

    expect(await screen.findByRole('alert')).toBeInTheDocument();
  });

  it('has no accessibility violations', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => ok({ data: { quote: QUOTE, versions: [] } })),
    );
    const { container } = renderWithQuery(<QuoteDetail quoteId="quote-1" />);
    await screen.findByText('Q-1001');

    expect(await axe(container)).toHaveNoViolations();
  });
});
