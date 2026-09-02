import { z } from 'zod';

export const adminPageSchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(25),
  })
  .strict();

export const planUpdateSchema = z
  .object({
    name: z.string().trim().min(2).max(100).optional(),
    description: z.string().trim().min(2).max(500).optional(),
    active: z.boolean().optional(),
    version: z.number().int().positive(),
  })
  .strict()
  .refine((value) => Object.keys(value).some((key) => key !== 'version'), {
    message: 'At least one field must change.',
  });

export const subscriptionUpdateSchema = z
  .object({
    status: z.enum(['trialing', 'active', 'past_due', 'cancelled']).optional(),
    cancelAtPeriodEnd: z.boolean().optional(),
    planId: z.string().uuid().optional(),
    version: z.number().int().positive(),
  })
  .strict()
  .refine((value) => Object.keys(value).some((key) => key !== 'version'), {
    message: 'At least one field must change.',
  });

export function parseAdminPage(url: string) {
  const search = new URL(url).searchParams;
  return adminPageSchema.parse({
    page: search.get('page') ?? undefined,
    limit: search.get('limit') ?? undefined,
  });
}
