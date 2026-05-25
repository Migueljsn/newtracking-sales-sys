import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { invalidate, cacheKeys } from "@/lib/cache/invalidate";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: leadId } = await params;
  const session = await getSession();
  const clientId = session.clientId!;

  const lead = await prisma.lead.findUnique({ where: { id: leadId, clientId }, select: { id: true } });
  if (!lead) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json();
  const { type, content, createdBy } = body;

  const validTypes = ["NOTE", "CALL", "WHATSAPP", "MEETING", "EMAIL", "OTHER"];
  if (!validTypes.includes(type)) return NextResponse.json({ error: "Invalid type" }, { status: 400 });
  if (!content?.trim()) return NextResponse.json({ error: "Content required" }, { status: 400 });

  const interaction = await prisma.leadInteraction.create({
    data: { leadId, clientId, type, content: content.trim(), createdBy: createdBy?.trim() || null },
  });

  await invalidate(cacheKeys.leadDetail(leadId));

  return NextResponse.json(interaction, { status: 201 });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: leadId } = await params;
  const session = await getSession();
  const clientId = session.clientId!;

  const { interactionId } = await req.json();

  const interaction = await prisma.leadInteraction.findFirst({
    where: { id: interactionId, leadId, clientId },
    select: { id: true },
  });
  if (!interaction) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.leadInteraction.delete({ where: { id: interactionId } });
  await invalidate(cacheKeys.leadDetail(leadId));

  return NextResponse.json({ ok: true });
}
