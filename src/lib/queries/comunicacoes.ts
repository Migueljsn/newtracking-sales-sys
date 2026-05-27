import { prisma } from "@/lib/db/prisma";

export interface EmailChannelStats {
  journeyEmailSent:       number;
  journeyEmailSkipped:    number;
  journeyEmailOptOut:     number;
  ltvSent:                number;
  ltvOpened:              number;
  ltvClicked:             number;
  ltvBounced:             number;
  totalSent:              number;
  openRate:               number;
  clickRate:              number;
}

export interface WhatsAppChannelStats {
  journeyWaSent:    number;
  journeyWaSkipped: number;
}

export interface DailyDispatch {
  date:     string;
  email:    number;
  whatsapp: number;
}

export interface JourneyDispatchRow {
  journeyId:   string;
  journeyName: string;
  emailSent:   number;
  emailOptOut: number;
  waSent:      number;
}

export interface TemplateBreakdown {
  templateId:   string;
  templateName: string;
  sent:         number;
  opened:       number;
  clicked:      number;
  openRate:     number;
  clickRate:    number;
}

export interface RecentDispatch {
  id:            string;
  source:        "ltv" | "journey";
  channel:       "email" | "whatsapp";
  customerName:  string;
  customerEmail: string | null;
  context:       string; // nome do template ou da jornada
  sentAt:        string; // ISO string
  status:        string;
}

