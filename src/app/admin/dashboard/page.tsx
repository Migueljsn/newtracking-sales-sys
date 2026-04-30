export const dynamic = "force-dynamic";

import { getAdminSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { DashboardFilters } from "@/components/admin/dashboard-filters";
import { BarChart2, ShoppingBag, TrendingUp, Users } from "lucide-react";

function toDateInput(d: Date) {
  return d.toISOString().split("T")[0];
}

export default async function AdminDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  await getAdminSession();

  const { from, to } = await searchParams;

  const defaultTo   = toDateInput(new Date());
  const defaultFrom = toDateInput(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000));

  const dateFrom = new Date(from ?? defaultFrom);
  const dateTo   = new Date(to   ?? defaultTo);
  dateTo.setHours(23, 59, 59, 999);

  const [clients, salesData, leadsByClient] = await Promise.all([
    prisma.client.findMany({
      select: { id: true, name: true, isActive: true },
      orderBy: { name: "asc" },
    }),

    prisma.sale.groupBy({
      by: ["clientId"],
      _count: { id: true },
      _sum:   { value: true },
      where:  { soldAt: { gte: dateFrom, lte: dateTo } },
    }),

    prisma.lead.groupBy({
      by: ["clientId"],
      _count: { id: true },
      where:  { capturedAt: { gte: dateFrom, lte: dateTo } },
    }),
  ]);

  const salesMap = new Map(salesData.map((s) => [s.clientId, s]));
  const leadsMap = new Map(leadsByClient.map((l) => [l.clientId, l._count.id]));

  const rows = clients.map((c) => {
    const s       = salesMap.get(c.id);
    const leads   = leadsMap.get(c.id) ?? 0;
    const sales   = s?._count.id ?? 0;
    const revenue = Number(s?._sum.value ?? 0);
    return { ...c, leads, sales, revenue };
  });

  const totalLeads   = rows.reduce((acc, r) => acc + r.leads, 0);
  const totalSales   = rows.reduce((acc, r) => acc + r.sales, 0);
  const totalRevenue = rows.reduce((acc, r) => acc + r.revenue, 0);

  const sorted = [...rows].sort((a, b) => b.revenue - a.revenue);

  const summaryCards = [
    { label: "Clientes ativos", value: clients.filter((c) => c.isActive).length, icon: Users,       color: "var(--accent)",   bg: "var(--accent-soft)"  },
    { label: "Total de leads",  value: totalLeads,   icon: BarChart2,  color: "var(--warning)",  bg: "var(--warning-soft)" },
    { label: "Total de vendas", value: totalSales,   icon: ShoppingBag,color: "var(--success)",  bg: "var(--success-soft)" },
    {
      label: "Receita total",
      value: totalRevenue.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }),
      icon: TrendingUp,
      color: "var(--success)",
      bg: "var(--success-soft)",
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.26em] text-[var(--text-muted)]">Admin</p>
        <h1 className="text-2xl font-semibold text-[var(--text)]">Dashboard geral</h1>
      </div>

      <DashboardFilters defaultFrom={defaultFrom} defaultTo={defaultTo} />

      {/* Summary cards */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {summaryCards.map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.label} className="stat-card">
              <div className="flex items-start justify-between gap-3">
                <div
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                  style={{ background: card.bg, color: card.color }}
                >
                  <Icon size={18} />
                </div>
                <p className="text-2xl font-bold tabular-nums leading-none" style={{ color: card.color }}>
                  {card.value}
                </p>
              </div>
              <p className="mt-3 text-sm font-medium text-[var(--text-muted)]">{card.label}</p>
            </div>
          );
        })}
      </div>

      {/* Per-client breakdown */}
      <div className="table-shell">
        <div className="border-b border-[var(--border)] px-4 py-3">
          <h2 className="text-sm font-semibold text-[var(--text)]">Desempenho por cliente</h2>
        </div>
        {sorted.length === 0 ? (
          <div className="flex items-center justify-center py-16 text-sm text-[var(--text-muted)]">
            Nenhuma movimentação no período selecionado.
          </div>
        ) : (
          <div className="table-scroll">
            <table className="w-full text-sm">
              <thead className="bg-[var(--surface-muted)]">
                <tr className="border-b border-[var(--border)]">
                  {["Cliente", "Leads", "Vendas", "Receita", "% da receita total"].map((h) => (
                    <th
                      key={h}
                      className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {sorted.map((row) => {
                  const pct = totalRevenue > 0 ? (row.revenue / totalRevenue) * 100 : 0;
                  return (
                    <tr key={row.id} className="transition-colors hover:bg-[var(--surface-muted)]">
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-[var(--text)]">{row.name}</p>
                          {!row.isActive && (
                            <span className="rounded-full bg-[var(--danger-soft)] px-2 py-0.5 text-[10px] font-semibold text-[var(--danger)]">
                              Inativo
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3.5 tabular-nums text-[var(--text-muted)]">{row.leads}</td>
                      <td className="px-4 py-3.5 tabular-nums text-[var(--text-muted)]">{row.sales}</td>
                      <td className="px-4 py-3.5 tabular-nums font-medium text-[var(--text)]">
                        {row.revenue.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                      </td>
                      <td className="px-4 py-3.5 w-48">
                        <div className="flex items-center gap-2">
                          <div className="h-2 flex-1 overflow-hidden rounded-full bg-[var(--border)]">
                            <div
                              className="h-full rounded-full bg-[var(--accent)] transition-all duration-500"
                              style={{ width: `${pct.toFixed(1)}%` }}
                            />
                          </div>
                          <span className="w-10 text-right text-xs tabular-nums text-[var(--text-muted)]">
                            {pct.toFixed(1)}%
                          </span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              {totalRevenue > 0 && (
                <tfoot className="bg-[var(--surface-muted)]">
                  <tr className="border-t-2 border-[var(--border)]">
                    <td className="px-4 py-3 text-xs font-bold uppercase tracking-wide text-[var(--text-muted)]">
                      Total
                    </td>
                    <td className="px-4 py-3 tabular-nums font-semibold text-[var(--text)]">{totalLeads}</td>
                    <td className="px-4 py-3 tabular-nums font-semibold text-[var(--text)]">{totalSales}</td>
                    <td className="px-4 py-3 tabular-nums font-bold text-[var(--success)]">
                      {totalRevenue.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                    </td>
                    <td />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
