import { z } from 'zod';

const branchFields = {
  name: z.string().trim().min(1).max(100),
  timezone: z
    .string()
    .trim()
    .min(1)
    .max(100)
    .refine((value) => {
      try {
        new Intl.DateTimeFormat('en', { timeZone: value }).format();
        return true;
      } catch {
        return false;
      }
    }, 'Use a valid IANA timezone.'),
};

export const createBranchSchema = z.object(branchFields).strict();
export const updateBranchSchema = z
  .object({
    name: branchFields.name.optional(),
    timezone: branchFields.timezone.optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, 'At least one field is required.');

export const switchBranchSchema = z.object({ branchId: z.string().uuid() }).strict();
