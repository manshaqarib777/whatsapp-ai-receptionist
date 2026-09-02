import { describe, expect, it } from 'vitest';

import {
  DASHBOARD_RANGES,
  parseDashboardRange,
  rangeToDates,
} from '@/features/dashboard/lib/range';

/**
 * The dashboard's global date range (COMPONENT_DESIGN.md §7).
 *
 * The range is a persisted, server-read cookie value; the unit surface is the
 * parse/convert pair. The cookie is a UI preference, so tolerance of garbage is
 * part of the contract — an unknown value must fall back to the default rather
 * than crash the first paint.
 */

describe('parseDashboardRange', () => {
  it('accepts every declared option', () => {
    for (const option of DASHBOARD_RANGES) {
      expect(parseDashboardRange(option)).toBe(option);
    }
  });

  it('defaults to 30d when the cookie is missing', () => {
    expect(parseDashboardRange(null)).toBe('30d');
    expect(parseDashboardRange(undefined)).toBe('30d');
  });

  it('defaults to 30d on an unknown or malformed value', () => {
    expect(parseDashboardRange('7d')).toBe('30d');
    expect(parseDashboardRange('90')).toBe('30d');
    expect(parseDashboardRange('')).toBe('30d');
  });
});

describe('rangeToDates', () => {
  it('covers 30 days inclusive, ending today', () => {
    const now = new Date('2026-08-12T14:30:00.000Z');
    const { from, to } = rangeToDates('30d', now);

    expect(to.toISOString()).toBe('2026-08-12T23:59:59.999Z');
    expect(from.toISOString()).toBe('2026-07-14T00:00:00.000Z');
  });

  it('covers 90 days inclusive', () => {
    const now = new Date('2026-08-12T14:30:00.000Z');
    const { from, to } = rangeToDates('90d', now);

    expect(to.toISOString()).toBe('2026-08-12T23:59:59.999Z');
    expect(from.toISOString()).toBe('2026-05-15T00:00:00.000Z');
  });

  it('keeps the bounds inclusive so a query on the end day is not truncated', () => {
    const now = new Date('2026-03-01T00:00:00.000Z');
    const { from, to } = rangeToDates('30d', now);

    // The last day must end at 23:59:59.999, not midnight — otherwise `lte to`
    // excludes everything on that day.
    expect(to.getTime() - from.getTime()).toBe(30 * 86_400_000 - 1);
  });

  it('does not depend on the local timezone (UTC-normalised)', () => {
    const now = new Date('2026-08-12T14:30:00.000Z');
    const local = rangeToDates('30d', now);
    const midnight = rangeToDates('30d', new Date('2026-08-12T23:00:00.000Z'));

    expect(local.from.toISOString()).toBe(midnight.from.toISOString());
    expect(local.to.toISOString()).toBe(midnight.to.toISOString());
  });
});
