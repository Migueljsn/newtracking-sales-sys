"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import {
  ArrowDownRight, ArrowUpRight,
  ChevronLeft, ChevronRight,
  Download, Minus, Users, DollarSign, PercentSquare, Ticket,
  RefreshCw, TrendingUp, Clock, AlertCircle,
} from "lucide-react";
import type { AnalyticsData, LtvData, CohortData, PipelineData } from "@/lib/queries/analytics";
import { HintTooltip } from "@/components/ui/hint-tooltip";
import { DateRangePicker } from "@/components/ui/date-range-picker";

// ─── helpers ───────────────────────────────────────────────────────────────

function pct(a: number, b: number) {
  return b === 0 ? 0 : Math.round((a / b) * 100);
}
function brl(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}
function fmt(v: number) {
  return v.toLocaleString("pt-BR");
}
function TrendBadge({ value }: { value: number }) {
  if (value > 0) return (
    <span className="inline-flex items-center gap-0.5 rounded-full bg-[var(--success-soft)] px-2 py-0.5 text-xs font-bold text-[var(--success)]">
      <ArrowUpRight size={13} />+{value}%
    </span>
  );
  if (value < 0) return (
    <span className="inline-flex items-center gap-0.5 rounded-full bg-[var(--danger-soft)] px-2 py-0.5 text-xs font-bold text-[var(--danger)]">
      <ArrowDownRight size={13} />{value}%
    </span>
  );
  return (
    <span className="inline-flex items-center gap-0.5 rounded-full bg-[var(--surface-muted)] px-2 py-0.5 text-xs font-bold text-[var(--text-muted)]">
      <Minus size={12} />0%
    </span>
  );
}

