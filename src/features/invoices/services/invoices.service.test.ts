// @vitest-environment node
import { describe, expect, it } from 'vitest';

import {
  computeTotals,
  DEFAULT_VAT_RATE,
} from '@/features/invoices/services/invoices.service';
import { renderInvoicePdf } from '@/features/invoices/services/pdf';

/**
 * Invoices service unit tests — pure math and document generation. The gateway
 * and repository paths are covered by the integration suite.
 */

describe('computeTotals', () => {
  it('applies the default 15% VAT rate', () => {
    const totals = computeTotals([
      { description: 'a', quantity: 1, unitPriceAmount: 100 },
    ]);
    expect(totals.subtotalAmount).toBeCloseTo(100, 4);
    expect(totals.taxAmount).toBeCloseTo(15, 4);
    expect(totals.totalAmount).toBeCloseTo(115, 4);
  });

  it('respects a per-line custom rate', () => {
    const totals = computeTotals([
      { description: 'a', quantity: 2, unitPriceAmount: 50, taxRate: 0.05 },
    ]);
    expect(totals.subtotalAmount).toBeCloseTo(100, 4);
    expect(totals.taxAmount).toBeCloseTo(5, 4);
    expect(totals.totalAmount).toBeCloseTo(105, 4);
  });

  it('sums multiple lines and rounds to 4 decimals', () => {
    const totals = computeTotals([
      { description: 'a', quantity: 1, unitPriceAmount: 0.3333 },
      { description: 'b', quantity: 3, unitPriceAmount: 0.3333 },
    ]);
    // 0.3333 + 0.9999 = 1.3332; 15% tax = 0.19998 → 0.2
    expect(totals.subtotalAmount).toBeCloseTo(1.3332, 4);
    expect(totals.taxAmount).toBeCloseTo(0.2, 4);
    expect(totals.totalAmount).toBeCloseTo(1.5332, 4);
  });

  it('exports the schema-matching default rate', () => {
    expect(DEFAULT_VAT_RATE).toBe(0.15);
  });
});

describe('renderInvoicePdf', () => {
  it('emits a valid PDF with the invoice number and totals', () => {
    const invoice = {
      id: 'x',
      number: 'INV-1000',
      contactId: 'c',
      contactName: 'Test Patient',
      quoteId: null,
      status: 'issued' as const,
      subtotalAmount: 100,
      taxAmount: 15,
      totalAmount: 115,
      amountPaid: 0,
      currency: 'SAR',
      issuedAt: new Date('2026-08-14'),
      dueAt: new Date('2026-09-14'),
      paidAt: null,
      createdAt: new Date('2026-08-14'),
      updatedAt: new Date('2026-08-14'),
      version: 1,
      lineItems: [
        {
          id: 'l1',
          position: 0,
          description: 'Crown fitting',
          quantity: 1,
          unitPriceAmount: 100,
          taxRate: 0.15,
          taxAmount: 15,
          lineTotalAmount: 115,
        },
      ],
    };

    const buffer = renderInvoicePdf(invoice);
    const text = buffer.toString('latin1');
    expect(text.startsWith('%PDF-1.4')).toBe(true);
    expect(text).toContain('INVOICE INV-1000');
    expect(text).toContain('Crown fitting');
    expect(text).toContain('115.00 SAR');
    expect(text).toContain('%%EOF');
  });
});
