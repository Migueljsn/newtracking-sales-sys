import { prisma } from "@/lib/db/prisma";

export interface AnalyticsSummary {
  totalLeads:     number;
  totalSales:     number;
  totalRevenue:   number;
  avgTicket:      number;
  conversionRate: number;
  leadsToday:     number;
  revenueToday:   number;
  leadsTrend:     number;
  revenueTrend:   number;
}

export interface DayPoint     { date: string; leads: number; sales: number; revenue: number }
export interface FunnelStep   { label: string; status: string; count: number; pct: number }
export interface WeekdayPoint { day: number; label: string; sales: number; revenue: number }
export interface BarItem      { label: string; leads: number; sales: number; revenue: number; rate: number }

export interface LtvData {
  repeatRate:    number;
  repeatRevenue: number;
  newRevenue:    number;
  avgLtv:        number;
  lifecycle: { NEW_BUYER: number; LOYAL: number; CHAMPION: number; AT_RISK: number; INACTIVE: number };
}

export interface AnalyticsData {
  period:        number;
  summary:       AnalyticsSummary;
  byDay:         DayPoint[];
  funnel:        FunnelStep[];
  byWeekday:     WeekdayPoint[];
  byUtmSource:   BarItem[];
  byUtmCampaign: BarItem[];
  byState:       BarItem[];
  byConsultant:  BarItem[];
  ltv:           LtvData;
}

function pct(a: number, b: number) {
  return b === 0 ? 0 : Math.round((a / b) * 100);
}
function trend(curr: number, prev: number) {
  if (prev === 0) return curr > 0 ? 100 : 0;
  return Math.round(((curr - prev) / prev) * 100);
}

