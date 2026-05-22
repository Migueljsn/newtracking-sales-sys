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
    soldAt: soldAt ? new Date(soldAt) : undefined,
    items:  items && items.length > 0 ? items : undefined,
  });

  fireLeadChanged(leadId, clientId);
  after(() => processPendingEvents());

  await invalidate(cacheKeys.leads(clientId), cacheKeys.metrics(clientId), cacheKeys.sales(clientId));
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
    data:  { pipelineStageId: stageId },
  });

  fireLeadChanged(leadId, clientId);

  await invalidate(cacheKeys.leads(clientId));
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
