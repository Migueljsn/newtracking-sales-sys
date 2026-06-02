export const dynamic = "force-dynamic";

import { notFound }    from "next/navigation";
import { getSession }  from "@/lib/auth/session";
import { prisma }      from "@/lib/db/prisma";
import { FlowCanvas }  from "@/components/flows/flow-canvas";
import type { Node, Edge } from "@xyflow/react";

export default async function FlowEditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session  = await getSession();
  const clientId = session.clientId!;
  const { id }   = await params;

  const [flow, audiences, pipelineStages, settings, allFlows] = await Promise.all([
    prisma.flow.findUnique({ where: { id, clientId }, include: { triggers: true } }),
    prisma.audience.findMany({ where: { clientId }, orderBy: { createdAt: "desc" }, select: { id: true, name: true } }),
    prisma.pipelineStage.findMany({ where: { clientId }, orderBy: { position: "asc" }, select: { id: true, name: true } }),
    prisma.clientSettings.findUnique({ where: { clientId }, select: { consultants: true } }),
    prisma.flow.findMany({ where: { clientId, status: { not: "ARCHIVED" } }, select: { id: true, name: true } }),
  ]);

  if (!flow) notFound();

  return (
    <FlowCanvas
      flowId={flow.id}
      flowName={flow.name}
      flowStatus={flow.status}
      initialNodes={(flow.nodes as unknown as Node[]) ?? []}
      initialEdges={(flow.edges as unknown as Edge[]) ?? []}
      audiences={audiences}
      pipelineStages={pipelineStages}
      consultants={settings?.consultants ?? []}
      flows={allFlows}
    />
  );
}
