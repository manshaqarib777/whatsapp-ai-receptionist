import type { DateRange } from '@/features/dashboard/repositories/dashboard.repository';
import type { RangeOption } from '@/features/dashboard/components/range-picker';

/**
 * The persisted dashboard date range.
 *
 * The cookie holds `'30d' | '90d'`; the page converts it to absolute UTC bounds.
 * 30 days is the default. The bounds are inclusive: `to` is the end of the last
 * day, so a query filtered `gte from, lte to` includes everything on that day.
 */

export const DASHBOARD_RANGES: readonly RangeOption[] = ['30d', '90d'];

export function parseDashboardRange(value: string | null | undefined): RangeOption {
  return DASHBOARD_RANGES.includes(value as RangeOption) ? (value as RangeOption) : '30d';
}

export function rangeToDates(range: RangeOption, now: Date = new Date()): DateRange {
  const days = range === '90d' ? 90 : 30;

  const to = new Date(now);
  to.setUTCHours(23, 59, 59, 999);

  const from = new Date(to);
  from.setUTCDate(from.getUTCDate() - (days - 1));
  from.setUTCHours(0, 0, 0, 0);

  return { from, to };
}
