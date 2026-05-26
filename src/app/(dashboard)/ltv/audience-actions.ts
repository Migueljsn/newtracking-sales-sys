"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { RuleGroup, AudienceDefinition } from "@/lib/audiences/types";
import { evaluateAudience } from "@/lib/audiences/evaluate";

// ─── Preview ──────────────────────────────────────────────────────────────────

export type PreviewSample = {
  id: string
  name: string
  status: string
  stageName: string | null
}

export type PreviewResult = {
  count: number
  samples: PreviewSample[]
}

export async function previewAudienceAction(
  include: RuleGroup,
  exclude: RuleGroup | null,
): Promise<PreviewResult> {
  const session  = await getSession();
  const clientId = session.clientId!;

  const leads = await prisma.lead.findMany({
    where: { clientId },
    select: {
      id:             true,
      status:         true,
      pipelineStageId:true,
      capturedAt:     true,
      utmSource:      true,
      utmMedium:      true,
      utmCampaign:    true,
      consultant:     true,
      pipelineStage:  { select: { name: true } },
      customer:       { select: { name: true, state: true, city: true, email: true } },
      sales:          { select: { value: true, soldAt: true } },
    },
  });

  const def: AudienceDefinition = { include, exclude };

  const matched = leads.filter((l) =>
    evaluateAudience(
      {
        status:          l.status,
        pipelineStageId: l.pipelineStageId,
        capturedAt:      l.capturedAt,
        utmSource:       l.utmSource,
        utmMedium:       l.utmMedium,
        utmCampaign:     l.utmCampaign,
        consultant:      l.consultant,
        customer:        l.customer,
        sales:           l.sales.map((s) => ({ value: s.value.toString(), soldAt: s.soldAt })),
      },
      def,
    )
  );

  return {
    count:   matched.length,
    samples: matched.slice(0, 5).map((l) => ({
      id:        l.id,
      name:      l.customer?.name ?? "—",
      status:    l.status,
      stageName: l.pipelineStage?.name ?? null,
    })),
  };
}

// ─── CRUD ─────────────────────────────────────────────────────────────────────

export async function createAudienceAction(data: {
  name:        string
  description?: string
  include:     RuleGroup
  exclude:     RuleGroup | null
}) {
  const session  = await getSession();
  const clientId = session.clientId!;

  await prisma.audience.create({
    data: {
      clientId,
      name:        data.name,
      description: data.description ?? null,
      rules:       { include: data.include, exclude: data.exclude } as object,
    },
  });

  revalidatePath("/ltv");
  revalidatePath("/journeys");
}

export async function updateAudienceAction(id: string, data: {
  name:        string
  description?: string
  include:     RuleGroup
  exclude:     RuleGroup | null
}) {
  const session  = await getSession();
  const clientId = session.clientId!;

  await prisma.audience.update({
    where: { id, clientId },
    data: {
      name:        data.name,
      description: data.description ?? null,
      rules:       { include: data.include, exclude: data.exclude } as object,
    },
  });

  revalidatePath("/ltv");
  revalidatePath("/journeys");
}

export async function deleteAudienceAction(id: string) {
  const session  = await getSession();
  const clientId = session.clientId!;

  await prisma.audience.delete({ where: { id, clientId } });
  revalidatePath("/ltv");
}

export async function bulkDeleteAudiencesAction(ids: string[]) {
  const session  = await getSession();
  const clientId = session.clientId!;

  await prisma.audience.deleteMany({ where: { id: { in: ids }, clientId } });
  revalidatePath("/ltv");
}

export async function bulkDuplicateAudiencesAction(ids: string[]) {
  const session  = await getSession();
  const clientId = session.clientId!;

  const originals = await prisma.audience.findMany({ where: { id: { in: ids }, clientId } });

  await prisma.audience.createMany({
    data: originals.map((a) => ({
      clientId,
      name:        `${a.name}-cópia`,
      description: a.description,
      rules:       a.rules as object,
    })),
  });

  revalidatePath("/ltv");
}

export async function duplicateAudienceAction(id: string) {
  const session  = await getSession();
  const clientId = session.clientId!;

  const original = await prisma.audience.findUniqueOrThrow({ where: { id, clientId } });

  await prisma.audience.create({
    data: {
      clientId,
      name:        `${original.name}-cópia`,
      description: original.description,
      rules:       original.rules as object,
    },
  });

  revalidatePath("/ltv");
}
