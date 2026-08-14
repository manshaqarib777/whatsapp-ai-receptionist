import { z } from 'zod';

/**
 * Zod schemas for the knowledge API (AD-8).
 *
 * `withApiHandler` converts a thrown `ZodError` into a 400 with per-field details,
 * so every route parses its input with these before touching a service.
 */

const sourceKindSchema = z.enum(['pdf', 'docx', 'csv', 'website', 'faq']);

export const createSourceSchema = z.object({
  kind: sourceKindSchema,
  name: z.string().trim().min(1, 'A name is required.').max(120),
  /** Website URL — required when kind is `website`. */
  url: z.string().url('A valid URL is required.').max(2048).optional(),
  /** FAQ entries — required when kind is `faq`. */
  faq: z
    .array(
      z.object({
        question: z.string().trim().min(1, 'A question is required.').max(500),
        answer: z.string().trim().min(1, 'An answer is required.').max(4000),
      }),
    )
    .min(1, 'At least one FAQ entry is required.')
    .max(50)
    .optional(),
});

export const createFaqSchema = z.object({
  sourceName: z.string().trim().min(1, 'A source name is required.').max(120),
  entries: z
    .array(
      z.object({
        question: z.string().trim().min(1, 'A question is required.').max(500),
        answer: z.string().trim().min(1, 'An answer is required.').max(4000),
      }),
    )
    .min(1, 'At least one FAQ entry is required.')
    .max(50),
});

export const uploadSchema = z.object({
  title: z.string().trim().min(1, 'A title is required.').max(200),
});

export const searchQuerySchema = z.object({
  q: z.string().trim().min(1, 'A search query is required.').max(500),
  limit: z.coerce.number().int().min(1).max(50).default(10),
});

export const jobStatusQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(20),
});
