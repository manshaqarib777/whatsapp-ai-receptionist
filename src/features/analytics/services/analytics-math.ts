import type { DateRange } from '@/features/analytics/repositories/analytics.types';

const currencyFormatter = new Intl.NumberFormat('en', {
  style: 'currency',
  currency: 'SAR',
  maximumFractionDigits: 0,
});

export function formatCurrency(amount: number): string {
  return currencyFormatter.format(amount);
}

export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const minutes = Math.floor(seconds / 60);
  return `${minutes}m ${Math.round(seconds % 60)}s`;
}

export function formatShortDate(date: Date): string {
  return new Intl.DateTimeFormat('en', { day: 'numeric', month: 'short' }).format(date);
}

export function rate(numerator: number, denominator: number): number | null {
  if (denominator <= 0) return null;
  return Math.round((numerator / denominator) * 1000) / 10;
}

export function fillDailySeries<
  TInput extends { date: Date },
  TOutput extends { date: Date },
>(
  points: TInput[],
  range: DateRange,
  mapPoint: (date: Date, existing?: TInput) => TOutput,
): TOutput[] {
  const byDay = new Map(
    points.map((point) => [point.date.toISOString().slice(0, 10), point]),
  );
  const output: TOutput[] = [];
  const cursor = new Date(range.from);
  cursor.setUTCHours(0, 0, 0, 0);
  const end = new Date(range.to);
  end.setUTCHours(23, 59, 59, 999);
  while (cursor <= end) {
    const date = new Date(cursor);
    output.push(mapPoint(date, byDay.get(date.toISOString().slice(0, 10))));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return output;
}
