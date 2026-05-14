import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

export const dynamic = "force-dynamic";

function hoursAgo(n: number) {
  return new Date(Date.now() - n * 60 * 60 * 1000);
}
function daysAgo(n: number) {
  return new Date(Date.now() - n * 24 * 60 * 60 * 1000);
}
function stateSuffix(state: string | null | undefined) {
  return state ? ` (${state})` : "";
}

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const results = { speedToLead: 0, activation: 0, ltv: 0 };

  // ── Speed-to-lead: NEW leads sem ação há 2h ou 8h ──────────
  for (const { hours, label } of [{ hours: 2, label: "2h" }, { hours: 8, label: "8h" }]) {
    const candidates = await prisma.lead.findMany({
      where: {
        status:     "NEW",
        capturedAt: { lte: hoursAgo(hours), gte: hoursAgo(24) },
      },
      include: { customer: { select: { name: true, state: true } } },
    });

    if (candidates.length === 0) continue;

    const dedupeKeys = candidates.map((l) => `SPEED_TO_LEAD:${l.id}:${label}`);
    const existing   = await prisma.notification.findMany({
      where:  { dedupeKey: { in: dedupeKeys } },
      select: { dedupeKey: true },
    });
    const sent = new Set(existing.map((n) => n.dedupeKey));

    const toCreate = candidates
      .filter((l) => !sent.has(`SPEED_TO_LEAD:${l.id}:${label}`))
      .map((l) => ({
        clientId:  l.clientId,
        type:      "SPEED_TO_LEAD" as const,
        title:     `Lead sem contato: ${l.customer.name}${stateSuffix(l.customer.state)}`,
        body:      `Capturada há mais de ${label} sem nenhuma ação registrada.`,
        metadata:  { leadId: l.id, milestone: label },
        dedupeKey: `SPEED_TO_LEAD:${l.id}:${label}`,
      }));

    if (toCreate.length > 0) {
      await prisma.notification.createMany({ data: toCreate, skipDuplicates: true });
      results.speedToLead += toCreate.length;
    }
  }

  // ── Activation: REGISTERED há 3d ou 7d sem venda ───────────
  for (const { days, label, text } of [
    { days: 3, label: "3d", text: "3 dias" },
    { days: 7, label: "7d", text: "7 dias" },
  ]) {
    const candidates = await prisma.lead.findMany({
      where: {
        status:        "REGISTERED",
        statusHistory: { some: { to: "REGISTERED", createdAt: { lte: daysAgo(days) } } },
      },
      include: { customer: { select: { name: true, state: true } } },
    });

    if (candidates.length === 0) continue;

    const dedupeKeys = candidates.map((l) => `ACTIVATION_ALERT:${l.id}:${label}`);
    const existing   = await prisma.notification.findMany({
      where:  { dedupeKey: { in: dedupeKeys } },
      select: { dedupeKey: true },
    });
    const sent = new Set(existing.map((n) => n.dedupeKey));

    const toCreate = candidates
      .filter((l) => !sent.has(`ACTIVATION_ALERT:${l.id}:${label}`))
      .map((l) => ({
        clientId:  l.clientId,
        type:      "ACTIVATION_ALERT" as const,
        title:     `Cadastro parado: ${l.customer.name}${stateSuffix(l.customer.state)}`,
        body:      `Cadastrada há mais de ${text} sem venda registrada.`,
        metadata:  { leadId: l.id, milestone: label },
        dedupeKey: `ACTIVATION_ALERT:${l.id}:${label}`,
      }));

    if (toCreate.length > 0) {
      await prisma.notification.createMany({ data: toCreate, skipDuplicates: true });
      results.activation += toCreate.length;
    }
  }

  // ── LTV: SOLD há 30d / 60d / 90d sem recompra ──────────────
  for (const { days, label, text } of [
    { days: 30, label: "30d", text: "30 dias" },
    { days: 60, label: "60d", text: "60 dias" },
    { days: 90, label: "90d", text: "90 dias" },
  ]) {
    const candidates = await prisma.lead.findMany({
      where: {
        status: "SOLD",
        sale:   { soldAt: { lte: daysAgo(days), gte: daysAgo(120) } },
      },
      include: {
        customer: {
          select: {
            name: true, state: true,
            // Última venda do cliente (para checar se houve recompra depois desta)
            sales: { orderBy: { soldAt: "desc" }, take: 1, select: { leadId: true } },
          },
        },
        sale: { select: { soldAt: true } },
      },
    });

    // Só alerta se esta lead for a venda mais recente do cliente
    // Se o cliente comprou de novo (recompra), a lead antiga é ignorada
    const active = candidates.filter(l => l.customer.sales[0]?.leadId === l.id);

    if (active.length === 0) continue;

    const dedupeKeys = active.map((l) => `LTV_REACTIVATION:${l.id}:${label}`);
    const existing   = await prisma.notification.findMany({
      where:  { dedupeKey: { in: dedupeKeys } },
      select: { dedupeKey: true },
    });
    const sent = new Set(existing.map((n) => n.dedupeKey));

    const toCreate = active
      .filter((l) => !sent.has(`LTV_REACTIVATION:${l.id}:${label}`))
      .map((l) => ({
        clientId:  l.clientId,
        type:      "LTV_REACTIVATION" as const,
        title:     `Reativar cliente: ${l.customer.name}${stateSuffix(l.customer.state)}`,
        body:      `Comprou há ${text} sem retorno. Hora de novo contato.`,
        metadata:  { leadId: l.id, milestone: label },
        dedupeKey: `LTV_REACTIVATION:${l.id}:${label}`,
      }));

    if (toCreate.length > 0) {
      await prisma.notification.createMany({ data: toCreate, skipDuplicates: true });
      results.ltv += toCreate.length;
    }
  }

  return NextResponse.json({ ok: true, created: results });
}
