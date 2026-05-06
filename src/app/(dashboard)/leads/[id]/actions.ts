"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth/session";
import { createSale } from "@/lib/domain/sale/create";
import { createLead } from "@/lib/domain/lead/create";
import { buildPurchasePayload } from "@/lib/domain/tracking/build-payload";
import { updateCustomerLifecycle } from "@/lib/domain/customer/update-lifecycle";
import { processPendingEvents } from "@/lib/domain/tracking/send-event";
import { prisma } from "@/lib/db/prisma";
import { invalidate, cacheKeys } from "@/lib/cache/invalidate";

function parseItems(formData: FormData) {
  const names      = formData.getAll("itemName")     as string[];
  const quantities = formData.getAll("itemQuantity") as string[];
  const prices     = formData.getAll("itemPrice")    as string[];

  return names
    .map((name, i) => ({
      name,
      quantity: parseInt(quantities[i]) || 1,
      price:    parseFloat(prices[i])   || 0,
    }))
    .filter((item) => item.name.trim() !== "");
}

export async function registerSaleAction(formData: FormData) {
  const session  = await getSession();
  const clientId = session.clientId!;

  const leadId    = formData.get("leadId") as string;
  const value     = parseFloat(formData.get("value") as string);
  const notes     = (formData.get("notes") as string)?.trim() || undefined;
  const soldAtStr = (formData.get("soldAt") as string)?.trim();
  const soldAt    = soldAtStr ? new Date(soldAtStr) : undefined;

  if (!leadId || isNaN(value) || value <= 0) throw new Error("Valor da venda inválido");

  const items = parseItems(formData);

  await createSale({
    clientId,
    leadId,
    value,
    soldAt,
    notes,
    items: items.length > 0 ? items : undefined,
  });

  after(() => processPendingEvents());

  await invalidate(cacheKeys.leadDetail(leadId), cacheKeys.leads(clientId), cacheKeys.sales(clientId), cacheKeys.metrics(clientId));
  revalidatePath(`/leads/${leadId}`);
  revalidatePath("/leads");
  revalidatePath("/sales");
  revalidatePath("/");
}

export async function markAsLostAction(leadId: string) {
  const session = await getSession();

  const lead = await prisma.lead.findUniqueOrThrow({
    where: { id: leadId, clientId: session.clientId! },
  });

  if (lead.status !== "NEW") throw new Error("Apenas leads novas podem ser marcadas como perdidas");

  await prisma.lead.update({
    where: { id: leadId },
    data: {
      status: "LOST",
      statusHistory: { create: { from: "NEW", to: "LOST" } },
    },
  });

  await invalidate(cacheKeys.leadDetail(leadId), cacheKeys.leads(session.clientId!), cacheKeys.metrics(session.clientId!));
  revalidatePath(`/leads/${leadId}`);
  revalidatePath("/leads");
}

