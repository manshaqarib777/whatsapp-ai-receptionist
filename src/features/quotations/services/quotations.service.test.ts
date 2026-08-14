import { describe, expect, it } from 'vitest';

import { computeTotals, DEFAULT_VAT_RATE } from '@/features/quotations/services/quotations.service';
import { renderQuotePdf } from '@/features/quotations/services/pdf';
import type { QuoteRow } from '@/features/quotations/repositories/quotations.repository';

/**
 * Quote unit tests (M11).
 *
 * The VAT math is the money-critical piece: rate and amount are both stored at
 * write time, and the totals must tie to the printed document exactly.
 */

function makeQuote(overrides: Partial<QuoteRow> = {}): QuoteRow {
  return {
    id: 'quote-1',
    number: 'Q-1001',
    contactId: 'contact-1',
    contactName: 'Aisha Khan',
    dealId: null,
    templateId: null,
    status: 'draft',
    subtotalAmount: 1000,
    taxAmount: 150,
    totalAmount: 1150,
    currency: 'SAR',
    validUntil: new Date('2026-09-01T00:00:00.000Z'),
    sentAt: null,
    acceptedAt: null,
    createdAt: new Date('2026-08-14T09:00:00.000Z'),
    updatedAt: new Date('2026-08-14T09:00:00.000Z'),
    version: 1,
    lineItems: [
      {
        id: 'line-1',
        position: 0,
        description: 'Root canal',
        quantity: 1,
        unitPriceAmount: 1000,
        taxRate: 0.15,
        taxAmount: 150,
        lineTotalAmount: 1150,
      },
    ],
    ...overrides,
  };
}

describe('computeTotals (VAT math)', () => {
  it('computes 15% VAT on a single line', () => {
    const totals = computeTotals([
      { description: 'Root canal', quantity: 1, unitPriceAmount: 1450 },
    ]);

    expect(totals.subtotalAmount).toBe(1450);
    expect(totals.taxAmount).toBe(217.5);
    expect(totals.totalAmount).toBe(1667.5);
  });

  it('uses the default VAT rate when a line omits one', () => {
    const totals = computeTotals([
      { description: 'Crown', quantity: 2, unitPriceAmount: 500 },
    ]);

    expect(totals.subtotalAmount).toBe(1000);
    expect(totals.taxAmount).toBe(150);
    expect(totals.totalAmount).toBe(1150);
  });

  it('honours a per-line rate (mixed rates)', () => {
    const totals = computeTotals([
      { description: 'Zero-rated', quantity: 1, unitPriceAmount: 100, taxRate: 0 },
      { description: 'Standard', quantity: 1, unitPriceAmount: 100, taxRate: DEFAULT_VAT_RATE },
    ]);

    expect(totals.subtotalAmount).toBe(200);
    expect(totals.taxAmount).toBe(15);
    expect(totals.totalAmount).toBe(215);
  });

  it('rounds to 4 decimals per line so totals tie to stored columns', () => {
    const totals = computeTotals([
      { description: 'Odd price', quantity: 3, unitPriceAmount: 0.1, taxRate: 0.15 },
    ]);

    expect(totals.subtotalAmount).toBe(0.3);
    expect(totals.taxAmount).toBe(0.045);
    expect(totals.totalAmount).toBe(0.345);
  });
});

describe('renderQuotePdf', () => {
  it('produces a valid PDF with the quote number and totals embedded', () => {
    const quote = makeQuote();
    const buffer = renderQuotePdf(quote, null);

    const head = buffer.subarray(0, 8).toString('latin1');
    expect(head).toBe('%PDF-1.4');

    const text = buffer.toString('latin1');
    expect(text).toContain('QUOTE Q-1001');
    expect(text).toContain('Aisha Khan');
    expect(text).toContain('1,150.00 SAR');
    expect(text).toContain('endstream');
    expect(text).toContain('%%EOF');
  });

  it('embeds the branding footer when present', () => {
    const quote = makeQuote();
    const buffer = renderQuotePdf(quote, { footer: 'Valid for 30 days.' });

    expect(buffer.toString('latin1')).toContain('Valid for 30 days.');
  });
});
