// @vitest-environment node
import { describe, expect, it } from 'vitest';

import {
  evaluateSegment,
  isEmptyDefinition,
  type SegmentContact,
  type SegmentDefinition,
} from '@/features/broadcast/services/segments';

/**
 * Unit tests for the segment filter-tree evaluation (M14 AD-2).
 *
 * `evaluateSegment` is a pure function — no database, no clock — so these
 * tests pin the rules without any fixture. The consent invariants are the
 * load-bearing part: `hasConsent` is always required and `optedOutAt` is
 * always excluded, no matter what the definition says.
 */

function contact(overrides: Partial<SegmentContact> = {}): SegmentContact {
  return {
    id: `contact-${Math.random().toString(36).slice(2)}`,
    locale: 'en',
    lifecycleStage: 'customer',
    hasConsent: true,
    optedOutAt: null,
    createdAt: new Date('2026-06-01T00:00:00.000Z'),
    openDealValue: 0,
    ...overrides,
  };
}

describe('evaluateSegment', () => {
  it('returns every consented contact for an empty filter set', () => {
    const a = contact({ id: 'a' });
    const b = contact({ id: 'b' });

    expect(evaluateSegment({}, [a, b])).toEqual(['a', 'b']);
  });

  it('filters by locale', () => {
    const ar = contact({ id: 'ar', locale: 'ar' });
    const en = contact({ id: 'en', locale: 'en' });

    expect(evaluateSegment({ locale: 'ar' }, [ar, en])).toEqual(['ar']);
  });

  it('filters by lifecycle stage', () => {
    const lead = contact({ id: 'lead', lifecycleStage: 'lead' });
    const customer = contact({ id: 'customer', lifecycleStage: 'customer' });

    expect(evaluateSegment({ lifecycleStage: 'lead' }, [lead, customer])).toEqual([
      'lead',
    ]);
  });

  it('filters by createdAtAfter', () => {
    const old = contact({ id: 'old', createdAt: new Date('2026-01-01T00:00:00.000Z') });
    const recent = contact({
      id: 'recent',
      createdAt: new Date('2026-07-01T00:00:00.000Z'),
    });

    expect(
      evaluateSegment({ createdAtAfter: '2026-06-01T00:00:00.000Z' }, [old, recent]),
    ).toEqual(['recent']);
  });

  it('filters by deal value', () => {
    const small = contact({ id: 'small', openDealValue: 100 });
    const big = contact({ id: 'big', openDealValue: 10_000 });

    expect(evaluateSegment({ dealValueMin: 5_000 }, [small, big])).toEqual(['big']);
  });

  it('ANDs all filters together', () => {
    const match = contact({
      id: 'match',
      locale: 'ar',
      lifecycleStage: 'customer',
      openDealValue: 8_000,
    });
    const wrongLocale = contact({
      id: 'wrong-locale',
      locale: 'en',
      lifecycleStage: 'customer',
      openDealValue: 8_000,
    });

    expect(
      evaluateSegment({ locale: 'ar', lifecycleStage: 'customer', dealValueMin: 5_000 }, [
        match,
        wrongLocale,
      ]),
    ).toEqual(['match']);
  });

  it('never includes a contact without consent, even with an empty filter set', () => {
    const noConsent = contact({ id: 'no', hasConsent: false });

    expect(evaluateSegment({}, [noConsent])).toEqual([]);
  });

  it('never includes an opted-out contact, even when the definition is empty', () => {
    const optedOut = contact({
      id: 'out',
      optedOutAt: new Date('2026-05-01T00:00:00.000Z'),
    });

    expect(evaluateSegment({}, [optedOut])).toEqual([]);
  });

  it('cannot be weakened by the definition — consent + opted-out always win', () => {
    const noConsent = contact({ id: 'no', hasConsent: false });
    const optedOut = contact({
      id: 'out',
      optedOutAt: new Date('2026-05-01T00:00:00.000Z'),
    });

    expect(evaluateSegment({ locale: 'en' }, [noConsent, optedOut])).toEqual([]);
  });
});

describe('isEmptyDefinition', () => {
  it('is true when no filter is set', () => {
    expect(isEmptyDefinition({})).toBe(true);
  });

  it('is false when any filter is set', () => {
    const definitions: SegmentDefinition[] = [
      { locale: 'en' },
      { lifecycleStage: 'lead' },
      { createdAtAfter: '2026-01-01T00:00:00.000Z' },
      { dealValueMin: 1 },
    ];

    for (const definition of definitions) {
      expect(isEmptyDefinition(definition)).toBe(false);
    }
  });
});
