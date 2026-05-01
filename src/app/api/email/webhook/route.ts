import { NextRequest, NextResponse } from "next/server";
import { Webhook } from "svix";
import { prisma } from "@/lib/db/prisma";

export async function POST(request: NextRequest) {
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  if (!secret) return NextResponse.json({ error: "Missing secret" }, { status: 500 });

  const body    = await request.text();
  const svixId  = request.headers.get("svix-id") ?? "";
  const svixTs  = request.headers.get("svix-timestamp") ?? "";
  const svixSig = request.headers.get("svix-signature") ?? "";

  try {
    const wh      = new Webhook(secret);
    const payload = wh.verify(body, { "svix-id": svixId, "svix-timestamp": svixTs, "svix-signature": svixSig }) as {
      type: string;
      data: { email_id?: string };
    };

    const messageId = payload?.data?.email_id;
    const type      = payload?.type;

    if (!messageId || !type) return NextResponse.json({ ok: true });

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
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }
}
