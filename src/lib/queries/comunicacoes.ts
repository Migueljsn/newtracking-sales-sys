import { prisma } from "@/lib/db/prisma";

export interface EmailChannelStats {
  // Jornadas
  journeyEmailSent:       number;
  journeyEmailSkipped:    number;
  journeyEmailOptOut:     number;
  // LTV
  ltvSent:                number;
  ltvOpened:              number;
  ltvClicked:             number;
  ltvBounced:             number;
  // Combinado
  totalSent:              number;
  openRate:               number; // %
  clickRate:              number; // %
}

export interface WhatsAppChannelStats {
  journeyWaSent:    number;
  journeyWaSkipped: number;
}

export interface DailyDispatch {
  date:       string; // YYYY-MM-DD
  email:      number;
  whatsapp:   number;
}

export interface JourneyDispatchRow {
  journeyId:   string;
  journeyName: string;
  emailSent:   number;
  emailOptOut: number;
  waSent:      number;
}

export async function fetchComunicacoesStats(clientId: string): Promise<{
  email:     EmailChannelStats;
  whatsapp:  WhatsAppChannelStats;
  daily:     DailyDispatch[];
  byJourney: JourneyDispatchRow[];
}> {
  const [emailNodeLogs, waNodeLogs, ltvLogs, journeys] = await Promise.all([
    // Todos os nós de e-mail da jornada
    prisma.journeyNodeLog.findMany({
      where:  { clientId, nodeType: "email" },
      select: { result: true, executedAt: true, journeyId: true },
    }),
    // Todos os nós de WhatsApp da jornada
    prisma.journeyNodeLog.findMany({
      where:  { clientId, nodeType: "whatsapp" },
      select: { result: true, executedAt: true, journeyId: true },
    }),
    // Logs de e-mail LTV (apenas clientes individuais, não digest da equipe)
    prisma.ltvEmailLog.findMany({
      where:  { clientId, type: "CUSTOMER" },
      select: { openedAt: true, clickedAt: true, bouncedAt: true, sentAt: true },
    }),
    // Jornadas para lookup de nome
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

  const totalSent  = journeyEmailSent + ltvSent;
  const openRate   = ltvSent  > 0 ? Math.round((ltvOpened  / ltvSent) * 100) : 0;
  const clickRate  = ltvSent  > 0 ? Math.round((ltvClicked / ltvSent) * 100) : 0;

  // ── WhatsApp stats ────────────────────────────────────────────────────────
  const journeyWaSent    = waNodeLogs.filter(l => l.result === "whatsapp_sent").length;
  const journeyWaSkipped = waNodeLogs.filter(l => l.result === "whatsapp_skipped").length;

  // ── Daily dispatches (últimos 30 dias) ───────────────────────────────────
  const dailyMap = new Map<string, { email: number; whatsapp: number }>();

  const today    = new Date();
  const cutoff   = new Date(today);
  cutoff.setDate(cutoff.getDate() - 29);

  for (let d = new Date(cutoff); d <= today; d.setDate(d.getDate() + 1)) {
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
        emailSent:   0,
        emailOptOut: 0,
        waSent:      0,
      });
    }
    const row = journeyMap.get(log.journeyId)!;
    if (log.result === "email_sent")             row.emailSent++;
    if (log.result === "email_skipped_optout")   row.emailOptOut++;
  }
  for (const log of waNodeLogs) {
    if (!journeyMap.has(log.journeyId)) {
      journeyMap.set(log.journeyId, {
        journeyId:   log.journeyId,
        journeyName: journeyNameMap.get(log.journeyId) ?? log.journeyId,
        emailSent:   0,
        emailOptOut: 0,
        waSent:      0,
      });
    }
    if (log.result === "whatsapp_sent") journeyMap.get(log.journeyId)!.waSent++;
  }

  const byJourney = [...journeyMap.values()]
    .sort((a, b) => (b.emailSent + b.waSent) - (a.emailSent + a.waSent));

  return {
    email:     { journeyEmailSent, journeyEmailSkipped, journeyEmailOptOut, ltvSent, ltvOpened, ltvClicked, ltvBounced, totalSent, openRate, clickRate },
    whatsapp:  { journeyWaSent, journeyWaSkipped },
    daily,
    byJourney,
  };
}
