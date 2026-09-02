import { z } from 'zod';

/**
 * Zod schemas for the loyalty API (M17).
 */

export const accountTierSchema = z
  .enum(['all', 'bronze', 'silver', 'gold'])
  .default('all');

export const createProgramSchema = z.object({
  name: z.string().trim().min(1, 'A name is required.').max(100),
  pointsPerCurrency: z.number().min(0).max(1000),
});

export const redeemSchema = z.object({
  points: z.number().int().positive(),
  reason: z.string().trim().max(200).optional(),
});

export const createCouponSchema = z.object({
  code: z.string().trim().min(1, 'A code is required.').max(50),
  type: z.enum(['percent', 'fixed']),
  value: z.number().min(0),
  expiresAt: z.string().datetime().optional(),
  maxRedemptions: z.number().int().min(1).optional(),
});

export const redeemCouponSchema = z.object({
  contactId: z.string().uuid(),
  invoiceId: z.string().uuid(),
});

export const createReferralSchema = z.object({
  referrerId: z.string().uuid(),
  referredContactId: z.string().uuid(),
});
