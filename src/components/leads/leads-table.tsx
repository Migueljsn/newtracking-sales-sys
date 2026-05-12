"use client";

import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import {
  ChevronLeft, ChevronRight, Search, Users,
  Download, SlidersHorizontal, X, Check,
} from "lucide-react";
import { LeadStatusBadge } from "./lead-status-badge";
import { WhatsAppButton } from "./whatsapp-button";
import type { LeadStatus, LeadSource } from "@prisma/client";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Lead {
  id:         string;
  status:     LeadStatus;
  source:     LeadSource;
  capturedAt: string;
  updatedAt:  string;
  consultant: string | null;
  sale:       { soldAt: string } | null;
  customer: {
    name:     string;
    phone:    string;
    email:    string | null;
    document: string | null;
    state:    string | null;
    city:     string | null;
  };
}

// ─── Column definitions ───────────────────────────────────────────────────────

type ColumnKey = "phone" | "emailDoc" | "status" | "state" | "consultant" | "source" | "capturedAt" | "inactivity";

const COLUMNS: { key: ColumnKey; label: string; defaultOn: boolean }[] = [
  { key: "phone",      label: "Telefone",     defaultOn: true  },
  { key: "emailDoc",   label: "Email / CPF",  defaultOn: true  },
  { key: "status",     label: "Status",       defaultOn: true  },
  { key: "state",      label: "Estado",       defaultOn: false },
  { key: "consultant", label: "Consultor",    defaultOn: false },
  { key: "source",     label: "Origem",       defaultOn: true  },
  { key: "capturedAt", label: "Capturada em", defaultOn: true  },
  { key: "inactivity", label: "Dias inativo", defaultOn: false },
];

const COLUMNS_KEY  = "leads-columns-v1";
const PAGE_SIZE_KEY = "leads-page-size-v1";
const PAGE_SIZES    = [25, 50, 100];

function loadColumns(): Set<ColumnKey> {
  if (typeof window === "undefined") return new Set(COLUMNS.filter(c => c.defaultOn).map(c => c.key));
  try {
    const stored = localStorage.getItem(COLUMNS_KEY);
    if (stored) return new Set(JSON.parse(stored) as ColumnKey[]);
  } catch {}
  return new Set(COLUMNS.filter(c => c.defaultOn).map(c => c.key));
}

function loadPageSize(): number {
  if (typeof window === "undefined") return 50;
  try {
    const n = Number(localStorage.getItem(PAGE_SIZE_KEY));
    if (PAGE_SIZES.includes(n)) return n;
  } catch {}
  return 50;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const sourceLabel: Record<LeadSource, string> = {
  FORM:   "Formulário",
  MANUAL: "Manual",
  IMPORT: "Importação",
};

const statusTabs: { value: LeadStatus | "ALL"; label: string }[] = [
  { value: "ALL",        label: "Todas"       },
  { value: "NEW",        label: "Novas"       },
  { value: "REGISTERED", label: "Cadastradas" },
  { value: "SOLD",       label: "Vendidas"    },
  { value: "LOST",       label: "Perdidas"    },
];

const INACTIVITY_PRESETS = [7, 15, 30, 45];

const ESTADOS = ["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"];

function daysAgo(dateStr: string): number {
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86_400_000);
}

function getInactivityDays(lead: Lead): number {
  if (lead.status === "SOLD" && lead.sale?.soldAt) return daysAgo(lead.sale.soldAt);
  if (lead.status === "REGISTERED") return daysAgo(lead.updatedAt);
  return daysAgo(lead.capturedAt);
}

function getPageNumbers(current: number, total: number): (number | "...")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i);
  const result: (number | "...")[] = [];
  const rangeStart = Math.max(1, current - 1);
  const rangeEnd   = Math.min(total - 2, current + 1);
  result.push(0);
  if (rangeStart > 1) result.push("...");
  for (let i = rangeStart; i <= rangeEnd; i++) result.push(i);
  if (rangeEnd < total - 2) result.push("...");
  result.push(total - 1);
  return result;
}

// ─── CSV export ───────────────────────────────────────────────────────────────

