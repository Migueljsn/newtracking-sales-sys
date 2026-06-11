"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { hashPassword } from "@/lib/auth/password";
import { createId } from "@paralleldrive/cuid2";
import { Resend } from "resend";

export async function saveSettingsAction(formData: FormData) {
  const session  = await getSession();
  const clientId = session.clientId!;

  const metaPixelId           = (formData.get("metaPixelId")       as string).trim() || null;
  const metaAccessToken       = (formData.get("metaAccessToken")   as string).trim() || null;
  const metaTestEventCode     = (formData.get("metaTestEventCode") as string).trim() || null;
  const trackingEnabled       = formData.get("trackingEnabled")       === "on";
  const metaLeadEnabled       = formData.get("metaLeadEnabled")       === "on";
  const metaPurchaseEnabled   = formData.get("metaPurchaseEnabled")   === "on";

  await prisma.clientSettings.upsert({
    where:  { clientId },
    create: { clientId, metaPixelId, metaAccessToken, metaTestEventCode, trackingEnabled, metaLeadEnabled, metaPurchaseEnabled },
    update: { metaPixelId, metaAccessToken, metaTestEventCode, trackingEnabled, metaLeadEnabled, metaPurchaseEnabled },
  });

  revalidatePath("/settings");
}

export async function saveGoogleSettingsAction(formData: FormData) {
  const session  = await getSession();
  const clientId = session.clientId;

  const googleAdsEnabled                  = formData.get("googleAdsEnabled")  === "on";
  const googleLeadEnabled                 = formData.get("googleLeadEnabled") === "on";
  const googleAdsCustomerId               = (formData.get("googleAdsCustomerId")               as string).trim() || null;
  const googleAdsConversionActionLead     = (formData.get("googleAdsConversionActionLead")     as string).trim() || null;
  const googleAdsConversionActionPurchase = (formData.get("googleAdsConversionActionPurchase") as string).trim() || null;
  const googleRefreshToken                = (formData.get("googleRefreshToken")                as string).trim() || null;

  await prisma.clientSettings.upsert({
    where:  { clientId },
    create: { clientId, googleAdsEnabled, googleLeadEnabled, googleAdsCustomerId, googleAdsConversionActionLead, googleAdsConversionActionPurchase, googleRefreshToken },
    update: { googleAdsEnabled, googleLeadEnabled, googleAdsCustomerId, googleAdsConversionActionLead, googleAdsConversionActionPurchase, googleRefreshToken },
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
  revalidatePath("/ltv");
}

export async function saveEmailTemplateAction(formData: FormData) {
  const session  = await getSession();
  const clientId = session.clientId!;

  const id           = (formData.get("id") as string) || undefined;
  const name         = (formData.get("name") as string).trim();
  const channel      = (formData.get("channel") as string) || "EMAIL";
  const subject      = (formData.get("subject") as string | null)?.trim() ?? "";
  const body         = (formData.get("body") as string).trim();
  const waType       = (formData.get("waType") as string | null) || null;
  const mediaUrl     = (formData.get("mediaUrl") as string | null)?.trim() || null;
  const mediaCaption = (formData.get("mediaCaption") as string | null)?.trim() || null;

  const data = { name, channel, subject, body, waType, mediaUrl, mediaCaption };

  if (id) {
    await prisma.emailTemplate.updateMany({
      where: { id, clientId },
      data,
    });
  } else {
    await prisma.emailTemplate.create({
      data: { clientId, type: "CUSTOMER", ...data },
    });
  }

  revalidatePath("/settings");
  revalidatePath("/ltv");
  revalidatePath("/journeys");
}

export async function deleteEmailTemplateAction(id: string) {
  const session  = await getSession();
  const clientId = session.clientId!;

  await prisma.emailTemplate.deleteMany({ where: { id, clientId } });

  revalidatePath("/settings");
  revalidatePath("/ltv");
  revalidatePath("/journeys");
}

export async function duplicateEmailTemplateAction(id: string) {
  const session  = await getSession();
  const clientId = session.clientId!;

  const original = await prisma.emailTemplate.findUnique({ where: { id } });
  if (!original || original.isDefault) throw new Error("Não é possível duplicar template padrão");

  await prisma.emailTemplate.create({
    data: {
      clientId,
      name:        `${original.name}-cópia`,
      channel:     original.channel,
      subject:     original.subject,
      body:        original.body,
      waType:      original.waType,
      mediaUrl:    original.mediaUrl,
      mediaCaption: original.mediaCaption,
      type:        original.type,
    },
  });

  revalidatePath("/settings");
  revalidatePath("/ltv");
  revalidatePath("/journeys");
}

export async function bulkDeleteEmailTemplatesAction(ids: string[]) {
  const session  = await getSession();
  const clientId = session.clientId!;

  await prisma.emailTemplate.deleteMany({
    where: { id: { in: ids }, clientId, isDefault: false },
  });

  revalidatePath("/settings");
  revalidatePath("/ltv");
  revalidatePath("/journeys");
}

export async function bulkDuplicateEmailTemplatesAction(ids: string[]) {
  const session  = await getSession();
  const clientId = session.clientId!;

  const originals = await prisma.emailTemplate.findMany({
    where: { id: { in: ids }, isDefault: false },
  });

  await prisma.emailTemplate.createMany({
    data: originals.map((t) => ({
      clientId,
      name:        `${t.name}-cópia`,
      channel:     t.channel,
      subject:     t.subject,
      body:        t.body,
      waType:      t.waType,
      mediaUrl:    t.mediaUrl,
      mediaCaption: t.mediaCaption,
      type:        t.type,
    })),
  });

  revalidatePath("/settings");
  revalidatePath("/ltv");
  revalidatePath("/journeys");
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

// ─── Consultant Users (Acessos) ───────────────────────────────────────────────

export async function createConsultantAction(formData: FormData) {
  const session  = await getSession();
  const clientId = session.clientId!;

  const name     = (formData.get("name")     as string).trim();
  const email    = (formData.get("email")    as string).trim().toLowerCase();
  const password = (formData.get("password") as string);

  if (!name || !email || !password) throw new Error("Todos os campos são obrigatórios");
  if (password.length < 6) throw new Error("Senha deve ter pelo menos 6 caracteres");

  try {
    await prisma.consultantUser.create({
      data: { clientId, name, email, passwordHash: hashPassword(password) },
    });
  } catch (err: unknown) {
    if ((err as { code?: string }).code === "P2002") throw new Error("Já existe um consultor com este e-mail.");
    throw err;
  }

  revalidatePath("/settings?tab=acessos");
}

export async function updateConsultantAction(id: string, formData: FormData) {
  const session  = await getSession();
  const clientId = session.clientId!;

  const name  = (formData.get("name")  as string).trim();
  const email = (formData.get("email") as string).trim().toLowerCase();

  if (!name || !email) throw new Error("Nome e e-mail são obrigatórios");

  try {
    await prisma.consultantUser.update({
      where: { id, clientId },
      data:  { name, email },
    });
  } catch (err: unknown) {
    if ((err as { code?: string }).code === "P2002") throw new Error("Já existe um consultor com este e-mail.");
    throw err;
  }

  revalidatePath("/settings?tab=acessos");
}

export async function toggleConsultantAction(id: string, active: boolean) {
  const session  = await getSession();
  const clientId = session.clientId!;

  await prisma.consultantUser.update({
    where: { id, clientId },
    data:  { active },
  });

  revalidatePath("/settings?tab=acessos");
}

export async function deleteConsultantAction(id: string) {
  const session  = await getSession();
  const clientId = session.clientId!;

  await prisma.consultantUser.delete({ where: { id, clientId } });

  revalidatePath("/settings?tab=acessos");
}

export async function resetConsultantPasswordAction(id: string, formData: FormData) {
  const session  = await getSession();
  const clientId = session.clientId!;

  const password = (formData.get("password") as string);
  if (!password || password.length < 6) throw new Error("Senha deve ter pelo menos 6 caracteres");


  await prisma.consultantUser.update({
    where: { id, clientId },
    data:  { passwordHash: hashPassword(password) },
  });

  revalidatePath("/settings?tab=acessos");
}

// ─── Botconversa ─────────────────────────────────────────────────────────────

export async function saveBotconversaConfigAction(formData: FormData) {
  const session  = await getSession();
  const clientId = session.clientId!;

  const apiKey   = (formData.get("botconversaApiKey")   as string).trim() || null;
  const flowId   = (formData.get("botconversaFlowId")   as string).trim() || null;
  const flowName = (formData.get("botconversaFlowName") as string).trim() || null;
  const enabled  = formData.get("botconversaEnabled") === "on";

  await prisma.clientSettings.upsert({
    where:  { clientId },
    create: { clientId, botconversaApiKey: apiKey, botconversaFlowId: flowId ? Number(flowId) : null, botconversaFlowName: flowName, botconversaEnabled: enabled },
    update: { botconversaApiKey: apiKey, botconversaFlowId: flowId ? Number(flowId) : null, botconversaFlowName: flowName, botconversaEnabled: enabled },
  });

  revalidatePath("/settings?tab=whatsapp");
}

// ─── Webhook — leads ─────────────────────────────────────────────────────────

export async function generateWebhookTokenAction() {
  const session  = await getSession();
  const clientId = session.clientId!;

  await prisma.webhookToken.upsert({
    where:  { clientId },
    create: { clientId },
    update: {},
  });

  revalidatePath("/settings?tab=webhooks");
}

export async function regenerateWebhookTokenAction() {
  const session  = await getSession();
  const clientId = session.clientId!;

  await prisma.webhookToken.upsert({
    where:  { clientId },
    create: { clientId, token: createId() },
    update: { token: createId() },
  });

  revalidatePath("/settings?tab=webhooks");
}

export async function toggleWebhookTokenAction(enabled: boolean) {
  const session  = await getSession();
  const clientId = session.clientId!;

  await prisma.webhookToken.update({
    where: { clientId },
    data:  { enabled },
  });

  revalidatePath("/settings?tab=webhooks");
}

// ─── Webhook — flows ─────────────────────────────────────────────────────────

export async function generateFlowTokenAction() {
  const session  = await getSession();
  const clientId = session.clientId!;

  await prisma.webhookToken.upsert({
    where:  { clientId },
    create: { clientId, flowToken: createId() },
    update: { flowToken: createId() },
  });

  revalidatePath("/settings?tab=webhooks");
}

export async function regenerateFlowTokenAction() {
  const session  = await getSession();
  const clientId = session.clientId!;

  await prisma.webhookToken.update({
    where: { clientId },
    data:  { flowToken: createId() },
  });

  revalidatePath("/settings?tab=webhooks");
}

// ─── Test email ───────────────────────────────────────────────────────────────

const SAMPLE_VARS: Record<string, string> = {
  nome:                "João",
  nome_completo:       "João Silva",
  telefone:            "11999999999",
  email:               "joao@email.com",
  consultor:           "Maria Vendas",
  dias:                "15",
  data_ultima_compra:  new Date().toLocaleDateString("pt-BR"),
  valor_ultima_compra: "R$ 350,00",
  total_compras:       "3",
  valor_total_ltv:     "R$ 1.050,00",
  unsub_url:           "#",
};

function renderSample(template: string, clientName: string): string {
  const vars = { ...SAMPLE_VARS, empresa: clientName };
  return template.replace(/\{(\w+)\}/g, (match, key) => (vars as Record<string, string>)[key] ?? match);
}

export async function sendTestEmailAction(subject: string, body: string, testEmail: string) {
  const session    = await getSession();
  const clientName = session.client!.name;

  if (!testEmail || !testEmail.includes("@")) throw new Error("E-mail inválido");

  const resend         = new Resend(process.env.RESEND_API_KEY);
  const renderedSubject = renderSample(subject, clientName);
  const renderedBody    = renderSample(body,    clientName);

  const { error } = await resend.emails.send({
    from:    `${clientName} via Portal CRM <noreply@fonilcompany.com.br>`,
    to:      [testEmail],
    subject: `[TESTE] ${renderedSubject}`,
    html:    renderedBody,
  });

  if (error) throw new Error(error.message);
}
