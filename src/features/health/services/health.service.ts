import { currentTransport } from '@/lib/email';
import { prisma } from '@/lib/prisma';
import { redisClient } from '@/lib/redis';
import { env } from '@/lib/env';

/**
 * Health service.
 *
 * Business logic for liveness reporting. Deliberately returns only whether
 * dependencies respond — never versions, hostnames, connection strings, or
 * dependency lists, which are reconnaissance for an attacker
 * (.claude/SECURITY_RULES.md).
 */

export type DependencyStatus = 'ok' | 'error' | 'not-configured';

export type HealthReport = {
  status: 'ok' | 'degraded';
  timestamp: string;
  uptimeSeconds: number;
  checks: {
    database: DependencyStatus;
    email: DependencyStatus;
    redis: DependencyStatus;
  };
};

const DEPENDENCY_TIMEOUT_MS = 2_000;

/**
 * Races a promise against a timeout so a hung database cannot hold the health
 * check open — an uptime probe that never returns is worse than one that fails.
 */
async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: NodeJS.Timeout | undefined;

  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error('timeout')), ms);
  });

  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export async function checkDatabase(): Promise<DependencyStatus> {
  try {
    await withTimeout(prisma.$queryRaw`SELECT 1`, DEPENDENCY_TIMEOUT_MS);
    return 'ok';
  } catch {
    return 'error';
  }
}

/**
 * Reports how mail is configured to leave the application.
 *
 * Deliberately does NOT open an SMTP connection. An earlier version did, and it was
 * wrong on three counts: a liveness probe would open an outbound connection to a
 * third party on every call; the probe's latency became the provider's latency; and
 * a provider blip would report OUR service as down when it is running fine.
 *
 * A liveness check should test what we own. Provider reachability is a separate,
 * on-demand concern — `verifyEmailTransport()` in src/lib/email.ts exists for that.
 */
export function checkEmail(): DependencyStatus {
  return currentTransport() === 'smtp' ? 'ok' : 'not-configured';
}

export async function checkRedis(): Promise<DependencyStatus> {
  if (!env.REDIS_URL) return 'not-configured';
  try {
    const redis = await redisClient();
    if (!redis) return 'error';
    return (await withTimeout(redis.ping(), DEPENDENCY_TIMEOUT_MS)) === 'PONG'
      ? 'ok'
      : 'error';
  } catch {
    return 'error';
  }
}

export async function getHealthReport(): Promise<HealthReport> {
  const database = await checkDatabase();
  const email = checkEmail();
  const redis = await checkRedis();

  const degraded = database !== 'ok' || email === 'error' || redis === 'error';

  return {
    status: degraded ? 'degraded' : 'ok',
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.round(process.uptime()),
    checks: { database, email, redis },
  };
}

export { currentTransport };
