/**
 * Money math for invoices — Milestone 12.
 *
 * Mirrors quotations: the tax RATE and tax AMOUNT are both stored per line at
 * write time, so a historical document never silently reprices at today's rate.
 * `computeTotals` is pure; the client preview mirrors it for live totals only,
 * and the server recomputes authoritatively on save.
 */

/** Default VAT fraction, matching the schema's CHECK and quotations. */
export const DEFAULT_VAT_RATE = 0.15;

export type InvoiceLineInput = {
  description: string;
  quantity: number;
  unitPriceAmount: number;
  taxRate?: number;
};

export type InvoiceTotals = {
  subtotalAmount: number;
  taxAmount: number;
  totalAmount: number;
};

/** Pure VAT math — the printed invoice always ties to the stored columns. */
export function computeTotals(lines: InvoiceLineInput[]): InvoiceTotals {
  let subtotal = 0;
  let tax = 0;
  for (const line of lines) {
    const unit = line.unitPriceAmount;
    const quantity = line.quantity;
    const rate = line.taxRate ?? DEFAULT_VAT_RATE;
    const lineSubtotal = round4(unit * quantity);
    const lineTax = round4(lineSubtotal * rate);
    subtotal = round4(subtotal + lineSubtotal);
    tax = round4(tax + lineTax);
  }
  return {
    subtotalAmount: subtotal,
    taxAmount: tax,
    totalAmount: round4(subtotal + tax),
  };
}

export function round4(value: number): number {
  return Math.round((value + Number.EPSILON) * 10_000) / 10_000;
}

/** The stored per-line tax figures, computed the way the schema demands. */
export function lineTaxFigures(line: InvoiceLineInput): {
  taxRate: number;
  taxAmount: number;
  lineTotalAmount: number;
} {
  const rate = line.taxRate ?? DEFAULT_VAT_RATE;
  const lineSubtotal = round4(line.unitPriceAmount * line.quantity);
  return {
    taxRate: rate,
    taxAmount: round4(lineSubtotal * rate),
    lineTotalAmount: round4(lineSubtotal * (1 + rate)),
  };
}
