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

export async function reorderPipelineStagesAction(orderedIds: string[]) {
  const session  = await getSession();
  const clientId = session.clientId!;

  await Promise.all(
    orderedIds.map((id, index) =>
      prisma.pipelineStage.updateMany({
        where: { id, clientId },
        data:  { position: index },
      })
    )
  );

  revalidatePath("/settings");
  revalidatePath("/leads");
}

// ─── Requirements ───────────────────────────────────────────────────────────

export async function addRequirementAction(stageId: string, text: string) {
  const session  = await getSession();
  const clientId = session.clientId!;

  // Verify stage belongs to client
  const stage = await prisma.pipelineStage.findFirst({ where: { id: stageId, clientId } });
  if (!stage) throw new Error("Etapa não encontrada");

  const max = await prisma.pipelineStageRequirement.aggregate({
    where: { stageId },
    _max:  { position: true },
  });

  await prisma.pipelineStageRequirement.create({
    data: { stageId, text: text.trim(), position: (max._max.position ?? 0) + 1 },
  });

  revalidatePath("/settings");
}

export async function updateRequirementAction(id: string, text: string) {
  await prisma.pipelineStageRequirement.update({
    where: { id },
    data:  { text: text.trim() },
  });
  revalidatePath("/settings");
}

export async function deleteRequirementAction(id: string) {
  await prisma.pipelineStageRequirement.delete({ where: { id } });
  revalidatePath("/settings");
}

export async function reorderRequirementsAction(stageId: string, orderedIds: string[]) {
  await Promise.all(
    orderedIds.map((id, index) =>
      prisma.pipelineStageRequirement.update({
        where: { id },
        data:  { position: index },
      })
    )
  );
  revalidatePath("/settings");
}
