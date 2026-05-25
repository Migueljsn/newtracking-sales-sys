import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import Link from "next/link";
import { AlertTriangle, UserX, Clock, Zap } from "lucide-react";

export async function DashboardAlerts() {
  const session  = await getSession();
  const clientId = session.clientId!;

  const thirtyDaysAgo = new Date(Date.now() - 30 * 86_400_000);
  const todayStart    = new Date(); todayStart.setHours(0, 0, 0, 0);

  const [noConsultant, stagnant, newToday] = await Promise.all([
    prisma.lead.count({
      where: {
        clientId,
        status:     { in: ["NEW", "REGISTERED"] },
        consultant: null,
      },
    }),
    prisma.lead.count({
      where: {
        clientId,
        status:          { in: ["NEW", "REGISTERED"] },
        pipelineStageId: { not: null },
        updatedAt:       { lt: thirtyDaysAgo },
      },
    }),
    prisma.lead.count({
      where: { clientId, capturedAt: { gte: todayStart } },
    }),
  ]);

  if (noConsultant === 0 && stagnant === 0 && newToday === 0) return null;

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 no-print">
      {newToday > 0 && (
        <Link
          href="/leads"
          className="flex items-center gap-3 rounded-2xl border border-[var(--accent)] bg-[var(--accent-soft)] px-4 py-3 transition-colors hover:bg-[var(--accent)] hover:text-white group"
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--accent)] text-white group-hover:bg-white group-hover:text-[var(--accent)] transition-colors">
            <Zap size={16} />
          </div>
          <div>
            <p className="text-lg font-bold tabular-nums text-[var(--accent)] group-hover:text-white leading-none">
              {newToday}
            </p>
            <p className="text-xs text-[var(--accent)] group-hover:text-white opacity-80">
              lead{newToday !== 1 ? "s" : ""} captada{newToday !== 1 ? "s" : ""} hoje
            </p>
          </div>
        </Link>
      )}

      {noConsultant > 0 && (
        <Link
          href="/leads"
          className="flex items-center gap-3 rounded-2xl border border-[var(--warning)] bg-[var(--warning-soft)] px-4 py-3 transition-colors hover:border-[var(--warning)] hover:brightness-95 group"
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--warning-soft)] border border-[var(--warning)] text-[var(--warning)]">
            <UserX size={16} />
          </div>
          <div>
            <p className="text-lg font-bold tabular-nums text-[var(--warning)] leading-none">
              {noConsultant}
            </p>
            <p className="text-xs text-[var(--warning)] opacity-80">
              sem consultor atribuído
            </p>
          </div>
        </Link>
      )}

      {stagnant > 0 && (
        <Link
          href="/leads"
          className="flex items-center gap-3 rounded-2xl border border-[var(--danger)] bg-[var(--danger-soft)] px-4 py-3 transition-colors hover:brightness-95 group"
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--danger-soft)] border border-[var(--danger)] text-[var(--danger)]">
            <Clock size={16} />
          </div>
          <div>
            <p className="text-lg font-bold tabular-nums text-[var(--danger)] leading-none">
              {stagnant}
            </p>
            <p className="text-xs text-[var(--danger)] opacity-80">
              paradas no pipeline +30 dias
            </p>
          </div>
        </Link>
      )}
    </div>
  );
}
