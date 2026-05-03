export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { fetchSalesForClient } from "@/lib/queries/sales";

export async function GET() {
  const session = await getSession();
  const sales = await fetchSalesForClient(session.clientId!);
  return NextResponse.json(sales);
}
