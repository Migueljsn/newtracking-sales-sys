export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { fetchAnalytics } from "@/lib/queries/analytics";

export async function GET(req: NextRequest) {
  const session  = await getSession();
  const days     = Math.min(90, Math.max(7, Number(req.nextUrl.searchParams.get("days") ?? 30)));
  const data     = await fetchAnalytics(session.clientId!, days);
  return NextResponse.json(data);
}
