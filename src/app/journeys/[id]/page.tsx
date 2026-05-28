export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { JourneyCanvas } from "@/components/journeys/journey-canvas";
import type { Node, Edge } from "@xyflow/react";
import type { SendWindowConfig } from "@/lib/journeys/send-window";

export default async function JourneyEditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session  = await getSession();
  const clientId = session.clientId!;
  const { id }   = await params;

  const [journey, pipelineStages, emailTemplates, audiences, settings] = await Promise.all([
    prisma.journey.findUnique({ where: { id, clientId } }),
    prisma.pipelineStage.findMany({ where: { clientId }, orderBy: { position: "asc" }, select: { id: true, name: true } }),
    prisma.emailTemplate.findMany({
      where:   { OR: [{ clientId }, { clientId: null, isDefault: true }] },
      orderBy: { createdAt: "asc" },
      select:  { id: true, name: true, channel: true, subject: true, body: true, waType: true, mediaUrl: true, mediaCaption: true },
    }),
    prisma.audience.findMany({ where: { clientId }, orderBy: { createdAt: "desc" }, select: { id: true, name: true } }),
    prisma.clientSettings.findUnique({ where: { clientId }, select: { consultants: true } }),
  ]);

  if (!journey) notFound();

  return (
    <JourneyCanvas
      journeyId={journey.id}
      journeyName={journey.name}
      journeyStatus={journey.status}
      initialNodes={(journey.nodes as unknown as Node[]) ?? []}
      initialEdges={(journey.edges as unknown as Edge[]) ?? []}
      pipelineStages={pipelineStages}
      emailTemplates={emailTemplates}
      audiences={audiences}
      consultants={settings?.consultants ?? []}
      sendWindow={(journey.sendWindow as unknown as SendWindowConfig) ?? null}
    />
  );
}
