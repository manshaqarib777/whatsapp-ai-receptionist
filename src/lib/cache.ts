import { createHmac } from 'node:crypto';
import { env } from '@/lib/env';
import { redisClient } from '@/lib/redis';

export function tenantCacheKey(
  namespace: string,
  organizationId: string,
  identifier: string,
): string {
  const tenant = createHmac('sha256', env.AUTH_SECRET)
    .update(organizationId)
    .digest('hex')
    .slice(0, 24);
  return `${env.CACHE_PREFIX}:${namespace}:${tenant}:${identifier}`;
}

export async function cacheGetOrLoad<T>(input: {
  namespace: string;
  organizationId: string;
  identifier: string;
  load: () => Promise<T>;
  ttlSeconds?: number;
}): Promise<T> {
  const redis = await redisClient();
  let key = tenantCacheKey(input.namespace, input.organizationId, input.identifier);
  if (redis) {
    try {
      const [namespaceGeneration, identifierGeneration] = await Promise.all([
        redis.get(generationKey(input.namespace, input.organizationId)),
        redis.get(generationKey(input.namespace, input.organizationId, input.identifier)),
      ]);
      key = `${key}:v${namespaceGeneration ?? '0'}.${identifierGeneration ?? '0'}`;
      const hit = await redis.get(key);
      if (hit !== null) return JSON.parse(hit) as T;
    } catch {
      /* Performance failures fall through to the authoritative loader. */
    }
  }
  const value = await input.load();
  if (redis) {
    try {
      await redis.set(key, JSON.stringify(value), {
        EX: input.ttlSeconds ?? env.CACHE_TTL_SECONDS,
      });
    } catch {
      /* A cache write must never fail the request. */
    }
  }
  return value;
}

export async function invalidateTenantCache(
  namespace: string,
  organizationId: string,
  identifier?: string,
): Promise<void> {
  const redis = await redisClient();
  if (!redis) return;
  try {
    await redis.incr(generationKey(namespace, organizationId, identifier));
  } catch {
    /* The source of truth remains correct when invalidation infrastructure is down. */
  }
}

function generationKey(
  namespace: string,
  organizationId: string,
  identifier?: string,
): string {
  return tenantCacheKey(
    namespace,
    organizationId,
    identifier ? `${identifier}:generation` : '__generation__',
  );
}
