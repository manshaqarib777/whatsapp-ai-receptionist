import { describe, expect, it } from 'vitest';

import {
  expandRecurrence,
  parseRecurrenceRule,
} from '@/features/appointments/services/recurrence';

/**
 * Recurrence unit tests (M9, AD-4) — the supported RRULE subset.
 */

describe('parseRecurrenceRule', () => {
  it('parses a weekly rule', () => {
    const rule = parseRecurrenceRule('FREQ=WEEKLY;INTERVAL=1;COUNT=4');
    expect(rule.freq).toBe('WEEKLY');
    expect(rule.interval).toBe(1);
    expect(rule.count).toBe(4);
  });

  it('parses a daily rule with UNTIL', () => {
    const rule = parseRecurrenceRule('FREQ=DAILY;UNTIL=20260831T000000Z');
    expect(rule.freq).toBe('DAILY');
    expect(rule.until).toBe('20260831T000000Z');
  });

  it('defaults unknown FREQ to WEEKLY', () => {
    const rule = parseRecurrenceRule('FREQ=MONTHLY');
    expect(rule.freq).toBe('WEEKLY');
  });
});

describe('expandRecurrence', () => {
  it('expands weekly occurrences by 7-day steps', () => {
    const rule = parseRecurrenceRule('FREQ=WEEKLY;COUNT=3');
    const start = new Date('2026-08-16T09:00:00.000Z');
    const occurrences = expandRecurrence(rule, start);
    expect(occurrences).toHaveLength(3);
    expect(occurrences[1]?.getTime()).toBe(start.getTime() + 7 * 86_400_000);
  });

  it('expands daily occurrences', () => {
    const rule = parseRecurrenceRule('FREQ=DAILY;COUNT=5');
    const start = new Date('2026-08-16T09:00:00.000Z');
    const occurrences = expandRecurrence(rule, start);
    expect(occurrences).toHaveLength(5);
    expect(occurrences[4]?.getTime()).toBe(start.getTime() + 4 * 86_400_000);
  });

  it('stops at UNTIL', () => {
    const rule = parseRecurrenceRule('FREQ=WEEKLY;UNTIL=20260830T000000Z');
    const start = new Date('2026-08-16T09:00:00.000Z');
    const occurrences = expandRecurrence(rule, start);
    // 16, 23, 30 — 30 Aug is within UNTIL, so 3 occurrences.
    expect(occurrences.length).toBeLessThanOrEqual(3);
    expect(occurrences[2]?.getTime()).toBe(start.getTime() + 14 * 86_400_000);
  });

  it('respects the expansion limit', () => {
    const rule = parseRecurrenceRule('FREQ=DAILY;COUNT=100');
    const start = new Date('2026-08-16T09:00:00.000Z');
    const occurrences = expandRecurrence(rule, start, 20);
    expect(occurrences).toHaveLength(20);
  });
});
