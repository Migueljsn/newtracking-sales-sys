export const dynamic = "force-dynamic";

import { getConsultantSession } from "@/lib/auth/consultant-session";
import { prisma }                from "@/lib/db/prisma";
import { LogOut, Target, TrendingUp, Users, DollarSign, CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { consultantLogoutAction } from "@/app/consultor/actions";
import type { ConsultantGoal } from "@/components/settings/consultant-access";

function brl(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}

function periodLabel(period: string) {
  return period === "WEEKLY" ? "esta semana" : "este mês";
}

function periodStart(period: string): Date {
  const now = new Date();
  if (period === "WEEKLY") {
    const d = new Date(now);
    d.setDate(d.getDate() - d.getDay());
    d.setHours(0, 0, 0, 0);
    return d;
  }
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

export default async function ConsultantDashboardPage() {
  const session  = await getConsultantSession();
  const clientId = session.clientId;

  const [consultantUser, pipelineStages, allLeads] = await Promise.all([
    prisma.consultantUser.findFirst({
      where: { clientId, name: session.name },
      select: { goal: true },
    }),
    prisma.pipelineStage.findMany({
      where:   { clientId },
      orderBy: { position: "asc" },
      select:  { id: true, name: true, color: true },
    }),
    prisma.lead.findMany({
      where:   { clientId, consultant: session.name },
      select:  {
        id:              true,
        status:          true,
        capturedAt:      true,
        pipelineStageId: true,
        pipelineStage:   { select: { id: true, name: true, color: true } },
        customer:        { select: { name: true, phone: true } },
        sales:           { select: { value: true, soldAt: true }, orderBy: { soldAt: "desc" } },
      },
      orderBy: { capturedAt: "desc" },
    }),
  ]);

  const goal = consultantUser?.goal as ConsultantGoal | null;

  // ── KPIs gerais ───────────────────────────────────────────────────────────
  const totalLeads    = allLeads.length;
  const soldLeads     = allLeads.filter(l => l.status === "SOLD");
  const totalSales    = soldLeads.length;
  const totalRevenue  = soldLeads.reduce((s, l) => s + l.sales.reduce((a, v) => a + Number(v.value), 0), 0);
  const convRate      = totalLeads > 0 ? Math.round((totalSales / totalLeads) * 100) : 0;

  // ── KPIs do período (para comparar com meta) ──────────────────────────────
  const start = goal ? periodStart(goal.period) : null;
  const periodSales = start
    ? allLeads.filter(l => l.sales.some(s => new Date(s.soldAt) >= start!))
    : [];
  const periodSalesCount   = periodSales.length;
  const periodRevenue      = periodSales.reduce((s, l) => {
    return s + l.sales.filter(sa => new Date(sa.soldAt) >= start!).reduce((a, v) => a + Number(v.value), 0);
  }, 0);

  // ── Progresso da meta principal ───────────────────────────────────────────
  const primaryActual  = goal?.primaryKpi === "REVENUE" ? periodRevenue : periodSalesCount;
  const primaryTarget  = goal?.primaryTarget ?? 0;
  const primaryPct     = primaryTarget > 0 ? Math.min(100, Math.round((primaryActual / primaryTarget) * 100)) : 0;

  // ── Leads por etapa (KPIs secundárias) ───────────────────────────────────
  const activeLeads    = allLeads.filter(l => l.status === "NEW" || l.status === "REGISTERED");
  const leadsByStage   = pipelineStages.map(stage => ({
    ...stage,
    count:  activeLeads.filter(l => l.pipelineStageId === stage.id).length,
    target: goal?.stageTargets.find(t => t.stageId === stage.id)?.target ?? 0,
  }));

  const recentLeads = allLeads.slice(0, 5);

  return (
    <div className="min-h-screen bg-[var(--bg)]">
      {/* Header */}
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-[var(--border)] bg-[var(--surface)] px-4 py-3 sm:px-6">
        <div>
          <p className="text-xs text-[var(--text-muted)]">Portal CRM</p>
          <p className="text-sm font-semibold text-[var(--text)]">Olá, {session.name}</p>
        </div>
        <form action={consultantLogoutAction}>
          <button type="submit" className="flex items-center gap-2 rounded-xl border border-[var(--border)] px-3 py-1.5 text-xs text-[var(--text-muted)] hover:text-[var(--danger)] hover:border-[var(--danger)] transition-colors">
            <LogOut size={13} /> Sair
          </button>
        </form>
      </header>

      <main className="mx-auto max-w-2xl px-3 py-4 sm:px-6 sm:py-6 space-y-5">

        {/* ── Meta principal ─────────────────────────────────────────────── */}
        {goal && primaryTarget > 0 && (
          <div className="card p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Target size={16} className="text-[var(--accent)]" />
                <p className="text-sm font-semibold text-[var(--text)]">
                  Meta {goal.period === "WEEKLY" ? "semanal" : "mensal"}
                </p>
              </div>
              <span className={`text-sm font-bold tabular-nums ${
                primaryPct >= 100 ? "text-[var(--success)]" : "text-[var(--accent)]"
              }`}>{primaryPct}%</span>
            </div>

            {/* Barra de progresso */}
            <div className="h-3 w-full rounded-full bg-[var(--surface-muted)] overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${primaryPct >= 100 ? "bg-[var(--success)]" : "bg-[var(--accent)]"}`}
                style={{ width: `${primaryPct}%` }}
              />
            </div>

            <div className="flex items-center justify-between text-xs text-[var(--text-muted)]">
              <span>
                {goal.primaryKpi === "REVENUE"
                  ? `${brl(periodRevenue)} de ${brl(primaryTarget)}`
                  : `${periodSalesCount} de ${primaryTarget} vendas`}
              </span>
              <span>{periodLabel(goal.period)}</span>
            </div>
          </div>
        )}

        {/* ── KPI cards ──────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: "Leads totais",     value: totalLeads,              icon: Users,        color: "var(--accent)"  },
            { label: "Vendas fechadas",  value: totalSales,              icon: CheckCircle2, color: "var(--success)" },
            { label: "Receita gerada",   value: brl(totalRevenue),       icon: DollarSign,   color: "var(--success)" },
            { label: "Tx. conversão",    value: `${convRate}%`,          icon: TrendingUp,   color: "var(--warning)" },
          ].map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="card p-4 space-y-2">
              <div className="flex items-center gap-2">
                <Icon size={15} style={{ color }} />
                <p className="text-xs text-[var(--text-muted)] leading-tight">{label}</p>
              </div>
              <p className="text-xl font-bold text-[var(--text)] tabular-nums">{value}</p>
            </div>
          ))}
        </div>

        {/* ── Pipeline / KPIs secundárias ────────────────────────────────── */}
        {leadsByStage.length > 0 && (
          <div className="card p-5 space-y-3">
            <p className="text-sm font-semibold text-[var(--text)]">Pipeline — leads ativas</p>
            <div className="space-y-3">
              {leadsByStage.map(stage => {
                const pct = stage.target > 0 ? Math.min(100, Math.round((stage.count / stage.target) * 100)) : null;
                return (
                  <div key={stage.id} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: stage.color }} />
                        <span className="text-[var(--text)]">{stage.name}</span>
                      </div>
                      <div className="flex items-center gap-2 tabular-nums">
                        <span className="font-semibold text-[var(--text)]">{stage.count}</span>
                        {stage.target > 0 && (
                          <span className="text-[var(--text-muted)]">/ {stage.target}</span>
                        )}
                      </div>
                    </div>
                    {pct !== null && (
                      <div className="h-1.5 w-full rounded-full bg-[var(--surface-muted)] overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${pct}%`,
                            backgroundColor: pct >= 100 ? "var(--success)" : stage.color,
                          }}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Leads recentes ─────────────────────────────────────────────── */}
        {recentLeads.length > 0 && (
          <div className="card p-5 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-[var(--text)]">Leads recentes</p>
              <Link href="/consultor" className="text-xs text-[var(--accent)] hover:underline">Ver todas</Link>
            </div>
            <div className="space-y-2">
              {recentLeads.map(lead => (
                <Link
                  key={lead.id}
                  href={`/consultor/leads/${lead.id}`}
                  className="flex items-center justify-between rounded-xl border border-[var(--border)] px-3 py-2.5 hover:border-[var(--accent)] transition-colors"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-[var(--text)] truncate">{lead.customer.name}</p>
                    <p className="text-xs text-[var(--text-muted)]">{lead.customer.phone}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 ml-3">
                    {lead.pipelineStage && (
                      <span className="text-[10px] font-semibold rounded-full px-2 py-0.5"
                        style={{ backgroundColor: `${lead.pipelineStage.color}22`, color: lead.pipelineStage.color }}>
                        {lead.pipelineStage.name}
                      </span>
                    )}
                    <span className={`text-[10px] font-semibold rounded-full px-2 py-0.5 ${
                      lead.status === "SOLD" ? "bg-[var(--success-soft)] text-[var(--success)]" :
                      lead.status === "LOST" ? "bg-[var(--danger-soft)] text-[var(--danger)]" :
                      "bg-[var(--surface-muted)] text-[var(--text-muted)]"
                    }`}>
                      {lead.status === "SOLD" ? "Vendida" : lead.status === "LOST" ? "Perdida" : "Nova"}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {totalLeads === 0 && (
          <div className="card p-12 flex flex-col items-center gap-3 text-center">
            <Users size={32} className="text-[var(--text-muted)]" />
            <p className="font-semibold text-[var(--text)]">Nenhuma lead atribuída ainda</p>
            <p className="text-sm text-[var(--text-muted)]">Suas leads aparecerão aqui quando forem atribuídas a você.</p>
          </div>
        )}
      </main>
    </div>
  );
}
