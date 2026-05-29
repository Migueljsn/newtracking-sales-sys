import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { listFlows } from "@/lib/botconversa/client";

export async function POST(req: NextRequest) {
  await getSession(); // require auth

  const { apiKey } = await req.json();
  if (!apiKey?.trim()) {
    return NextResponse.json({ error: "API key obrigatória" }, { status: 400 });
  }

  try {
    const flows = await listFlows(apiKey.trim());
    return NextResponse.json({ flows });
  } catch {
    return NextResponse.json({ error: "Não foi possível conectar ao Botconversa. Verifique a API key." }, { status: 502 });
  }
}
