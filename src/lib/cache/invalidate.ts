import { redis } from "./redis";

export const cacheKeys = {
  leads:       (clientId: string) => `leads:${clientId}`,
  leadDetail:  (leadId:   string) => `lead:${leadId}`,
  sales:       (clientId: string) => `sales:${clientId}`,
  metrics:     (clientId: string) => `metrics:${clientId}`,
  unreadCount: (clientId: string) => `notifications:unread:${clientId}`,
};

export async function invalidate(...keys: string[]) {
  if (!keys.length || !process.env.UPSTASH_REDIS_REST_URL) return;
  await redis.del(...keys);
}
