import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';

type BucketRow = { count: number; resetAt: Date };

export const rateLimitRepository = {
  async consume(keyHash: string, limit: number, windowSeconds: number, now = new Date()) {
    const resetAt = new Date(now.getTime() + windowSeconds * 1000);
    const [row] = await prisma.$queryRaw<BucketRow[]>(Prisma.sql`
      INSERT INTO rate_limit_buckets (key_hash, count, reset_at, created_at, updated_at)
      VALUES (${keyHash}, 1, ${resetAt}, ${now}, ${now})
      ON CONFLICT (key_hash) DO UPDATE SET
        count = CASE WHEN rate_limit_buckets.reset_at <= ${now} THEN 1
          ELSE LEAST(rate_limit_buckets.count + 1, ${limit + 1}) END,
        reset_at = CASE WHEN rate_limit_buckets.reset_at <= ${now} THEN ${resetAt}
          ELSE rate_limit_buckets.reset_at END,
        updated_at = ${now}
      RETURNING count, reset_at AS "resetAt"
    `);
    if (!row) throw new Error('Rate-limit bucket update returned no row.');
    return row;
  },
};
