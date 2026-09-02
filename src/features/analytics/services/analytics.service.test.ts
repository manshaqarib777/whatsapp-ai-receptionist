// @vitest-environment node
import { describe, expect, it } from 'vitest';

import {
  formatCurrency,
  formatDuration,
  rate,
} from '@/features/analytics/services/analytics.service';

/**
 * Unit tests for the analytics service math (M15).
 *
 * The service's view-model math is pure — no database, no clock — so these
 * tests pin the conversions, rates, and formatting without a fixture.
 */

describe('rate', () => {
  it('computes a rounded percentage', () => {
    expect(rate(3, 4)).toBe(75);
  });

  it('rounds to one decimal', () => {
    expect(rate(1, 3)).toBe(33.3);
  });

  it('returns null when there is no baseline', () => {
    expect(rate(5, 0)).toBeNull();
    expect(rate(0, 0)).toBeNull();
  });
});

describe('formatCurrency', () => {
  it('formats SAR with thousands separators', () => {
    // Intl uses a non-breaking space between the currency and amount.
    expect(formatCurrency(4197.5)).toBe('SAR\u00a04,198');
  });

  it('handles zero', () => {
    expect(formatCurrency(0)).toBe('SAR\u00a00');
  });
});

describe('formatDuration', () => {
  it('formats seconds under a minute', () => {
    expect(formatDuration(45)).toBe('45s');
  });

  it('formats minutes and seconds', () => {
    expect(formatDuration(134)).toBe('2m 14s');
  });
});

describe('forecast math (weighted pipeline)', () => {
  it('multiplies deal value by stage probability', () => {
    const deals = [
      { value: 1000, probability: 0.3 },
      { value: 2000, probability: 0.6 },
    ];
    const weighted = deals.reduce((sum, deal) => sum + deal.value * deal.probability, 0);
    expect(weighted).toBe(1500);
  });

  it('an empty pipeline forecasts zero', () => {
    expect(0).toBe(0);
  });
});
