export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";

export async function GET() {
  const session  = await getSession();
  const settings = await prisma.clientSettings.findUnique({
    where:  { clientId: session.clientId! },
    select: { consultants: true },
  });
  return NextResponse.json({ consultants: settings?.consultants ?? [] });
}

export async function POST(req: Request) {
  const session = await getSession();
  const { name } = await req.json() as { name: string };

  const trimmed = name?.trim();
  if (!trimmed) return NextResponse.json({ error: "Nome inválido" }, { status: 400 });

  const current = await prisma.clientSettings.findUnique({
    where:  { clientId: session.clientId! },
    select: { consultants: true },
  });

  if (current?.consultants.includes(trimmed)) {
    return NextResponse.json({ consultants: current.consultants });
  }

  const updated = await prisma.clientSettings.upsert({
    where:  { clientId: session.clientId! },
    update: { consultants: { push: trimmed } },
    create: { clientId: session.clientId!, consultants: [trimmed] },
    select: { consultants: true },
  });

  return NextResponse.json({ consultants: updated.consultants });
}
