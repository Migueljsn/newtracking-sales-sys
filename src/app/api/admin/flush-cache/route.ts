import { NextRequest, NextResponse } from "next/server";
import { redis } from "@/lib/cache/redis";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!process.env.UPSTASH_REDIS_REST_URL) {
    return NextResponse.json({ ok: true, message: "Redis não configurado — nada a limpar." });
  }

  let deleted = 0;
  let cursor   = 0;

  do {
    const [next, keys] = await redis.scan(cursor, { count: 100 });
    cursor = Number(next);
    if (keys.length > 0) {
      await redis.del(...(keys as string[]));
      deleted += keys.length;
    }
  } while (cursor !== 0);

  return NextResponse.json({ ok: true, deleted });
}
