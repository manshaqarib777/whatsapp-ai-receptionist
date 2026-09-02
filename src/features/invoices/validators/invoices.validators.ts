import { z } from 'zod';

/**
 * Zod schemas for the invoices API (M12).
 *
 * `withApiHandler` converts a thrown `ZodError` into a 400 with per-field
 * details. Money math mirrors quotations: rates and amounts are both stored at
 * write time — a historical invoice is never recomputed from today's rate.
 */

export const invoiceStatusSchema = z.enum([
  'draft',
  'issued',
  'partially_paid',
  'paid',
  'overdue',
  'void',
]);

export const invoiceLineItemSchema = z.object({
  description: z.string().trim().min(1, 'A description is required.').max(2000),
  quantity: z.number().positive(),
  unitPriceAmount: z.number().min(0),
  /** Tax rate as a FRACTION (0.15 = 15%), matching the schema's CHECK. */
  taxRate: z.number().min(0).max(1).optional(),
});

export const createInvoiceSchema = z.object({
  contactId: z.string().uuid(),
  quoteId: z.string().uuid().optional(),
  currency: z.string().min(3).max(3).default('SAR'),
  dueAt: z.string().datetime().optional(),
  /** Required when no quoteId (the quote copy path supplies its own). */
  lineItems: z.array(invoiceLineItemSchema).min(1).optional(),
});

export const updateInvoiceSchema = z.object({
  dueAt: z.string().datetime().nullable().optional(),
  currency: z.string().min(3).max(3).optional(),
  lineItems: z.array(invoiceLineItemSchema).min(1).optional(),
});

export const invoicesQuerySchema = z.object({
  status: invoiceStatusSchema.optional(),
});

export const invoiceTransitionSchema = z.object({
  action: z.enum(['issue', 'void', 'mark_paid']),
});

export const createPaymentSchema = z.object({
  gateway: z.enum(['stripe', 'hyperpay', 'paytabs', 'stcpay', 'applepay']),
  amount: z.number().positive(),
  currency: z.string().min(3).max(3).default('SAR'),
});

export const createRefundSchema = z.object({
  amount: z.number().positive(),
  reason: z.string().trim().max(500).optional(),
});
