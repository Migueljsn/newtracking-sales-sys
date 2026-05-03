export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { fetchLeadsForClient } from "@/lib/queries/leads";

export async function GET() {
  const session = await getSession();
  const leads = await fetchLeadsForClient(session.clientId!);
  return NextResponse.json(leads);
}
