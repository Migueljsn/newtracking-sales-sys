"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import {
  ArrowDownRight, ArrowUpRight, Calendar as CalendarIcon,
  Download, Minus, Users, DollarSign, PercentSquare, Ticket,
} from "lucide-react";
import type { AnalyticsData } from "@/lib/queries/analytics";

// ─── helpers ───────────────────────────────────────────────────────────────

function brl(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}
function fmt(v: number) {
  return v.toLocaleString("pt-BR");
}
function TrendBadge({ value }: { value: number }) {
  if (value > 0) return (
    <span className="inline-flex items-center gap-0.5 text-xs font-semibold text-[var(--success)]">
      <ArrowUpRight size={12} />+{value}%
    </span>
  );
  if (value < 0) return (
    <span className="inline-flex items-center gap-0.5 text-xs font-semibold text-[var(--danger)]">
      <ArrowDownRight size={12} />{value}%
    </span>
  );
  return <span className="inline-flex items-center gap-0.5 text-xs font-semibold text-[var(--text-muted)]"><Minus size={12} />0%</span>;
}

const ACCENT        = "var(--accent)";
const SUCCESS       = "var(--success)";
const WARNING       = "var(--warning)";
const DANGER        = "var(--danger)";
const CHART_COLORS  = ["#6366f1","#22c55e","#f59e0b","#ef4444","#8b5cf6","#14b8a6","#f97316","#ec4899"];

// ─── Custom tooltip ─────────────────────────────────────────────────────────

function ChartTooltip({ active, payload, label, currency = false }: {
  active?: boolean; payload?: { name: string; value: number; color: string }[];
  label?: string; currency?: boolean;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 shadow-lg text-xs">
      {label && <p className="mb-1 font-semibold text-[var(--text)]">{label}</p>}
      {payload.map(p => (
        <p key={p.name} style={{ color: p.color }}>
          {p.name}: <span className="font-bold">{currency ? brl(p.value) : fmt(p.value)}</span>
        </p>
      ))}
    </div>
  );
}

// ─── Horizontal bar list ─────────────────────────────────────────────────────

