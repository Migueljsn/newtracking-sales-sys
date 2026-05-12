"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Search, Users } from "lucide-react";
import { LeadStatusBadge } from "./lead-status-badge";
import { WhatsAppButton } from "./whatsapp-button";
import type { LeadStatus, LeadSource } from "@prisma/client";

interface Lead {
  id: string;
  status: LeadStatus;
  source: LeadSource;
  capturedAt: string;
  customer: {
    name:     string;
    phone:    string;
    email:    string | null;
    document: string | null;
    state:    string | null;
    city:     string | null;
  };
}

const PAGE_SIZE = 50;

const sourceLabel: Record<LeadSource, string> = {
  FORM:   "Formulário",
  MANUAL: "Manual",
  IMPORT: "Importação",
};

const statusTabs: { value: LeadStatus | "ALL"; label: string }[] = [
  { value: "ALL",        label: "Todas"      },
  { value: "NEW",        label: "Novas"      },
  { value: "REGISTERED", label: "Cadastradas"},
  { value: "SOLD",       label: "Vendidas"   },
  { value: "LOST",       label: "Perdidas"   },
];

interface LeadsTableProps {
  whatsappTemplate?: string | null;
}

export function LeadsTable({ whatsappTemplate }: LeadsTableProps) {
  const { data: leads = [] } = useQuery<Lead[]>({
    queryKey:       ["leads"],
    queryFn:        () => fetch("/api/leads").then((r) => r.json()),
    refetchInterval: 30_000,
  });

  const [search, setSearch]             = useState("");
  const [statusFilter, setStatusFilter] = useState<LeadStatus | "ALL">("ALL");
  const [page, setPage]                 = useState(0);

  // Reset page when filters change
  const resetPage = () => setPage(0);

  const counts: Record<LeadStatus | "ALL", number> = {
    ALL:        leads.length,
    NEW:        leads.filter((l) => l.status === "NEW").length,
    REGISTERED: leads.filter((l) => l.status === "REGISTERED").length,
    SOLD:       leads.filter((l) => l.status === "SOLD").length,
    LOST:       leads.filter((l) => l.status === "LOST").length,
  };

  const filtered = leads.filter((lead) => {
    const q = search.toLowerCase();
    const matchSearch =
      !q ||
      lead.customer.name.toLowerCase().includes(q) ||
      lead.customer.phone.includes(q) ||
      lead.customer.document?.includes(q) ||
      lead.customer.email?.toLowerCase().includes(q);

    const matchStatus = statusFilter === "ALL" || lead.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage   = Math.min(page, totalPages - 1);
  const paginated  = filtered.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE);

  return (
    <div className="space-y-4">

      {/* Filters row */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="relative flex-1">
          <Search
            size={15}
            className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none"
          />
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); resetPage(); }}
            placeholder="Buscar por nome, telefone ou CPF/CNPJ..."
            className="input w-full"
            style={{ paddingLeft: "3rem" }}
          />
        </div>

        <div className="soft-panel flex flex-wrap gap-1 p-1.5">
          {statusTabs.map((tab) => {
            const active = statusFilter === tab.value;
            return (
              <button
                key={tab.value}
                onClick={() => { setStatusFilter(tab.value); resetPage(); }}
                className={`flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold transition-all duration-150 ${
                  active
                    ? "bg-[var(--surface-strong)] text-[var(--text)] shadow-sm"
                    : "text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--surface-strong)]/50"
                }`}
              >
                {tab.label}
                <span
                  className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold tabular-nums transition-colors ${
                    active
                      ? "bg-[var(--accent-soft)] text-[var(--accent)]"
                      : "bg-[var(--border)] text-[var(--text-muted)]"
                  }`}
                >
                  {counts[tab.value]}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Table */}
      <div className="table-shell">
        {paginated.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--surface-muted)] text-[var(--text-muted)]">
              {search || statusFilter !== "ALL" ? <Search size={22} /> : <Users size={22} />}
            </div>
            <p className="text-sm font-semibold text-[var(--text)]">
              {search || statusFilter !== "ALL" ? "Nenhuma lead encontrada" : "Nenhuma lead cadastrada"}
            </p>
            <p className="mt-1 text-xs text-[var(--text-muted)]">
              {search || statusFilter !== "ALL"
                ? "Tente ajustar os filtros ou o termo buscado"
                : "Use o botão acima para cadastrar a primeira lead"}
            </p>
          </div>
        ) : (
          <div className="table-scroll">
            <table className="w-full text-sm">
              <thead className="bg-[var(--surface-muted)]">
                <tr className="border-b border-[var(--border)]">
                  {["Nome", "Telefone", "Email / CPF", "Status", "Origem", "Capturada em"].map((h) => (
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
                {paginated.map((lead) => (
                  <tr
                    key={lead.id}
                    className="transition-colors duration-100 hover:bg-[var(--surface-muted)]"
                  >
                    <td className="px-4 py-3.5">
                      <div className="max-w-[220px]">
                        <Link
                          href={`/leads/${lead.id}`}
                          className="block truncate font-semibold text-[var(--text)] hover:text-[var(--accent)] transition-colors"
                          title={lead.customer.name}
                        >
                          {lead.customer.name}
                        </Link>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-[var(--text-muted)]">{lead.customer.phone}</td>
                    <td className="px-4 py-3.5 text-[var(--text-muted)]">
                      <div className="max-w-[240px]">
                        <p className="truncate" title={lead.customer.email || lead.customer.document || "—"}>
                          {lead.customer.email || lead.customer.document || "—"}
                        </p>
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      <LeadStatusBadge status={lead.status} />
                    </td>
                    <td className="px-4 py-3.5 text-[var(--text-muted)]">{sourceLabel[lead.source]}</td>
                    <td className="px-4 py-3.5 text-[var(--text-muted)]">
                      {new Date(lead.capturedAt).toLocaleDateString("pt-BR")}
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-2">
                        <WhatsAppButton
                          phone={lead.customer.phone}
                          name={lead.customer.name}
                          state={lead.customer.state}
                          city={lead.customer.city}
                          template={whatsappTemplate}
                          variant="icon"
                        />
                        <Link
                          href={`/leads/${lead.id}`}
                          className="link-accent inline-flex items-center gap-1 text-xs"
                        >
                          Ver <ChevronRight size={13} />
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Footer com paginação */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-[var(--text-muted)]">
          {filtered.length === 0
            ? "0 leads"
            : `${safePage * PAGE_SIZE + 1}–${Math.min((safePage + 1) * PAGE_SIZE, filtered.length)} de ${filtered.length} leads`}
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
