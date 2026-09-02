import { z } from 'zod';

/**
 * Zod schemas for the reviews API (M16).
 */

export const reviewStatusSchema = z.enum(['all', 'needs-attention']).default('all');

export const requestStatusSchema = z
  .enum(['all', 'created', 'sent', 'responded', 'expired', 'cancelled'])
  .default('all');

export const createReviewSchema = z.object({
  contactId: z.string().uuid(),
  platformId: z.string().uuid(),
  requestId: z.string().uuid().optional(),
  rating: z.number().int().min(1).max(5),
  text: z.string().trim().max(2000).optional(),
  externalReviewId: z.string().trim().max(200).optional(),
});

export const createRequestSchema = z.object({
  contactId: z.string().uuid(),
  appointmentId: z.string().uuid(),
  platformId: z.string().uuid(),
});

export const requestTransitionSchema = z.object({
  action: z.enum(['send', 'cancel']),
});
