import { NextResponse } from "next/server";
import { getSession }   from "@/lib/auth/session";
import { prisma }       from "@/lib/db/prisma";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  const { id }   = await params;
  const session  = await getSession();
  const clientId = session.clientId!;

  const flow = await prisma.flow.findUnique({
    where:   { id, clientId },
    include: { triggers: true },
  });
  if (!flow) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json(flow);
}

export async function PUT(req: Request, { params }: Params) {
  const { id }   = await params;
  const session  = await getSession();
  const clientId = session.clientId!;
  const body     = await req.json() as {
    name?:     string;
    nodes?:    unknown[];
    edges?:    unknown[];
    status?:   string;
    triggers?: { type: string; audienceId?: string | null; keyword?: string | null; keywordMatchType?: string }[];
  };

  const { triggers, ...rest } = body;

  const flow = await prisma.$transaction(async (tx) => {
    if (triggers !== undefined) {
      await tx.flowTrigger.deleteMany({ where: { flowId: id } });
      if (triggers.length > 0) {
        await tx.flowTrigger.createMany({
          data: triggers.map((t) => ({
            flowId:          id,
            clientId,
            type:            t.type as "AUDIENCE" | "KEYWORD",
            audienceId:      t.audienceId ?? null,
            keyword:         t.keyword    ?? null,
            keywordMatchType: (t.keywordMatchType ?? "CONTAINS") as "EXACT" | "CONTAINS" | "STARTS_WITH",
          })),
        });
      }
    }
    return tx.flow.update({
      where: { id, clientId },
      data:  rest as object,
    });
  });

  return NextResponse.json(flow);
}

export async function DELETE(_req: Request, { params }: Params) {
  const { id }   = await params;
  const session  = await getSession();
  const clientId = session.clientId!;

  await prisma.flow.delete({ where: { id, clientId } });
  return NextResponse.json({ ok: true });
}
