import { describe, expect, it } from 'vitest';

import {
  fillSeries,
  formatCurrency,
  formatDuration,
  percentDelta,
} from '@/features/dashboard/services/dashboard.service';

/**
 * The dashboard service's pure, database-free surface.
 *
 * The service owns the presentation decisions that must be unit-testable without
 * Postgres: delta derivation, duration/currency formatting, and the dense chart
 * series. The repository handles data; these functions handle meaning.
 */

describe('percentDelta', () => {
  it('rounds the percentage change', () => {
    expect(percentDelta(1_284, 1_146)).toBe(12);
    expect(percentDelta(90, 100)).toBe(-10);
    expect(percentDelta(50, 100)).toBe(-50);
  });

  it('reports zero change as zero', () => {
    expect(percentDelta(100, 100)).toBe(0);
  });

  it('returns null when there is no baseline', () => {
    expect(percentDelta(10, 0)).toBeNull();
    expect(percentDelta(0, 0)).toBeNull();
  });
});

describe('formatDuration', () => {
  it('formats sub-minute gaps in seconds', () => {
    expect(formatDuration(45)).toBe('45s');
  });

  it('formats minute/second gaps', () => {
    expect(formatDuration(134)).toBe('2m 14s');
  });

  it('rounds partial seconds', () => {
    expect(formatDuration(59.6)).toBe('60s');
    expect(formatDuration(134.4)).toBe('2m 14s');
  });
});

describe('formatCurrency', () => {
  it('formats a whole-amount currency with no decimals', () => {
    // Intl inserts a narrow no-break space between the code and the amount.
    expect(formatCurrency(4_197.5).replace(/\s/g, ' ')).toBe('SAR 4,198');
  });

  it('formats zero', () => {
    expect(formatCurrency(0).replace(/\s/g, ' ')).toBe('SAR 0');
  });
});

describe('fillSeries', () => {
  const range = {
    from: new Date('2026-08-01T00:00:00.000Z'),
    to: new Date('2026-08-03T23:59:59.999Z'),
  };

  it('zero-fills days with no data so charts have no gaps', () => {
    const points = [{ date: new Date('2026-08-02T00:00:00.000Z'), count: 3 }];

    const filled = fillSeries(points, range, (date, existing) => ({
      date,
      count: existing?.count ?? 0,
    }));

    expect(filled.map((p) => p.count)).toEqual([0, 3, 0]);
  });

  it('produces one bucket per day across the inclusive range', () => {
    const filled = fillSeries([], range, (date) => ({ date, count: 0 }));

    expect(filled).toHaveLength(3);
    expect(filled[0]?.date.toISOString()).toBe('2026-08-01T00:00:00.000Z');
    expect(filled[2]?.date.toISOString()).toBe('2026-08-03T00:00:00.000Z');
  });

  it('preserves point order and labels through the mapping', () => {
    const points = [{ date: new Date('2026-08-02T00:00:00.000Z'), label: '2 Aug' }];

    const filled = fillSeries(points, range, (date, existing) => ({
      date,
      label: existing?.label ?? 'empty',
    }));

    expect(filled.map((p) => p.label)).toEqual(['empty', '2 Aug', 'empty']);
  });
});
