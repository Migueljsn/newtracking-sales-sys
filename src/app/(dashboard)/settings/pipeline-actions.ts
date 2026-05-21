"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";

export async function createPipelineStageAction(formData: FormData) {
  const session  = await getSession();
  const clientId = session.clientId!;

  const name  = (formData.get("name")  as string).trim();
  const color = (formData.get("color") as string) || "#6366f1";

  if (!name) throw new Error("Nome obrigatório");

  const max = await prisma.pipelineStage.aggregate({
    where: { clientId },
    _max:  { position: true },
  });

  await prisma.pipelineStage.create({
    data: { clientId, name, color, position: (max._max.position ?? 0) + 1 },
  });

  revalidatePath("/settings");
  revalidatePath("/leads");
}

export async function updatePipelineStageAction(formData: FormData) {
  const session  = await getSession();
  const clientId = session.clientId!;

  const id    = formData.get("id")    as string;
  const name  = (formData.get("name")  as string).trim();
  const color = (formData.get("color") as string) || "#6366f1";

  if (!id || !name) throw new Error("Dados inválidos");

  await prisma.pipelineStage.updateMany({
    where: { id, clientId },
    data:  { name, color },
  });

  revalidatePath("/settings");
  revalidatePath("/leads");
}

export async function deletePipelineStageAction(id: string) {
  const session  = await getSession();
  const clientId = session.clientId!;

  // Move leads on this stage back to plain NEW
  await prisma.lead.updateMany({
    where: { pipelineStageId: id, clientId },
    data:  { pipelineStageId: null },
  });

  await prisma.pipelineStage.deleteMany({ where: { id, clientId } });

  revalidatePath("/settings");
  revalidatePath("/leads");
}
