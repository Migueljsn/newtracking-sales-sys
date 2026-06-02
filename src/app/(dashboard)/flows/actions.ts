"use server";

import { revalidatePath } from "next/cache";
import { redirect }       from "next/navigation";
import { getSession }     from "@/lib/auth/session";
import { prisma }         from "@/lib/db/prisma";
import { inngest }                          from "@/lib/inngest/client";
import { flowEnrollAllEvent }               from "@/lib/inngest/events";

export async function createFlowAction(name: string) {
  const session  = await getSession();
  const clientId = session.clientId!;
  const flow = await prisma.flow.create({
    data: { clientId, name: name.trim(), nodes: [], edges: [] },
  });
  revalidatePath("/flows");
  redirect(`/flows/${flow.id}`);
}

type NodeLike = { type?: string; data?: Record<string, unknown> }
const MATCH_MAP: Record<string, "EXACT" | "CONTAINS" | "STARTS_WITH"> = {
  exact: "EXACT", contains: "CONTAINS", starts_with: "STARTS_WITH",
};

export async function updateFlowAction(
  id: string,
  data: { name?: string; nodes?: unknown; edges?: unknown }
) {
  const session  = await getSession();
  const clientId = session.clientId!;

  if (data.nodes !== undefined) {
    const nodes = data.nodes as NodeLike[];
    const triggerNode = nodes.find((n) => n.type === "trigger");
    const d = triggerNode?.data;

    await prisma.$transaction(async (tx) => {
      await tx.flowTrigger.deleteMany({ where: { flowId: id, clientId } });

      if (d?.triggerType === "audience" && d.audienceId) {
        await tx.flowTrigger.create({
          data: { flowId: id, clientId, type: "AUDIENCE", audienceId: String(d.audienceId) },
        });
      } else if (d?.triggerType === "keyword" && d.keyword) {
        await tx.flowTrigger.create({
          data: {
            flowId: id, clientId, type: "KEYWORD",
            keyword: String(d.keyword),
            keywordMatchType: MATCH_MAP[String(d.keywordMatch)] ?? "CONTAINS",
          },
        });
      }

      await tx.flow.update({ where: { id, clientId }, data: data as object });
    });
  } else {
    await prisma.flow.update({ where: { id, clientId }, data: data as object });
  }

  revalidatePath("/flows");
  revalidatePath(`/flows/${id}`);
}

export async function publishFlowAction(id: string) {
  const session  = await getSession();
  const clientId = session.clientId!;

  // Apaga enrollments bloqueantes para permitir re-execução ao reativar
  // Mantém apenas COMPLETED (histórico de quem concluiu o fluxo)
  await prisma.flowEnrollment.deleteMany({
    where: { flowId: id, clientId, status: { in: ["ACTIVE", "FAILED", "EXITED"] } },
  });

  await prisma.flow.update({ where: { id, clientId }, data: { status: "ACTIVE" } });

  try {
    await inngest.send(flowEnrollAllEvent.create({ flowId: id, clientId }));
  } catch (err) {
    console.error("[publishFlowAction] inngest.send failed:", err);
  }

  revalidatePath("/flows");
  revalidatePath(`/flows/${id}`);
}

export async function pauseFlowAction(id: string) {
  const session  = await getSession();
  const clientId = session.clientId!;
  await prisma.flow.update({ where: { id, clientId }, data: { status: "PAUSED" } });
  revalidatePath("/flows");
  revalidatePath(`/flows/${id}`);
}

export async function archiveFlowAction(id: string) {
  const session  = await getSession();
  const clientId = session.clientId!;
  await prisma.flow.update({ where: { id, clientId }, data: { status: "ARCHIVED" } });
  revalidatePath("/flows");
}

export async function deleteFlowAction(id: string) {
  const session  = await getSession();
  const clientId = session.clientId!;
  await prisma.flow.delete({ where: { id, clientId } });
  revalidatePath("/flows");
}

export async function duplicateFlowAction(id: string) {
  const session  = await getSession();
  const clientId = session.clientId!;
  const source   = await prisma.flow.findUniqueOrThrow({ where: { id, clientId }, include: { triggers: true } });
  const copy     = await prisma.flow.create({
    data: {
      clientId,
      name:   `${source.name} — cópia`,
      nodes:  source.nodes as object,
      edges:  source.edges as object,
      status: "DRAFT",
    },
  });
  if (source.triggers.length > 0) {
    await prisma.flowTrigger.createMany({
      data: source.triggers.map((t) => ({
        flowId:          copy.id,
        clientId,
        type:            t.type,
        audienceId:      t.audienceId,
        keyword:         t.keyword,
        keywordMatchType: t.keywordMatchType,
      })),
    });
  }
  revalidatePath("/flows");
}
