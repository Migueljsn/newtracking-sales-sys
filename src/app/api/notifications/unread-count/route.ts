import { NextResponse } from "next/server";
import { getSession }   from "@/lib/auth/session";
import { prisma }       from "@/lib/db/prisma";

export async function GET() {
  try {
    const session = await getSession();
    const count   = await prisma.notification.count({
      where: { clientId: session.clientId!, isRead: false },
    });
    return NextResponse.json({ count });
  } catch {
    return NextResponse.json({ count: 0 });
  }
}
