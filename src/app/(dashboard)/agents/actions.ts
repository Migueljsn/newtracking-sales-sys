"use server";

import { revalidatePath } from "next/cache";
import { getSession }     from "@/lib/auth/session";
import { prisma }         from "@/lib/db/prisma";

export async function createAiAgentAction(data: {
  name: string;
  systemPrompt: string;
  negativePrompt?: string;
  temperature: number;
  memoryWindow: number;
}) {
  const session  = await getSession();
  const clientId = session.clientId!;

  if (!data.name.trim() || !data.systemPrompt.trim()) {
    throw new Error("Nome e prompt do sistema são obrigatórios");
  }

  await prisma.aiAgent.create({
    data: {
      clientId,
      name:           data.name.trim(),
      systemPrompt:   data.systemPrompt.trim(),
      negativePrompt: data.negativePrompt?.trim() || null,
      temperature:    data.temperature,
      memoryWindow:   data.memoryWindow,
    },
  });

  revalidatePath("/agents");
}

export async function toggleAiAgentActiveAction(id: string, isActive: boolean) {
  const session  = await getSession();
  const clientId = session.clientId!;

  await prisma.aiAgent.update({
    where: { id, clientId },
    data:  { isActive },
  });

  revalidatePath("/agents");
}

export async function deleteAiAgentAction(id: string) {
  const session  = await getSession();
  const clientId = session.clientId!;

  await prisma.aiAgent.delete({ where: { id, clientId } });

  revalidatePath("/agents");
}
