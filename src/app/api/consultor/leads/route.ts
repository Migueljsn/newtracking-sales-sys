export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getConsultantSession } from "@/lib/auth/consultant-session";
import { fetchLeadsForClient } from "@/lib/queries/leads";

export async function GET() {
  const session = await getConsultantSession();
  const leads = await fetchLeadsForClient(session.clientId);
  return NextResponse.json(leads);
}
