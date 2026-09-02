import { createClient, type RedisClientType } from 'redis';
import { env } from '@/lib/env';
import { logger } from '@/lib/logger';

let client: RedisClientType | null = null;
let connecting: Promise<RedisClientType | null> | null = null;

export async function redisClient(): Promise<RedisClientType | null> {
  if (!env.REDIS_URL) return null;
  if (client?.isReady) return client;
  if (connecting) return connecting;
  connecting = connect();
  const result = await connecting;
  connecting = null;
  return result;
}

async function connect(): Promise<RedisClientType | null> {
  const candidate = createClient({
    url: env.REDIS_URL,
    socket: { connectTimeout: 500, reconnectStrategy: false },
  });
  candidate.on('error', (error) =>
    logger.warn({ err: error }, 'redis unavailable; using safe fallback'),
  );
  try {
    await candidate.connect();
    client = candidate as RedisClientType;
    return client;
  } catch {
    if (candidate.isOpen) await candidate.disconnect();
    return null;
  }
}

export async function closeRedisForTests(): Promise<void> {
  if (client?.isOpen) await client.quit();
  client = null;
  connecting = null;
}
