import { redisClient } from '@/lib/redis';

const SCRIPT = `
local current = redis.call('INCR', KEYS[1])
if current == 1 then redis.call('EXPIRE', KEYS[1], ARGV[1]) end
local ttl = redis.call('TTL', KEYS[1])
return { current, ttl }
`;

export async function consumeRedisRateLimit(key: string, windowSeconds: number) {
  const redis = await redisClient();
  if (!redis) return null;
  try {
    const result = (await redis.eval(SCRIPT, {
      keys: [key],
      arguments: [String(windowSeconds)],
    })) as [number, number];
    return {
      count: Number(result[0]),
      retryAfterSeconds: Math.max(1, Number(result[1])),
    };
  } catch {
    return null;
  }
}