export async function fetchComunicacoesStats(clientId: string, days = 30, fromDate?: Date, toDate?: Date): Promise<{
  email:             EmailChannelStats;
  whatsapp:          WhatsAppChannelStats;
  daily:             DailyDispatch[];
  byJourney:         JourneyDispatchRow[];
  templateBreakdown: TemplateBreakdown[];
  recentDispatches:  RecentDispatch[];
}> {
  const from = fromDate ?? new Date(Date.now() - days * 86_400_000);
  const to   = toDate   ?? new Date();

  const [emailNodeLogs, waNodeLogs, ltvLogs, journeys] = await Promise.all([
    prisma.journeyNodeLog.findMany({
      where:  { clientId, nodeType: "email", executedAt: { gte: from, lte: to } },
      select: { id: true, result: true, executedAt: true, journeyId: true, enrollmentId: true },
    }),
    prisma.journeyNodeLog.findMany({
      where:  { clientId, nodeType: "whatsapp", executedAt: { gte: from, lte: to } },
      select: { id: true, result: true, executedAt: true, journeyId: true, enrollmentId: true },
    }),
    prisma.ltvEmailLog.findMany({
      where:   { clientId, type: "CUSTOMER", sentAt: { gte: from, lte: to } },
      select:  { id: true, openedAt: true, clickedAt: true, bouncedAt: true, sentAt: true, templateId: true, customerId: true },
      orderBy: { sentAt: "desc" },
    }),
    prisma.journey.findMany({
      where:  { clientId },
      select: { id: true, name: true },
    }),
  ]);

  const journeyNameMap = new Map(journeys.map(j => [j.id, j.name]));

  // ── E-mail stats ──────────────────────────────────────────────────────────
  const journeyEmailSent    = emailNodeLogs.filter(l => l.result === "email_sent").length;
  const journeyEmailSkipped = emailNodeLogs.filter(l => l.result === "email_skipped").length;
  const journeyEmailOptOut  = emailNodeLogs.filter(l => l.result === "email_skipped_optout").length;

  const ltvSent    = ltvLogs.length;
  const ltvOpened  = ltvLogs.filter(l => l.openedAt  != null).length;
  const ltvClicked = ltvLogs.filter(l => l.clickedAt != null).length;
  const ltvBounced = ltvLogs.filter(l => l.bouncedAt != null).length;

  const totalSent = journeyEmailSent + ltvSent;
  const openRate  = ltvSent > 0 ? Math.round((ltvOpened  / ltvSent) * 100) : 0;
  const clickRate = ltvSent > 0 ? Math.round((ltvClicked / ltvSent) * 100) : 0;

  // ── WhatsApp stats ────────────────────────────────────────────────────────
  const journeyWaSent    = waNodeLogs.filter(l => l.result === "whatsapp_sent").length;
  const journeyWaSkipped = waNodeLogs.filter(l => l.result === "whatsapp_skipped").length;

  // ── Daily dispatches ─────────────────────────────────────────────────────
  const dailyMap = new Map<string, { email: number; whatsapp: number }>();
  for (let d = new Date(from); d <= to; d.setDate(d.getDate() + 1)) {
    dailyMap.set(d.toISOString().slice(0, 10), { email: 0, whatsapp: 0 });
  }
  for (const log of emailNodeLogs) {
    if (log.result !== "email_sent") continue;
    const day = new Date(log.executedAt).toISOString().slice(0, 10);
    if (dailyMap.has(day)) dailyMap.get(day)!.email++;
  }
  for (const log of ltvLogs) {
    const day = new Date(log.sentAt).toISOString().slice(0, 10);
    if (dailyMap.has(day)) dailyMap.get(day)!.email++;
  }
  for (const log of waNodeLogs) {
    if (log.result !== "whatsapp_sent") continue;
    const day = new Date(log.executedAt).toISOString().slice(0, 10);
    if (dailyMap.has(day)) dailyMap.get(day)!.whatsapp++;
  }
  const daily: DailyDispatch[] = [...dailyMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, v]) => ({ date, ...v }));

  // ── Por jornada ───────────────────────────────────────────────────────────
  const journeyMap = new Map<string, JourneyDispatchRow>();
  for (const log of emailNodeLogs) {
    if (!journeyMap.has(log.journeyId)) {
      journeyMap.set(log.journeyId, {
        journeyId:   log.journeyId,
        journeyName: journeyNameMap.get(log.journeyId) ?? log.journeyId,
        emailSent: 0, emailOptOut: 0, waSent: 0,
      });
    }
    const row = journeyMap.get(log.journeyId)!;
    if (log.result === "email_sent")           row.emailSent++;
    if (log.result === "email_skipped_optout") row.emailOptOut++;
  }
  for (const log of waNodeLogs) {
    if (!journeyMap.has(log.journeyId)) {
      journeyMap.set(log.journeyId, {
        journeyId:   log.journeyId,
        journeyName: journeyNameMap.get(log.journeyId) ?? log.journeyId,
        emailSent: 0, emailOptOut: 0, waSent: 0,
      });
    }
    if (log.result === "whatsapp_sent") journeyMap.get(log.journeyId)!.waSent++;
  }
  const byJourney = [...journeyMap.values()]
    .sort((a, b) => (b.emailSent + b.waSent) - (a.emailSent + a.waSent));

  // ── Breakdown por template ────────────────────────────────────────────────
  const templateIds = [...new Set(ltvLogs.map(l => l.templateId).filter(Boolean) as string[])];
  const templates   = templateIds.length > 0
    ? await prisma.emailTemplate.findMany({ where: { id: { in: templateIds } }, select: { id: true, name: true } })
    : [];
  const templateNameMap = new Map(templates.map(t => [t.id, t.name]));

  const tplMap = new Map<string, { sent: number; opened: number; clicked: number }>();
  for (const log of ltvLogs) {
    const key = log.templateId ?? "__sem_template__";
    if (!tplMap.has(key)) tplMap.set(key, { sent: 0, opened: 0, clicked: 0 });
    const r = tplMap.get(key)!;
    r.sent++;
    if (log.openedAt)  r.opened++;
    if (log.clickedAt) r.clicked++;
  }
  const templateBreakdown: TemplateBreakdown[] = [...tplMap.entries()].map(([id, r]) => ({
    templateId:   id,
    templateName: templateNameMap.get(id) ?? "Sem template",
    sent:         r.sent,
    opened:       r.opened,
    clicked:      r.clicked,
    openRate:     r.sent > 0 ? Math.round((r.opened  / r.sent) * 100) : 0,
    clickRate:    r.sent > 0 ? Math.round((r.clicked / r.sent) * 100) : 0,
  })).sort((a, b) => b.sent - a.sent);

  // ── Histórico recente ─────────────────────────────────────────────────────
  // LTV: buscar com info do cliente
  const ltvWithCustomer = await prisma.ltvEmailLog.findMany({
    where:   { clientId, type: "CUSTOMER", sentAt: { gte: from, lte: to } },
    select:  {
      id: true, sentAt: true, openedAt: true, clickedAt: true, bouncedAt: true,
      templateId: true,
      customer:  { select: { name: true, email: true } },
    },
    orderBy: { sentAt: "desc" },
    take:    100,
  });

  // Journey email + WA: buscar enrollment → lead → customer
  const journeyNodeLogsWithLead = await prisma.journeyNodeLog.findMany({
    where:   { clientId, nodeType: { in: ["email", "whatsapp"] }, executedAt: { gte: from, lte: to } },
    select:  {
      id: true, nodeType: true, result: true, executedAt: true, journeyId: true,
      enrollment: {
        select: {
          lead: {
            select: {
              customer: { select: { name: true, email: true } },
            },
          },
        },
      },
    },
    orderBy: { executedAt: "desc" },
    take:    100,
  });

  const ltvDispatches: RecentDispatch[] = ltvWithCustomer.map(l => {
    let status = "sent";
    if (l.bouncedAt) status = "bounced";
    else if (l.clickedAt) status = "clicked";
    else if (l.openedAt)  status = "opened";
    return {
      id:            l.id,
      source:        "ltv",
      channel:       "email",
      customerName:  l.customer?.name ?? "—",
      customerEmail: l.customer?.email ?? null,
      context:       templateNameMap.get(l.templateId ?? "") ?? "LTV",
      sentAt:        l.sentAt.toISOString(),
      status,
    };
  });

  const journeyDispatches: RecentDispatch[] = journeyNodeLogsWithLead.map(l => ({
    id:            l.id,
    source:        "journey",
    channel:       l.nodeType as "email" | "whatsapp",
    customerName:  l.enrollment?.lead?.customer?.name ?? "—",
    customerEmail: l.enrollment?.lead?.customer?.email ?? null,
    context:       journeyNameMap.get(l.journeyId) ?? "Jornada",
    sentAt:        l.executedAt.toISOString(),
    status:        l.result ?? "unknown",
  }));

  const recentDispatches: RecentDispatch[] = [...ltvDispatches, ...journeyDispatches]
    .sort((a, b) => new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime())
    .slice(0, 100);

  return {
    email:    { journeyEmailSent, journeyEmailSkipped, journeyEmailOptOut, ltvSent, ltvOpened, ltvClicked, ltvBounced, totalSent, openRate, clickRate },
    whatsapp: { journeyWaSent, journeyWaSkipped },
    daily,
    byJourney,
    templateBreakdown,
    recentDispatches,
  };
}
