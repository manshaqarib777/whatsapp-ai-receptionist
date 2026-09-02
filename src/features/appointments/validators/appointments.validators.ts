import { z } from 'zod';
import { isIanaTimezone } from '@/features/appointments/services/timezone';

/**
 * Zod schemas for the appointments API (AD-6).
 *
 * `withApiHandler` converts a thrown `ZodError` into a 400 with per-field
 * details.
 */

export const createServiceSchema = z
  .object({
    name: z.string().trim().min(1, 'A name is required.').max(120),
    description: z.string().trim().max(2000).optional(),
    durationMinutes: z.number().int().min(5).max(480),
    priceAmount: z.number().min(0),
    priceCurrency: z.string().min(3).max(3).default('SAR'),
  })
  .strict();

export const updateServiceSchema = createServiceSchema
  .partial()
  .refine((input) => Object.keys(input).length > 0, 'At least one field is required.');

export const createResourceSchema = z.object({
  kind: z.enum(['staff', 'room', 'equipment']),
  name: z.string().trim().min(1, 'A name is required.').max(120),
  userId: z.string().uuid().optional(),
});

export const addRuleSchema = z.object({
  weekday: z.number().int().min(0).max(6),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, 'Use HH:mm.'),
  endTime: z.string().regex(/^\d{2}:\d{2}$/, 'Use HH:mm.'),
});

export const availabilityQuerySchema = z
  .object({
    serviceId: z.string().uuid(),
    resourceId: z.string().uuid().optional(),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD.'),
    timezone: z.string().min(1).max(100).refine(isIanaTimezone, 'Use an IANA timezone.'),
  })
  .strict();

export const bookSchema = z
  .object({
    contactId: z.string().uuid(),
    serviceId: z.string().uuid(),
    resourceId: z.string().uuid(),
    startsAt: z.string().datetime(),
    timezone: z.string().min(1).max(100).refine(isIanaTimezone, 'Use an IANA timezone.'),
    notes: z.string().trim().max(4000).optional(),
    recurrenceRule: z.string().trim().max(200).optional(),
  })
  .strict();

export const rescheduleSchema = z.object({
  startsAt: z.string().datetime(),
});

export const calendarQuerySchema = z.object({
  from: z.string().datetime(),
  to: z.string().datetime(),
});
