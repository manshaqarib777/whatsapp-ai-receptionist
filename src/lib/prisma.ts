import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';

import { env, isDevelopment, isProduction } from '@/lib/env';

/**
 * Prisma client singleton.
 *
 * Prisma 7 takes its connection through a driver adapter rather than a URL in the
 * schema. The client is cached on `globalThis` in development because Next's hot
 * reload re-evaluates modules on every change, and a fresh pool per reload
 * exhausts Postgres connections within a few minutes.
 *
 * Only repositories may import this. Controllers, hooks, and components must not —
 * see .claude/ARCHITECTURE_RULES.md §3.
 */

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient(): PrismaClient {
  const pool = new Pool({
    connectionString: env.DATABASE_URL,
    max: env.DATABASE_POOL_MAX,
    connectionTimeoutMillis: 5_000,
    idleTimeoutMillis: 10_000,
  });
  const adapter = new PrismaPg(pool, { disposeExternalPool: true });

  return new PrismaClient({
    adapter,
    log: isProduction ? ['warn', 'error'] : ['warn', 'error'],
  });
}

export const prisma: PrismaClient = globalForPrisma.prisma ?? createPrismaClient();

if (isDevelopment) {
  globalForPrisma.prisma = prisma;
}
