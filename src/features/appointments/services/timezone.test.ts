import { describe, expect, it } from 'vitest';

import {
  localDateInZone,
  zonedDateTimeToUtc,
} from '@/features/appointments/services/timezone';

describe('appointment timezone conversion', () => {
  it('converts fixed-offset local business hours to UTC', () => {
    expect(zonedDateTimeToUtc('2026-08-16', '08:00', 'Asia/Riyadh').toISOString()).toBe(
      '2026-08-16T05:00:00.000Z',
    );
  });

  it('uses the DST offset effective on the requested date', () => {
    expect(
      zonedDateTimeToUtc('2026-01-15', '09:00', 'America/New_York').toISOString(),
    ).toBe('2026-01-15T14:00:00.000Z');
    expect(
      zonedDateTimeToUtc('2026-07-15', '09:00', 'America/New_York').toISOString(),
    ).toBe('2026-07-15T13:00:00.000Z');
  });

  it('rejects a local time skipped by the spring DST transition', () => {
    expect(() => zonedDateTimeToUtc('2026-03-08', '02:30', 'America/New_York')).toThrow(
      'does not exist',
    );
  });

  it('derives the booking date in the requested zone, not UTC', () => {
    expect(localDateInZone(new Date('2026-08-15T22:30:00.000Z'), 'Asia/Riyadh')).toBe(
      '2026-08-16',
    );
  });
});
