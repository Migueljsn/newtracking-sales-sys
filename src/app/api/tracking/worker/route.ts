import { NextRequest, NextResponse } from "next/server";
import { processPendingEvents } from "@/lib/domain/tracking/send-event";

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const workerSecret = req.headers.get("x-worker-secret");

  const validVercelCron = authHeader === `Bearer ${process.env.CRON_SECRET}`;
  const validManual = workerSecret === process.env.TRACKING_WORKER_SECRET;

  if (!validVercelCron && !validManual) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await processPendingEvents();

  return NextResponse.json({ ok: true });
}
