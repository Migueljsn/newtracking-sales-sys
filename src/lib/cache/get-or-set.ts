import { redis } from "./redis";

// Returns cached value or fetches fresh data, caches it, and returns it.
// Falls through to fn() when Redis env vars are not configured (local dev).
export async function getOrSet<T>(key: string, ttl: number, fn: () => Promise<T>): Promise<T> {
  if (!process.env.UPSTASH_REDIS_REST_URL) return fn();

  const cached = await redis.get<T>(key);
  if (cached !== null) return cached;

  const data = await fn();
  await redis.set(key, data, { ex: ttl });
  return data;
}
