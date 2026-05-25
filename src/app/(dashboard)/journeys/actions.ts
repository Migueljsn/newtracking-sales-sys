"use server";

import { revalidatePath } from "next/cache";
import { redirect }       from "next/navigation";
import { getSession }     from "@/lib/auth/session";
import { prisma }         from "@/lib/db/prisma";
import { inngest }          from "@/lib/inngest/client";
import { enrollAllEvent }   from "@/lib/inngest/events";

export async function createJourneyAction(name: string) {
  const session  = await getSession();
  const clientId = session.clientId!;

  const journey = await prisma.journey.create({
    data: { clientId, name, nodes: [], edges: [] },
  });

  redirect(`/journeys/${journey.id}`);
}

export async function createJourneyFromTemplateAction(templateId: string) {
  const { JOURNEY_TEMPLATES } = await import("@/lib/journeys/templates");
  const template = JOURNEY_TEMPLATES.find(t => t.id === templateId);
  if (!template) throw new Error("Template not found");

  const session  = await getSession();
  const clientId = session.clientId!;

  const journey = await prisma.journey.create({
    data: {
      clientId,
      name:        template.name,
      description: template.description,
      nodes:       template.nodes as object[],
      edges:       template.edges as object[],
    },
  });

  redirect(`/journeys/${journey.id}`);
}

export async function updateJourneyAction(
  id: string,
  data: { name?: string; description?: string; nodes?: object[]; edges?: object[] }
) {
  const session  = await getSession();
  const clientId = session.clientId!;

  await prisma.journey.update({
    where: { id, clientId },
    data,
  });

  revalidatePath(`/journeys/${id}`);
}

export async function publishJourneyAction(id: string) {
  const session  = await getSession();
  const clientId = session.clientId!;

  await prisma.journey.update({
    where: { id, clientId },
    data:  { status: "ACTIVE" },
  });

  // Disparar enroll de todos os leads do público
  await inngest.send(enrollAllEvent.create({ journeyId: id, clientId }));

  revalidatePath(`/journeys/${id}`);
  revalidatePath("/journeys");
}

export async function pauseJourneyAction(id: string) {
  const session  = await getSession();
  const clientId = session.clientId!;

  await prisma.journey.update({
    where: { id, clientId },
    data:  { status: "PAUSED" },
  });

  revalidatePath(`/journeys/${id}`);
  revalidatePath("/journeys");
}

export async function archiveJourneyAction(id: string) {
  const session  = await getSession();
  const clientId = session.clientId!;

  await prisma.journey.update({
    where: { id, clientId },
    data:  { status: "ARCHIVED" },
  });

  revalidatePath("/journeys");
}

export async function deleteJourneyAction(id: string) {
  const session  = await getSession();
  const clientId = session.clientId!;

  await prisma.journey.delete({ where: { id, clientId } });
  revalidatePath("/journeys");
}

export async function bulkDeleteJourneysAction(ids: string[]) {
  const session  = await getSession();
  const clientId = session.clientId!;

  await prisma.journey.deleteMany({ where: { id: { in: ids }, clientId } });
  revalidatePath("/journeys");
}

export async function bulkArchiveJourneysAction(ids: string[]) {
  const session  = await getSession();
  const clientId = session.clientId!;

  await prisma.journey.updateMany({
    where: { id: { in: ids }, clientId, status: { not: "ARCHIVED" } },
    data:  { status: "ARCHIVED" },
  });
  revalidatePath("/journeys");
}

export async function bulkDuplicateJourneysAction(ids: string[]) {
  const session  = await getSession();
  const clientId = session.clientId!;

  const originals = await prisma.journey.findMany({
    where: { id: { in: ids }, clientId },
  });

  await prisma.journey.createMany({
    data: originals.map((j) => ({
      clientId,
      name:        `${j.name}-cópia`,
      description: j.description,
      status:      "DRAFT" as const,
      audienceId:  j.audienceId,
      nodes:       j.nodes as object[],
      edges:       j.edges as object[],
    })),
  });

  revalidatePath("/journeys");
}

export async function updateSendWindowAction(id: string, sendWindow: object) {
  const session  = await getSession();
  const clientId = session.clientId!;

  await prisma.journey.update({
    where: { id, clientId },
    data:  { sendWindow },
  });

  revalidatePath(`/journeys/${id}`);
}

export async function duplicateJourneyAction(id: string) {
  const session  = await getSession();
  const clientId = session.clientId!;

  const original = await prisma.journey.findUniqueOrThrow({ where: { id, clientId } });

  const copy = await prisma.journey.create({
    data: {
      clientId,
      name:        `${original.name}-cópia`,
      description: original.description,
      status:      "DRAFT",
      audienceId:  original.audienceId,
      nodes:       original.nodes as object[],
      edges:       original.edges as object[],
    },
  });

  revalidatePath("/journeys");
  redirect(`/journeys/${copy.id}`);
}
