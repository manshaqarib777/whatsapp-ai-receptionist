import { z } from 'zod';

/**
 * Dashboard validation schemas.
 *
 * Single source of truth for client and server, per CODING_STANDARDS.md — the
 * same schema drives the RangePicker and the route handler, so the allowed range
 * values cannot drift apart.
 */

export const DASHBOARD_RANGES = ['30d', '90d'] as const;

export const dashboardRangeSchema = z.object({
  range: z.enum(DASHBOARD_RANGES),
});