export async function fetchAnalytics(clientId: string, from: Date, to: Date): Promise<AnalyticsData> {
  const fromDay = new Date(from.toISOString().slice(0, 10) + "T00:00:00.000Z");
  const toDay   = new Date(to.toISOString().slice(0, 10)   + "T00:00:00.000Z");
  const days    = Math.max(1, Math.round((toDay.getTime() - fromDay.getTime()) / 86_400_000) + 1);
  const startDate     = from;
  const endDate       = to;
  const prevStartDate = new Date(from.getTime() - days * 86_400_000);
  const todayStart    = new Date(); todayStart.setHours(0, 0, 0, 0);

  const [leads, sales, prevLeadsCount, prevSalesAgg, lifecycleRows, customerSalesRows] = await Promise.all([
    prisma.lead.findMany({
      where:  { clientId, capturedAt: { gte: startDate, lte: endDate } },
      select: {
        id: true, status: true, capturedAt: true,
        utmSource: true, utmCampaign: true, consultant: true,
        customer: { select: { state: true } },
      },
    }),
    prisma.sale.findMany({
      where:  { clientId, soldAt: { gte: startDate, lte: endDate } },
      select: {
        id: true, value: true, soldAt: true, isRepeatPurchase: true,
        lead: {
          select: {
            utmSource: true, utmCampaign: true, consultant: true,
            customer: { select: { state: true } },
          },
        },
      },
    }),
    prisma.lead.count({ where: { clientId, capturedAt: { gte: prevStartDate, lt: startDate } } }),
    prisma.sale.aggregate({
      where: { clientId, soldAt: { gte: prevStartDate, lt: startDate } },
      _sum:  { value: true },
    }),
    prisma.customer.groupBy({
      by:    ["lifecycle"],
      where: { clientId },
      _count: { id: true },
    }),
    prisma.sale.groupBy({
      by:    ["customerId"],
      where: { clientId },
      _sum:  { value: true },
    }),
  ]);

  const totalRevenue = sales.reduce((s, x) => s + Number(x.value), 0);
  const prevRevenue  = Number(prevSalesAgg._sum.value ?? 0);
  const soldLeads    = leads.filter(l => l.status === "SOLD").length;

  // ── By Day ─────────────────────────────────────────────────────────────────
  const mapLeads   = new Map<string, number>();
  const mapSales   = new Map<string, number>();
  const mapRevenue = new Map<string, number>();
  leads.forEach(l => {
    const d = new Date(l.capturedAt).toISOString().slice(0, 10);
    mapLeads.set(d, (mapLeads.get(d) ?? 0) + 1);
  });
  sales.forEach(s => {
    const d = new Date(s.soldAt).toISOString().slice(0, 10);
    mapSales.set(d, (mapSales.get(d) ?? 0) + 1);
    mapRevenue.set(d, (mapRevenue.get(d) ?? 0) + Number(s.value));
  });
  const byDay: DayPoint[] = [];
  for (let i = 0; i <= days; i++) {
    const d = new Date(startDate);
    d.setDate(d.getDate() + i);
    if (d > endDate) break;
    const k = d.toISOString().slice(0, 10);
    byDay.push({ date: k, leads: mapLeads.get(k) ?? 0, sales: mapSales.get(k) ?? 0, revenue: mapRevenue.get(k) ?? 0 });
  }

  // ── Funnel ──────────────────────────────────────────────────────────────────
  const sc = { NEW: 0, REGISTERED: 0, SOLD: 0, LOST: 0 };
  leads.forEach(l => { if (l.status in sc) sc[l.status as keyof typeof sc]++; });
  const maxSC = Math.max(...Object.values(sc), 1);
  const funnel: FunnelStep[] = [
    { label: "Novas",       status: "NEW",        count: sc.NEW,        pct: pct(sc.NEW,        maxSC) },
    { label: "Cadastradas", status: "REGISTERED", count: sc.REGISTERED, pct: pct(sc.REGISTERED, maxSC) },
    { label: "Vendidas",    status: "SOLD",        count: sc.SOLD,       pct: pct(sc.SOLD,       maxSC) },
    { label: "Perdidas",    status: "LOST",        count: sc.LOST,       pct: pct(sc.LOST,       maxSC) },
  ];

  // ── By Weekday ──────────────────────────────────────────────────────────────
  const WD = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
  const wS = new Array(7).fill(0), wR = new Array(7).fill(0);
  sales.forEach(s => { const d = new Date(s.soldAt).getDay(); wS[d]++; wR[d] += Number(s.value); });
  const byWeekday: WeekdayPoint[] = [1, 2, 3, 4, 5, 6, 0].map(d => ({
    day: d, label: WD[d], sales: wS[d], revenue: wR[d],
  }));

  // ── Generic group helper ────────────────────────────────────────────────────
  type L = typeof leads[0];
  type S = typeof sales[0];
  function group(getL: (l: L) => string, getS: (s: S) => string, top = 8): BarItem[] {
    const lm = new Map<string, number>();
    const sm = new Map<string, number>();
    const rm = new Map<string, number>();
    leads.forEach(l => { const k = getL(l) || "(Sem dado)"; lm.set(k, (lm.get(k) ?? 0) + 1); });
    sales.forEach(s => {
      const k = getS(s) || "(Sem dado)";
      sm.set(k, (sm.get(k) ?? 0) + 1);
      rm.set(k, (rm.get(k) ?? 0) + Number(s.value));
    });
    return [...new Set([...lm.keys(), ...sm.keys()])]
      .map(label => ({ label, leads: lm.get(label) ?? 0, sales: sm.get(label) ?? 0, revenue: rm.get(label) ?? 0, rate: pct(sm.get(label) ?? 0, lm.get(label) ?? 0) }))
      .sort((a, b) => b.leads - a.leads)
      .slice(0, top);
  }

  // ── LTV / Recompra ──────────────────────────────────────────────────────────
  const repeatSales   = sales.filter(s => s.isRepeatPurchase);
  const repeatRevenue = repeatSales.reduce((a, s) => a + Number(s.value), 0);
  const newRevenue    = totalRevenue - repeatRevenue;
  const repeatRate    = pct(repeatSales.length, sales.length);

  const lc = { NEW_BUYER: 0, LOYAL: 0, CHAMPION: 0, AT_RISK: 0, INACTIVE: 0 };
  lifecycleRows.forEach(r => { if (r.lifecycle in lc) lc[r.lifecycle as keyof typeof lc] = r._count.id; });

  const avgLtv = customerSalesRows.length > 0
    ? customerSalesRows.reduce((a, r) => a + Number(r._sum.value ?? 0), 0) / customerSalesRows.length
    : 0;

  return {
    period:  days,
    summary: {
      totalLeads:     leads.length,
      totalSales:     sales.length,
      totalRevenue,
      avgTicket:      sales.length > 0 ? totalRevenue / sales.length : 0,
      conversionRate: pct(soldLeads, leads.length),
      leadsToday:     leads.filter(l => new Date(l.capturedAt) >= todayStart).length,
      revenueToday:   sales.filter(s => new Date(s.soldAt) >= todayStart).reduce((a, x) => a + Number(x.value), 0),
      leadsTrend:     trend(leads.length, prevLeadsCount),
      revenueTrend:   trend(totalRevenue, prevRevenue),
    },
    byDay,
    funnel,
    byWeekday,
    byUtmSource:   group(l => l.utmSource ?? "",   s => s.lead?.utmSource ?? ""),
    byUtmCampaign: group(l => l.utmCampaign ?? "", s => s.lead?.utmCampaign ?? ""),
    byState:       group(l => l.customer?.state ?? "", s => s.lead?.customer?.state ?? ""),
    byConsultant:  group(l => l.consultant ?? "",  s => s.lead?.consultant ?? ""),
    ltv: { repeatRate, repeatRevenue, newRevenue, avgLtv, lifecycle: lc },
  };
}
