import { logger } from '@/lib/logger';

/**
 * In-process rate limiter.
 *
 * KNOWN LIMITATION (MILESTONE_02_PLAN.md, Risk 4): this is per-process and resets on
 * deploy. With more than one instance an attacker gets N times the allowance. Redis
 * arrives in Milestone 24 and replaces the store behind this same interface.
 *
 * It is documented rather than omitted because an imperfect limiter on the sign-in
 * endpoint is materially better than none, and shipping without one would leave
 * credential stuffing entirely unmetered.
 */

type Bucket = {
  count: number;
  resetAt: number;
};

const buckets = new Map<string, Bucket>();

/** Prevents unbounded growth if a process is long-lived and heavily probed. */
const MAX_BUCKETS = 10_000;

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
};

export type RateLimitRule = {
  /** Requests permitted per window. */
  limit: number;
  /** Window length in seconds. */
  windowSeconds: number;
};

/**
 * Limits tuned to the threat rather than to a single global number: credential
 * endpoints are strict, read endpoints are generous.
 */
export const RATE_LIMITS = {
  signIn: { limit: 5, windowSeconds: 60 },
  signUp: { limit: 3, windowSeconds: 60 * 15 },
  passwordReset: { limit: 3, windowSeconds: 60 * 15 },
  magicLink: { limit: 3, windowSeconds: 60 * 15 },
  twoFactor: { limit: 5, windowSeconds: 60 * 5 },
  invitation: { limit: 20, windowSeconds: 60 * 60 },
  api: { limit: 100, windowSeconds: 60 },
} as const satisfies Record<string, RateLimitRule>;

export type RateLimitName = keyof typeof RATE_LIMITS;

function sweep(now: number): void {
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }

  if (buckets.size > MAX_BUCKETS) {
    logger.warn({ size: buckets.size }, 'rate limit store exceeded capacity; clearing');
    buckets.clear();
  }
}

/**
 * Consumes one unit of the caller's allowance.
 *
 * @param name       Which rule to apply.
 * @param identifier IP, user id, or email hash. NEVER a raw email — see below.
 */
export function consume(name: RateLimitName, identifier: string): RateLimitResult {
  const rule = RATE_LIMITS[name];
  const now = Date.now();

  if (buckets.size > 0 && Math.random() < 0.01) sweep(now);

  const key = `${name}:${identifier}`;
  const existing = buckets.get(key);

  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + rule.windowSeconds * 1000 });
    return { allowed: true, remaining: rule.limit - 1, retryAfterSeconds: 0 };
  }

  if (existing.count >= rule.limit) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
    };
  }

  existing.count += 1;

  return {
    allowed: true,
    remaining: rule.limit - existing.count,
    retryAfterSeconds: 0,
  };
}

/** Clears all buckets. Test-only — keeps tests independent and order-agnostic. */
export function resetRateLimits(): void {
  buckets.clear();
}

/**
 * Derives the client IP from proxy headers.
 *
 * `x-forwarded-for` is client-controlled unless a trusted proxy overwrites it, so
 * this is a best-effort signal, not an identity. It is used for rate limiting and
 * audit context only — never for authorization.
 */
export function clientIp(headers: Headers): string {
  const forwarded = headers.get('x-forwarded-for');
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim();
    if (first) return first;
  }

  return headers.get('x-real-ip')?.trim() ?? 'unknown';
}
