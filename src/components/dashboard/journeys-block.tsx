import Link from "next/link";
import { Zap, TrendingUp, DollarSign, Users } from "lucide-react";
import { getSession } from "@/lib/auth/session";
import { fetchAllJourneysSummary } from "@/lib/queries/journey-metrics";

export async function JourneysBlock() {
  const session  = await getSession();
  const clientId = session.clientId!;

  const summaries = await fetchAllJourneysSummary(clientId);
  const active    = summaries.filter(s => s.status === "ACTIVE");

  if (active.length === 0) return null;

  const totalRevenue  = active.reduce((s, j) => s + j.attributedRevenue, 0);
  const totalEnrolled = active.reduce((s, j) => s + j.enrolled, 0);

  return (
    <div className="card p-5 no-print">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--accent-soft)]">
            <Zap size={14} className="text-[var(--accent)]" />
          </div>
          <h2 className="text-sm font-semibold text-[var(--text)]">Jornadas ativas</h2>
          <span className="rounded-full bg-[var(--accent-soft)] px-2 py-0.5 text-[10px] font-semibold text-[var(--accent)]">
            {active.length}
          </span>
        </div>
        <Link
          href="/journeys"
          className="text-xs font-medium text-[var(--accent)] hover:text-[var(--accent-strong)] transition-colors"
        >
          Ver todas →
        </Link>
      </div>

      {/* KPI row */}
      <div className="mb-4 grid grid-cols-3 gap-3">
        <div className="rounded-xl bg-[var(--surface-muted)] border border-[var(--border)] px-3 py-2.5">
          <div className="flex items-center gap-1 text-[10px] text-[var(--text-muted)] mb-0.5">
            <Users size={10} />
            Leads inscritas
          </div>
          <p className="text-base font-bold text-[var(--text)]">{totalEnrolled}</p>
        </div>
        <div className="rounded-xl bg-[var(--surface-muted)] border border-[var(--border)] px-3 py-2.5">
          <div className="flex items-center gap-1 text-[10px] text-[var(--text-muted)] mb-0.5">
            <TrendingUp size={10} />
            Convertidas
          </div>
          <p className="text-base font-bold text-[var(--success)]">
            {active.reduce((s, j) => s + j.completed, 0)}
          </p>
        </div>
        <div className="rounded-xl bg-[var(--surface-muted)] border border-[var(--border)] px-3 py-2.5">
          <div className="flex items-center gap-1 text-[10px] text-[var(--text-muted)] mb-0.5">
            <DollarSign size={10} />
            Receita atribuída
          </div>
          <p className="text-base font-bold text-[#10b981]">
            {totalRevenue.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 })}
          </p>
        </div>
      </div>

      {/* Journey rows */}
      <div className="space-y-2">
        {active.map(j => (
          <div key={j.journeyId} className="flex items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-2.5 text-xs">
            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-[var(--accent-soft)]">
              <Zap size={11} className="text-[var(--accent)]" />
            </div>

            <span className="flex-1 font-medium text-[var(--text)] truncate">{j.journeyName}</span>

            <div className="flex items-center gap-3 shrink-0 text-[var(--text-muted)] tabular-nums">
              <span>{j.enrolled} inscrita{j.enrolled !== 1 ? "s" : ""}</span>

              {j.conversionRate > 0 && (
                <span className="font-semibold text-[var(--warning)]">
                  {j.conversionRate}% conversão
                </span>
              )}

              {j.attributedRevenue > 0 && (
                <span className="font-semibold text-[#10b981]">
                  {j.attributedRevenue.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 })}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