function RealtimeBadge() {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--success)] bg-[var(--success-soft)] px-2 py-0.5 text-[10px] font-semibold text-[var(--success)]">
      <span className="relative flex h-1.5 w-1.5">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--success)] opacity-75" />
        <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[var(--success)]" />
      </span>
      Tempo real
    </span>
  );
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

  const effectiveFrom = mode === "preset" ? daysAgo(days) : customFrom;
  const effectiveTo   = mode === "preset" ? TODAY         : customTo;
  const canGoForward  = effectiveTo < TODAY;

  function navigatePeriod(direction: -1 | 1) {
    const f      = new Date(effectiveFrom);
    const t      = new Date(effectiveTo);
    const spanMs = t.getTime() - f.getTime() + 86_400_000;
    const newF   = new Date(f.getTime() + direction * spanMs).toISOString().slice(0, 10);
    const newT   = new Date(t.getTime() + direction * spanMs).toISOString().slice(0, 10);
    if (direction === 1 && newT > TODAY) return;
    setMode("custom");
    setCustomFrom(newF);
    setCustomTo(newT > TODAY ? TODAY : newT);
  }

  type QueryKey =
    | ["analytics", "preset", number]
    | ["analytics", "custom", string, string];

  const queryKey: QueryKey = mode === "preset"
    ? ["analytics", "preset", days]
    : ["analytics", "custom", customFrom, customTo];

  const { data, isFetching } = useQuery<AnalyticsData>({
    queryKey,
    queryFn: async ({ queryKey: key }) => {
      const url = key[1] === "preset"
        ? `/api/dashboard/analytics?days=${key[2]}`
        : `/api/dashboard/analytics?from=${key[2]}&to=${key[3]}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error("Erro ao buscar dados");
      return res.json();
    },
    staleTime: 30_000,
    enabled:  mode === "preset" || !!isCustomReady,
  });

  const periodLabel = mode === "preset"
    ? `últimos ${days} dias`
    : `${customFrom} até ${customTo}`;

  function handleExport() {
    const html = document.documentElement;
    const wasDark = html.classList.contains("dark");
    if (wasDark) html.classList.remove("dark");

    const restore = () => {
      if (wasDark) html.classList.add("dark");
      window.removeEventListener("afterprint", restore);
    };
    window.addEventListener("afterprint", restore);

    requestAnimationFrame(() => window.print());
  }

  const s = data?.summary;

  return (
    <div className="space-y-6">
      {/* ── Controls ── */}
      <div className="no-print flex flex-wrap items-center gap-2">
        {/* period navigation arrows */}
        <button
          type="button"
          onClick={() => navigatePeriod(-1)}
          title="Período anterior"
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] text-[var(--text-muted)] transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)]"
        >
          <ChevronLeft size={16} />
        </button>

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
        </div>

        <DateRangePicker
          value={mode === "custom" ? { from: customFrom, to: customTo } : null}
          onChange={(r) => {
            if (r) { setMode("custom"); setCustomFrom(r.from); setCustomTo(r.to); }
            else   { setMode("preset"); setDays(30); }
          }}
          placeholder="Personalizado"
        />

        {/* forward arrow */}
        <button
          type="button"
          onClick={() => navigatePeriod(1)}
          disabled={!canGoForward}
          title="Próximo período"
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] text-[var(--text-muted)] transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)] disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <ChevronRight size={16} />
        </button>

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
            hint="Leads capturadas no período selecionado, independente do status atual. Inclui formulário, cadastro manual e importação."
            iconBg="var(--accent-soft)"
            iconColor={ACCENT}
          />
          <KpiCard
            icon={DollarSign}
            label="Receita total"
            value={s ? brl(s.totalRevenue) : "—"}
            sub={`Hoje: ${s ? brl(s.revenueToday) : "—"}`}
            trend={s?.revenueTrend}
            hint="Soma de todas as vendas registradas no período. Inclui primeiras compras e recompras. A tendência compara com o período imediatamente anterior de igual duração."
            iconBg="var(--success-soft)"
            iconColor={SUCCESS}
          />
          <KpiCard
            icon={PercentSquare}
            label="Conversão"
            value={s ? `${s.conversionRate}%` : "—"}
            sub={`${s ? fmt(s.totalSales) : "—"} vendas`}
            trend={s?.conversionTrend}
            hint="Percentual de leads capturadas no período que encerraram com status VENDIDA. Calculado como: vendas ÷ total de leads × 100."
            iconBg="var(--warning-soft)"
            iconColor={WARNING}
          />
          <KpiCard
            icon={Ticket}
            label="Ticket médio"
            value={s ? brl(s.avgTicket) : "—"}
            sub={`${s ? fmt(s.totalSales) : "—"} vendas`}
            trend={s?.avgTicketTrend}
            hint="Valor médio por venda no período. Calculado como: receita total ÷ número de vendas. Inclui recompras."
            iconBg="var(--danger-soft)"
            iconColor={DANGER}
          />
        </div>

        {/* ── Pipeline atual ── */}
        {data && <PipelineBlock pipeline={data.pipeline} />}

        {/* ── Area chart: leads & revenue by day ── */}
        <div className="card p-5">
          <div className="mb-4 flex items-center gap-1.5">
            <h2 className="text-sm font-semibold text-[var(--text)]">Leads e Receita por dia</h2>
            <HintTooltip text="Evolução diária de capturas e receita no período. Passe o mouse sobre o gráfico para ver a taxa de conversão daquele dia." />
          </div>
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
              <Tooltip
                content={({ active, payload, label }) => {
                  if (!active || !payload?.length) return null;
                  const dayData = data?.byDay.find(d => d.date === label);
                  const rate = dayData && dayData.leads > 0
                    ? Math.round((dayData.sales / dayData.leads) * 100)
                    : 0;
                  return (
                    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 shadow-lg text-xs">
                      <p className="mb-1.5 font-semibold text-[var(--text)]">{label ? String(label).slice(5).replace("-", "/") : ""}</p>
                      {payload.map(p => (
                        <p key={p.name as string} style={{ color: p.color as string }} className="tabular-nums">
                          {p.name}: <span className="font-bold">{p.name === "Receita" ? brl(p.value as number) : fmt(p.value as number)}</span>
                        </p>
                      ))}
                      {dayData && dayData.leads > 0 && (
                        <p className="mt-1.5 border-t border-[var(--border)] pt-1.5 text-[var(--text-muted)]">
                          Conversão: <span className="font-bold text-[var(--text)]">{rate}%</span>
                          <span className="ml-1 opacity-60">({dayData.sales}/{dayData.leads})</span>
                        </p>
                      )}
                    </div>
                  );
                }}
              />
              <Area yAxisId="l" type="monotone" dataKey="leads"   name="Leads"   stroke={ACCENT}  fill="url(#gradLeads)"   strokeWidth={2} dot={false} />
              <Area yAxisId="r" type="monotone" dataKey="revenue" name="Receita" stroke={SUCCESS} fill="url(#gradRevenue)" strokeWidth={2} dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* ── Cohort do período ── */}
        {data && <CohortBlock cohort={data.cohort} />}

        {/* ── Funnel + Weekday ── */}
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="card p-5">
            <div className="mb-4 flex items-center gap-1.5">
              <h2 className="text-sm font-semibold text-[var(--text)]">Funil de leads</h2>
              <HintTooltip text="Distribuição dos status das leads capturadas no período. A largura da barra mostra a proporção de cada etapa em relação ao total." />
            </div>
            <FunnelChart data={data?.funnel ?? []} />
          </div>

          <div className="card p-5">
            <div className="mb-4 flex items-center gap-1.5">
              <h2 className="text-sm font-semibold text-[var(--text)]">Vendas por dia da semana</h2>
              <HintTooltip text="Concentração de vendas fechadas por dia da semana no período. Útil para identificar os melhores dias para operação comercial." />
            </div>
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

        {/* ── LTV / Recompra ── */}
        {data && <LtvBlock ltv={data.ltv} />}

        {/* ── UTM Source + UTM Campaign ── */}
        <div className="grid gap-4 lg:grid-cols-2">
          <BarListCard title="Por UTM Source" data={data?.byUtmSource ?? []} />
          <BarListCard title="Por UTM Campaign" data={data?.byUtmCampaign ?? []} />
        </div>

        {/* ── State + Consultant ranking ── */}
        <div className="grid gap-4 lg:grid-cols-2">
          <BarListCard title="Por Estado" data={data?.byState ?? []} />
          <ConsultantRanking data={data?.byConsultant ?? []} />
        </div>

      </div>
    </div>
  );
}

// ─── Pipeline atual ──────────────────────────────────────────────────────────

function PipelineBlock({ pipeline }: { pipeline: PipelineData }) {
  const total = pipeline.currentNew + pipeline.currentInStage;
  if (total === 0) return null;

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-1.5">
          <h2 className="text-sm font-semibold text-[var(--text)]">Pipeline atual</h2>
          <HintTooltip text="Snapshot do funil em tempo real, independente do período selecionado. Mostra leads que ainda podem virar venda: Novas (sem etapa) e Em etapa (em negociação)." />
        </div>
        <RealtimeBadge />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex items-center gap-4 rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] p-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[var(--accent-soft)]">
            <Users size={18} className="text-[var(--accent)]" />
          </div>
          <div className="min-w-0">
            <p className="text-3xl font-bold tabular-nums text-[var(--text)]">{fmt(pipeline.currentNew)}</p>
            <p className="text-sm font-medium text-[var(--text-muted)]">Aguardando contato</p>
            <p className="text-[11px] text-[var(--text-muted)] opacity-60">leads sem etapa de pipeline</p>
          </div>
        </div>
        <div className="flex items-center gap-4 rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] p-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[var(--warning-soft)]">
            <AlertCircle size={18} className="text-[var(--warning)]" />
          </div>
          <div className="min-w-0">
            <p className="text-3xl font-bold tabular-nums text-[var(--text)]">{fmt(pipeline.currentInStage)}</p>
            <p className="text-sm font-medium text-[var(--text-muted)]">Em etapa</p>
            <p className="text-[11px] text-[var(--text-muted)] opacity-60">leads em etapa de pipeline</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Cohort do período ───────────────────────────────────────────────────────

const COHORT_STEPS = [
  { key: "sold"      as const, label: "Convertidas", color: "var(--success)" },
  { key: "inStage"   as const, label: "Em etapa",    color: "var(--accent)"  },
  { key: "newStatus" as const, label: "Sem contato", color: "var(--warning)" },
  { key: "lost"      as const, label: "Perdidas",    color: "var(--danger)"  },
];

function CohortBlock({ cohort }: { cohort: CohortData }) {
  if (cohort.total === 0) return null;

  return (
    <div className="card p-5">
      <div className="flex flex-wrap items-start justify-between gap-4 mb-5">
        <div>
          <div className="flex items-center gap-1.5">
            <h2 className="text-sm font-semibold text-[var(--text)]">Leads capturadas no período</h2>
            <HintTooltip text="De todas as leads geradas no período selecionado, mostra onde cada uma está hoje. Indica qualidade e velocidade do funil de vendas." />
          </div>
          <p className="mt-0.5 text-xs text-[var(--text-muted)]">
            {fmt(cohort.total)} leads — onde estão hoje
          </p>
        </div>
        {cohort.avgConvDays !== null && (
          <div className="flex items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[var(--success-soft)]">
              <Clock size={14} className="text-[var(--success)]" />
            </div>
            <div>
              <p className="text-lg font-bold tabular-nums text-[var(--text)] leading-none">
                {cohort.avgConvDays === 0 ? "< 1" : cohort.avgConvDays} {cohort.avgConvDays === 1 ? "dia" : "dias"}
              </p>
              <div className="flex items-center gap-1">
                <p className="text-[11px] text-[var(--text-muted)]">tempo médio de conversão</p>
                <HintTooltip text="Média de dias entre a captura da lead e o registro da venda. Calculado apenas sobre as leads convertidas no período." />
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="space-y-3">
        {COHORT_STEPS.map(step => {
          const count = cohort[step.key];
          const p     = pct(count, cohort.total);
          return (
            <div key={step.key} className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span
                    className="inline-block h-2 w-2 rounded-full shrink-0"
                    style={{ background: step.color }}
                  />
                  <span className="font-medium text-[var(--text)]">{step.label}</span>
                </div>
                <span className="tabular-nums font-semibold text-[var(--text-muted)]">
                  {fmt(count)} <span className="text-[10px]">({p}%)</span>
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--surface-muted)]">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${p}%`, background: step.color }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── LTV / Recompra block ────────────────────────────────────────────────────

const LIFECYCLE_LABELS: Record<string, string> = {
  NEW_BUYER: "Primeira compra",
  LOYAL:     "Fiel",
  CHAMPION:  "Campeão",
  AT_RISK:   "Em risco",
  INACTIVE:  "Inativo",
};

const LIFECYCLE_COLORS: Record<string, string> = {
  NEW_BUYER: "#6366f1",
  LOYAL:     "#22c55e",
  CHAMPION:  "#f59e0b",
  AT_RISK:   "#f97316",
  INACTIVE:  "#ef4444",
};

const LIFECYCLE_ORDER = ["NEW_BUYER", "LOYAL", "CHAMPION", "AT_RISK", "INACTIVE"] as const;

function LtvBlock({ ltv }: { ltv: LtvData }) {
  const totalCustomers = LIFECYCLE_ORDER.reduce((a, k) => a + ltv.lifecycle[k], 0);
  const totalPeriod    = ltv.newRevenue + ltv.repeatRevenue;
  const newPct         = totalPeriod > 0 ? Math.round((ltv.newRevenue    / totalPeriod) * 100) : 0;
  const repeatPct      = totalPeriod > 0 ? Math.round((ltv.repeatRevenue / totalPeriod) * 100) : 0;

  return (
    <div className="card p-5 space-y-6">
      <div className="flex items-center gap-1.5">
        <h2 className="text-sm font-semibold text-[var(--text)]">LTV &amp; Recompra</h2>
        <HintTooltip text="Análise do valor ao longo da vida do cliente. Mede receita de recompra, frequência de retorno e classifica clientes por estágio de fidelização." />
      </div>

      {/* ── 3 KPIs ── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="soft-panel flex items-center gap-4 p-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--accent-soft)]">
            <RefreshCw size={16} className="text-[var(--accent)]" />
          </div>
          <div>
            <p className="text-2xl font-bold tabular-nums text-[var(--text)]">{ltv.repeatRate}%</p>
            <div className="flex items-center gap-1">
              <p className="text-xs text-[var(--text-muted)]">Taxa de recompra</p>
              <HintTooltip text="Percentual de vendas no período realizadas por clientes que já compraram antes. Alta taxa indica boa retenção e fidelização." />
            </div>
            <p className="text-[10px] text-[var(--text-muted)] opacity-70">do total de vendas no período</p>
          </div>
        </div>
        <div className="soft-panel flex items-center gap-4 p-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--success-soft)]">
            <DollarSign size={16} className="text-[var(--success)]" />
          </div>
          <div>
            <p className="text-2xl font-bold tabular-nums text-[var(--success)]">{brl(ltv.repeatRevenue)}</p>
            <div className="flex items-center gap-1">
              <p className="text-xs text-[var(--text-muted)]">Receita de recompra</p>
              <HintTooltip text="Valor total gerado pelas vendas de clientes que já compraram antes. Alta proporção em relação à receita total indica base de clientes fiel." />
            </div>
            <p className="text-[10px] text-[var(--text-muted)] opacity-70">no período selecionado</p>
          </div>
        </div>
        <div className="soft-panel flex items-center gap-4 p-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--warning-soft)]">
            <TrendingUp size={16} className="text-[var(--warning)]" />
          </div>
          <div>
            <p className="text-2xl font-bold tabular-nums text-[var(--text)]">{brl(ltv.avgLtv)}</p>
            <div className="flex items-center gap-1">
              <p className="text-xs text-[var(--text-muted)]">LTV médio por cliente</p>
              <HintTooltip text="Receita total acumulada de todos os clientes, dividida pelo número de clientes. Representa o valor médio que cada cliente gera para o negócio ao longo do tempo." />
            </div>
            <p className="text-[10px] text-[var(--text-muted)] opacity-70">gasto total acumulado</p>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* ── Receita: nova venda vs recompra ── */}
        <div className="space-y-3">
          <div className="flex items-center gap-1">
            <p className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">Receita no período</p>
            <HintTooltip text="Divide a receita do período entre clientes novos (primeira compra) e clientes recorrentes (recompra)." />
          </div>
          {totalPeriod === 0 ? (
            <p className="text-sm text-[var(--text-muted)]">Sem vendas no período.</p>
          ) : (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-[var(--text)]">Primeira compra</span>
                  <span className="tabular-nums font-bold text-[var(--text-muted)]">{brl(ltv.newRevenue)} <span className="text-[10px]">({newPct}%)</span></span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--surface-muted)]">
                  <div className="h-full rounded-full bg-[var(--accent)] transition-all duration-500" style={{ width: `${newPct}%` }} />
                </div>
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-[var(--text)]">Recompra</span>
                  <span className="tabular-nums font-bold text-[var(--text-muted)]">{brl(ltv.repeatRevenue)} <span className="text-[10px]">({repeatPct}%)</span></span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--surface-muted)]">
                  <div className="h-full rounded-full bg-[var(--success)] transition-all duration-500" style={{ width: `${repeatPct}%` }} />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── Ciclo de vida dos clientes ── */}
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1">
              <p className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                Ciclo de vida — {fmt(totalCustomers)} clientes com compra
              </p>
              <HintTooltip text="Snapshot atual de todos os clientes que já compraram (independente do período selecionado). Primeira compra = 1 compra; Fiel = 2–3 compras; Campeão = 4+ compras; Em risco = última compra há +60 dias; Inativo = última compra há +120 dias." />
            </div>
            <RealtimeBadge />
          </div>
          {totalCustomers === 0 ? (
            <p className="text-sm text-[var(--text-muted)]">Nenhum cliente cadastrado.</p>
          ) : (
            <div className="space-y-2.5">
              {LIFECYCLE_ORDER.filter(k => ltv.lifecycle[k] > 0).map(k => {
                const count = ltv.lifecycle[k];
                const pct   = Math.round((count / totalCustomers) * 100);
                return (
                  <div key={k} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-[var(--text)]">{LIFECYCLE_LABELS[k]}</span>
                      <span className="tabular-nums font-bold text-[var(--text-muted)]">{fmt(count)} <span className="text-[10px]">({pct}%)</span></span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--surface-muted)]">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${pct}%`, background: LIFECYCLE_COLORS[k] }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── KPI card ────────────────────────────────────────────────────────────────

function KpiCard({ icon: Icon, label, value, sub, trend, hint, iconBg, iconColor }: {
  icon: React.ElementType;
  label: string; value: string; sub: string;
  trend?: number; hint?: string; iconBg: string; iconColor: string;
}) {
  return (
    <div className="stat-card">
      <div className="flex items-start justify-between gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl" style={{ background: iconBg, color: iconColor }}>
          <Icon size={20} />
        </div>
        {trend !== undefined && <TrendBadge value={trend} />}
      </div>
      <p className="mt-4 text-3xl font-bold tabular-nums leading-none text-[var(--text)]">{value}</p>
      <div className="mt-2 flex items-center gap-1.5">
        <p className="text-sm font-semibold text-[var(--text)]">{label}</p>
        {hint && <HintTooltip text={hint} />}
      </div>
      <p className="mt-0.5 text-xs text-[var(--text-muted)]">{sub}</p>
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
        <HBarList
          data={[...data].sort((a, b) => b[metric] - a[metric])}
          valueKey={metric}
          currency={metric === "revenue"}
        />
      )}
    </div>
  );
}

// ─── Consultant ranking ───────────────────────────────────────────────────────

const MEDAL_COLORS = ["#f59e0b", "#94a3b8", "#cd7f32"];

function ConsultantRanking({ data }: { data: BarItemFull[] }) {
  const ranked = [...data].filter(d => d.label).sort((a, b) => b.revenue - a.revenue);

  return (
    <div className="card p-5">
      <div className="mb-4 flex items-center gap-1.5">
        <h2 className="text-sm font-semibold text-[var(--text)]">Ranking de consultores</h2>
        <HintTooltip text="Desempenho por consultor no período selecionado, ordenado por receita gerada." />
      </div>

      {ranked.length === 0 ? (
        <p className="text-sm text-[var(--text-muted)]">Sem dados de consultores no período.</p>
      ) : (
        <div className="space-y-3">
          {ranked.map((c, i) => {
            const maxRevenue = ranked[0].revenue;
            const barPct     = maxRevenue > 0 ? Math.round((c.revenue / maxRevenue) * 100) : 0;
            return (
              <div key={c.label} className="space-y-1.5">
                <div className="flex items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white"
                      style={{ background: MEDAL_COLORS[i] ?? "var(--text-muted)" }}
                    >
                      {i + 1}
                    </span>
                    <span className="font-medium text-[var(--text)] truncate">{c.label}</span>
                  </div>
                  <div className="flex items-center gap-3 shrink-0 tabular-nums text-[var(--text-muted)]">
                    <span>{c.sales} venda{c.sales !== 1 ? "s" : ""}</span>
                    <span className="font-semibold text-[var(--success)]">{brl(c.revenue)}</span>
                  </div>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--surface-muted)]">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width:      `${barPct}%`,
                      background: MEDAL_COLORS[i] ?? "var(--accent)",
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
