"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth/session";
import { createLead } from "@/lib/domain/lead/create";
import { createSale } from "@/lib/domain/sale/create";
import { processPendingEvents } from "@/lib/domain/tracking/send-event";
import { prisma } from "@/lib/db/prisma";
import { invalidate, cacheKeys } from "@/lib/cache/invalidate";

function normalizeDigits(value: string | null) {
  return value?.replace(/\D/g, "") || "";
}

export async function createLeadAction(
  formData: FormData
): Promise<{ duplicate: boolean; saleCreated: boolean }> {
  const session = await getSession();
  const clientId = session.clientId!;

  const name     = (formData.get("name")     as string)?.trim();
  const phone    = normalizeDigits(formData.get("phone") as string | null);
  const document = normalizeDigits(formData.get("document") as string | null);
  const zipCode  = normalizeDigits(formData.get("zipCode") as string | null);

  if (!name || !phone) throw new Error("Nome e telefone são obrigatórios");

  const utmSource   = (formData.get("utmSource")   as string)?.trim() || undefined;
  const utmMedium   = (formData.get("utmMedium")   as string)?.trim() || undefined;
  const utmCampaign = (formData.get("utmCampaign") as string)?.trim() || undefined;
  const utmContent  = (formData.get("utmContent")  as string)?.trim() || undefined;
  const utmTerm     = (formData.get("utmTerm")     as string)?.trim() || undefined;

  const consultant = (formData.get("consultant") as string)?.trim() || undefined;

  const { lead, duplicate } = await createLead({
    clientId,
    name,
    phone,
    email:      (formData.get("email")   as string)?.trim() || undefined,
    document:   document || undefined,
    zipCode:    zipCode  || undefined,
    city:       (formData.get("city")    as string)?.trim() || undefined,
    state:      (formData.get("state")   as string)?.trim() || undefined,
    source:     "MANUAL",
    consultant,
    utmSource,
    utmMedium,
    utmCampaign,
    utmContent,
    utmTerm,
  });

  let saleCreated = false;

  if (!duplicate) {
    const sellNow  = formData.get("sellNow") === "on";
    const saleValue = parseFloat(formData.get("saleValue") as string);

    if (sellNow && !isNaN(saleValue) && saleValue > 0) {
      const names      = formData.getAll("itemName")     as string[];
      const quantities = formData.getAll("itemQuantity") as string[];
      const prices     = formData.getAll("itemPrice")    as string[];

      const items = names
        .map((n, i) => ({
          name:     n,
          quantity: parseInt(quantities[i]) || 1,
          price:    parseFloat(prices[i])   || 0,
        }))
        .filter((item) => item.name.trim() !== "");

      const soldAtStr = (formData.get("soldAt") as string)?.trim();
      const soldAt    = soldAtStr ? new Date(soldAtStr) : undefined;

      await createSale({
        clientId,
        leadId: lead.id,
        value:  saleValue,
        soldAt,
        notes:  (formData.get("saleNotes") as string)?.trim() || undefined,
        items:  items.length > 0 ? items : undefined,
      });

      saleCreated = true;
      revalidatePath("/sales");
      revalidatePath("/");
    }
  }

  if (!duplicate) after(() => processPendingEvents());

  await invalidate(cacheKeys.leads(clientId), cacheKeys.metrics(clientId));
  if (saleCreated) await invalidate(cacheKeys.sales(clientId));
  revalidatePath("/leads");
  return { duplicate, saleCreated };
}

// ─── Ações em massa ───────────────────────────────────────────────────────────

export async function bulkMarkAsLostAction(leadIds: string[]): Promise<{ updated: number }> {
  const session  = await getSession();
  const clientId = session.clientId!;
  if (leadIds.length === 0) return { updated: 0 };

  const eligible = await prisma.lead.findMany({
    where:  { id: { in: leadIds }, clientId, status: { in: ["NEW", "REGISTERED"] } },
    select: { id: true, status: true },
  });
  if (eligible.length === 0) return { updated: 0 };

  await prisma.lead.updateMany({
    where: { id: { in: eligible.map(l => l.id) } },
    data:  { status: "LOST" },
  });
  await prisma.leadStatusHistory.createMany({
    data: eligible.map(l => ({ leadId: l.id, from: l.status, to: "LOST" as const })),
  });

  await invalidate(cacheKeys.leads(clientId), cacheKeys.metrics(clientId));
  revalidatePath("/leads");
  return { updated: eligible.length };
}

export async function bulkMarkAsRegisteredAction(leadIds: string[]): Promise<{ updated: number }> {
  const session  = await getSession();
  const clientId = session.clientId!;
  if (leadIds.length === 0) return { updated: 0 };

  const eligible = await prisma.lead.findMany({
    where:  { id: { in: leadIds }, clientId, status: "NEW" },
    select: { id: true, status: true },
  });
  if (eligible.length === 0) return { updated: 0 };

  await prisma.lead.updateMany({
    where: { id: { in: eligible.map(l => l.id) } },
    data:  { status: "REGISTERED" },
  });
  await prisma.leadStatusHistory.createMany({
    data: eligible.map(l => ({ leadId: l.id, from: l.status, to: "REGISTERED" as const })),
  });

  await invalidate(cacheKeys.leads(clientId), cacheKeys.metrics(clientId));
  revalidatePath("/leads");
  return { updated: eligible.length };
}

export async function bulkAssignConsultantAction(
  leadIds: string[],
  consultant: string | null,
): Promise<{ updated: number }> {
  const session  = await getSession();
  const clientId = session.clientId!;
  if (leadIds.length === 0) return { updated: 0 };

  const result = await prisma.lead.updateMany({
    where: { id: { in: leadIds }, clientId },
    data:  { consultant: consultant || null },
  });

  await invalidate(cacheKeys.leads(clientId));
  revalidatePath("/leads");
  return { updated: result.count };
}
