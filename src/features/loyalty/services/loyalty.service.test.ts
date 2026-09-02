// @vitest-environment node
import { describe, expect, it } from 'vitest';

import {
  DEFAULT_REFERRAL_BONUS,
  TIER_THRESHOLDS,
  pointsForInvoice,
  tierFor,
} from '@/features/loyalty/services/loyalty.service';

/**
 * Unit tests for the loyalty service math (M17) — the pure functions: points
 * from an invoice, tier derivation, and the referral bonus constant.
 */

describe('pointsForInvoice', () => {
  it('floors total × rate', () => {
    expect(pointsForInvoice(1000, 1)).toBe(1000);
    expect(pointsForInvoice(1000, 0.5)).toBe(500);
    expect(pointsForInvoice(999, 0.5)).toBe(499);
  });

  it('returns 0 for a zero or negative rate', () => {
    expect(pointsForInvoice(1000, 0)).toBe(0);
    expect(pointsForInvoice(1000, -1)).toBe(0);
  });
});

describe('tierFor', () => {
  it('derives bronze below the silver threshold', () => {
    expect(tierFor(0)).toBe('bronze');
    expect(tierFor(TIER_THRESHOLDS.silver - 1)).toBe('bronze');
  });

  it('derives silver at and above the silver threshold', () => {
    expect(tierFor(TIER_THRESHOLDS.silver)).toBe('silver');
    expect(tierFor(TIER_THRESHOLDS.gold - 1)).toBe('silver');
  });

  it('derives gold at and above the gold threshold', () => {
    expect(tierFor(TIER_THRESHOLDS.gold)).toBe('gold');
    expect(tierFor(10_000)).toBe('gold');
  });
});

describe('referral bonus', () => {
  it('has a positive default bonus', () => {
    expect(DEFAULT_REFERRAL_BONUS).toBeGreaterThan(0);
  });
});
