import { beforeEach, describe, expect, it, vi } from 'vitest';

import { RATE_LIMITS, clientIp, consume, resetRateLimits } from '@/lib/rate-limit';

beforeEach(() => {
  resetRateLimits();
  vi.useRealTimers();
});

describe('consume', () => {
  it('allows requests up to the limit', () => {
    const { limit } = RATE_LIMITS.signIn;

    for (let i = 0; i < limit; i += 1) {
      expect(consume('signIn', '198.51.100.1').allowed).toBe(true);
    }
  });

  it('blocks the request after the limit is reached', () => {
    const { limit } = RATE_LIMITS.signIn;

    for (let i = 0; i < limit; i += 1) {
      consume('signIn', '198.51.100.2');
    }

    const blocked = consume('signIn', '198.51.100.2');

    expect(blocked.allowed).toBe(false);
    expect(blocked.remaining).toBe(0);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
  });

  it('counts down the remaining allowance', () => {
    const first = consume('signIn', '198.51.100.3');
    const second = consume('signIn', '198.51.100.3');

    expect(first.remaining).toBe(RATE_LIMITS.signIn.limit - 1);
    expect(second.remaining).toBe(RATE_LIMITS.signIn.limit - 2);
  });

  it('tracks identifiers independently — one attacker cannot lock out everyone', () => {
    for (let i = 0; i < RATE_LIMITS.signIn.limit; i += 1) {
      consume('signIn', 'attacker');
    }

    expect(consume('signIn', 'attacker').allowed).toBe(false);
    // A different user is unaffected.
    expect(consume('signIn', 'innocent-user').allowed).toBe(true);
  });

  it('tracks rules independently — exhausting sign-in does not block signup', () => {
    for (let i = 0; i < RATE_LIMITS.signIn.limit; i += 1) {
      consume('signIn', 'shared-ip');
    }

    expect(consume('signIn', 'shared-ip').allowed).toBe(false);
    expect(consume('signUp', 'shared-ip').allowed).toBe(true);
  });

  it('allows requests again once the window has elapsed', () => {
    vi.useFakeTimers();

    for (let i = 0; i < RATE_LIMITS.signIn.limit; i += 1) {
      consume('signIn', '198.51.100.4');
    }

    expect(consume('signIn', '198.51.100.4').allowed).toBe(false);

    vi.advanceTimersByTime((RATE_LIMITS.signIn.windowSeconds + 1) * 1000);

    expect(consume('signIn', '198.51.100.4').allowed).toBe(true);

    vi.useRealTimers();
  });

  it('applies stricter limits to credential endpoints than to reads', () => {
    // A policy assertion: if someone loosens sign-in to match the API limit, this
    // fails and forces the change to be deliberate.
    expect(RATE_LIMITS.signIn.limit).toBeLessThan(RATE_LIMITS.api.limit);
    expect(RATE_LIMITS.passwordReset.limit).toBeLessThan(RATE_LIMITS.api.limit);
    expect(RATE_LIMITS.magicLink.limit).toBeLessThan(RATE_LIMITS.api.limit);
  });
});

describe('clientIp', () => {
  it('takes the first entry of x-forwarded-for', () => {
    const headers = new Headers({
      'x-forwarded-for': '203.0.113.1, 198.51.100.7, 10.0.0.1',
    });

    expect(clientIp(headers)).toBe('203.0.113.1');
  });

  it('trims whitespace', () => {
    expect(clientIp(new Headers({ 'x-forwarded-for': '  203.0.113.2  ' }))).toBe(
      '203.0.113.2',
    );
  });

  it('falls back to x-real-ip', () => {
    expect(clientIp(new Headers({ 'x-real-ip': '203.0.113.3' }))).toBe('203.0.113.3');
  });

  it('returns "unknown" rather than throwing when no header is present', () => {
    expect(clientIp(new Headers())).toBe('unknown');
  });

  it('does not crash on an empty x-forwarded-for', () => {
    expect(clientIp(new Headers({ 'x-forwarded-for': '' }))).toBe('unknown');
  });
});
