import { NextResponse } from "next/server";
import { getSession }   from "@/lib/auth/session";
import { prisma }       from "@/lib/db/prisma";

export async function GET() {
  const session  = await getSession();
  const clientId = session.clientId!;

  const flows = await prisma.flow.findMany({
    where:   { clientId, status: { not: "ARCHIVED" } },
    orderBy: { updatedAt: "desc" },
    include: {
      triggers:    { select: { type: true, audienceId: true, keyword: true, audience: { select: { name: true } } } },
      enrollments: { select: { id: true } },
    },
  });

  return NextResponse.json(flows);
}

export async function POST(req: Request) {
  const session  = await getSession();
  const clientId = session.clientId!;
  const { name } = await req.json() as { name: string };

  const flow = await prisma.flow.create({
    data: { clientId, name: name.trim(), nodes: [], edges: [] },
  });

  return NextResponse.json(flow);
}
