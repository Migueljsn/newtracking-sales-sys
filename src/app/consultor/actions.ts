"use server";

import { redirect } from "next/navigation";
import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { getConsultantSession, clearConsultantCookie } from "@/lib/auth/consultant-session";
import { prisma } from "@/lib/db/prisma";
import { createSale } from "@/lib/domain/sale/create";
import { processPendingEvents } from "@/lib/domain/tracking/send-event";
import { invalidate, cacheKeys } from "@/lib/cache/invalidate";
import { inngest } from "@/lib/inngest/client";
import { leadChangedEvent } from "@/lib/inngest/events";

function fireLeadChanged(leadId: string, clientId: string) {
  after(() => inngest.send(leadChangedEvent.create({ leadId, clientId })));
}

export async function consultantLogoutAction() {
  await clearConsultantCookie();
  redirect("/consultor/login");
}

export async function consultantRegisterSaleAction(
  leadId: string,
  value: number,
  soldAt?: string,
  items?: { name: string; quantity: number; price: number }[]
) {
  const session  = await getConsultantSession();
  const clientId = session.clientId;

  await createSale({
    clientId,
    leadId,
    value,
    soldAt:    soldAt ? new Date(soldAt) : undefined,
    items:     items && items.length > 0 ? items : undefined,
    changedBy: session.name,
  });

  fireLeadChanged(leadId, clientId);
  after(() => processPendingEvents());

  await invalidate(
    cacheKeys.leads(clientId),
    cacheKeys.leadDetail(leadId),
    cacheKeys.metrics(clientId),
    cacheKeys.sales(clientId),
  );
  revalidatePath("/consultor");
}

export async function consultantMoveToStageAction(leadId: string, stageId: string | null) {
  const session  = await getConsultantSession();
  const clientId = session.clientId;

  const lead = await prisma.lead.findUniqueOrThrow({
    where:  { id: leadId, clientId },
    select: { status: true, pipelineStageId: true },
  });

  if (lead.status === "SOLD" || lead.status === "LOST") return;

  await prisma.lead.update({
    where: { id: leadId },
    data:  {
      pipelineStageId: stageId,
      statusHistory:   stageId
        ? { create: { to: stageId, changedBy: session.name } }
        : undefined,
    },
  });

  fireLeadChanged(leadId, clientId);

  await invalidate(cacheKeys.leads(clientId));
  revalidatePath("/consultor");
}

export async function getStageRequirementsAction(stageId: string) {
  await getConsultantSession(); // auth check only
  return prisma.pipelineStageRequirement.findMany({
    where:   { stageId },
    orderBy: { position: "asc" },
    select:  { id: true, text: true },
  });
}

export async function consultantMoveToStageWithChecklistAction(
  leadId: string,
  stageId: string | null,
  checkedRequirementIds: string[]
) {
  const session  = await getConsultantSession();
  const clientId = session.clientId;

  const lead = await prisma.lead.findUniqueOrThrow({
    where:  { id: leadId, clientId },
    select: { status: true, pipelineStageId: true },
  });

  if (lead.status === "SOLD" || lead.status === "LOST") return;

  // Upsert checklist entries for all requirements of the target stage
  if (stageId && checkedRequirementIds.length > 0) {
    await Promise.all(
      checkedRequirementIds.map((requirementId) =>
        prisma.leadChecklist.upsert({
          where:  { leadId_requirementId: { leadId, requirementId } },
          create: { leadId, requirementId, checked: true, checkedAt: new Date(), checkedBy: session.name },
          update: { checked: true, checkedAt: new Date(), checkedBy: session.name },
        })
      )
    );
  }

  await prisma.lead.update({
    where: { id: leadId },
    data:  {
      pipelineStageId: stageId,
      statusHistory:   stageId
        ? { create: { to: stageId, changedBy: session.name } }
        : undefined,
    },
  });

  fireLeadChanged(leadId, clientId);

  await invalidate(cacheKeys.leads(clientId), cacheKeys.leadDetail(leadId));
  revalidatePath("/consultor");
}

export async function consultantAssignConsultantAction(leadId: string, consultant: string | null) {
  const session  = await getConsultantSession();
  const clientId = session.clientId;

  await prisma.lead.update({
    where: { id: leadId, clientId },
    data:  { consultant: consultant || null },
  });

  fireLeadChanged(leadId, clientId);

  await invalidate(cacheKeys.leads(clientId));
  revalidatePath("/consultor");
}
