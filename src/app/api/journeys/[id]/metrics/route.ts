import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { fetchJourneyMetrics } from "@/lib/queries/journey-metrics";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: journeyId } = await params;
  const session  = await getSession();
  const clientId = session.clientId!;

  const metrics = await fetchJourneyMetrics(journeyId, clientId);
  return NextResponse.json(metrics);
}
