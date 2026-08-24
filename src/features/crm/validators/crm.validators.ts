import { z } from 'zod';

/**
 * Zod schemas for the CRM API (AD-6).
 *
 * `withApiHandler` converts a thrown `ZodError` into a 400 with per-field
 * details.
 */

export const createPipelineSchema = z.object({
  name: z.string().trim().min(1, 'A name is required.').max(120),
  stages: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(120),
        winProbability: z.number().min(0).max(1).optional(),
      }),
    )
    .min(1, 'A pipeline needs at least one stage.'),
});

export const dealStatusSchema = z.enum(['open', 'won', 'lost']);

export const createDealSchema = z.object({
  title: z.string().trim().min(1, 'A title is required.').max(200),
  stageId: z.string().uuid(),
  contactId: z.string().uuid().optional(),
  companyId: z.string().uuid().optional(),
  valueAmount: z.number().min(0).optional(),
  valueCurrency: z.string().min(3).max(3).default('SAR'),
});

export const updateDealSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  valueAmount: z.number().min(0).optional(),
  valueCurrency: z.string().min(3).max(3).optional(),
  contactId: z.string().uuid().nullable().optional(),
  companyId: z.string().uuid().nullable().optional(),
});

export const moveDealSchema = z.object({
  stageId: z.string().uuid(),
});

export const closeDealSchema = z.object({
  status: z.enum(['won', 'lost']),
});

export const dealsQuerySchema = z.object({
  stageId: z.string().uuid().optional(),
  status: dealStatusSchema.optional(),
});

export const createCompanySchema = z.object({
  name: z.string().trim().min(1, 'A name is required.').max(200),
  vatNumber: z.string().trim().max(32).optional(),
});

export const updateCompanySchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  vatNumber: z.string().trim().max(32).nullable().optional(),
});

/** Badge colors the tag manager offers. */
export const tagColorSchema = z.enum(['neutral', 'info', 'success', 'warning', 'danger']);

export const createTagSchema = z.object({
  name: z.string().trim().min(1, 'A name is required.').max(60),
  color: tagColorSchema.default('neutral'),
});

export const assignTagSchema = z.object({
  tagId: z.string().uuid(),
  taggableType: z.enum(['contact', 'deal', 'conversation', 'company']),
  taggableId: z.string().uuid(),
});

export const createActivitySchema = z.object({
  kind: z.enum(['note', 'call', 'email', 'meeting']),
  body: z.string().trim().min(1, 'A description is required.').max(4000),
});

export const createTaskSchema = z.object({
  title: z.string().trim().min(1, 'A title is required.').max(200),
  description: z.string().trim().max(4000).optional(),
  dueAt: z.string().datetime().optional(),
  assigneeId: z.string().uuid().optional(),
});

export const taskStatusSchema = z.enum(['open', 'in_progress', 'done', 'cancelled']);

export const updateTaskSchema = z.object({
  status: taskStatusSchema,
});
