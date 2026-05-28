import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";

const EVO_URL = process.env.EVO_API_URL!;
const EVO_KEY = process.env.EVO_API_KEY!;

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  await getSession();
  const { name } = await params;

  const res = await fetch(`${EVO_URL}/instance/connect/${name}`, {
    headers: { apikey: EVO_KEY },
    cache:   "no-store",
  });

  if (!res.ok) return NextResponse.json({ error: "EvoAPI error" }, { status: 502 });

  const data = await res.json();
  return NextResponse.json({ base64: data.base64 ?? null, code: data.code ?? null });
}
