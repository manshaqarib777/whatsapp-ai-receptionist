import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import { InvoiceList } from '@/features/invoices/components/invoice-list';
import { InvoiceDetail } from '@/features/invoices/components/invoice-detail';

/**
 * Invoice component tests (M12) — list and detail states, lifecycle actions,
 * payments/refunds, axe-clean.
 */

const INVOICE = {
  id: 'invoice-1',
  number: 'INV-1001',
  contactId: 'contact-1',
  contactName: 'Aisha Khan',
  quoteId: null,
  status: 'issued' as const,
  subtotalAmount: 3650,
  discountAmount: 0,
  taxAmount: 547.5,
  totalAmount: 4197.5,
  amountPaid: 0,
  currency: 'SAR',
  issuedAt: '2026-08-14T09:00:00.000Z',
  dueAt: '2026-09-14T00:00:00.000Z',
  paidAt: null,
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

const PAYMENT = {
  id: 'payment-1',
  invoiceId: 'invoice-1',
  gateway: 'stripe' as const,
  gatewayPaymentId: 'cs_123',
  amount: 4197.5,
  currency: 'SAR',
  status: 'succeeded' as const,
  capturedAt: '2026-08-14T10:00:00.000Z',
  createdAt: '2026-08-14T10:00:00.000Z',
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

describe('InvoiceList', () => {
  it('renders invoices with status and totals', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => ok({ data: { invoices: [INVOICE] } })),
    );
    renderWithQuery(<InvoiceList />);

    expect(await screen.findByText('INV-1001')).toBeInTheDocument();
    expect(screen.getAllByText('issued').length).toBeGreaterThan(0);
    expect(screen.getByText(/4,197.50 SAR/)).toBeInTheDocument();
  });

  it('shows an error state with retry', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => ({ ok: false, status: 500 })),
    );
    renderWithQuery(<InvoiceList />);

    expect(await screen.findByRole('button', { name: /try again/i })).toBeInTheDocument();
  });

  it('has no accessibility violations', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => ok({ data: { invoices: [INVOICE] } })),
    );
    const { container } = renderWithQuery(<InvoiceList />);
    await screen.findByText('INV-1001');
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});

describe('InvoiceDetail', () => {
  it('shows line items, totals, and the balance due', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => ok({ data: { invoice: INVOICE, payments: [], refunds: [] } })),
    );
    renderWithQuery(<InvoiceDetail invoiceId="invoice-1" />);

    expect(await screen.findByText('Root canal')).toBeInTheDocument();
    expect(screen.getAllByText('4,197.50 SAR').length).toBeGreaterThan(0);
  });

  it('shows issue for a draft, record-payment for an issued invoice', async () => {
    const draft = { ...INVOICE, status: 'draft' as const, issuedAt: null };
    vi.stubGlobal(
      'fetch',
      vi.fn(() => ok({ data: { invoice: draft, payments: [], refunds: [] } })),
    );
    renderWithQuery(<InvoiceDetail invoiceId="invoice-1" />);

    expect(
      await screen.findByRole('button', { name: 'Issue invoice' }),
    ).toBeInTheDocument();

    const issued = { ...INVOICE, status: 'issued' as const };
    vi.stubGlobal(
      'fetch',
      vi.fn(() => ok({ data: { invoice: issued, payments: [], refunds: [] } })),
    );
    renderWithQuery(<InvoiceDetail invoiceId="invoice-1" />);
    expect(
      await screen.findByRole('button', { name: 'Record payment' }),
    ).toBeInTheDocument();
  });

  it('shows a succeeded payment and a refund doorway', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => ok({ data: { invoice: INVOICE, payments: [PAYMENT], refunds: [] } })),
    );
    renderWithQuery(<InvoiceDetail invoiceId="invoice-1" />);

    expect(await screen.findByText(/stripe · succeeded/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Refund' })).toBeInTheDocument();
  });

  it('has no accessibility violations', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => ok({ data: { invoice: INVOICE, payments: [], refunds: [] } })),
    );
    const { container } = renderWithQuery(<InvoiceDetail invoiceId="invoice-1" />);
    await screen.findByText('Root canal');
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
