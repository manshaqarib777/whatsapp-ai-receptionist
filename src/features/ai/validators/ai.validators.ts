import { z } from 'zod';

/**
 * Zod schemas for the AI API (AD-8).
 *
 * `withApiHandler` converts a thrown `ZodError` into a 400 with per-field details,
 * so every route parses its input with these before touching a service.
 */

export const createTemplateSchema = z.object({
  key: z
    .string()
    .trim()
    .min(1, 'A key is required.')
    .max(80)
    .regex(/^[a-z0-9.]+$/, 'Keys are lowercase letters, digits, and dots.'),
  name: z.string().trim().min(1, 'A name is required.').max(120),
  body: z.string().trim().min(1, 'A prompt body is required.').max(20_000),
});

export const addVersionSchema = z.object({
  body: z.string().trim().min(1, 'A prompt body is required.').max(20_000),
});

export const runTurnSchema = z.object({
  conversationId: z.string().uuid(),
  message: z.string().trim().min(1).max(4000),
});

export const listRunsQuerySchema = z.object({
  conversationId: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