// Registra uma nova venda para um cliente já existente (LTV / recompra)
export async function createLtvSaleAction(formData: FormData): Promise<string> {
  const session  = await getSession();
  const clientId = session.clientId!;

  const sourceLeadId = formData.get("sourceLeadId") as string;
  const value        = parseFloat(formData.get("value") as string);
  const notes        = (formData.get("notes") as string)?.trim() || undefined;
  const soldAtStr    = (formData.get("soldAt") as string)?.trim();
  const soldAt       = soldAtStr ? new Date(soldAtStr) : undefined;

  if (!sourceLeadId || isNaN(value) || value <= 0) throw new Error("Valor da venda inválido");

  const sourceLead = await prisma.lead.findUniqueOrThrow({
    where:   { id: sourceLeadId, clientId },
    include: { customer: true },
  });

  // Atualiza email do customer se estava vazio
  const email = (formData.get("email") as string)?.trim() || undefined;
  if (email && !sourceLead.customer.email) {
    await prisma.customer.update({
      where: { id: sourceLead.customer.id },
      data:  { email },
    });
  }

  const utmSource   = (formData.get("utmSource")   as string)?.trim() || undefined;
  const utmMedium   = (formData.get("utmMedium")   as string)?.trim() || undefined;
  const utmCampaign = (formData.get("utmCampaign") as string)?.trim() || undefined;
  const utmContent  = (formData.get("utmContent")  as string)?.trim() || undefined;
  const utmTerm     = (formData.get("utmTerm")     as string)?.trim() || undefined;

  const { lead } = await createLead({
    clientId,
    name:   sourceLead.customer.name,
    phone:  sourceLead.customer.phone,
    source: "MANUAL",
    utmSource,
    utmMedium,
    utmCampaign,
    utmContent,
    utmTerm,
  });

  const items = parseItems(formData);

  await createSale({
    clientId,
    leadId: lead.id,
    value,
    soldAt,
    notes,
    items: items.length > 0 ? items : undefined,
  });

  after(() => processPendingEvents());

  await invalidate(
    cacheKeys.leads(clientId),
    cacheKeys.leadDetail(sourceLeadId),
    cacheKeys.sales(clientId),
    cacheKeys.metrics(clientId),
  );
  revalidatePath("/leads");
  revalidatePath("/sales");
  revalidatePath("/");
  revalidatePath(`/leads/${sourceLeadId}`);

  return lead.id;
}

// ─── CRUD: Customer ──────────────────────────────────────────────────────────

export async function updateCustomerAction(formData: FormData) {
  const session  = await getSession();
  const clientId = session.clientId!;

  const leadId = formData.get("leadId") as string;

  const lead = await prisma.lead.findUniqueOrThrow({
    where:  { id: leadId, clientId },
    select: { customerId: true },
  });

  const name     = (formData.get("name")     as string).trim();
  const phone    = (formData.get("phone")    as string).replace(/\D/g, "");
  const email    = (formData.get("email")    as string)?.trim()             || null;
  const document = (formData.get("document") as string)?.replace(/\D/g, "") || null;
  const zipCode  = (formData.get("zipCode")  as string)?.replace(/\D/g, "") || null;
  const city     = (formData.get("city")     as string)?.trim()             || null;
  const state    = (formData.get("state")    as string)?.trim()             || null;
  const bdStr    = (formData.get("birthDate") as string)?.trim();
  const birthDate = bdStr ? new Date(bdStr) : null;

  if (!name || !phone) throw new Error("Nome e telefone são obrigatórios");

  try {
    await prisma.customer.update({
      where: { id: lead.customerId },
      data:  { name, phone, email, document, zipCode, city, state, birthDate },
    });
  } catch (err: unknown) {
    if ((err as { code?: string }).code === "P2002") {
      throw new Error("Já existe outro cliente com este telefone ou CPF/CNPJ nesta conta.");
    }
    throw err;
  }

  await invalidate(cacheKeys.leadDetail(leadId), cacheKeys.leads(clientId));
  revalidatePath(`/leads/${leadId}`);
}

// ─── CRUD: Lead (UTMs + notas) ────────────────────────────────────────────────

export async function updateLeadAction(formData: FormData) {
  const session  = await getSession();
  const clientId = session.clientId!;

  const leadId      = formData.get("leadId")      as string;
  const notes       = (formData.get("notes")       as string)?.trim() || null;
  const utmSource   = (formData.get("utmSource")   as string)?.trim() || null;
  const utmMedium   = (formData.get("utmMedium")   as string)?.trim() || null;
  const utmCampaign = (formData.get("utmCampaign") as string)?.trim() || null;
  const utmContent  = (formData.get("utmContent")  as string)?.trim() || null;
  const utmTerm     = (formData.get("utmTerm")     as string)?.trim() || null;

  await prisma.lead.update({
    where: { id: leadId, clientId },
    data:  { notes, utmSource, utmMedium, utmCampaign, utmContent, utmTerm },
  });

  await invalidate(cacheKeys.leadDetail(leadId), cacheKeys.leads(clientId));
  revalidatePath(`/leads/${leadId}`);
}

// ─── CRUD: Delete Lead ────────────────────────────────────────────────────────

