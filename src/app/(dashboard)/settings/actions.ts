"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";

export async function saveSettingsAction(formData: FormData) {
  const session  = await getSession();
  const clientId = session.clientId!;

  const metaPixelId       = (formData.get("metaPixelId")       as string).trim() || null;
  const metaAccessToken   = (formData.get("metaAccessToken")   as string).trim() || null;
  const metaTestEventCode = (formData.get("metaTestEventCode") as string).trim() || null;
  const trackingEnabled   = formData.get("trackingEnabled") === "on";

  await prisma.clientSettings.upsert({
    where:  { clientId },
    create: { clientId, metaPixelId, metaAccessToken, metaTestEventCode, trackingEnabled },
    update: { metaPixelId, metaAccessToken, metaTestEventCode, trackingEnabled },
  });

  revalidatePath("/settings");
}

export async function saveGoogleSettingsAction(formData: FormData) {
  const session  = await getSession();
  const clientId = session.clientId;

  const googleAdsEnabled                  = formData.get("googleAdsEnabled") === "on";
  const googleAdsCustomerId               = (formData.get("googleAdsCustomerId")               as string).trim() || null;
  const googleAdsConversionActionLead     = (formData.get("googleAdsConversionActionLead")     as string).trim() || null;
  const googleAdsConversionActionPurchase = (formData.get("googleAdsConversionActionPurchase") as string).trim() || null;
  const googleRefreshToken                = (formData.get("googleRefreshToken")                as string).trim() || null;

  await prisma.clientSettings.upsert({
    where:  { clientId },
    create: { clientId, googleAdsEnabled, googleAdsCustomerId, googleAdsConversionActionLead, googleAdsConversionActionPurchase, googleRefreshToken },
    update: { googleAdsEnabled, googleAdsCustomerId, googleAdsConversionActionLead, googleAdsConversionActionPurchase, googleRefreshToken },
  });

  revalidatePath("/settings");
}

export async function rotateLeadCaptureKeyAction() {
  const session  = await getSession();
  const clientId = session.clientId!;
  const { createId } = await import("@paralleldrive/cuid2");

  await prisma.client.update({
    where: { id: clientId },
    data:  { leadCaptureKey: createId() },
  });

  revalidatePath("/settings");
}

export async function addAuthorizedDomainAction(formData: FormData) {
  const session  = await getSession();
  const clientId = session.clientId!;

  const raw   = (formData.get("url") as string)?.trim();
  const label = (formData.get("label") as string)?.trim() || null;

  if (!raw) throw new Error("URL obrigatória");

  let url: string;
  try {
    const parsed = new URL(raw.startsWith("http") ? raw : `https://${raw}`);
    url = parsed.origin; // normaliza para protocolo+host sem barra final
  } catch {
    throw new Error("URL inválida");
  }

  try {
    await prisma.authorizedDomain.create({ data: { clientId, url, label } });
  } catch (err: unknown) {
    if ((err as { code?: string }).code === "P2002") {
      throw new Error("Este domínio já está na lista.");
    }
    throw err;
  }

  revalidatePath("/settings");
}

export async function deleteAuthorizedDomainAction(id: string) {
  const session  = await getSession();
  const clientId = session.clientId!;

  await prisma.authorizedDomain.deleteMany({ where: { id, clientId } });

  revalidatePath("/settings");
}

export async function saveLtvEmailConfigAction(formData: FormData) {
  const session  = await getSession();
  const clientId = session.clientId!;

  const enabled    = formData.get("enabled") === "on";
  const teamEmails = (formData.get("teamEmails") as string)
    .split(/[\n,]+/)
    .map(e => e.trim())
    .filter(e => e.includes("@"));

  const rawThresholds = formData.get("thresholds") as string;
  const thresholds = JSON.parse(rawThresholds);

  await prisma.ltvEmailConfig.upsert({
    where:  { clientId },
    create: { clientId, enabled, teamEmails, thresholds },
    update: { enabled, teamEmails, thresholds },
  });

  revalidatePath("/settings");
}

export async function saveEmailTemplateAction(formData: FormData) {
  const session  = await getSession();
  const clientId = session.clientId!;

  const id      = (formData.get("id") as string) || undefined;
  const name    = (formData.get("name") as string).trim();
  const subject = (formData.get("subject") as string).trim();
  const body    = (formData.get("body") as string).trim();

  if (id) {
    await prisma.emailTemplate.updateMany({
      where: { id, clientId },
      data:  { name, subject, body },
    });
  } else {
    await prisma.emailTemplate.create({
      data: { clientId, name, subject, body, type: "CUSTOMER" },
    });
  }

  revalidatePath("/settings");
}

export async function deleteEmailTemplateAction(id: string) {
  const session  = await getSession();
  const clientId = session.clientId!;

  await prisma.emailTemplate.deleteMany({ where: { id, clientId } });

  revalidatePath("/settings");
}

export async function disconnectGoogleAdsAction() {
  const session  = await getSession();
  const clientId = session.clientId!;

  await prisma.clientSettings.update({
    where:  { clientId },
    data:   { googleRefreshToken: null },
  });

  revalidatePath("/settings");
}

export async function saveWhatsappTemplateAction(formData: FormData) {
  const session  = await getSession();
  const clientId = session.clientId!;

  const whatsappTemplate = (formData.get("whatsappTemplate") as string)?.trim() || null;

  await prisma.clientSettings.upsert({
    where:  { clientId },
    create: { clientId, whatsappTemplate },
    update: { whatsappTemplate },
  });

  revalidatePath("/settings");
}
