"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import type { TrackingEventStatus } from "@prisma/client";

interface Sale {
  id: string;
  value: unknown;
  soldAt: string;
  isRepeatPurchase: boolean;
  leadId: string;
  customer: { name: string; phone: string; document: string | null };
  lead: { utmCampaign: string | null; utmSource: string | null };
  trackingEvents: { status: TrackingEventStatus }[];
}

const PAGE_SIZE = 50;

const trackingColor: Record<TrackingEventStatus, string> = {
  PENDING: "bg-[var(--warning-soft)] text-[var(--warning)]",
  SUCCESS: "bg-[var(--success-soft)] text-[var(--success)]",
  FAILED:  "bg-[var(--danger-soft)] text-[var(--danger)]",
  SKIPPED: "bg-[var(--surface-muted)] text-[var(--text-muted)]",
};

const trackingLabel: Record<TrackingEventStatus, string> = {
  PENDING: "Pendente",
  SUCCESS: "Enviado",
  FAILED:  "Falhou",
  SKIPPED: "Ignorado",
};

export function SalesTable() {
  const { data: sales = [] } = useQuery<Sale[]>({
    queryKey: ["sales"],
    queryFn:  () => fetch("/api/sales").then((r) => r.json()),
  });

  const [search, setSearch] = useState("");
  const [page, setPage]     = useState(0);

  const totalRevenue = sales.reduce((acc, s) => acc + Number(s.value), 0);
  const repeatCount  = sales.filter((s) => s.isRepeatPurchase).length;

  const filtered = sales.filter((s) => {
    const q = search.toLowerCase();
    return (
      !q ||
      s.customer.name.toLowerCase().includes(q) ||
      s.customer.phone.includes(q) ||
      s.customer.document?.includes(q) ||
      s.lead.utmCampaign?.toLowerCase().includes(q)
    );
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage   = Math.min(page, totalPages - 1);
  const paginated  = filtered.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE);

  const resetPage = () => setPage(0);

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <div className="card p-5">
          <p className="text-xs text-[var(--text-muted)] uppercase tracking-wider mb-1">Receita total</p>
          <p className="text-2xl font-bold text-[var(--success)]">
            {totalRevenue.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
          </p>
        </div>
        <div className="card p-5">
          <p className="text-xs text-[var(--text-muted)] uppercase tracking-wider mb-1">Total de vendas</p>
          <p className="text-2xl font-bold text-[var(--text)]">{sales.length}</p>
        </div>
        <div className="card p-5">
          <p className="text-xs text-[var(--text-muted)] uppercase tracking-wider mb-1">Recompras</p>
          <p className="text-2xl font-bold text-[var(--text)]">
            {repeatCount}
            <span className="text-sm font-normal text-[var(--text-muted)] ml-1">
              ({sales.length > 0 ? Math.round((repeatCount / sales.length) * 100) : 0}%)
            </span>
          </p>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search
          size={15}
          className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-muted)]"
        />
        <input
          value={search}
          onChange={(e) => { setSearch(e.target.value); resetPage(); }}
          placeholder="Buscar por nome, telefone ou CPF..."
          className="input w-full"
          style={{ paddingLeft: "3rem" }}
        />
      </div>

      <div className="table-shell">
        {paginated.length === 0 ? (
          <div className="py-16 text-center text-[var(--text-muted)] text-sm">
            {search ? "Nenhuma venda encontrada." : "Nenhuma venda registrada ainda."}
          </div>
        ) : (
          <div className="table-scroll">
            <table className="w-full text-sm">
              <thead className="bg-[var(--surface-muted)]">
                <tr className="border-b border-[var(--border)]">
                  {["Cliente", "Valor", "Campanha", "Recompra", "Tracking", "Data"].map((h) => (
                    <th
                      key={h}
                      className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]"
                    >
                      {h}
                    </th>
                  ))}
                  <th />
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {paginated.map((sale) => {
                  const tracking = sale.trackingEvents[0];
                  return (
                    <tr key={sale.id} className="hover:bg-[var(--surface-muted)]">
                      <td className="px-4 py-3">
                        <div className="max-w-[240px]">
                          <Link
                            href={`/leads/${sale.leadId}`}
                            className="block truncate font-semibold text-[var(--text)] hover:text-[var(--accent)]"
                            title={sale.customer.name}
                          >
                            {sale.customer.name}
                          </Link>
                          <p className="truncate text-xs text-[var(--text-muted)]">{sale.customer.phone}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3 font-semibold text-[var(--success)]">
                        {Number(sale.value).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                      </td>
                      <td className="px-4 py-3 text-xs text-[var(--text-muted)]">
                        <div
                          className="max-w-[220px] truncate"
                          title={sale.lead.utmCampaign || sale.lead.utmSource || "—"}
                        >
                          {sale.lead.utmCampaign || sale.lead.utmSource || "—"}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-semibold ${sale.isRepeatPurchase ? "text-[var(--accent)]" : "text-[var(--text-muted)]"}`}>
                          {sale.isRepeatPurchase ? "Sim" : "Não"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {tracking ? (
                          <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${trackingColor[tracking.status]}`}>
                            {trackingLabel[tracking.status]}
                          </span>
                        ) : (
                          <span className="text-xs text-[var(--text-muted)]">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-[var(--text-muted)]">
                        {new Date(sale.soldAt).toLocaleDateString("pt-BR")}
                      </td>
                      <td className="px-4 py-3">
                        <Link
                          href={`/leads/${sale.leadId}`}
                          className="link-accent inline-flex items-center gap-1 text-xs"
                        >
                          Lead <ChevronRight size={14} />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Paginação */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-[var(--text-muted)]">
          {filtered.length === 0
            ? "0 vendas"
            : `${safePage * PAGE_SIZE + 1}–${Math.min((safePage + 1) * PAGE_SIZE, filtered.length)} de ${filtered.length} vendas`}
        </p>

        {totalPages > 1 && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={safePage === 0}
              className="flex h-8 w-8 items-center justify-center rounded-xl border border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text)] disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ChevronLeft size={15} />
            </button>
            <span className="text-xs text-[var(--text-muted)]">
              {safePage + 1} / {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={safePage === totalPages - 1}
              className="flex h-8 w-8 items-center justify-center rounded-xl border border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text)] disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ChevronRight size={15} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