function HBarList({ data, valueKey = "leads" as "leads" | "sales" | "revenue", currency = false }: {
  data: { label: string; leads: number; sales: number; revenue: number; rate: number }[];
  valueKey?: "leads" | "sales" | "revenue";
  currency?: boolean;
}) {
  const max = Math.max(...data.map(d => d[valueKey]), 1);
  return (
    <div className="space-y-2.5">
      {data.map((item, i) => (
        <div key={item.label} className="space-y-1">
          <div className="flex items-center justify-between gap-2 text-xs">
            <span className="truncate font-medium text-[var(--text)] max-w-[60%]">{item.label}</span>
            <span className="shrink-0 font-bold tabular-nums text-[var(--text-muted)]">
              {currency ? brl(item[valueKey]) : fmt(item[valueKey])}
            </span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--surface-muted)]">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width:      `${(item[valueKey] / max) * 100}%`,
                background: CHART_COLORS[i % CHART_COLORS.length],
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Funnel ──────────────────────────────────────────────────────────────────

const FUNNEL_COLORS = [ACCENT, WARNING, SUCCESS, DANGER] as const;
function FunnelChart({ data }: { data: AnalyticsData["funnel"] }) {
  return (
    <div className="space-y-2">
      {data.map((step, i) => (
        <div key={step.status} className="relative overflow-hidden rounded-xl">
          <div
            className="flex items-center justify-between gap-3 px-4 py-3 text-sm font-medium text-white transition-all duration-500"
            style={{
              width:      "100%",
              background: `linear-gradient(90deg, ${FUNNEL_COLORS[i]} ${step.pct}%, color-mix(in srgb, ${FUNNEL_COLORS[i]} 18%, transparent) ${step.pct}%)`,
            }}
          >
            <span>{step.label}</span>
            <span className="tabular-nums font-bold">{fmt(step.count)}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Period selector ─────────────────────────────────────────────────────────

const PERIODS = [
  { label: "7 dias",  value: 7  },
  { label: "30 dias", value: 30 },
  { label: "90 dias", value: 90 },
];

// ─── Main component ──────────────────────────────────────────────────────────

const TODAY = new Date().toISOString().slice(0, 10);

function daysAgo(n: number) {
  return new Date(Date.now() - n * 86_400_000).toISOString().slice(0, 10);
}

export function AnalyticsOverview() {
  const [mode,       setMode]       = useState<"preset" | "custom">("preset");
  const [days,       setDays]       = useState(30);
  const [customFrom, setCustomFrom] = useState(daysAgo(30));
  const [customTo,   setCustomTo]   = useState(TODAY);

  const isCustomReady = mode === "custom" && customFrom && customTo && customFrom <= customTo;

  const queryKey = mode === "preset"
    ? ["analytics", "preset", days]
    : ["analytics", "custom", customFrom, customTo];

  const queryUrl = mode === "preset"
    ? `/api/dashboard/analytics?days=${days}`
    : `/api/dashboard/analytics?from=${customFrom}&to=${customTo}`;

  const { data, isFetching } = useQuery<AnalyticsData>({
    queryKey,
    queryFn:  () => fetch(queryUrl).then(r => r.json()),
    staleTime: 60_000,
    enabled:  mode === "preset" || !!isCustomReady,
  });

  const periodLabel = mode === "preset"
    ? `últimos ${days} dias`
    : `${customFrom} até ${customTo}`;

  function handleExport() {
    window.print();
  }

  const s = data?.summary;

  return (
    <div className="space-y-6">
      {/* ── Controls ── */}
      <div className="no-print flex flex-wrap items-center gap-2">
        {/* period selector pill */}
        <div className="flex gap-1 rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] p-1">
          {PERIODS.map(p => (
            <button
              key={p.value}
              type="button"
              onClick={() => { setMode("preset"); setDays(p.value); }}
              className={`rounded-xl px-3.5 py-1.5 text-sm font-medium transition-all ${
                mode === "preset" && days === p.value
                  ? "bg-[var(--accent)] text-white shadow"
                  : "text-[var(--text-muted)] hover:text-[var(--text)]"
              }`}
            >
              {p.label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setMode("custom")}
            className={`flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-sm font-medium transition-all ${
              mode === "custom"
                ? "bg-[var(--accent)] text-white shadow"
                : "text-[var(--text-muted)] hover:text-[var(--text)]"
            }`}
          >
            <CalendarIcon size={13} />
            Personalizado
          </button>
        </div>

        {/* compact inline date range — only when custom is active */}
        {mode === "custom" && (
          <div className="flex items-center gap-1.5 rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-1.5">
            <input
              type="date"
              value={customFrom}
              max={customTo || TODAY}
              onChange={e => setCustomFrom(e.target.value)}
              className="bg-transparent text-sm text-[var(--text)] outline-none"
            />
            <span className="text-[var(--text-muted)] text-xs select-none">→</span>
            <input
              type="date"
              value={customTo}
              min={customFrom}
              max={TODAY}
              onChange={e => setCustomTo(e.target.value)}
              className="bg-transparent text-sm text-[var(--text)] outline-none"
            />
          </div>
        )}

        {/* right side */}
        <div className="ml-auto flex items-center gap-2">
          {isFetching && (
            <span className="text-xs text-[var(--text-muted)] animate-pulse">Atualizando...</span>
          )}
          <button
            type="button"
            onClick={handleExport}
            disabled={!data}
            className="btn-secondary flex items-center gap-2 px-4 py-2 text-sm disabled:opacity-50"
          >
            <Download size={14} />
            Exportar PDF
          </button>
        </div>
      </div>

      {/* ── Printable area ── */}
      <div id="analytics-print-area" className="space-y-6">

        {/* print-only header */}
        <div className="hidden print:flex items-center justify-between border-b border-slate-200 pb-3 mb-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Relatório Analytics</p>
            <p className="text-lg font-bold text-slate-800">Período: {periodLabel}</p>
          </div>
          <p className="text-sm text-slate-500">{new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })}</p>
        </div>

        {/* ── KPI cards ── */}
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard
            icon={Users}
            label="Total de leads"
            value={s ? fmt(s.totalLeads) : "—"}
            sub={`Hoje: ${s ? fmt(s.leadsToday) : "—"}`}
            trend={s?.leadsTrend}
            iconBg="var(--accent-soft)"
            iconColor={ACCENT}
          />
          <KpiCard
            icon={DollarSign}
            label="Receita total"
            value={s ? brl(s.totalRevenue) : "—"}
            sub={`Hoje: ${s ? brl(s.revenueToday) : "—"}`}
            trend={s?.revenueTrend}
            iconBg="var(--success-soft)"
            iconColor={SUCCESS}
          />
          <KpiCard
            icon={PercentSquare}
            label="Conversão"
            value={s ? `${s.conversionRate}%` : "—"}
            sub={`${s ? fmt(s.totalSales) : "—"} vendas`}
            iconBg="var(--warning-soft)"
            iconColor={WARNING}
          />
          <KpiCard
            icon={Ticket}
            label="Ticket médio"
            value={s ? brl(s.avgTicket) : "—"}
            sub={`Período: ${days}d`}
            iconBg="var(--danger-soft)"
            iconColor={DANGER}
          />
        </div>

        {/* ── Area chart: leads & revenue by day ── */}
        <div className="card p-5">
          <h2 className="mb-4 text-sm font-semibold text-[var(--text)]">Leads e Receita por dia</h2>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={data?.byDay ?? []} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="gradLeads" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor={ACCENT}  stopOpacity={0.25} />
                  <stop offset="95%" stopColor={ACCENT}  stopOpacity={0}    />
                </linearGradient>
                <linearGradient id="gradRevenue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor={SUCCESS} stopOpacity={0.25} />
                  <stop offset="95%" stopColor={SUCCESS} stopOpacity={0}    />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: "var(--text-muted)" }} tickFormatter={d => d.slice(5)} />
              <YAxis yAxisId="l" tick={{ fontSize: 10, fill: "var(--text-muted)" }} width={32} />
              <YAxis yAxisId="r" orientation="right" tick={{ fontSize: 10, fill: "var(--text-muted)" }} width={60}
                     tickFormatter={v => brl(v).replace("R$ ", "").replace(",00", "")} />
              <Tooltip content={<ChartTooltip currency={false} />} />
              <Area yAxisId="l" type="monotone" dataKey="leads"   name="Leads"   stroke={ACCENT}  fill="url(#gradLeads)"   strokeWidth={2} dot={false} />
              <Area yAxisId="r" type="monotone" dataKey="revenue" name="Receita" stroke={SUCCESS} fill="url(#gradRevenue)" strokeWidth={2} dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* ── Funnel + Weekday ── */}
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="card p-5">
            <h2 className="mb-4 text-sm font-semibold text-[var(--text)]">Funil de leads</h2>
            <FunnelChart data={data?.funnel ?? []} />
          </div>

          <div className="card p-5">
            <h2 className="mb-4 text-sm font-semibold text-[var(--text)]">Vendas por dia da semana</h2>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={data?.byWeekday ?? []} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: "var(--text-muted)" }} />
                <YAxis tick={{ fontSize: 10, fill: "var(--text-muted)" }} width={28} allowDecimals={false} />
                <Tooltip content={<ChartTooltip />} />
                <Bar dataKey="sales" name="Vendas" radius={[6, 6, 0, 0]}>
                  {(data?.byWeekday ?? []).map((_, i) => (
                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* ── By hour ── */}
        <div className="card p-5">
          <h2 className="mb-4 text-sm font-semibold text-[var(--text)]">Vendas por horário (BRT)</h2>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={data?.byHour ?? []} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="label" tick={{ fontSize: 9, fill: "var(--text-muted)" }} interval={1} />
              <YAxis tick={{ fontSize: 10, fill: "var(--text-muted)" }} width={28} allowDecimals={false} />
              <Tooltip content={<ChartTooltip />} />
              <Bar dataKey="sales" name="Vendas" fill={ACCENT} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* ── UTM Source + UTM Campaign ── */}
        <div className="grid gap-4 lg:grid-cols-2">
          <BarListCard title="Por UTM Source" data={data?.byUtmSource ?? []} />
          <BarListCard title="Por UTM Campaign" data={data?.byUtmCampaign ?? []} />
        </div>

        {/* ── State + Consultant ── */}
        <div className="grid gap-4 lg:grid-cols-2">
          <BarListCard title="Por Estado" data={data?.byState ?? []} />
          <BarListCard title="Por Consultor" data={data?.byConsultant ?? []} />
        </div>

      </div>
    </div>
  );
}

// ─── KPI card ────────────────────────────────────────────────────────────────

function KpiCard({ icon: Icon, label, value, sub, trend, iconBg, iconColor }: {
  icon: React.ElementType;
  label: string; value: string; sub: string;
  trend?: number; iconBg: string; iconColor: string;
}) {
  return (
    <div className="stat-card">
      <div className="flex items-start justify-between gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl" style={{ background: iconBg, color: iconColor }}>
          <Icon size={18} />
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold tabular-nums leading-none text-[var(--text)]">{value}</p>
          {trend !== undefined && <div className="mt-1"><TrendBadge value={trend} /></div>}
        </div>
      </div>
      <p className="mt-3 text-sm font-medium text-[var(--text-muted)]">{label}</p>
      <p className="text-xs text-[var(--text-muted)] opacity-70">{sub}</p>
    </div>
  );
}

// ─── BarList card ─────────────────────────────────────────────────────────────

type BarItemFull = { label: string; leads: number; sales: number; revenue: number; rate: number };

function BarListCard({ title, data }: { title: string; data: BarItemFull[] }) {
  const [metric, setMetric] = useState<"leads" | "sales" | "revenue">("leads");
  return (
    <div className="card p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-[var(--text)]">{title}</h2>
        <div className="flex gap-1 rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] p-0.5 text-xs">
          {(["leads", "sales", "revenue"] as const).map(m => (
            <button
              key={m}
              type="button"
              onClick={() => setMetric(m)}
              className={`rounded-lg px-2.5 py-1 font-medium transition-all ${
                metric === m ? "bg-[var(--accent)] text-white" : "text-[var(--text-muted)] hover:text-[var(--text)]"
              }`}
            >
              {m === "leads" ? "Leads" : m === "sales" ? "Vendas" : "Receita"}
            </button>
          ))}
        </div>
      </div>
      {data.length === 0 ? (
        <p className="text-sm text-[var(--text-muted)]">Sem dados no período.</p>
      ) : (
        <HBarList data={data} valueKey={metric} currency={metric === "revenue"} />
      )}
    </div>
  );
}
