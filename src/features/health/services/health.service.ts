import { currentTransport, verifyEmailTransport } from '@/lib/email';
import { prisma } from '@/lib/prisma';

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
 * Verifies the SMTP connection when SMTP is the configured transport.
 *
 * Reports `not-configured` rather than `error` for the console transport: that is a
 * deliberate development setting, not a fault, and must not make the health check
 * report the service as degraded.
 */
export async function checkEmail(): Promise<DependencyStatus> {
  try {
    const result = await withTimeout(verifyEmailTransport(), DEPENDENCY_TIMEOUT_MS);

    if (result === null) return 'not-configured';

    return result ? 'ok' : 'error';
  } catch {
    return 'error';
  }
}

export async function getHealthReport(): Promise<HealthReport> {
  // Checked in parallel — a health endpoint should not take the sum of its
  // dependencies' latencies.
  const [database, email] = await Promise.all([checkDatabase(), checkEmail()]);

  const degraded = database !== 'ok' || email === 'error';

  return {
    status: degraded ? 'degraded' : 'ok',
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.round(process.uptime()),
    checks: { database, email },
  };
}

export { currentTransport };
