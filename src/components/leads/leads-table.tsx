"use client";

import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import {
  ChevronLeft, ChevronRight, Search, Users,
  Download, SlidersHorizontal, X, Check, Loader2,
  CheckSquare, UserCheck, ChevronDown, Trash2, AlertTriangle,
  DollarSign, Plus, Minus, ArrowUp, ArrowDown, ChevronsUpDown,
} from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "sonner";
import { LeadStatusBadge } from "./lead-status-badge";
import { WhatsAppButton } from "./whatsapp-button";
import { AdvancedFiltersPanel } from "./advanced-filters-panel";
import { DateRangePicker, type DateRange } from "@/components/ui/date-range-picker";
import { evaluateGroup } from "@/lib/audiences/evaluate";
import type { RuleGroup } from "@/lib/audiences/types";
import {
  bulkMarkAsLostAction,
  bulkMoveToStageAction,
  bulkAssignConsultantAction,
  bulkDeleteLeadsAction,
  quickRegisterSaleAction,
} from "@/app/(dashboard)/leads/actions";
import { moveToStageAction } from "@/app/(dashboard)/leads/[id]/actions";
import type { LeadStatus, LeadSource } from "@prisma/client";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Lead {
  id:              string;
  status:          LeadStatus;
  source:          LeadSource;
  pipelineStageId: string | null;
  utmSource:       string | null;
  utmMedium:       string | null;
  utmCampaign:     string | null;
  capturedAt: string;
  updatedAt:  string;
  consultant: string | null;
  sales:      { soldAt: string; value: number }[];
  pipelineStage: { id: string; name: string; color: string } | null;
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

type ColumnKey = "phone" | "email" | "document" | "status" | "pipeline" | "state" | "consultant" | "source" | "capturedAt" | "inactivity" | "totalSales" | "lastSale";

type SortKey = "capturedAt" | "inactivity" | "totalSales" | "lastSale";
type SortDir = "asc" | "desc";
interface SortConfig { key: SortKey; dir: SortDir }

const COLUMNS: { key: ColumnKey; label: string; defaultOn: boolean }[] = [
  { key: "phone",      label: "Telefone",        defaultOn: true  },
  { key: "email",      label: "Email",            defaultOn: true  },
  { key: "document",   label: "Documento",        defaultOn: false },
  { key: "status",     label: "Status",           defaultOn: true  },
  { key: "pipeline",   label: "Etapa Pipeline",   defaultOn: true  },
  { key: "state",      label: "Estado",           defaultOn: false },
  { key: "consultant", label: "Consultor",        defaultOn: false },
  { key: "source",     label: "Origem",           defaultOn: true  },
  { key: "capturedAt", label: "Capturada em",     defaultOn: true  },
  { key: "inactivity", label: "Inativo",          defaultOn: false },
  { key: "totalSales", label: "Total compras",    defaultOn: true  },
  { key: "lastSale",   label: "Última compra",    defaultOn: true  },
];

const COLUMNS_KEY   = "leads-columns-v3";
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

const statusTabs: { value: "ALL" | "NEW" | "SOLD" | "LOST"; label: string }[] = [
  { value: "ALL",  label: "Todas"    },
  { value: "NEW",  label: "Novas"    },
  { value: "SOLD", label: "Vendidas" },
  { value: "LOST", label: "Perdidas" },
];

const INACTIVITY_PRESETS = [7, 15, 30, 45];
const ESTADOS = ["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"];

function daysAgo(dateStr: string): number {
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86_400_000);
}

function getMostRecentSaleDate(sales: { soldAt: string }[]): string | undefined {
  if (sales.length === 0) return undefined;
  return sales.reduce((max, s) => (s.soldAt > max ? s.soldAt : max), sales[0].soldAt);
}

function getInactivityDays(lead: Lead): number {
  const lastSale = getMostRecentSaleDate(lead.sales);
  if (lead.status === "SOLD" && lastSale) return daysAgo(lastSale);
  if ((lead.status === "NEW" || lead.status === "REGISTERED") && lead.pipelineStage) return daysAgo(lead.updatedAt);
  return daysAgo(lead.capturedAt);
}

function getTotalSalesValue(lead: Lead): number {
  return lead.sales.reduce((sum, s) => sum + Number(s.value), 0);
}