export async function deleteLeadAction(leadId: string) {
  const session  = await getSession();
  const clientId = session.clientId!;

  const lead = await prisma.lead.findUniqueOrThrow({
    where:   { id: leadId, clientId },
    include: { sale: true },
  });

  // Tracking events não têm cascade no schema — deletar manualmente
  await prisma.trackingEvent.deleteMany({ where: { leadId } });

  if (lead.sale) {
    await prisma.trackingEvent.deleteMany({ where: { saleId: lead.sale.id } });
    // Sale cascade deleta SaleItem
    await prisma.sale.delete({ where: { id: lead.sale.id } });
  }

  // Lead cascade deleta LeadStatusHistory
  await prisma.lead.delete({ where: { id: leadId } });

  await invalidate(cacheKeys.leadDetail(leadId), cacheKeys.leads(clientId), cacheKeys.sales(clientId), cacheKeys.metrics(clientId));
  revalidatePath("/leads");
  revalidatePath("/sales");
  revalidatePath("/");
}

// ─── CRUD: Sale (editar) ──────────────────────────────────────────────────────

export async function updateSaleAction(formData: FormData) {
  const session  = await getSession();
  const clientId = session.clientId!;

  const saleId = formData.get("saleId") as string;
  const value  = parseFloat(formData.get("value") as string);
  const notes  = (formData.get("notes") as string)?.trim() || null;

  if (!saleId || isNaN(value) || value <= 0) throw new Error("Valor inválido");

  const items = parseItems(formData);

  const sale = await prisma.sale.findUniqueOrThrow({
    where:   { id: saleId, clientId },
    include: { lead: { include: { customer: true } } },
  });

  const updatedSale = await prisma.sale.update({
    where: { id: saleId },
    data:  {
      value,
      notes,
      items: { deleteMany: {}, create: items },
    },
  });

  // Se o evento ainda não foi enviado ao Meta, atualiza o payload com o novo valor
  const pendingEvent = await prisma.trackingEvent.findFirst({
    where: { saleId, status: { in: ["PENDING", "FAILED"] } },
  });

  if (pendingEvent) {
    const { createId } = await import("@paralleldrive/cuid2");
    const newEventId   = createId();
    const payload      = buildPurchasePayload(
      sale.lead.customer,
      sale.lead,
      { ...updatedSale, soldAt: sale.soldAt, leadId: sale.leadId, customerId: sale.customerId },
      newEventId
    );
    await prisma.trackingEvent.update({
      where: { id: pendingEvent.id },
      data:  { eventId: newEventId, status: "PENDING", payload, attempts: 0, errorMessage: null, lastAttemptAt: null },
    });
  }

  after(() => processPendingEvents());

  await invalidate(cacheKeys.leadDetail(sale.leadId), cacheKeys.sales(clientId));
  revalidatePath(`/leads/${sale.leadId}`);
  revalidatePath("/sales");
}

// ─── CRUD: Delete Sale ────────────────────────────────────────────────────────

export async function deleteSaleAction(saleId: string) {
  const session  = await getSession();
  const clientId = session.clientId!;

  const sale = await prisma.sale.findUniqueOrThrow({
    where: { id: saleId, clientId },
  });

  // Tracking events do Purchase não têm cascade — deletar manualmente
  await prisma.trackingEvent.deleteMany({ where: { saleId } });

  // Sale cascade deleta SaleItem
  await prisma.sale.delete({ where: { id: saleId } });

  // Reverte a lead para NEW
  await prisma.lead.update({
    where: { id: sale.leadId },
    data:  {
      status:        "NEW",
      statusHistory: { create: { from: "SOLD", to: "NEW" } },
    },
  });

  await updateCustomerLifecycle(sale.customerId);

  await invalidate(cacheKeys.leadDetail(sale.leadId), cacheKeys.leads(clientId), cacheKeys.sales(clientId), cacheKeys.metrics(clientId));
  revalidatePath(`/leads/${sale.leadId}`);
  revalidatePath("/leads");
  revalidatePath("/sales");
  revalidatePath("/");
}
