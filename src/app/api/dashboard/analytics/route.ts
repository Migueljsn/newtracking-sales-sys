export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { fetchAnalytics } from "@/lib/queries/analytics";

export async function GET(req: NextRequest) {
  const session  = await getSession();
  const p        = req.nextUrl.searchParams;
  const fromParam = p.get("from");
  const toParam   = p.get("to");

  let from: Date, to: Date;

  if (fromParam && toParam) {
    from = new Date(`${fromParam}T00:00:00.000Z`);
    to   = new Date(`${toParam}T23:59:59.999Z`);
  } else {
    const days = Math.min(365, Math.max(1, Number(p.get("days") ?? 30)));
    to   = new Date();
    from = new Date(Date.now() - days * 86_400_000);
  }

  const data = await fetchAnalytics(session.clientId!, from, to);
  return NextResponse.json(data);
}
