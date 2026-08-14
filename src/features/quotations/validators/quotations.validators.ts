import { z } from 'zod';

/**
 * Zod schemas for the quotes API (M11).
 *
 * `withApiHandler` converts a thrown `ZodError` into a 400 with per-field
 * details.
 */

export const quoteStatusSchema = z.enum(['draft', 'sent', 'accepted', 'rejected', 'expired']);

export const lineItemSchema = z.object({
  description: z.string().trim().min(1, 'A description is required.').max(2000),
  quantity: z.number().positive(),
  unitPriceAmount: z.number().min(0),
  /** Tax rate as a FRACTION (0.15 = 15%), matching the schema's CHECK. */
  taxRate: z.number().min(0).max(1).optional(),
});

export const createQuoteSchema = z.object({
  contactId: z.string().uuid(),
  dealId: z.string().uuid().optional(),
  templateId: z.string().uuid().optional(),
  currency: z.string().min(3).max(3).default('SAR'),
  validUntil: z.string().datetime().optional(),
  lineItems: z.array(lineItemSchema).min(1, 'A quote needs at least one line item.'),
});

export const updateQuoteSchema = z.object({
  contactId: z.string().uuid().optional(),
  dealId: z.string().uuid().nullable().optional(),
  templateId: z.string().uuid().nullable().optional(),
  validUntil: z.string().datetime().nullable().optional(),
  currency: z.string().min(3).max(3).optional(),
  lineItems: z.array(lineItemSchema).min(1).optional(),
});

export const quotesQuerySchema = z.object({
  status: quoteStatusSchema.optional(),
});

export const transitionSchema = z.object({
  action: z.enum(['send', 'accept', 'reject', 'expire', 'mark_draft']),
});

export const createTemplateSchema = z.object({
  name: z.string().trim().min(1, 'A name is required.').max(120),
  bodyTemplate: z.string().trim().min(1, 'A body template is required.').max(20000),
  branding: z
    .object({
      logoKey: z.string().max(500).nullable().optional(),
      colors: z.record(z.string(), z.string()).nullable().optional(),
      footer: z.string().max(2000).nullable().optional(),
    })
    .optional(),
});
