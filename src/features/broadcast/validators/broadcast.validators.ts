import { z } from 'zod';

import { isEmptyDefinition } from '@/features/broadcast/services/segments';

/**
 * Zod schemas for the broadcast API (M14).
 *
 * `withApiHandler` converts a thrown `ZodError` into a 400 with per-field
 * details. The segment definition is additionally checked for emptiness
 * server-side (a filter-less segment cannot target anyone).
 */

export const segmentDefinitionSchema = z
  .object({
    locale: z.string().min(2).max(10).optional(),
    lifecycleStage: z.enum(['lead', 'prospect', 'customer']).optional(),
    createdAtAfter: z.string().datetime().optional(),
    dealValueMin: z.number().min(0).optional(),
  })
  .superRefine((definition, ctx) => {
    if (isEmptyDefinition(definition)) {
      ctx.addIssue({
        code: 'custom',
        path: ['definition'],
        message: 'A segment needs at least one filter.',
      });
    }
  });

export const createSegmentSchema = z.object({
  name: z.string().trim().min(1, 'A name is required.').max(100),
  definition: segmentDefinitionSchema,
});

export const createTemplateSchema = z.object({
  name: z.string().trim().min(1, 'A name is required.').max(100),
  language: z.string().min(2).max(10).default('en'),
  body: z.record(z.string(), z.unknown()),
});

export const campaignStatusSchema = z.enum([
  'draft',
  'scheduled',
  'sending',
  'sent',
  'cancelled',
]);

export const createCampaignSchema = z.object({
  name: z.string().trim().min(1, 'A name is required.').max(100),
  segmentId: z.string().uuid(),
  templateId: z.string().uuid(),
  scheduledFor: z.string().datetime().optional(),
});

export const campaignsQuerySchema = z.object({
  status: campaignStatusSchema.optional(),
});

export const campaignTransitionSchema = z.object({
  action: z.enum(['schedule', 'send', 'cancel']),
  scheduledFor: z.string().datetime().optional(),
});
