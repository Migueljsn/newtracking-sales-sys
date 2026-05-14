import { redis } from "./redis";

const V = "v2";

export const cacheKeys = {
  leads:       (clientId: string) => `${V}:leads:${clientId}`,
  leadDetail:  (leadId:   string) => `${V}:lead:${leadId}`,
  sales:       (clientId: string) => `${V}:sales:${clientId}`,
  metrics:     (clientId: string) => `${V}:metrics:${clientId}`,
  unreadCount: (clientId: string) => `${V}:notifications:unread:${clientId}`,
};

export async function invalidate(...keys: string[]) {
  if (!keys.length || !process.env.UPSTASH_REDIS_REST_URL) return;
  await redis.del(...keys);
}
