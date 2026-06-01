import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { normalizePhone } from "@/lib/utils/normalize";
import { inngest } from "@/lib/inngest/client";
import { leadChangedEvent } from "@/lib/inngest/events";

// Maps field names from Botconversa and similar platforms to CRM fields
function pickVars(
  flat: Record<string, unknown>,
  vars: Record<string, unknown>,
  ...keys: string[]
): string {
  for (const key of keys) {
    const v = vars[key] ?? flat[key];
    if (v && typeof v === "string" && v.trim()) return v.trim();
  }
  return "";
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  // ── Validate token against flowToken column ──────────────────────────────────
  const webhookToken = await prisma.webhookToken.findUnique({
    where: { flowToken: token },
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

  // ── Extract variables — supports both flat fields and Botconversa's variables map ──
  const variables: Record<string, unknown> =
    body.variables && typeof body.variables === "object" && !Array.isArray(body.variables)
      ? (body.variables as Record<string, unknown>)
      : {};

  const rawPhone = pickVars(body, variables, "phone", "telefone", "whatsapp", "fone", "celular");
  if (!rawPhone) {
    return NextResponse.json({ error: "Campo obrigatório ausente: phone/telefone" }, { status: 400 });
  }

  const phone    = normalizePhone(rawPhone);
  const document = pickVars(body, variables, "document", "documento", "cnpj", "cpf");
  const city     = pickVars(body, variables, "city", "cidade");
  const state    = pickVars(body, variables, "state", "estado", "uf");
  const zipCode  = pickVars(body, variables, "zip_code", "zipCode", "cep");
  const name     = pickVars(body, variables, "name", "nome", "nome_completo");
  const notes    = pickVars(body, variables, "notes", "observacao", "obs", "interesse", "interest");

  const pipelineStageName = pickVars(body, variables, "pipeline_stage", "estagio", "etapa");
  const flowName          = pickVars(body, variables, "flow_name", "fluxo", "flow");
  const flowId            = pickVars(body, variables, "flow_id");

  let action     = "flow_completed";
  let customerId = "";
  let leadId     = "";
  let error      = "";

  try {
    // ── Find existing customer — flows never create new leads ────────────────────
    // Botconversa sends phone as +55XXXXXXXXXX (may lack mobile 9 digit).
    // normalizePhone strips +55, so we try both the raw normalized form
    // and the version with 9 inserted after the 2-digit DDD (Brazilian mobile).
    let customer = await prisma.customer.findFirst({
      where: { clientId, phone },
    });

    if (!customer && phone.length === 10) {
      const withNine = phone.slice(0, 2) + "9" + phone.slice(2);
      customer = await prisma.customer.findFirst({
        where: { clientId, phone: withNine },
      });
    }

    if (!customer) {
      return NextResponse.json(
        { error: "Lead não encontrado para este telefone. O webhook de fluxos só enriquece leads existentes." },
        { status: 404 }
      );
    }

    customerId = customer.id;

    // ── Enrich customer data ─────────────────────────────────────────────────────
    const customerUpdates: Record<string, string> = {};
    if (document && !customer.document) customerUpdates.document = document;
    if (city     && !customer.city)     customerUpdates.city     = city;
    if (state    && !customer.state)    customerUpdates.state    = state;
    if (zipCode  && !customer.zipCode)  customerUpdates.zipCode  = zipCode;
    if (name     && customer.name === "")  customerUpdates.name  = name;

    if (Object.keys(customerUpdates).length > 0) {
      await prisma.customer.update({ where: { id: customer.id }, data: customerUpdates });
    }

    // ── Find active lead ─────────────────────────────────────────────────────────
    const activeLead = await prisma.lead.findFirst({
      where:   { clientId, customerId: customer.id, status: { in: ["NEW", "REGISTERED"] } },
      orderBy: { createdAt: "desc" },
    });

    if (activeLead) {
      leadId = activeLead.id;
      const leadUpdates: Record<string, unknown> = {};

      // Append notes without overwriting existing ones
      if (notes) {
        const existing  = activeLead.notes ? `${activeLead.notes}\n` : "";
        const prefix    = flowName ? `[${flowName}] ` : "[Bot] ";
        leadUpdates.notes = `${existing}${prefix}${notes}`;
      }

      // Move pipeline stage if requested
      if (pipelineStageName) {
        const stage = await prisma.pipelineStage.findFirst({
          where: { clientId, name: { equals: pipelineStageName, mode: "insensitive" } },
        });
        if (stage) leadUpdates.pipelineStageId = stage.id;
      }

      if (Object.keys(leadUpdates).length > 0) {
        await prisma.lead.update({ where: { id: activeLead.id }, data: leadUpdates });
      }

      // ── Create timeline interaction ────────────────────────────────────────────
      const interactionLabel = flowName || flowId || "Fluxo externo";
      const interactionLines = [
        `Fluxo concluído: ${interactionLabel}`,
        ...Object.entries({ document, city, state, zipCode })
          .filter(([, v]) => v)
          .map(([k, v]) => `${k}: ${v}`),
        ...(notes ? [`Obs: ${notes}`] : []),
      ];

      await prisma.leadInteraction.create({
        data: {
          leadId:    activeLead.id,
          clientId,
          type:      "NOTE",
          content:   interactionLines.join("\n"),
          createdBy: "webhook/flows",
        },
      });

      // ── Admin notification ─────────────────────────────────────────────────────
      const customerName = name || customer.name;
      const notifTitle   = flowName
        ? `Lead qualificado: ${customerName}`
        : `Fluxo externo concluído: ${customerName}`;
      const notifBody    = [
        flowName ? `Fluxo: ${flowName}` : null,
        document ? `Doc: ${document}` : null,
        city     ? `Cidade: ${city}` : null,
      ].filter(Boolean).join(" · ") || "Dados atualizados via bot";

      await prisma.notification.create({
        data: {
          clientId,
          type:      "FLOW_COMPLETED",
          title:     notifTitle,
          body:      notifBody,
          metadata:  { leadId: activeLead.id, customerId: customer.id, flowName, flowId },
          dedupeKey: `flow:${activeLead.id}:${flowId || flowName || Date.now()}`,
        },
      }).catch(() => { /* dedupe conflict is fine */ });
    }

  } catch (err) {
    error  = err instanceof Error ? err.message : "Erro interno";
    action = "error";
    console.error("[webhook/flows]", err);
  }

  // ── Fire journey re-evaluation ────────────────────────────────────────────────
  if (leadId && action !== "error") {
    inngest.send(leadChangedEvent.create({ leadId, clientId })).catch(() => {});
  }

  // ── Audit log ─────────────────────────────────────────────────────────────────
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
  }).catch(() => {});

  if (action === "error") {
    return NextResponse.json({ ok: false, error }, { status: 500 });
  }

  return NextResponse.json({ ok: true, action, leadId: leadId || null });
}
