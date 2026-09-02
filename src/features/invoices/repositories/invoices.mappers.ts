import type { InvoiceRow, PaymentRow, RefundRow } from './invoices.types';

export function toInvoiceRow(row: {
  id: string;
  number: string;
  contactId: string;
  contact: { displayName: string } | null;
  quoteId: string | null;
  status: InvoiceRow['status'];
  subtotalAmount: unknown;
  taxAmount: unknown;
  discountAmount: unknown;
  totalAmount: unknown;
  amountPaid: unknown;
  currency: string;
  issuedAt: Date | null;
  dueAt: Date | null;
  paidAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  version: number;
  lineItems: {
    id: string;
    position: number;
    description: string;
    quantity: unknown;
    unitPriceAmount: unknown;
    taxRate: unknown;
    taxAmount: unknown;
    lineTotalAmount: unknown;
  }[];
}): InvoiceRow {
  return {
    id: row.id,
    number: row.number,
    contactId: row.contactId,
    contactName: row.contact?.displayName ?? null,
    quoteId: row.quoteId,
    status: row.status,
    subtotalAmount: Number(row.subtotalAmount),
    taxAmount: Number(row.taxAmount),
    discountAmount: Number(row.discountAmount),
    totalAmount: Number(row.totalAmount),
    amountPaid: Number(row.amountPaid),
    currency: row.currency,
    issuedAt: row.issuedAt,
    dueAt: row.dueAt,
    paidAt: row.paidAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    version: row.version,
    lineItems: row.lineItems.map((line) => ({
      id: line.id,
      position: line.position,
      description: line.description,
      quantity: Number(line.quantity),
      unitPriceAmount: Number(line.unitPriceAmount),
      taxRate: Number(line.taxRate),
      taxAmount: Number(line.taxAmount),
      lineTotalAmount: Number(line.lineTotalAmount),
    })),
  };
}

export function toPaymentRow(row: {
  id: string;
  invoiceId: string;
  gateway: PaymentRow['gateway'];
  gatewayPaymentId: string;
  amount: unknown;
  currency: string;
  status: PaymentRow['status'];
  capturedAt: Date | null;
  createdAt: Date;
}): PaymentRow {
  return {
    id: row.id,
    invoiceId: row.invoiceId,
    gateway: row.gateway,
    gatewayPaymentId: row.gatewayPaymentId,
    amount: Number(row.amount),
    currency: row.currency,
    status: row.status,
    capturedAt: row.capturedAt,
    createdAt: row.createdAt,
  };
}

export function toRefundRow(row: {
  id: string;
  paymentId: string;
  gatewayRefundId: string;
  amount: unknown;
  currency: string;
  reason: string | null;
  createdAt: Date;
}): RefundRow {
  return {
    id: row.id,
    paymentId: row.paymentId,
    gatewayRefundId: row.gatewayRefundId,
    amount: Number(row.amount),
    currency: row.currency,
    reason: row.reason,
    createdAt: row.createdAt,
  };
}
