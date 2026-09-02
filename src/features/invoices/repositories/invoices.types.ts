/**
 * Invoice row types shared by the aggregate repositories — Milestone 12.
 *
 * Split out of invoices.repository.ts so each aggregate repository stays under
 * the 300-line architecture rule while the service keeps one import surface.
 */

export type InvoiceStatus =
  'draft' | 'issued' | 'partially_paid' | 'paid' | 'overdue' | 'void';
export type PaymentGateway =
  'manual' | 'stripe' | 'hyperpay' | 'paytabs' | 'stcpay' | 'applepay';
export type PaymentStatus = 'pending' | 'succeeded' | 'failed';

export type InvoiceLineItemRow = {
  id: string;
  position: number;
  description: string;
  quantity: number;
  unitPriceAmount: number;
  taxRate: number;
  taxAmount: number;
  lineTotalAmount: number;
};

export type InvoiceRow = {
  id: string;
  number: string;
  contactId: string;
  contactName: string | null;
  quoteId: string | null;
  status: InvoiceStatus;
  subtotalAmount: number;
  taxAmount: number;
  discountAmount: number;
  totalAmount: number;
  amountPaid: number;
  currency: string;
  issuedAt: Date | null;
  dueAt: Date | null;
  paidAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  version: number;
  lineItems: InvoiceLineItemRow[];
};

export type PaymentRow = {
  id: string;
  invoiceId: string;
  gateway: PaymentGateway;
  gatewayPaymentId: string;
  amount: number;
  currency: string;
  status: PaymentStatus;
  capturedAt: Date | null;
  createdAt: Date;
};

export type RefundRow = {
  id: string;
  paymentId: string;
  gatewayRefundId: string;
  amount: number;
  currency: string;
  reason: string | null;
  createdAt: Date;
};

export type PaymentEventRow = {
  id: string;
  paymentId: string;
  gatewayEventId: string;
  kind: string;
  payload: unknown;
  createdAt: Date;
};

/** A quote row in the narrow shape the invoice-from-quote flow needs. */
export type QuoteForInvoice = {
  id: string;
  contactId: string;
  currency: string;
  subtotalAmount: number;
  taxAmount: number;
  totalAmount: number;
  lineItems: {
    description: string;
    quantity: number;
    unitPriceAmount: number;
    taxRate: number;
    taxAmount: number;
    lineTotalAmount: number;
  }[];
};
