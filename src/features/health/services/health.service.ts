import { prisma } from '@/lib/prisma';

/**
 * Health service.
 *
 * Business logic for liveness reporting. Deliberately returns only whether
 * dependencies respond — never versions, hostnames, connection strings, or
 * dependency lists, which are reconnaissance for an attacker
 * (.claude/SECURITY_RULES.md).
 */

export type DependencyStatus = 'ok' | 'error';

export type HealthReport = {
  status: 'ok' | 'degraded';
  timestamp: string;
  uptimeSeconds: number;
  checks: {
    database: DependencyStatus;
  };
};

const DATABASE_TIMEOUT_MS = 2_000;

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
    await withTimeout(prisma.$queryRaw`SELECT 1`, DATABASE_TIMEOUT_MS);
    return 'ok';
  } catch {
    return 'error';
  }
}

export async function getHealthReport(): Promise<HealthReport> {
  const database = await checkDatabase();

  return {
    status: database === 'ok' ? 'ok' : 'degraded',
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.round(process.uptime()),
    checks: { database },
  };
}
