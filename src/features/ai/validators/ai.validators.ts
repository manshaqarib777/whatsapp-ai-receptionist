import { z } from 'zod';

/**
 * Zod schemas for the AI API (AD-8).
 *
 * `withApiHandler` converts a thrown `ZodError` into a 400 with per-field details,
 * so every route parses its input with these before touching a service.
 */

export const createTemplateSchema = z
  .object({
    key: z
      .string()
      .trim()
      .min(1, 'A key is required.')
      .max(80)
      .regex(/^[a-z0-9.]+$/, 'Keys are lowercase letters, digits, and dots.'),
    name: z.string().trim().min(1, 'A name is required.').max(120),
    body: z.string().trim().min(1, 'A prompt body is required.').max(20_000),
  })
  .strict();

export const addVersionSchema = z
  .object({
    body: z.string().trim().min(1, 'A prompt body is required.').max(20_000),
  })
  .strict();

export const runTurnSchema = z
  .object({
    inputMessageId: z.string().uuid(),
  })
  .strict();

export const listRunsQuerySchema = z
  .object({
    conversationId: z.string().uuid().optional(),
    limit: z.coerce.number().int().min(1).max(100).default(20),
  })
  .strict();

export const updateAgentSchema = z
  .object({
    displayName: z.string().trim().min(2).max(80).optional(),
    description: z.string().trim().min(2).max(500).optional(),
    enabled: z.boolean().optional(),
    promptTemplateId: z.string().uuid().nullable().optional(),
    version: z.number().int().positive(),
  })
  .strict()
  .refine((value) => Object.keys(value).some((key) => key !== 'version'), {
    message: 'At least one AI agent field must change.',
  });

export const testAgentSchema = z
  .object({
    message: z.string().trim().min(1).max(2_000),
  })
  .strict();
