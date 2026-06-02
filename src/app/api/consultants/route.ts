export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";

export async function GET() {
  const session  = await getSession();
  const clientId = session.clientId!;

  const [settings, consultantUsers] = await Promise.all([
    prisma.clientSettings.findUnique({ where: { clientId }, select: { consultants: true } }),
    prisma.consultantUser.findMany({ where: { clientId, active: true }, select: { name: true }, orderBy: { name: "asc" } }),
  ]);

  // Merge ConsultantUser names (active) with legacy string array, deduplicated
  const fromUsers   = consultantUsers.map(u => u.name);
  const fromLegacy  = settings?.consultants ?? [];
  const merged      = [...new Set([...fromUsers, ...fromLegacy])].sort();

  return NextResponse.json({ consultants: merged });
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
