import { z } from 'zod';

import { ANALYTICS_RANGES } from '@/features/analytics/lib/range';

/**
 * Zod schemas for the analytics API (M15).
 *
 * The analytics surface is read-only; the only input is the optional `range`
 * query parameter, shared with the page's cookie parsing so the client and
 * server agree on the option set.
 */

export const analyticsRangeSchema = z.enum(ANALYTICS_RANGES);

/** A parsed `?range=` query — defaults to 30d when absent. */
export const analyticsQuerySchema = z.object({
  range: analyticsRangeSchema.default('30d'),
});

/** The `PATCH /api/analytics/range` body. */
export const setRangeSchema = z.object({
  range: analyticsRangeSchema,
});
