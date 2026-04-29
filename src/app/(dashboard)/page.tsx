export const dynamic = "force-dynamic";

import { AlertCircle, Clock, TrendingUp, Users } from "lucide-react";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";

export default async function DashboardPage() {
  const session = await getSession();
  const clientId = session.clientId!;

  const [totalLeads, totalSales, pendingEvents, failedEvents] = await Promise.all([
    prisma.lead.count({ where: { clientId } }),
    prisma.sale.count({ where: { clientId } }),
    prisma.trackingEvent.count({ where: { clientId, status: "PENDING" } }),
    prisma.trackingEvent.count({ where: { clientId, status: "FAILED" } }),
  ]);

  const cards = [
    {
      label: "Total de leads",
      value: totalLeads,
      icon: Users,
      iconBg: "var(--accent-soft)",
      iconColor: "var(--accent)",
      valueColor: "var(--accent)",
    },
    {
      label: "Vendas realizadas",
      value: totalSales,
      icon: TrendingUp,
      iconBg: "var(--success-soft)",
      iconColor: "var(--success)",
      valueColor: "var(--success)",
    },
    {
      label: "Eventos pendentes",
      value: pendingEvents,
      icon: Clock,
      iconBg: "var(--warning-soft)",
      iconColor: "var(--warning)",
      valueColor: "var(--warning)",
    },
    {
      label: "Eventos com falha",
      value: failedEvents,
      icon: AlertCircle,
      iconBg: "var(--danger-soft)",
      iconColor: "var(--danger)",
      valueColor: "var(--danger)",
    },
  ];

  return (
    <div className="space-y-6 animate-fade-in">

      {/* Header */}
      <div className="space-y-1 animate-slide-up">
        <p className="text-xs font-semibold uppercase tracking-[0.26em] text-[var(--text-muted)]">Dashboard</p>
        <h1 className="text-2xl font-semibold text-[var(--text)] sm:text-3xl">Visão geral</h1>
      </div>

      {/* KPI cards */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card, i) => {
          const Icon = card.icon;
          return (
            <div
              key={card.label}
              className="stat-card animate-slide-up"
              style={{ animationDelay: `${i * 80}ms` }}
            >
              <div className="flex items-start justify-between gap-3">
                <div
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-transform duration-200 group-hover:scale-110"
                  style={{ background: card.iconBg, color: card.iconColor }}
                >
                  <Icon size={18} />
                </div>
                <p
                  className="text-3xl font-bold tabular-nums leading-none"
                  style={{ color: card.valueColor }}
                >
                  {card.value}
                </p>
              </div>
              <p className="mt-3 text-sm font-medium text-[var(--text-muted)]">{card.label}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
