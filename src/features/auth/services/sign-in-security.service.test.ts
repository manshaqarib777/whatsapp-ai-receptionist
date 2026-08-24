import { describe, expect, it } from 'vitest';

import {
  isLocked,
  lockDurationSeconds,
} from '@/features/auth/services/sign-in-security.service';

describe('progressive sign-in lockout', () => {
  it('does not lock the first four failures', () => {
    expect([1, 2, 3, 4].map(lockDurationSeconds)).toEqual([0, 0, 0, 0]);
  });

  it('progressively extends the lock and caps it at one hour', () => {
    expect(lockDurationSeconds(5)).toBe(60);
    expect(lockDurationSeconds(6)).toBe(300);
    expect(lockDurationSeconds(7)).toBe(900);
    expect(lockDurationSeconds(8)).toBe(3600);
    expect(lockDurationSeconds(100)).toBe(3600);
  });

  it('only treats a future timestamp as locked', () => {
    const now = new Date('2026-08-23T12:00:00.000Z');
    expect(isLocked({ lockedUntil: new Date('2026-08-23T12:00:01.000Z') }, now)).toBe(
      true,
    );
    expect(isLocked({ lockedUntil: new Date('2026-08-23T11:59:59.000Z') }, now)).toBe(
      false,
    );
    expect(isLocked(null, now)).toBe(false);
  });
});
