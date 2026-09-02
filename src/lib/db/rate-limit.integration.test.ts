import { afterEach, describe, expect, it } from 'vitest';
import { prisma } from '@/lib/prisma';
import { rateLimitRepository } from '@/lib/db/rate-limit.repository';

const keys: string[] = [];
afterEach(async () => {
  await prisma.rateLimitBucket.deleteMany({ where: { keyHash: { in: keys.splice(0) } } });
});

describe('durable rate-limit repository', () => {
  it('increments atomically and resets expired buckets without raw identifiers', async () => {
    const keyHash = 'a'.repeat(64);
    keys.push(keyHash);
    const now = new Date('2026-08-24T10:00:00Z');
    const rows = await Promise.all(
      Array.from({ length: 4 }, () => rateLimitRepository.consume(keyHash, 2, 60, now)),
    );
    expect(rows.map((row) => row.count).sort((a, b) => a - b)).toEqual([1, 2, 3, 3]);
    const stored = await prisma.rateLimitBucket.findFirstOrThrow({ where: { keyHash } });
    expect(stored.keyHash).toBe(keyHash);
    const reset = await rateLimitRepository.consume(
      keyHash,
      2,
      60,
      new Date('2026-08-24T10:02:00Z'),
    );
    expect(reset.count).toBe(1);
  });
});
