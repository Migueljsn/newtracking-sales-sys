import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { findOrCreateCustomer } from "@/lib/domain/customer/find-or-create";
import { createLead } from "@/lib/domain/lead/create";
import { normalizePhone } from "@/lib/utils/normalize";
import { inngest } from "@/lib/inngest/client";
import { leadChangedEvent } from "@/lib/inngest/events";
import { triggerFlowForLead } from "@/lib/botconversa/client";

// Aceita múltiplos nomes de campo comuns em integrações BR
function pick(body: Record<string, unknown>, ...keys: string[]): string {
  for (const key of keys) {
    const v = body[key];
    if (v && typeof v === "string" && v.trim()) return v.trim();
  }
  return "";
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  // ── Valida token ─────────────────────────────────────────────────────────────
  const webhookToken = await prisma.webhookToken.findUnique({
    where: { token },
    include: { client: true },
  });

  if (!webhookToken || !webhookToken.enabled) {
    return NextResponse.json({ error: "Token inválido ou desativado" }, { status: 401 });
  }

  const clientId = webhookToken.clientId;
  let body: Record<string, unknown>;

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  // ── Extrai campos — aceita nomes em PT e EN ──────────────────────────────────
  const rawPhone = pick(body, "phone", "telefone", "whatsapp", "fone", "celular");
  if (!rawPhone) {
    return NextResponse.json({ error: "Campo obrigatório ausente: phone/telefone" }, { status: 400 });
  }

  const phone    = normalizePhone(rawPhone);
  const name     = pick(body, "name", "nome", "nome_completo");
  const email    = pick(body, "email");
  const document = pick(body, "document", "documento", "cnpj", "cpf");
  const city     = pick(body, "city", "cidade");
  const state    = pick(body, "state", "estado", "uf");
  const zipCode  = pick(body, "zip_code", "zipCode", "cep");

  // Campos de pipeline e consultor (enriquecimento avançado)
  const pipelineStageName = pick(body, "pipeline_stage", "estagio", "etapa");
  const consultantName    = pick(body, "consultant", "consultor", "vendedor");

  let action     = "enriched";
  let customerId = "";
  let leadId     = "";
  let error      = "";

  try {
    // ── Tenta encontrar customer existente por telefone ─────────────────────────
    const existingCustomer = await prisma.customer.findFirst({
      where: { clientId, phone },
    });

    if (existingCustomer) {
      // Enriquece dados que estavam vazios
      await findOrCreateCustomer({
        clientId,
        name:     name     || existingCustomer.name,
        phone:    rawPhone,
        email:    email    || undefined,
        document: document || undefined,
        city:     city     || undefined,
        state:    state    || undefined,
        zipCode:  zipCode  || undefined,
      });
      customerId = existingCustomer.id;

      // Encontra lead ativa para notificar jornadas e aplicar atualizações
      const activeLead = await prisma.lead.findFirst({
        where:   { clientId, customerId: existingCustomer.id, status: { in: ["NEW", "REGISTERED"] } },
        orderBy: { createdAt: "desc" },
      });

      if (activeLead) {
        leadId = activeLead.id;
        const updates: Record<string, unknown> = {};

        if (consultantName) updates.consultant = consultantName;

        if (pipelineStageName) {
          const stage = await prisma.pipelineStage.findFirst({
            where: { clientId, name: { equals: pipelineStageName, mode: "insensitive" } },
          });
          if (stage) updates.pipelineStageId = stage.id;
        }

        if (Object.keys(updates).length > 0) {
          await prisma.lead.update({ where: { id: activeLead.id }, data: updates });
        }
      }

    } else {
      // Cria novo lead — name é obrigatório apenas na criação
      if (!name) {
        return NextResponse.json({ error: "Campo obrigatório ausente na criação: name/nome" }, { status: 400 });
      }

      const { lead, duplicate } = await createLead({
        clientId,
        name,
        phone:     rawPhone,
        email:     email    || undefined,
        document:  document || undefined,
        city:      city     || undefined,
        state:     state    || undefined,
        zipCode:   zipCode  || undefined,
        consultant: consultantName || undefined,
        source:    "FORM",
      });

      customerId = lead.customerId;
      leadId     = lead.id;
      action     = duplicate ? "duplicate" : "created";

      // Pipeline stage na criação
      if (pipelineStageName && !duplicate) {
        const stage = await prisma.pipelineStage.findFirst({
          where: { clientId, name: { equals: pipelineStageName, mode: "insensitive" } },
        });
        if (stage) {
          await prisma.lead.update({ where: { id: lead.id }, data: { pipelineStageId: stage.id } });
        }
      }
    }

  } catch (err) {
    error  = err instanceof Error ? err.message : "Erro interno";
    action = "error";
    console.error("[webhook/leads]", err);
  }

  // ── Dispara verificação de jornadas ─────────────────────────────────────────
  if (leadId && action !== "error") {
    inngest.send(leadChangedEvent.create({ leadId, clientId })).catch(() => {});
  }

  // ── Botconversa — dispara fluxo ao criar lead novo ───────────────────────────
  if (action === "created" && leadId) {
    const botSettings = await prisma.clientSettings.findUnique({
      where:  { clientId },
      select: { botconversaEnabled: true, botconversaApiKey: true, botconversaFlowId: true },
    });
    if (botSettings?.botconversaEnabled && botSettings.botconversaApiKey && botSettings.botconversaFlowId) {
      triggerFlowForLead({
        apiKey:  botSettings.botconversaApiKey,
        flowId:  botSettings.botconversaFlowId,
        phone,
        name:    name || phone,
      }).catch(err => console.error("[botconversa] trigger falhou:", err));
    }
  }

  // ── Grava log ────────────────────────────────────────────────────────────────
  await prisma.webhookInboundLog.create({
    data: {
      tokenId:    webhookToken.id,
      clientId,
      phone,
      action,
      customerId: customerId || null,
      leadId:     leadId     || null,
      payload:    body as object,
      error:      error      || null,
    },
  }).catch(() => { /* log failure never blocks the response */ });

  if (action === "error") {
    return NextResponse.json({ ok: false, error }, { status: 500 });
  }

  return NextResponse.json({ ok: true, action });
}
