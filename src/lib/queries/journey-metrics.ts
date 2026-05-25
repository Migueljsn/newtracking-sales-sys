import { prisma } from "@/lib/db/prisma";

export interface NodeMetric {
  nodeId:   string;
  nodeType: string;
  count:    number;
  results:  Record<string, number>;
}

export interface ConvertedLead {
  leadId:       string;
  customerName: string;
  saleValue:    number;
  soldAt:       Date;
  enrolledAt:   Date;
}

export interface JourneyMetrics {
  journeyId:       string;
  enrolled:        number;
  completed:       number;
  active:          number;
  failed:          number;
  exited:          number;
  completionRate:  number;
  avgDaysToComplete: number | null;
  nodeMetrics:     NodeMetric[];
  converted:       ConvertedLead[];
  attributedRevenue: number;
}

export async function fetchJourneyMetrics(journeyId: string, clientId: string): Promise<JourneyMetrics> {
  const [enrollments, nodeLogs] = await Promise.all([
    prisma.journeyEnrollment.findMany({
      where:   { journeyId, lead: { clientId } },
      select:  {
        id:          true,
        status:      true,
        startedAt:   true,
        completedAt: true,
        leadId:      true,
        lead: {
          select: {
            customer: { select: { name: true } },
            sales:    { select: { value: true, soldAt: true }, orderBy: { soldAt: "asc" } },
          },
        },
      },
    }),
    prisma.journeyNodeLog.findMany({
      where:   { journeyId, clientId },
      select:  { nodeId: true, nodeType: true, result: true },
    }),
  ]);

  const enrolled   = enrollments.length;
  const completed  = enrollments.filter(e => e.status === "COMPLETED").length;
  const active     = enrollments.filter(e => e.status === "ACTIVE").length;
  const failed     = enrollments.filter(e => e.status === "FAILED").length;
  const exited     = enrollments.filter(e => e.status === "EXITED").length;

  const completionTimes = enrollments
    .filter(e => e.status === "COMPLETED" && e.completedAt)
    .map(e => (e.completedAt!.getTime() - e.startedAt.getTime()) / 86_400_000);

  const avgDaysToComplete = completionTimes.length > 0
    ? Math.round(completionTimes.reduce((a, v) => a + v, 0) / completionTimes.length)
    : null;

  // ── Node funnel ─────────────────────────────────────────────────────────────
  const nodeMap = new Map<string, { nodeType: string; count: number; results: Record<string, number> }>();
  for (const log of nodeLogs) {
    if (!nodeMap.has(log.nodeId)) {
      nodeMap.set(log.nodeId, { nodeType: log.nodeType, count: 0, results: {} });
    }
    const entry = nodeMap.get(log.nodeId)!;
    entry.count++;
    if (log.result) entry.results[log.result] = (entry.results[log.result] ?? 0) + 1;
  }
  const nodeMetrics: NodeMetric[] = [...nodeMap.entries()].map(([nodeId, v]) => ({
    nodeId,
    nodeType: v.nodeType,
    count:    v.count,
    results:  v.results,
  }));

  // ── Atribuição de receita ───────────────────────────────────────────────────
  // Lead inscrita na jornada + realizou compra após a inscrição
  const converted: ConvertedLead[] = [];
  let attributedRevenue = 0;

  for (const enrollment of enrollments) {
    const salesAfterEnrollment = enrollment.lead.sales.filter(
      s => new Date(s.soldAt) >= enrollment.startedAt
    );
    if (salesAfterEnrollment.length > 0) {
      const firstSale = salesAfterEnrollment[0];
      const value     = Number(firstSale.value);
      converted.push({
        leadId:       enrollment.leadId,
        customerName: enrollment.lead.customer.name,
        saleValue:    value,
        soldAt:       new Date(firstSale.soldAt),
        enrolledAt:   enrollment.startedAt,
      });
      attributedRevenue += value;
    }
  }

  converted.sort((a, b) => b.soldAt.getTime() - a.soldAt.getTime());

  return {
    journeyId,
    enrolled,
    completed,
    active,
    failed,
    exited,
    completionRate:    enrolled > 0 ? Math.round((completed / enrolled) * 100) : 0,
    avgDaysToComplete,
    nodeMetrics,
    converted,
    attributedRevenue,
  };
}

// ── Resumo de todas as jornadas (para o Dashboard) ──────────────────────────

export interface JourneySummary {
  journeyId:         string;
  journeyName:       string;
  status:            string;
  enrolled:          number;
  completed:         number;
  active:            number;
  completionRate:    number;
  attributedRevenue: number;
  conversionRate:    number;
}

export async function fetchAllJourneysSummary(clientId: string): Promise<JourneySummary[]> {
  const journeys = await prisma.journey.findMany({
    where:   { clientId, status: { in: ["ACTIVE", "PAUSED"] } },
    select:  {
      id:     true,
      name:   true,
      status: true,
      enrollments: {
        select: {
          id:          true,
          status:      true,
          startedAt:   true,
          lead: {
            select: {
              sales: { select: { value: true, soldAt: true }, orderBy: { soldAt: "asc" } },
            },
          },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return journeys.map(j => {
    const enrolled   = j.enrollments.length;
    const completed  = j.enrollments.filter(e => e.status === "COMPLETED").length;
    const active     = j.enrollments.filter(e => e.status === "ACTIVE").length;

    let attributedRevenue = 0;
    let conversions       = 0;
    for (const enrollment of j.enrollments) {
      const sales = enrollment.lead.sales.filter(s => new Date(s.soldAt) >= enrollment.startedAt);
      if (sales.length > 0) {
        conversions++;
        attributedRevenue += Number(sales[0].value);
      }
    }

    return {
      journeyId:         j.id,
      journeyName:       j.name,
      status:            j.status,
      enrolled,
      completed,
      active,
      completionRate:    enrolled > 0 ? Math.round((completed / enrolled) * 100) : 0,
      attributedRevenue,
      conversionRate:    enrolled > 0 ? Math.round((conversions / enrolled) * 100) : 0,
    };
  });
}