function formatBRL(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
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
  if (visibleCols.has("email"))      headers.push("Email");
  if (visibleCols.has("document"))   headers.push("Documento");
  if (visibleCols.has("status"))     headers.push("Status");
  if (visibleCols.has("pipeline"))   headers.push("Etapa Pipeline");
  if (visibleCols.has("state"))      headers.push("Estado");
  if (visibleCols.has("consultant")) headers.push("Consultor");
  if (visibleCols.has("source"))     headers.push("Origem");
  if (visibleCols.has("capturedAt")) headers.push("Capturada em");
  if (visibleCols.has("inactivity")) headers.push("Dias inativo");
  if (visibleCols.has("totalSales")) headers.push("Vol. Compras (R$)");
  if (visibleCols.has("lastSale"))   headers.push("Última Compra (R$)");

  const rows = leads.map((l) => {
    const cols = [l.customer.name, l.customer.phone];
    if (visibleCols.has("email"))      cols.push(l.customer.email ?? "");
    if (visibleCols.has("document"))   cols.push(l.customer.document ?? "");
    if (visibleCols.has("status"))     cols.push(l.status);
    if (visibleCols.has("pipeline"))   cols.push(l.pipelineStage?.name ?? "");
    if (visibleCols.has("state"))      cols.push(l.customer.state ?? "");
    if (visibleCols.has("consultant")) cols.push(l.consultant ?? "");
    if (visibleCols.has("source"))     cols.push(sourceLabel[l.source]);
    if (visibleCols.has("capturedAt")) cols.push(new Date(l.capturedAt).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" }));
    if (visibleCols.has("inactivity")) cols.push(String(getInactivityDays(l)));
    if (visibleCols.has("totalSales")) cols.push(String(getTotalSalesValue(l).toFixed(2)));
    if (visibleCols.has("lastSale"))   cols.push(l.sales[0] ? String(Number(l.sales[0].value).toFixed(2)) : "");
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

// ─── Sale item type ───────────────────────────────────────────────────────────

interface SaleItem { name: string; quantity: number; price: number }

// ─── Component ────────────────────────────────────────────────────────────────

interface LeadsTableProps {
  whatsappTemplate?: string | null;
  pipelineStages?:   { id: string; name: string; color: string }[];
  audienceFilter?:   { ids: string[]; name: string } | null;
}

export function LeadsTable({ whatsappTemplate, pipelineStages, audienceFilter }: LeadsTableProps) {
  const { data: leads = [], isFetching, refetch } = useQuery<Lead[]>({
    queryKey:        ["leads"],
    queryFn:         () => fetch("/api/leads").then((r) => r.json()),
    refetchInterval: 30_000,
  });

  // Filters
  const [search,           setSearch]           = useState("");
  const [statusFilter,     setStatusFilter]     = useState<"ALL" | "NEW" | "SOLD" | "LOST">("ALL");
  const [stateFilter,      setStateFilter]      = useState<string>("ALL");
  const [consultantFilter, setConsultantFilter] = useState<string>("ALL");
  const [stageFilter,      setStageFilter]      = useState<string>("ALL");
  const [inactivityFilter, setInactivityFilter] = useState<number | null>(null);
  const [capturedRange,    setCapturedRange]    = useState<DateRange | null>(null);
  const [page,             setPage]             = useState(0);

  // Page size
  const [pageSize, setPageSize] = useState<number>(loadPageSize);

  // Columns
  const [visibleCols,   setVisibleCols]   = useState<Set<ColumnKey>>(() => loadColumns());
  const [colPanelOpen,  setColPanelOpen]  = useState(false);
  const colPanelRef = useRef<HTMLDivElement>(null);

  // Consultants list
  const [consultants, setConsultants] = useState<string[]>([]);

  // Bulk selection
  const [isSelecting,    setIsSelecting]    = useState(false);
  const [selectedIds,    setSelectedIds]    = useState<Set<string>>(new Set());
  const [bulkStep,       setBulkStep]       = useState<"idle" | "confirm-lost" | "move-to-stage" | "assign-consultant" | "confirm-delete-1" | "confirm-delete-2">("idle");
  const [bulkConsultant, setBulkConsultant] = useState("");
  const [bulkStageId,    setBulkStageId]    = useState<string>("");
  const [bulkLoading,    setBulkLoading]    = useState(false);

  // Inline pipeline update
  const [updatingStage, setUpdatingStage] = useState<Set<string>>(new Set());

  // Inline consultant update
  const [updatingConsultant, setUpdatingConsultant] = useState<Set<string>>(new Set());

  async function handleInlineConsultantChange(lead: Lead, consultant: string) {
    setUpdatingConsultant(prev => new Set(prev).add(lead.id));
    try {
      await bulkAssignConsultantAction([lead.id], consultant || null);
      refetch();
    } catch (e: unknown) {
      toast.error((e as Error).message || "Erro ao atualizar consultor");
    } finally {
      setUpdatingConsultant(prev => {
        const next = new Set(prev);
        next.delete(lead.id);
        return next;
      });
    }
  }

  // Sorting
  const [sortConfig,     setSortConfig]     = useState<SortConfig | null>(null);
  const [advancedRules,  setAdvancedRules]  = useState<RuleGroup | null>(null);

  function handleSort(key: SortKey) {
    setSortConfig(prev => {
      if (!prev || prev.key !== key) return { key, dir: "asc" };
      if (prev.dir === "asc") return { key, dir: "desc" };
      return null;
    });
    resetPage();
  }

  function SortIcon({ col }: { col: SortKey }) {
    if (!sortConfig || sortConfig.key !== col)
      return <ChevronsUpDown size={10} className="ml-1 shrink-0 opacity-30" />;
    return sortConfig.dir === "asc"
      ? <ArrowUp   size={10} className="ml-1 shrink-0 text-[var(--accent)]" />
      : <ArrowDown size={10} className="ml-1 shrink-0 text-[var(--accent)]" />;
  }

  // Sale modal
  const [saleModal,     setSaleModal]     = useState<Lead | null>(null);
  const [saleModalStep, setSaleModalStep] = useState<"confirm" | "form">("confirm");
  const [saleValue,     setSaleValue]     = useState("");
  const [saleDate,      setSaleDate]      = useState("");
  const [saleItems,     setSaleItems]     = useState<SaleItem[]>([]);
  const [saleLoading,   setSaleLoading]   = useState(false);

  function openSaleModal(lead: Lead) {
    setSaleModal(lead);
    setSaleModalStep("confirm");
    setSaleValue("");
    setSaleDate(new Date().toISOString().slice(0, 10));
    setSaleItems([]);
  }

  function closeSaleModal() {
    setSaleModal(null);
    setSaleModalStep("confirm");
  }

  async function handleRegisterSale() {
    if (!saleModal || !saleValue) return;
    const value = parseFloat(saleValue.replace(",", "."));
    if (isNaN(value) || value <= 0) { toast.error("Valor inválido"); return; }
    setSaleLoading(true);
    try {
      await quickRegisterSaleAction(
        saleModal.id,
        value,
        saleDate || undefined,
        saleItems.filter(i => i.name.trim()),
      );
      toast.success("Venda registrada com sucesso!");
      closeSaleModal();
      exitSelecting();
      refetch();
    } catch (e: unknown) {
      toast.error((e as Error).message || "Erro ao registrar venda");
    } finally {
      setSaleLoading(false);
    }
  }

  function addSaleItem() {
    setSaleItems(prev => [...prev, { name: "", quantity: 1, price: 0 }]);
  }

  function removeSaleItem(i: number) {
    setSaleItems(prev => prev.filter((_, idx) => idx !== i));
  }

  function updateSaleItem(i: number, field: keyof SaleItem, value: string | number) {
    setSaleItems(prev => prev.map((item, idx) => idx === i ? { ...item, [field]: value } : item));
  }

  function exitSelecting() {
    setIsSelecting(false);
    setSelectedIds(new Set());
    setBulkStep("idle");
  }

  function toggleSelect(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function selectPage(on: boolean) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      paginated.forEach(l => on ? next.add(l.id) : next.delete(l.id));
      return next;
    });
  }

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

  async function handleInlineStageChange(lead: Lead, stageId: string) {
    setUpdatingStage(prev => new Set(prev).add(lead.id));
    try {
      await moveToStageAction(lead.id, stageId || null);
      refetch();
    } catch (e: unknown) {
      toast.error((e as Error).message || "Erro ao atualizar etapa");
    } finally {
      setUpdatingStage(prev => {
        const next = new Set(prev);
        next.delete(lead.id);
        return next;
      });
    }
  }

  const counts: Record<"ALL" | "NEW" | "SOLD" | "LOST", number> = {
    ALL:  leads.length,
    NEW:  leads.filter((l) => l.status === "NEW" || l.status === "REGISTERED").length,
    SOLD: leads.filter((l) => l.status === "SOLD").length,
    LOST: leads.filter((l) => l.status === "LOST").length,
  };

  const audienceIds = audienceFilter ? new Set(audienceFilter.ids) : null;

  const filtered = leads.filter((lead) => {
    if (audienceIds && !audienceIds.has(lead.id)) return false;

    if (advancedRules) {
      const matches = evaluateGroup({
        status:          lead.status,
        pipelineStageId: lead.pipelineStageId,
        capturedAt:      new Date(lead.capturedAt),
        utmSource:       lead.utmSource,
        utmMedium:       lead.utmMedium,
        utmCampaign:     lead.utmCampaign,
        consultant:      lead.consultant,
        customer:        lead.customer,
        sales:           lead.sales.map((s) => ({ value: s.value, soldAt: new Date(s.soldAt) })),
      }, advancedRules);
      if (!matches) return false;
    }

    const q = search.toLowerCase();
    const matchSearch =
      !q ||
      lead.customer.name.toLowerCase().includes(q) ||
      lead.customer.phone.includes(q) ||
      lead.customer.document?.includes(q) ||
      lead.customer.email?.toLowerCase().includes(q);

    const matchStatus =
      statusFilter === "ALL" ||
      (statusFilter === "NEW" && (lead.status === "NEW" || lead.status === "REGISTERED")) ||
      lead.status === statusFilter;
    const matchState      = stateFilter      === "ALL" || lead.customer.state  === stateFilter;
    const matchConsultant = consultantFilter === "ALL" || lead.consultant       === consultantFilter;
    const matchStage      = stageFilter      === "ALL" || lead.pipelineStage?.id === stageFilter;
    const matchInactivity = inactivityFilter === null  || getInactivityDays(lead) >= inactivityFilter;

    const capturedMs = new Date(lead.capturedAt).getTime();
    const matchCaptured = !capturedRange ||
      (capturedMs >= new Date(capturedRange.from + "T00:00:00").getTime() &&
       capturedMs <= new Date(capturedRange.to   + "T23:59:59").getTime());

    return matchSearch && matchStatus && matchState && matchConsultant && matchStage && matchInactivity && matchCaptured;
  });

  function getSortValue(lead: Lead, key: SortKey): number {
    switch (key) {
      case "capturedAt": return new Date(lead.capturedAt).getTime();
      case "inactivity": return getInactivityDays(lead);
      case "totalSales": return getTotalSalesValue(lead);
      case "lastSale":   return lead.sales[0] ? Number(lead.sales[0].value) : -1;
    }
  }

  const sorted = sortConfig
    ? [...filtered].sort((a, b) => {
        const cmp = getSortValue(a, sortConfig.key) - getSortValue(b, sortConfig.key);
        return sortConfig.dir === "asc" ? cmp : -cmp;
      })
    : filtered;

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const safePage   = Math.min(page, totalPages - 1);
  const paginated  = sorted.slice(safePage * pageSize, (safePage + 1) * pageSize);
  const pageNums   = getPageNumbers(safePage, totalPages);

  const hasActiveFilters = search !== "" || statusFilter !== "ALL" || stateFilter !== "ALL" || consultantFilter !== "ALL" || stageFilter !== "ALL" || inactivityFilter !== null || capturedRange !== null;

  // Lead selecionada para venda (apenas quando exatamente 1)
  const singleSelectedLead = selectedIds.size === 1
    ? leads.find(l => l.id === [...selectedIds][0]) ?? null
    : null;

  function clearFilters() {
    setSearch("");
    setStatusFilter("ALL");
    setStateFilter("ALL");
    setConsultantFilter("ALL");
    setStageFilter("ALL");
    setInactivityFilter(null);
    setCapturedRange(null);
    resetPage();
  }

  return (
    <div className="space-y-4">

      {/* Banner: filtro por público */}
      {audienceFilter && (
        <div className="flex items-center gap-3 rounded-xl border border-[var(--accent)] bg-[var(--accent-soft)] px-4 py-2.5">
          <Users size={14} className="shrink-0 text-[var(--accent)]" />
          <span className="text-sm text-[var(--accent)]">
            Filtrando por público: <span className="font-semibold">{audienceFilter.name}</span>
            <span className="font-normal text-[var(--text-muted)] ml-2">— {audienceFilter.ids.length} lead{audienceFilter.ids.length !== 1 ? "s" : ""}</span>
          </span>
          <a href="/leads" className="ml-auto text-xs text-[var(--text-muted)] hover:text-[var(--text)] transition-colors">
            Limpar filtro ×
          </a>
        </div>
      )}

      {/* Row 1: search + state + consultant + stage + inactivity */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none" />
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); resetPage(); }}
            placeholder="Buscar por nome, telefone ou documento..."
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

        {(pipelineStages ?? []).length > 0 && (
          <select
            value={stageFilter}
            onChange={(e) => { setStageFilter(e.target.value); resetPage(); }}
            className="input w-full lg:w-36"
          >
            <option value="ALL">Etapa</option>
            {(pipelineStages ?? []).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
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

        <DateRangePicker
          value={capturedRange}
          onChange={(r) => { setCapturedRange(r); resetPage(); }}
          placeholder="Capturada em"
        />
      </div>

      {/* Advanced filters */}
      <AdvancedFiltersPanel
        pipelineStages={pipelineStages ?? []}
        matchCount={filtered.length}
        totalCount={leads.length}
        activeRules={advancedRules}
        onChange={(rules) => { setAdvancedRules(rules); resetPage(); }}
      />

      {/* Row 2: status tabs + column editor + export + select + clear */}
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

        {/* Select mode toggle */}
        <button
          onClick={() => isSelecting ? exitSelecting() : setIsSelecting(true)}
          title={isSelecting ? "Sair da seleção" : "Selecionar leads"}
          className={`flex h-9 items-center gap-1.5 rounded-xl border px-3 text-xs font-semibold transition-colors ${
            isSelecting
              ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]"
              : "border-[var(--border)] bg-[var(--surface-muted)] text-[var(--text-muted)] hover:text-[var(--text)]"
          }`}
        >
          <CheckSquare size={14} />
          {isSelecting && selectedIds.size > 0 ? `${selectedIds.size} selecionadas` : "Selecionar"}
        </button>

        {/* Export CSV */}
        <button
          onClick={() => exportCSV(
            isSelecting && selectedIds.size > 0 ? filtered.filter(l => selectedIds.has(l.id)) : filtered,
            visibleCols,
          )}
          title={isSelecting && selectedIds.size > 0 ? "Exportar selecionadas" : "Exportar CSV"}
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

      {/* Refetch indicator */}
      {isFetching && (
        <div className="flex items-center gap-2 rounded-xl border border-[var(--accent)] bg-[var(--accent-soft)] px-3 py-2 text-xs font-medium text-[var(--accent)]">
          <Loader2 size={13} className="animate-spin" />
          Atualizando lista de leads...
        </div>
      )}

      {/* Table */}
      <div className="table-shell">
        {paginated.length === 0 ? (
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
                  {isSelecting && (
                    <th className="w-10 px-3 py-3">
                      <button
                        onClick={() => selectPage(!paginated.every(l => selectedIds.has(l.id)))}
                        className={`flex h-4 w-4 items-center justify-center rounded-[4px] border transition-colors ${
                          paginated.length > 0 && paginated.every(l => selectedIds.has(l.id))
                            ? "border-[var(--accent)] bg-[var(--accent)] text-white"
                            : "border-[var(--border)] bg-[var(--surface)]"
                        }`}
                      >
                        {paginated.length > 0 && paginated.every(l => selectedIds.has(l.id)) && <Check size={10} />}
                      </button>
                    </th>
                  )}
                  <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">Nome</th>
                  {visibleCols.has("phone")      && <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">Telefone</th>}
                  {visibleCols.has("email")      && <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">Email</th>}
                  {visibleCols.has("document")   && <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">Documento</th>}
                  {visibleCols.has("status")     && <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">Status</th>}
                  {visibleCols.has("pipeline") && (pipelineStages ?? []).length > 0 && <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">Etapa</th>}
                  {visibleCols.has("state")      && <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">Estado</th>}
                  {visibleCols.has("consultant") && <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">Consultor</th>}
                  {visibleCols.has("source")     && <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">Origem</th>}
                  {visibleCols.has("capturedAt") && (
                    <th className="px-4 py-3 text-left">
                      <button onClick={() => handleSort("capturedAt")} className="flex items-center text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)] hover:text-[var(--text)] transition-colors">
                        Capturada em <SortIcon col="capturedAt" />
                      </button>
                    </th>
                  )}
                  {visibleCols.has("inactivity") && (
                    <th className="px-4 py-3 text-left">
                      <button onClick={() => handleSort("inactivity")} className="flex items-center text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)] hover:text-[var(--text)] transition-colors">
                        Dias inativo <SortIcon col="inactivity" />
                      </button>
                    </th>
                  )}
                  {visibleCols.has("totalSales") && (
                    <th className="px-4 py-3 text-left">
                      <button onClick={() => handleSort("totalSales")} className="flex items-center text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)] hover:text-[var(--text)] transition-colors">
                        Vol. Compras <SortIcon col="totalSales" />
                      </button>
                    </th>
                  )}
                  {visibleCols.has("lastSale") && (
                    <th className="px-4 py-3 text-left">
                      <button onClick={() => handleSort("lastSale")} className="flex items-center text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)] hover:text-[var(--text)] transition-colors">
                        Última Compra <SortIcon col="lastSale" />
                      </button>
                    </th>
                  )}
                  <th />
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {paginated.map((lead) => {
                  const inactiveDays = getInactivityDays(lead);
                  const isSelected   = selectedIds.has(lead.id);
                  const canEditStage = lead.status === "NEW" || lead.status === "REGISTERED";
                  return (
                    <tr
                      key={lead.id}
                      onClick={() => isSelecting && toggleSelect(lead.id)}
                      className={`transition-colors duration-100 ${
                        isSelecting
                          ? `cursor-pointer select-none ${isSelected ? "bg-[var(--accent-soft)]" : "hover:bg-[var(--surface-muted)]"}`
                          : "hover:bg-[var(--surface-muted)]"
                      }`}
                    >
                      {isSelecting && (
                        <td className="w-10 px-3 py-3.5" onClick={e => e.stopPropagation()}>
                          <button
                            onClick={() => toggleSelect(lead.id)}
                            className={`flex h-4 w-4 items-center justify-center rounded-[4px] border transition-colors ${
                              isSelected
                                ? "border-[var(--accent)] bg-[var(--accent)] text-white"
                                : "border-[var(--border)] bg-[var(--surface)]"
                            }`}
                          >
                            {isSelected && <Check size={10} />}
                          </button>
                        </td>
                      )}
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
                      {visibleCols.has("email") && (
                        <td className="px-4 py-3.5 text-[var(--text-muted)]">
                          <span className="truncate block max-w-[180px]" title={lead.customer.email ?? "—"}>
                            {lead.customer.email || "—"}
                          </span>
                        </td>
                      )}
                      {visibleCols.has("document") && (
                        <td className="px-4 py-3.5 text-[var(--text-muted)]">
                          {lead.customer.document || "—"}
                        </td>
                      )}
                      {visibleCols.has("status") && (
                        <td className="px-4 py-3.5">
                          <LeadStatusBadge status={lead.status} pipelineStage={null} />
                        </td>
                      )}
                      {visibleCols.has("pipeline") && (pipelineStages ?? []).length > 0 && (
                        <td className="px-4 py-3.5" onClick={e => e.stopPropagation()}>
                          {canEditStage ? (
                            <div className="flex items-center gap-1.5">
                              <span
                                className="h-2 w-2 shrink-0 rounded-full transition-colors"
                                style={{ backgroundColor: lead.pipelineStage?.color ?? "var(--border)" }}
                              />
                              <div className="relative">
                                <select
                                  value={lead.pipelineStage?.id ?? ""}
                                  disabled={updatingStage.has(lead.id)}
                                  onChange={(e) => handleInlineStageChange(lead, e.target.value)}
                                  className="h-7 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2 pr-6 text-xs text-[var(--text)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)] disabled:opacity-50 appearance-none cursor-pointer"
                                >
                                  <option value="">— Sem etapa</option>
                                  {(pipelineStages ?? []).map(s => (
                                    <option key={s.id} value={s.id}>{s.name}</option>
                                  ))}
                                </select>
                                {updatingStage.has(lead.id)
                                  ? <Loader2 size={10} className="absolute right-1.5 top-1/2 -translate-y-1/2 animate-spin text-[var(--text-muted)]" />
                                  : <ChevronDown size={10} className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
                                }
                              </div>
                            </div>
                          ) : (
                            <span className="text-xs text-[var(--text-muted)]">—</span>
                          )}
                        </td>
                      )}
                      {visibleCols.has("state") && (
                        <td className="px-4 py-3.5 text-[var(--text-muted)]">{lead.customer.state || "—"}</td>
                      )}
                      {visibleCols.has("consultant") && consultants.length > 0 && (
                        <td className="px-4 py-3.5" onClick={e => e.stopPropagation()}>
                          <div className="relative">
                            <select
                              value={lead.consultant ?? ""}
                              disabled={updatingConsultant.has(lead.id)}
                              onChange={(e) => handleInlineConsultantChange(lead, e.target.value)}
                              className="h-7 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2 pr-6 text-xs text-[var(--text)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)] disabled:opacity-50 appearance-none cursor-pointer"
                            >
                              <option value="">— Sem consultor</option>
                              {consultants.map(c => (
                                <option key={c} value={c}>{c}</option>
                              ))}
                            </select>
                            {updatingConsultant.has(lead.id)
                              ? <Loader2 size={10} className="absolute right-1.5 top-1/2 -translate-y-1/2 animate-spin text-[var(--text-muted)]" />
                              : <ChevronDown size={10} className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
                            }
                          </div>
                        </td>
                      )}
                      {visibleCols.has("consultant") && consultants.length === 0 && (
                        <td className="px-4 py-3.5 text-[var(--text-muted)]">{lead.consultant || "—"}</td>
                      )}
                      {visibleCols.has("source") && (
                        <td className="px-4 py-3.5 text-[var(--text-muted)]">{sourceLabel[lead.source]}</td>
                      )}
                      {visibleCols.has("capturedAt") && (
                        <td className="px-4 py-3.5 text-[var(--text-muted)]">
                          {new Date(lead.capturedAt).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}
                        </td>
                      )}
                      {visibleCols.has("inactivity") && (
                        <td className="px-4 py-3.5">
                          <span className={`font-semibold tabular-nums ${
                            inactiveDays >= 30 ? "text-[var(--danger)]" : inactiveDays >= 15 ? "text-[var(--warning)]" : "text-[var(--text-muted)]"
                          }`}>
                            {inactiveDays}d
                          </span>
                        </td>
                      )}
                      {visibleCols.has("totalSales") && (
                        <td className="px-4 py-3.5 text-[var(--text-muted)]">
                          {lead.sales.length > 0
                            ? <span className="font-semibold text-[var(--success)]">{formatBRL(getTotalSalesValue(lead))}</span>
                            : "—"}
                        </td>
                      )}
                      {visibleCols.has("lastSale") && (
                        <td className="px-4 py-3.5 text-[var(--text-muted)]">
                          {lead.sales[0]
                            ? <span className="font-medium text-[var(--text)]">{formatBRL(Number(lead.sales[0].value))}</span>
                            : "—"}
                        </td>
                      )}
                      <td className="px-4 py-3.5" onClick={e => isSelecting && e.stopPropagation()}>
                        <div className="flex items-center gap-2">
                          <WhatsAppButton
                            phone={lead.customer.phone}
                            name={lead.customer.name}
                            state={lead.customer.state}
                            city={lead.customer.city}
                            template={whatsappTemplate}
                            variant="icon"
                          />
                          {lead.status !== "LOST" && (
                            <button
                              onClick={e => { e.stopPropagation(); openSaleModal(lead); }}
                              title={lead.status === "SOLD" ? "Registrar recompra" : "Registrar venda"}
                              className="flex h-7 w-7 items-center justify-center rounded-lg border border-[var(--success)] text-[var(--success)] hover:bg-[var(--success)] hover:text-white transition-colors"
                            >
                              <DollarSign size={13} />
                            </button>
                          )}
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
            {sorted.length === 0
              ? "0 leads"
              : `${safePage * pageSize + 1}–${Math.min((safePage + 1) * pageSize, sorted.length)} de ${sorted.length} leads`}
          </p>
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
                <span key={`ellipsis-${i}`} className="flex h-8 w-8 items-center justify-center text-xs text-[var(--text-muted)]">…</span>
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

      {/* ── Bulk action bar ── */}
      {isSelecting && selectedIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 z-30 w-[calc(100vw-2rem)] max-w-2xl -translate-x-1/2">
          <div className="flex items-center gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 shadow-xl">

            {bulkStep === "idle" && (
              <>
                <span className="shrink-0 text-sm font-semibold text-[var(--text)]">
                  {selectedIds.size} {selectedIds.size === 1 ? "selecionada" : "selecionadas"}
                </span>
                <div className="mx-1 h-5 w-px bg-[var(--border)]" />
                <div className="flex flex-1 flex-wrap items-center gap-2">
                  {/* Registrar venda — só aparece com 1 lead selecionada */}
                  {singleSelectedLead && (
                    <button
                      onClick={() => openSaleModal(singleSelectedLead)}
                      className="flex items-center gap-1.5 rounded-xl border border-[var(--success)] bg-[var(--success-soft)] px-3 py-1.5 text-xs font-semibold text-[var(--success)] transition-colors hover:bg-[var(--success)] hover:text-white"
                    >
                      <DollarSign size={13} /> Registrar Venda
                    </button>
                  )}
                  <button
                    onClick={() => setBulkStep("confirm-lost")}
                    className="rounded-xl border border-[var(--danger)] bg-[var(--danger-soft)] px-3 py-1.5 text-xs font-semibold text-[var(--danger)] transition-colors hover:bg-[var(--danger)] hover:text-white"
                  >
                    Marcar perdida
                  </button>
                  {(pipelineStages ?? []).length > 0 && (
                    <button
                      onClick={() => { setBulkStageId(""); setBulkStep("move-to-stage"); }}
                      className="rounded-xl border border-[var(--accent)] bg-[var(--accent-soft)] px-3 py-1.5 text-xs font-semibold text-[var(--accent)] transition-colors hover:bg-[var(--accent)] hover:text-white"
                    >
                      Mover etapa
                    </button>
                  )}
                  <button
                    onClick={() => { setBulkConsultant(""); setBulkStep("assign-consultant"); }}
                    className="flex items-center gap-1.5 rounded-xl border border-[var(--border)] px-3 py-1.5 text-xs font-semibold text-[var(--text-muted)] transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)]"
                  >
                    <UserCheck size={13} /> Consultor
                  </button>
                  <button
                    onClick={() => exportCSV(filtered.filter(l => selectedIds.has(l.id)), visibleCols)}
                    className="flex items-center gap-1.5 rounded-xl border border-[var(--border)] px-3 py-1.5 text-xs font-semibold text-[var(--text-muted)] transition-colors hover:text-[var(--text)]"
                  >
                    <Download size={13} /> Exportar
                  </button>
                  <button
                    onClick={() => setBulkStep("confirm-delete-1")}
                    className="flex items-center gap-1.5 rounded-xl border border-[var(--danger)] px-3 py-1.5 text-xs font-semibold text-[var(--danger)] transition-colors hover:bg-[var(--danger)] hover:text-white"
                  >
                    <Trash2 size={13} /> Excluir
                  </button>
                </div>
                <button
                  onClick={exitSelecting}
                  className="shrink-0 rounded-xl p-1.5 text-[var(--text-muted)] transition-colors hover:text-[var(--danger)]"
                >
                  <X size={16} />
                </button>
              </>
            )}

            {bulkStep === "confirm-lost" && (
              <>
                <span className="flex-1 text-sm text-[var(--text)]">
                  Marcar <strong>{selectedIds.size}</strong> {selectedIds.size === 1 ? "lead" : "leads"} como perdida?
                  <span className="ml-1 text-xs text-[var(--text-muted)]">(apenas NEW e Cadastradas)</span>
                </span>
                <button
                  disabled={bulkLoading}
                  onClick={async () => {
                    setBulkLoading(true);
                    try {
                      const { updated } = await bulkMarkAsLostAction([...selectedIds]);
                      toast.success(`${updated} ${updated === 1 ? "lead marcada" : "leads marcadas"} como perdida.`);
                      exitSelecting(); refetch();
                    } catch { toast.error("Erro ao atualizar leads."); }
                    finally { setBulkLoading(false); }
                  }}
                  className="flex items-center gap-1.5 rounded-xl bg-[var(--danger)] px-4 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                >
                  {bulkLoading && <Spinner size={12} />}
                  {bulkLoading ? "Processando..." : "Confirmar"}
                </button>
                <button onClick={() => setBulkStep("idle")} className="rounded-xl border border-[var(--border)] px-3 py-1.5 text-xs font-medium text-[var(--text-muted)] hover:text-[var(--text)]">Voltar</button>
              </>
            )}

            {bulkStep === "move-to-stage" && (
              <>
                <span className="shrink-0 text-sm font-semibold text-[var(--text)]">Etapa:</span>
                <div className="relative flex-1">
                  <select value={bulkStageId} onChange={e => setBulkStageId(e.target.value)} className="input w-full pr-8 text-sm">
                    <option value="">— Remover etapa</option>
                    {(pipelineStages ?? []).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                  <ChevronDown size={13} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
                </div>
                <button
                  disabled={bulkLoading}
                  onClick={async () => {
                    setBulkLoading(true);
                    try {
                      const { updated } = await bulkMoveToStageAction([...selectedIds], bulkStageId || null);
                      toast.success(`Etapa atualizada em ${updated} ${updated === 1 ? "lead" : "leads"}.`);
                      exitSelecting(); refetch();
                    } catch { toast.error("Erro ao atualizar etapa."); }
                    finally { setBulkLoading(false); }
                  }}
                  className="shrink-0 flex items-center gap-1.5 rounded-xl bg-[var(--accent)] px-4 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                >
                  {bulkLoading && <Spinner size={12} />}
                  {bulkLoading ? "Processando..." : "Aplicar"}
                </button>
                <button onClick={() => setBulkStep("idle")} className="shrink-0 rounded-xl border border-[var(--border)] px-3 py-1.5 text-xs font-medium text-[var(--text-muted)] hover:text-[var(--text)]">Voltar</button>
              </>
            )}

            {bulkStep === "confirm-delete-1" && (
              <>
                <AlertTriangle size={16} className="shrink-0 text-[var(--warning)]" />
                <span className="flex-1 text-sm text-[var(--text)]">
                  Excluir <strong>{selectedIds.size}</strong> {selectedIds.size === 1 ? "lead" : "leads"}?
                  <span className="ml-1 text-xs text-[var(--text-muted)]">Inclui todas as vendas associadas.</span>
                </span>
                <button onClick={() => setBulkStep("confirm-delete-2")} className="rounded-xl border border-[var(--danger)] px-4 py-1.5 text-xs font-semibold text-[var(--danger)] transition-colors hover:bg-[var(--danger)] hover:text-white">Continuar</button>
                <button onClick={() => setBulkStep("idle")} className="rounded-xl border border-[var(--border)] px-3 py-1.5 text-xs font-medium text-[var(--text-muted)] hover:text-[var(--text)]">Voltar</button>
              </>
            )}

            {bulkStep === "confirm-delete-2" && (
              <>
                <AlertTriangle size={16} className="shrink-0 text-[var(--danger)]" />
                <span className="flex-1 text-sm font-semibold text-[var(--danger)]">Esta ação não pode ser desfeita. Confirma a exclusão permanente?</span>
                <button
                  disabled={bulkLoading}
                  onClick={async () => {
                    setBulkLoading(true);
                    try {
                      const { deleted } = await bulkDeleteLeadsAction([...selectedIds]);
                      toast.success(`${deleted} ${deleted === 1 ? "lead excluída" : "leads excluídas"} permanentemente.`);
                      exitSelecting(); refetch();
                    } catch { toast.error("Erro ao excluir leads."); }
                    finally { setBulkLoading(false); }
                  }}
                  className="shrink-0 flex items-center gap-1.5 rounded-xl bg-[var(--danger)] px-4 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                >
                  {bulkLoading && <Spinner size={12} />}
                  {bulkLoading ? "Excluindo..." : "Excluir definitivamente"}
                </button>
                <button onClick={() => setBulkStep("confirm-delete-1")} className="shrink-0 rounded-xl border border-[var(--border)] px-3 py-1.5 text-xs font-medium text-[var(--text-muted)] hover:text-[var(--text)]">Voltar</button>
              </>
            )}

            {bulkStep === "assign-consultant" && (
              <>
                <span className="shrink-0 text-sm font-semibold text-[var(--text)]">Consultor:</span>
                <div className="relative flex-1">
                  <select value={bulkConsultant} onChange={e => setBulkConsultant(e.target.value)} className="input w-full pr-8 text-sm">
                    <option value="">— Remover consultor</option>
                    {consultants.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <ChevronDown size={13} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
                </div>
                <button
                  disabled={bulkLoading}
                  onClick={async () => {
                    setBulkLoading(true);
                    try {
                      const { updated } = await bulkAssignConsultantAction([...selectedIds], bulkConsultant || null);
                      toast.success(`Consultor atualizado em ${updated} ${updated === 1 ? "lead" : "leads"}.`);
                      exitSelecting(); refetch();
                    } catch { toast.error("Erro ao atualizar consultor."); }
                    finally { setBulkLoading(false); }
                  }}
                  className="shrink-0 flex items-center gap-1.5 rounded-xl bg-[var(--accent)] px-4 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                >
                  {bulkLoading && <Spinner size={12} />}
                  {bulkLoading ? "Processando..." : "Aplicar"}
                </button>
                <button onClick={() => setBulkStep("idle")} className="shrink-0 rounded-xl border border-[var(--border)] px-3 py-1.5 text-xs font-medium text-[var(--text-muted)] hover:text-[var(--text)]">Voltar</button>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Modal de registro de venda ── */}
      {saleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-2xl">

            {saleModalStep === "confirm" ? (
              <div className="p-6">
                <h2 className="text-base font-semibold text-[var(--text)] mb-1">Confirmar lead</h2>
                <p className="text-xs text-[var(--text-muted)] mb-4">Verifique os dados antes de registrar a venda.</p>
                <div className="rounded-xl bg-[var(--surface-muted)] p-4 space-y-3 mb-6">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">Nome</p>
                    <p className="font-semibold text-[var(--text)]">{saleModal.customer.name}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">Documento (CPF/CNPJ)</p>
                    <p className="font-semibold text-[var(--text)]">{saleModal.customer.document || <span className="text-[var(--text-muted)] font-normal">Não informado</span>}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">Telefone</p>
                    <p className="font-semibold text-[var(--text)]">{saleModal.customer.phone}</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={closeSaleModal}
                    className="flex-1 h-10 rounded-xl border border-[var(--border)] text-sm text-[var(--text-muted)] hover:text-[var(--text)] transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={() => setSaleModalStep("form")}
                    className="flex-1 h-10 rounded-xl bg-[var(--accent)] text-sm font-semibold text-white hover:bg-[var(--accent-strong)] transition-colors"
                  >
                    Sim, é esta lead
                  </button>
                </div>
              </div>
            ) : (
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-base font-semibold text-[var(--text)]">Registrar venda</h2>
                    <p className="text-xs text-[var(--text-muted)]">{saleModal.customer.name}</p>
                  </div>
                  <button onClick={closeSaleModal} className="text-[var(--text-muted)] hover:text-[var(--text)]">
                    <X size={16} />
                  </button>
                </div>

                <div className="space-y-4">
                  {/* Valor */}
                  <div>
                    <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">Valor (R$) *</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={saleValue}
                      onChange={e => setSaleValue(e.target.value)}
                      placeholder="0,00"
                      className="input w-full"
                    />
                  </div>

                  {/* Data */}
                  <div>
                    <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">Data da venda</label>
                    <input
                      type="date"
                      value={saleDate}
                      onChange={e => setSaleDate(e.target.value)}
                      className="input w-full"
                    />
                  </div>

                  {/* Itens (opcional) */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-medium text-[var(--text-muted)]">Itens (opcional)</label>
                      <button
                        type="button"
                        onClick={addSaleItem}
                        className="flex items-center gap-1 text-xs text-[var(--accent)] hover:text-[var(--accent-strong)]"
                      >
                        <Plus size={12} /> Adicionar
                      </button>
                    </div>
                    {saleItems.length > 0 && (
                      <div className="space-y-2">
                        {saleItems.map((item, i) => (
                          <div key={i} className="flex gap-2 items-center">
                            <input
                              type="text"
                              placeholder="Nome do item"
                              value={item.name}
                              onChange={e => updateSaleItem(i, "name", e.target.value)}
                              className="input flex-1 text-xs h-8"
                            />
                            <input
                              type="number"
                              min="1"
                              value={item.quantity}
                              onChange={e => updateSaleItem(i, "quantity", parseInt(e.target.value) || 1)}
                              className="input w-14 text-xs h-8 text-center"
                              title="Qtd"
                            />
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={item.price || ""}
                              onChange={e => updateSaleItem(i, "price", parseFloat(e.target.value) || 0)}
                              className="input w-24 text-xs h-8"
                              placeholder="Preço"
                            />
                            <button onClick={() => removeSaleItem(i)} className="text-[var(--text-muted)] hover:text-[var(--danger)]">
                              <Minus size={13} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex gap-2 mt-6">
                  <button
                    onClick={() => setSaleModalStep("confirm")}
                    className="flex-1 h-10 rounded-xl border border-[var(--border)] text-sm text-[var(--text-muted)] hover:text-[var(--text)] transition-colors"
                  >
                    Voltar
                  </button>
                  <button
                    onClick={handleRegisterSale}
                    disabled={saleLoading || !saleValue}
                    className="flex-1 h-10 rounded-xl bg-[var(--success)] text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50 transition-opacity flex items-center justify-center gap-2"
                  >
                    {saleLoading && <Spinner size={15} />}
                    {saleLoading ? "Salvando..." : "Registrar venda"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
