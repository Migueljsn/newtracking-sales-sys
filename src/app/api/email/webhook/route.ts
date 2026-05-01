import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

export async function POST(request: NextRequest) {
  const payload = await request.json();

  const messageId: string | undefined = payload?.data?.email_id;
  const type: string | undefined      = payload?.type;

  if (!messageId || !type) {
    return NextResponse.json({ ok: true });
  }

  const log = await prisma.ltvEmailLog.findUnique({ where: { messageId } });
  if (!log) return NextResponse.json({ ok: true });

  const now = new Date();

  if (type === "email.opened" && !log.openedAt) {
    await prisma.ltvEmailLog.update({ where: { id: log.id }, data: { openedAt: now } });
  } else if (type === "email.clicked" && !log.clickedAt) {
    await prisma.ltvEmailLog.update({ where: { id: log.id }, data: { clickedAt: now } });
  } else if (type === "email.bounced" && !log.bouncedAt) {
    await prisma.ltvEmailLog.update({ where: { id: log.id }, data: { bouncedAt: now } });
  }

  return NextResponse.json({ ok: true });
}
