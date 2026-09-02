import { z } from 'zod';

export const createPrivacyRequestSchema = z
  .object({
    contactId: z.string().uuid(),
    type: z.enum(['access', 'erasure']),
  })
  .strict();

export const processPrivacyRequestSchema = z
  .object({
    version: z.number().int().positive(),
    confirmation: z.literal('ERASE CONTACT').optional(),
  })
  .strict();

export const privacyRequestIdSchema = z.string().uuid();
