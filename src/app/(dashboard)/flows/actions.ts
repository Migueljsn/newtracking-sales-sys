"use server";

import { revalidatePath } from "next/cache";
import { redirect }       from "next/navigation";
import { getSession }     from "@/lib/auth/session";
import { prisma }         from "@/lib/db/prisma";

export async function createFlowAction(name: string) {
  const session  = await getSession();
  const clientId = session.clientId!;
  const flow = await prisma.flow.create({
    data: { clientId, name: name.trim(), nodes: [], edges: [] },
  });
  revalidatePath("/flows");
  redirect(`/flows/${flow.id}`);
}

export async function updateFlowAction(
  id: string,
  data: { name?: string; nodes?: unknown; edges?: unknown }
) {
  const session  = await getSession();
  const clientId = session.clientId!;
  await prisma.flow.update({ where: { id, clientId }, data: data as object });
  revalidatePath("/flows");
}

export async function publishFlowAction(id: string) {
  const session  = await getSession();
  const clientId = session.clientId!;
  await prisma.flow.update({ where: { id, clientId }, data: { status: "ACTIVE" } });
  revalidatePath("/flows");
}

export async function pauseFlowAction(id: string) {
  const session  = await getSession();
  const clientId = session.clientId!;
  await prisma.flow.update({ where: { id, clientId }, data: { status: "PAUSED" } });
  revalidatePath("/flows");
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
