"use server";

import { revalidatePath } from "next/cache";
import { getSession }     from "@/lib/auth/session";
import { prisma }         from "@/lib/db/prisma";
import { validateExitRules, type AgentExitRule } from "@/lib/agents/types";

type AgentFormData = {
  name: string;
  systemPrompt: string;
  negativePrompt?: string;
  temperature: number;
  memoryWindow: number;
  exitRules: AgentExitRule[];
};

function validate(data: AgentFormData) {
  if (!data.name.trim() || !data.systemPrompt.trim()) {
    throw new Error("Nome e prompt do sistema são obrigatórios");
  }
  validateExitRules(data.exitRules);
}

export async function createAiAgentAction(data: AgentFormData) {
  const session  = await getSession();
  const clientId = session.clientId!;

  validate(data);

  await prisma.aiAgent.create({
    data: {
      clientId,
      name:           data.name.trim(),
      systemPrompt:   data.systemPrompt.trim(),
      negativePrompt: data.negativePrompt?.trim() || null,
      temperature:    data.temperature,
      memoryWindow:   data.memoryWindow,
      exitRules:      data.exitRules,
    },
  });

  revalidatePath("/agents");
}

export async function updateAiAgentAction(id: string, data: AgentFormData) {
  const session  = await getSession();
  const clientId = session.clientId!;

  validate(data);

  await prisma.aiAgent.update({
    where: { id, clientId },
    data: {
      name:           data.name.trim(),
      systemPrompt:   data.systemPrompt.trim(),
      negativePrompt: data.negativePrompt?.trim() || null,
      temperature:    data.temperature,
      memoryWindow:   data.memoryWindow,
      exitRules:      data.exitRules,
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
