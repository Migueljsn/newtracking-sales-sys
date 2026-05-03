export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { fetchDashboardMetrics } from "@/lib/queries/dashboard";

export async function GET() {
  const session = await getSession();
  const metrics = await fetchDashboardMetrics(session.clientId!);
  return NextResponse.json(metrics);
}
