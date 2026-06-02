import { NextResponse } from "next/server";
import { getSession }   from "@/lib/auth/session";
import { prisma }       from "@/lib/db/prisma";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id }     = await params;
  const session    = await getSession();
  const { paused } = await req.json() as { paused: boolean };

  await prisma.lead.update({
    where: { id, clientId: session.clientId! },
    data:  { automationPaused: paused },
  });

  return NextResponse.json({ ok: true });
}
