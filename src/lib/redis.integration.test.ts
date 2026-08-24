import { afterAll, describe, expect, it } from 'vitest';
import { cacheGetOrLoad, invalidateTenantCache } from '@/lib/cache';
import { consumeRedisRateLimit } from '@/lib/db/redis-rate-limit';
import { closeRedisForTests, redisClient } from '@/lib/redis';
import { env } from '@/lib/env';

afterAll(closeRedisForTests);

describe.runIf(Boolean(env.REDIS_URL))('Redis performance infrastructure', () => {
  it('caches tenant aggregates, invalidates them, and increments atomically', async () => {
    const redis = await redisClient();
    expect(redis).not.toBeNull();
    let loads = 0;
    const input = {
      namespace: 'test',
      organizationId: 'org-a',
      identifier: 'summary',
      ttlSeconds: 30,
      load: async () => ({ value: ++loads }),
    };
    expect(await cacheGetOrLoad(input)).toEqual({ value: 1 });
    expect(await cacheGetOrLoad(input)).toEqual({ value: 1 });
    expect(loads).toBe(1);
    await invalidateTenantCache('test', 'org-a', 'summary');
    expect(await cacheGetOrLoad(input)).toEqual({ value: 2 });
    const key = `war:test-rate:${Date.now()}`;
    const rows = await Promise.all(
      Array.from({ length: 4 }, () => consumeRedisRateLimit(key, 30)),
    );
    expect(rows.map((row) => row?.count).sort()).toEqual([1, 2, 3, 4]);
    await redis?.del(key);
    await invalidateTenantCache('test', 'org-a');
  });

  it('does not expose a stale load that finishes after invalidation', async () => {
    let releaseLoad: (() => void) | undefined;
    const blocked = new Promise<void>((resolve) => {
      releaseLoad = resolve;
    });
    let loads = 0;
    const input = {
      namespace: 'race-test',
      organizationId: `org-${Date.now()}`,
      identifier: 'catalog',
      ttlSeconds: 30,
      load: async () => {
        loads += 1;
        if (loads === 1) await blocked;
        return { value: loads };
      },
    };

    const staleLoad = cacheGetOrLoad(input);
    await new Promise((resolve) => setTimeout(resolve, 25));
    await invalidateTenantCache(input.namespace, input.organizationId, input.identifier);
    releaseLoad?.();

    expect(await staleLoad).toEqual({ value: 1 });
    expect(await cacheGetOrLoad(input)).toEqual({ value: 2 });
  });
});