function exportCSV(leads: Lead[], visibleCols: Set<ColumnKey>) {
  const headers = ["Nome", "Telefone"];
  if (visibleCols.has("emailDoc"))   headers.push("Email", "CPF/CNPJ");
  if (visibleCols.has("status"))     headers.push("Status");
  if (visibleCols.has("state"))      headers.push("Estado");
  if (visibleCols.has("consultant")) headers.push("Consultor");
  if (visibleCols.has("source"))     headers.push("Origem");
  if (visibleCols.has("capturedAt")) headers.push("Capturada em");
  if (visibleCols.has("inactivity")) headers.push("Dias inativo");

  const rows = leads.map((l) => {
    const cols = [l.customer.name, l.customer.phone];
    if (visibleCols.has("emailDoc"))   { cols.push(l.customer.email ?? "", l.customer.document ?? ""); }
    if (visibleCols.has("status"))     cols.push(l.status);
    if (visibleCols.has("state"))      cols.push(l.customer.state ?? "");
    if (visibleCols.has("consultant")) cols.push(l.consultant ?? "");
    if (visibleCols.has("source"))     cols.push(sourceLabel[l.source]);
    if (visibleCols.has("capturedAt")) cols.push(new Date(l.capturedAt).toLocaleDateString("pt-BR"));
    if (visibleCols.has("inactivity")) cols.push(String(getInactivityDays(l)));
    return cols.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",");
  });

  const csv  = [headers.join(","), ...rows].join("\n");
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href     = url;
  a.download = `leads-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Component ────────────────────────────────────────────────────────────────

interface LeadsTableProps {
  whatsappTemplate?: string | null;
}

export function LeadsTable({ whatsappTemplate }: LeadsTableProps) {
  const { data: leads = [], isLoading, isFetching } = useQuery<Lead[]>({
    queryKey:        ["leads"],
    queryFn:         () => fetch("/api/leads").then((r) => r.json()),
    refetchInterval: 30_000,
  });

  // Filters
  const [search,           setSearch]           = useState("");
  const [statusFilter,     setStatusFilter]     = useState<LeadStatus | "ALL">("ALL");
  const [stateFilter,      setStateFilter]      = useState<string>("ALL");
  const [consultantFilter, setConsultantFilter] = useState<string>("ALL");
  const [inactivityFilter, setInactivityFilter] = useState<number | null>(null);
  const [page,             setPage]             = useState(0);

  // Page size
  const [pageSize, setPageSize] = useState<number>(loadPageSize);

  // Columns
  const [visibleCols,   setVisibleCols]   = useState<Set<ColumnKey>>(() => loadColumns());
  const [colPanelOpen,  setColPanelOpen]  = useState(false);
  const colPanelRef = useRef<HTMLDivElement>(null);

  // Consultants list
  const [consultants, setConsultants] = useState<string[]>([]);

  const resetPage = () => setPage(0);

  useEffect(() => {
    fetch("/api/consultants")
      .then((r) => r.json())
      .then((d) => setConsultants(d.consultants ?? []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    localStorage.setItem(COLUMNS_KEY, JSON.stringify([...visibleCols]));
  }, [visibleCols]);

  useEffect(() => {
    localStorage.setItem(PAGE_SIZE_KEY, String(pageSize));
    resetPage();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageSize]);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (colPanelRef.current && !colPanelRef.current.contains(e.target as Node)) {
        setColPanelOpen(false);
      }
    }
    if (colPanelOpen) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [colPanelOpen]);

  function toggleCol(key: ColumnKey) {
    setVisibleCols((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }

  // Counts (always based on full list, not filtered)
  const counts: Record<LeadStatus | "ALL", number> = {
    ALL:        leads.length,
    NEW:        leads.filter((l) => l.status === "NEW").length,
    REGISTERED: leads.filter((l) => l.status === "REGISTERED").length,
    SOLD:       leads.filter((l) => l.status === "SOLD").length,
    LOST:       leads.filter((l) => l.status === "LOST").length,
  };

  // Filtered list
  const filtered = leads.filter((lead) => {
    const q = search.toLowerCase();
    const matchSearch =
      !q ||
      lead.customer.name.toLowerCase().includes(q) ||
      lead.customer.phone.includes(q) ||
      lead.customer.document?.includes(q) ||
      lead.customer.email?.toLowerCase().includes(q);

    const matchStatus     = statusFilter     === "ALL" || lead.status          === statusFilter;
    const matchState      = stateFilter      === "ALL" || lead.customer.state  === stateFilter;
    const matchConsultant = consultantFilter === "ALL" || lead.consultant       === consultantFilter;
    const matchInactivity = inactivityFilter === null  || getInactivityDays(lead) >= inactivityFilter;

    return matchSearch && matchStatus && matchState && matchConsultant && matchInactivity;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage   = Math.min(page, totalPages - 1);
  const paginated  = filtered.slice(safePage * pageSize, (safePage + 1) * pageSize);
  const pageNums   = getPageNumbers(safePage, totalPages);

  const hasActiveFilters = search !== "" || statusFilter !== "ALL" || stateFilter !== "ALL" || consultantFilter !== "ALL" || inactivityFilter !== null;

  function clearFilters() {
    setSearch("");
    setStatusFilter("ALL");
    setStateFilter("ALL");
    setConsultantFilter("ALL");
    setInactivityFilter(null);
    resetPage();
  }

  return (
    <div className="space-y-4">

      {/* Row 1: search + state + consultant + inactivity */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none" />
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); resetPage(); }}
            placeholder="Buscar por nome, telefone ou CPF/CNPJ..."
            className="input w-full"
            style={{ paddingLeft: "3rem" }}
          />
        </div>

        <select
          value={stateFilter}
          onChange={(e) => { setStateFilter(e.target.value); resetPage(); }}
          className="input w-full lg:w-28"
        >
          <option value="ALL">Estado</option>
          {ESTADOS.map((e) => <option key={e} value={e}>{e}</option>)}
        </select>

        {consultants.length > 0 && (
          <select
            value={consultantFilter}
            onChange={(e) => { setConsultantFilter(e.target.value); resetPage(); }}
            className="input w-full lg:w-36"
          >
            <option value="ALL">Consultor</option>
            {consultants.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        )}

        <div className="soft-panel flex items-center gap-1 p-1.5">
          <span className="px-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">Inativo há</span>
          {INACTIVITY_PRESETS.map((d) => {
            const active = inactivityFilter === d;
            return (
              <button
                key={d}
                onClick={() => { setInactivityFilter(active ? null : d); resetPage(); }}
                className={`rounded-xl px-2.5 py-1.5 text-xs font-semibold transition-all ${
                  active
                    ? "bg-[var(--surface-strong)] text-[var(--text)] shadow-sm"
                    : "text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--surface-strong)]/50"
                }`}
              >
                {d}d
              </button>
            );
          })}
        </div>
      </div>

      {/* Row 2: status tabs + column editor + export + clear */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="soft-panel flex flex-1 flex-wrap gap-1 p-1.5">
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
                <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold tabular-nums transition-colors ${
                  active ? "bg-[var(--accent-soft)] text-[var(--accent)]" : "bg-[var(--border)] text-[var(--text-muted)]"
                }`}>
                  {counts[tab.value]}
                </span>
              </button>
            );
          })}
        </div>

        {/* Column editor */}
        <div className="relative" ref={colPanelRef}>
          <button
            onClick={() => setColPanelOpen((v) => !v)}
            title="Editar colunas"
            className={`flex h-9 w-9 items-center justify-center rounded-xl border transition-colors ${
              colPanelOpen
                ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]"
                : "border-[var(--border)] bg-[var(--surface-muted)] text-[var(--text-muted)] hover:text-[var(--text)]"
            }`}
          >
            <SlidersHorizontal size={15} />
          </button>

          {colPanelOpen && (
            <div className="absolute right-0 top-11 z-20 w-52 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3 shadow-lg">
              <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Colunas visíveis</p>
              <div className="space-y-1">
                {COLUMNS.map((col) => {
                  const on = visibleCols.has(col.key);
                  return (
                    <button
                      key={col.key}
                      onClick={() => toggleCol(col.key)}
                      className="flex w-full items-center gap-2.5 rounded-xl px-2 py-2 text-sm text-[var(--text)] transition-colors hover:bg-[var(--surface-muted)]"
                    >
                      <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-[4px] border transition-colors ${
                        on ? "border-[var(--accent)] bg-[var(--accent)]" : "border-[var(--border)]"
                      }`}>
                        {on && <Check size={10} className="text-white" />}
                      </span>
                      {col.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Export CSV */}
        <button
          onClick={() => exportCSV(filtered, visibleCols)}
          title="Exportar CSV"
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] text-[var(--text-muted)] transition-colors hover:text-[var(--text)]"
        >
          <Download size={15} />
        </button>

        {hasActiveFilters && (
          <button
            onClick={clearFilters}
            className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-medium text-[var(--text-muted)] transition-colors hover:text-[var(--danger)]"
          >
            <X size={13} /> Limpar filtros
          </button>
        )}
      </div>

      {/* Table */}
      <div className="table-shell">
        {isLoading ? (
          <div className="table-scroll">
            <table className="w-full text-sm">
              <thead className="bg-[var(--surface-muted)]">
                <tr className="border-b border-[var(--border)]">
                  <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">Nome</th>
                  {visibleCols.has("phone")      && <th className="px-4 py-3" />}
                  {visibleCols.has("emailDoc")   && <th className="px-4 py-3" />}
                  {visibleCols.has("status")     && <th className="px-4 py-3" />}
                  {visibleCols.has("state")      && <th className="px-4 py-3" />}
                  {visibleCols.has("consultant") && <th className="px-4 py-3" />}
                  {visibleCols.has("source")     && <th className="px-4 py-3" />}
                  {visibleCols.has("capturedAt") && <th className="px-4 py-3" />}
                  {visibleCols.has("inactivity") && <th className="px-4 py-3" />}
                  <th />
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td className="px-4 py-4"><div className="h-3.5 w-32 rounded-md bg-[var(--border)]" /></td>
                    {visibleCols.has("phone")      && <td className="px-4 py-4"><div className="h-3.5 w-24 rounded-md bg-[var(--border)]" /></td>}
                    {visibleCols.has("emailDoc")   && <td className="px-4 py-4"><div className="h-3.5 w-36 rounded-md bg-[var(--border)]" /></td>}
                    {visibleCols.has("status")     && <td className="px-4 py-4"><div className="h-5 w-20 rounded-full bg-[var(--border)]" /></td>}
                    {visibleCols.has("state")      && <td className="px-4 py-4"><div className="h-3.5 w-8  rounded-md bg-[var(--border)]" /></td>}
                    {visibleCols.has("consultant") && <td className="px-4 py-4"><div className="h-3.5 w-20 rounded-md bg-[var(--border)]" /></td>}
                    {visibleCols.has("source")     && <td className="px-4 py-4"><div className="h-3.5 w-20 rounded-md bg-[var(--border)]" /></td>}
                    {visibleCols.has("capturedAt") && <td className="px-4 py-4"><div className="h-3.5 w-20 rounded-md bg-[var(--border)]" /></td>}
                    {visibleCols.has("inactivity") && <td className="px-4 py-4"><div className="h-3.5 w-10 rounded-md bg-[var(--border)]" /></td>}
                    <td className="px-4 py-4"><div className="h-3.5 w-10 rounded-md bg-[var(--border)]" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : paginated.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--surface-muted)] text-[var(--text-muted)]">
              {hasActiveFilters ? <Search size={22} /> : <Users size={22} />}
            </div>
            <p className="text-sm font-semibold text-[var(--text)]">
              {hasActiveFilters ? "Nenhuma lead encontrada" : "Nenhuma lead cadastrada"}
            </p>
            <p className="mt-1 text-xs text-[var(--text-muted)]">
              {hasActiveFilters ? "Tente ajustar os filtros" : "Use o botão acima para cadastrar a primeira lead"}
            </p>
          </div>
        ) : (
          <div className="table-scroll">
            <table className="w-full text-sm">
              <thead className="bg-[var(--surface-muted)]">
                <tr className="border-b border-[var(--border)]">
                  <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">Nome</th>
                  {visibleCols.has("phone")      && <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">Telefone</th>}
                  {visibleCols.has("emailDoc")   && <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">Email / CPF</th>}
                  {visibleCols.has("status")     && <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">Status</th>}
                  {visibleCols.has("state")      && <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">Estado</th>}
                  {visibleCols.has("consultant") && <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">Consultor</th>}
                  {visibleCols.has("source")     && <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">Origem</th>}
                  {visibleCols.has("capturedAt") && <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">Capturada em</th>}
                  {visibleCols.has("inactivity") && <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">Dias inativo</th>}
                  <th />
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {paginated.map((lead) => {
                  const inactiveDays = getInactivityDays(lead);
                  return (
                    <tr key={lead.id} className="transition-colors duration-100 hover:bg-[var(--surface-muted)]">
                      <td className="px-4 py-3.5">
                        <div className="max-w-[200px]">
                          <Link
                            href={`/leads/${lead.id}`}
                            className="block truncate font-semibold text-[var(--text)] hover:text-[var(--accent)] transition-colors"
                            title={lead.customer.name}
                          >
                            {lead.customer.name}
                          </Link>
                        </div>
                      </td>
                      {visibleCols.has("phone") && (
                        <td className="px-4 py-3.5 text-[var(--text-muted)]">{lead.customer.phone}</td>
                      )}
                      {visibleCols.has("emailDoc") && (
                        <td className="px-4 py-3.5 text-[var(--text-muted)]">
                          <div className="max-w-[220px]">
                            <p className="truncate" title={lead.customer.email || lead.customer.document || "—"}>
                              {lead.customer.email || lead.customer.document || "—"}
                            </p>
                          </div>
                        </td>
                      )}
                      {visibleCols.has("status") && (
                        <td className="px-4 py-3.5"><LeadStatusBadge status={lead.status} /></td>
                      )}
                      {visibleCols.has("state") && (
                        <td className="px-4 py-3.5 text-[var(--text-muted)]">{lead.customer.state || "—"}</td>
                      )}
                      {visibleCols.has("consultant") && (
                        <td className="px-4 py-3.5 text-[var(--text-muted)]">{lead.consultant || "—"}</td>
                      )}
                      {visibleCols.has("source") && (
                        <td className="px-4 py-3.5 text-[var(--text-muted)]">{sourceLabel[lead.source]}</td>
                      )}
                      {visibleCols.has("capturedAt") && (
                        <td className="px-4 py-3.5 text-[var(--text-muted)]">
                          {new Date(lead.capturedAt).toLocaleDateString("pt-BR")}
                        </td>
                      )}
                      {visibleCols.has("inactivity") && (
                        <td className="px-4 py-3.5">
                          <span className={`font-semibold tabular-nums ${
                            inactiveDays >= 30
                              ? "text-[var(--danger)]"
                              : inactiveDays >= 15
                              ? "text-[var(--warning)]"
                              : "text-[var(--text-muted)]"
                          }`}>
                            {inactiveDays}d
                          </span>
                        </td>
                      )}
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
                          <Link href={`/leads/${lead.id}`} className="link-accent inline-flex items-center gap-1 text-xs">
                            Ver <ChevronRight size={13} />
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Footer: count + page size + pagination */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <p className="text-xs text-[var(--text-muted)]">
            {isLoading
              ? "Carregando..."
              : filtered.length === 0
              ? "0 leads"
              : `${safePage * pageSize + 1}–${Math.min((safePage + 1) * pageSize, filtered.length)} de ${filtered.length} leads`}
          </p>
          {isFetching && !isLoading && (
            <span className="flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--accent)]" />
              Atualizando
            </span>
          )}

          <div className="flex items-center gap-1.5">
            <span className="text-xs text-[var(--text-muted)]">Por página:</span>
            <div className="flex items-center gap-0.5 rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] p-0.5">
              {PAGE_SIZES.map((size) => (
                <button
                  key={size}
                  onClick={() => setPageSize(size)}
                  className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-all ${
                    pageSize === size
                      ? "bg-[var(--surface)] text-[var(--text)] shadow-sm"
                      : "text-[var(--text-muted)] hover:text-[var(--text)]"
                  }`}
                >
                  {size}
                </button>
              ))}
            </div>
          </div>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={safePage === 0}
              className="flex h-8 w-8 items-center justify-center rounded-xl border border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text)] disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ChevronLeft size={15} />
            </button>

            {pageNums.map((n, i) =>
              n === "..." ? (
                <span key={`ellipsis-${i}`} className="flex h-8 w-8 items-center justify-center text-xs text-[var(--text-muted)]">
                  …
                </span>
              ) : (
                <button
                  key={n}
                  onClick={() => setPage(n)}
                  className={`flex h-8 w-8 items-center justify-center rounded-xl text-xs font-semibold transition-all ${
                    n === safePage
                      ? "bg-[var(--accent)] text-white shadow-sm"
                      : "border border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text)]"
                  }`}
                >
                  {n + 1}
                </button>
              )
            )}

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
