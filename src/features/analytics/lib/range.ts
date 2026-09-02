import type { DateRange } from '@/features/analytics/repositories/analytics.types';

/**
 * The persisted analytics date range.
 *
 * Same cookie → bounds pattern as the dashboard (`src/features/dashboard/lib/range.ts`),
 * extended with 180d and 12m for longer-horizon analytics. The cookie holds the option
 * name; the page converts it to absolute inclusive UTC bounds. 30 days is the default.
 */

export const ANALYTICS_RANGES = ['30d', '90d', '180d', '12m'] as const;
export type AnalyticsRange = (typeof ANALYTICS_RANGES)[number];

export function parseAnalyticsRange(value: string | null | undefined): AnalyticsRange {
  return ANALYTICS_RANGES.includes(value as AnalyticsRange)
    ? (value as AnalyticsRange)
    : '30d';
}

export function rangeToDates(range: AnalyticsRange, now: Date = new Date()): DateRange {
  const days = range === '12m' ? 365 : range === '180d' ? 180 : range === '90d' ? 90 : 30;

  const to = new Date(now);
  to.setUTCHours(23, 59, 59, 999);

  const from = new Date(to);
  from.setUTCDate(from.getUTCDate() - (days - 1));
  from.setUTCHours(0, 0, 0, 0);

  return { from, to };
}
