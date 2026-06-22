"use client";

import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Search, ChevronLeft, ChevronRight, Loader2,
  ChevronDown, DollarSign, X, Plus, Minus, Users,
  ArrowDown, ArrowUp, ChevronsUpDown, CheckSquare, Square, ListChecks, Eye,
  SlidersHorizontal, Check, GripVertical,
} from "lucide-react";
import { toast } from "sonner";
import { LeadStatusBadge } from "@/components/leads/lead-status-badge";
import { CurrencyInput } from "@/components/ui/currency-input";
import { WhatsAppButton } from "@/components/leads/whatsapp-button";
import { AdvancedFiltersPanel } from "@/components/leads/advanced-filters-panel";
import { evaluateGroup } from "@/lib/audiences/evaluate";
import type { RuleGroup } from "@/lib/audiences/types";
import {
  consultantRegisterSaleAction,
  consultantMoveToStageWithChecklistAction,
  consultantAssignConsultantAction,
  getStageRequirementsAction,
} from "@/app/consultor/actions";
import type { LeadStatus, LeadSource } from "@prisma/client";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Lead {
  id:              string;
  status:          LeadStatus;
  source:          LeadSource;
  capturedAt:      string;
  updatedAt:       string;
  consultant:      string | null;
  pipelineStageId: string | null;
  utmSource:       string | null;
  utmMedium:       string | null;
  utmCampaign:     string | null;
  sales:           { soldAt: string; value: number }[];
  pipelineStage:   { id: string; name: string; color: string } | null;
  lastCheckedRequirement?: { text: string; checkedAt: string | null; checkedBy: string | null } | null;
  customer: {
    name:     string;
    phone:    string;
    email:    string | null;
    document: string | null;
    state:    string | null;
    city:     string | null;
  };
}

interface Requirement { id: string; text: string }
interface SaleItem    { name: string; quantity: number; price: number }

// ─── Helpers ──────────────────────────────────────────────────────────────────

const PAGE_SIZES = [10, 25, 50, 100];
const ESTADOS = ["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"];

function getMostRecentSaleDate(sales: { soldAt: string }[]): string | undefined {
  if (sales.length === 0) return undefined;
  return sales.reduce((max, s) => (s.soldAt > max ? s.soldAt : max), sales[0].soldAt);
}

function getInactivityDays(lead: Lead): number {
  const lastSale = getMostRecentSaleDate(lead.sales);
  if (lead.status === "SOLD" && lastSale) return Math.floor((Date.now() - new Date(lastSale).getTime()) / 86_400_000);
  return Math.floor((Date.now() - new Date(lead.updatedAt).getTime()) / 86_400_000);
}

function getTotalSalesValue(lead: Lead) {
  return lead.sales.reduce((sum, s) => sum + Number(s.value), 0);
}

function formatBRL(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function getPageNumbers(current: number, total: number): (number | "...")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i);
  const result: (number | "...")[] = [];
  const s = Math.max(1, current - 1);
  const e = Math.min(total - 2, current + 1);
  result.push(0);
  if (s > 1) result.push("...");
  for (let i = s; i <= e; i++) result.push(i);
  if (e < total - 2) result.push("...");
  result.push(total - 1);
  return result;
}

type SortKey = "capturedAt" | "inactivity" | "totalSales" | "lastSale";
interface SortConfig { key: SortKey; dir: "asc" | "desc" }

// ─── Column definitions (apenas colunas disponíveis na tabela do consultor) ───

type ColumnKey = "phone" | "email" | "document" | "status" | "pipeline" | "lastRequirement" | "state" | "consultant" | "capturedAt" | "inactivity" | "totalSales" | "lastSale";

const COLUMNS: { key: ColumnKey; label: string; defaultOn: boolean }[] = [
  { key: "phone",           label: "Telefone",        defaultOn: true },
  { key: "email",           label: "Email",            defaultOn: true },
  { key: "document",        label: "Documento",        defaultOn: true },
  { key: "status",          label: "Status",           defaultOn: true },
  { key: "pipeline",        label: "Etapa Pipeline",   defaultOn: true },
  { key: "lastRequirement", label: "Último requisito", defaultOn: true },
  { key: "state",           label: "Estado",           defaultOn: true },
  { key: "consultant",      label: "Consultor",        defaultOn: true },
  { key: "capturedAt",      label: "Capturada em",     defaultOn: true },
  { key: "inactivity",      label: "Inativo",          defaultOn: true },
  { key: "totalSales",      label: "Total compras",    defaultOn: true },
  { key: "lastSale",        label: "Última compra",    defaultOn: true },
];

const COLUMNS_KEY   = "consultant-leads-columns-v1";
const COL_ORDER_KEY = "consultant-leads-col-order-v1";

function loadColumns(): Set<ColumnKey> {
  if (typeof window === "undefined") return new Set(COLUMNS.filter(c => c.defaultOn).map(c => c.key));
  try {
    const stored = localStorage.getItem(COLUMNS_KEY);
    if (stored) return new Set(JSON.parse(stored) as ColumnKey[]);
  } catch {}
  return new Set(COLUMNS.filter(c => c.defaultOn).map(c => c.key));
}

function loadColOrder(): ColumnKey[] {
  const allKeys = COLUMNS.map(c => c.key);
  if (typeof window === "undefined") return allKeys;
  try {
    const stored = localStorage.getItem(COL_ORDER_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as ColumnKey[];
      const storedSet = new Set(parsed);
      const missing = allKeys.filter(k => !storedSet.has(k));
      return [...parsed.filter((k): k is ColumnKey => allKeys.includes(k as ColumnKey)), ...missing];
    }
  } catch {}
  return allKeys;
}

// ─── Persistência de filtros (apenas no dispositivo — localStorage) ──────────

interface PersistedFilters {
  search?:           string;
  statusFilter?:     "ALL" | "NEW" | "SOLD" | "LOST";
  stateFilter?:      string;
  consultantFilter?: string;
  stageFilter?:      string;
  page?:             number;
  pageSize?:         number;
  sortConfig?:       SortConfig | null;
  advancedRules?:    RuleGroup | null;
}

const FILTERS_KEY = "consultant-leads-filters-v1";

function loadFilters(): PersistedFilters {
  if (typeof window === "undefined") return {};
  try {
    const stored = localStorage.getItem(FILTERS_KEY);
    if (stored) return JSON.parse(stored) as PersistedFilters;
  } catch {}
  return {};
}

// ─── Component ────────────────────────────────────────────────────────────────

interface Props {
  consultantName: string;
  pipelineStages: { id: string; name: string; color: string }[];
  consultants:    string[];
  whatsappTemplate?: string | null;
}

export function ConsultantLeadsTable({ consultantName, pipelineStages, consultants, whatsappTemplate }: Props) {
  const { data: leads = [], isFetching, refetch } = useQuery<Lead[]>({
    queryKey:        ["consultant-leads"],
    queryFn:         () => fetch("/api/consultor/leads").then(r => r.json()),
    refetchInterval: 30_000,
  });

  const [persisted] = useState<PersistedFilters>(() => loadFilters());

  const [search,           setSearch]           = useState(persisted.search ?? "");
  const [statusFilter,     setStatusFilter]      = useState<"ALL" | "NEW" | "SOLD" | "LOST">(persisted.statusFilter ?? "ALL");
  const [stateFilter,      setStateFilter]       = useState(persisted.stateFilter ?? "ALL");
  const [consultantFilter, setConsultantFilter]  = useState(persisted.consultantFilter ?? "ALL");
  const [stageFilter,      setStageFilter]       = useState(persisted.stageFilter ?? "ALL");
  const [page,             setPage]              = useState(persisted.page ?? 0);
  const [pageSize,         setPageSize]          = useState(persisted.pageSize ?? 10);
  const [sortConfig,       setSortConfig]        = useState<SortConfig | null>(persisted.sortConfig ?? null);
  const [advancedRules,    setAdvancedRules]     = useState<RuleGroup | null>(persisted.advancedRules ?? null);

  useEffect(() => {
    const data: PersistedFilters = {
      search, statusFilter, stateFilter, consultantFilter, stageFilter,
      page, pageSize, sortConfig, advancedRules,
    };
    localStorage.setItem(FILTERS_KEY, JSON.stringify(data));
  }, [search, statusFilter, stateFilter, consultantFilter, stageFilter, page, pageSize, sortConfig, advancedRules]);

  // Columns
  const [visibleCols,  setVisibleCols]  = useState<Set<ColumnKey>>(() => loadColumns());
  const [colOrder,     setColOrder]     = useState<ColumnKey[]>(() => loadColOrder());
  const [colPanelOpen, setColPanelOpen] = useState(false);
  const colPanelRef = useRef<HTMLDivElement>(null);
  const dragColIdx  = useRef<number | null>(null);

  useEffect(() => {
    localStorage.setItem(COLUMNS_KEY, JSON.stringify([...visibleCols]));
  }, [visibleCols]);

  useEffect(() => {
    localStorage.setItem(COL_ORDER_KEY, JSON.stringify(colOrder));
  }, [colOrder]);

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
    setVisibleCols(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }

  function handleColDragStart(idx: number) { dragColIdx.current = idx; }
  function handleColDragOver(e: React.DragEvent, idx: number) {
    e.preventDefault();
    if (dragColIdx.current === null || dragColIdx.current === idx) return;
    setColOrder(prev => {
      const next = [...prev];
      const [item] = next.splice(dragColIdx.current!, 1);
      next.splice(idx, 0, item);
      dragColIdx.current = idx;
      return next;
    });
  }
  function handleColDragEnd() { dragColIdx.current = null; }

  // Inline updates
  const [updatingStage,      setUpdatingStage]      = useState<Set<string>>(new Set());
  const [updatingConsultant, setUpdatingConsultant] = useState<Set<string>>(new Set());

  // Checklist modal
  const [checklistModal,   setChecklistModal]   = useState<{ lead: Lead; stageId: string; stageName: string; reqs: Requirement[] } | null>(null);
  const [checkedReqs,      setCheckedReqs]      = useState<Set<string>>(new Set());
  const [checklistLoading, setChecklistLoading] = useState(false);

  // Sale modal
  const [saleModal,     setSaleModal]     = useState<Lead | null>(null);
  const [saleModalStep, setSaleModalStep] = useState<"confirm" | "form">("confirm");
  const [saleValue,     setSaleValue]     = useState("");
  const [saleDate,      setSaleDate]      = useState("");
  const [saleItems,     setSaleItems]     = useState<SaleItem[]>([]);
  const [saleLoading,   setSaleLoading]   = useState(false);

  const resetPage = () => setPage(0);

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

  async function handleInlineStageChange(lead: Lead, stageId: string) {
    if (!stageId) {
      // Clearing stage — no checklist needed
      setUpdatingStage(prev => new Set(prev).add(lead.id));
      try {
        await consultantMoveToStageWithChecklistAction(lead.id, null, []);
        refetch();
      } catch (e: unknown) {
        toast.error((e as Error).message || "Erro ao atualizar etapa");
      } finally {
        setUpdatingStage(prev => { const n = new Set(prev); n.delete(lead.id); return n; });
      }
      return;
    }

    setUpdatingStage(prev => new Set(prev).add(lead.id));
    try {
      const reqs = await getStageRequirementsAction(stageId);
      setUpdatingStage(prev => { const n = new Set(prev); n.delete(lead.id); return n; });

      const stageName = pipelineStages.find(s => s.id === stageId)?.name ?? stageId;

      if (reqs.length === 0) {
        // No requirements — apply directly
        setUpdatingStage(prev => new Set(prev).add(lead.id));
        try {
          await consultantMoveToStageWithChecklistAction(lead.id, stageId, []);
          refetch();
        } catch (e: unknown) {
          toast.error((e as Error).message || "Erro ao atualizar etapa");
        } finally {
          setUpdatingStage(prev => { const n = new Set(prev); n.delete(lead.id); return n; });
        }
      } else {
        // Has requirements — open checklist modal
        setCheckedReqs(new Set());
        setChecklistModal({ lead, stageId, stageName, reqs });
      }
    } catch (e: unknown) {
      setUpdatingStage(prev => { const n = new Set(prev); n.delete(lead.id); return n; });
      toast.error((e as Error).message || "Erro ao carregar requisitos");
    }
  }

  async function handleChecklistConfirm() {
    if (!checklistModal) return;
    setChecklistLoading(true);
    try {
      await consultantMoveToStageWithChecklistAction(
        checklistModal.lead.id,
        checklistModal.stageId,
        Array.from(checkedReqs),
      );
      toast.success(`Etapa atualizada para "${checklistModal.stageName}"`);
      setChecklistModal(null);
      refetch();
    } catch (e: unknown) {
      toast.error((e as Error).message || "Erro ao confirmar etapa");
    } finally {
      setChecklistLoading(false);
    }
  }

  function toggleReq(id: string) {
    setCheckedReqs(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  async function handleInlineConsultantChange(lead: Lead, consultant: string) {
    setUpdatingConsultant(prev => new Set(prev).add(lead.id));
    try {
      await consultantAssignConsultantAction(lead.id, consultant || null);
      refetch();
    } catch (e: unknown) {
      toast.error((e as Error).message || "Erro ao atualizar consultor");
    } finally {
      setUpdatingConsultant(prev => { const n = new Set(prev); n.delete(lead.id); return n; });
    }
  }

  function openSaleModal(lead: Lead) {
    setSaleModal(lead);
    setSaleModalStep("confirm");
    setSaleValue("");
    setSaleDate(new Date().toISOString().slice(0, 10));
    setSaleItems([]);
  }

  async function handleRegisterSale() {
    if (!saleModal || !saleValue) return;
    const value = parseFloat(saleValue.replace(",", "."));
    if (isNaN(value) || value <= 0) { toast.error("Valor inválido"); return; }
    setSaleLoading(true);
    try {
      await consultantRegisterSaleAction(
        saleModal.id, value, saleDate || undefined,
        saleItems.filter(i => i.name.trim()),
      );
      toast.success("Venda registrada!");
      setSaleModal(null);
      refetch();
    } catch (e: unknown) {
      toast.error((e as Error).message || "Erro ao registrar venda");
    } finally {
      setSaleLoading(false);
    }
  }

  const thClass = "px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]";

  function renderHeaderCell(key: ColumnKey) {
    switch (key) {
      case "phone":      return <th key={key} className={thClass}>Telefone</th>;
      case "email":      return <th key={key} className={thClass}>Email</th>;
      case "document":   return <th key={key} className={thClass}>Documento</th>;
      case "status":     return <th key={key} className={thClass}>Status</th>;
      case "pipeline":        return pipelineStages.length > 0 ? <th key={key} className={thClass}>Etapa</th> : null;
      case "lastRequirement": return <th key={key} className={thClass}>Requisitos</th>;
      case "state":      return <th key={key} className={thClass}>Estado</th>;
      case "consultant": return consultants.length > 0 ? <th key={key} className={thClass}>Consultor</th> : null;
      case "capturedAt": return (
        <th key={key} className="px-4 py-3 text-left">
          <button onClick={() => handleSort("capturedAt")} className="flex items-center text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)] hover:text-[var(--text)] transition-colors">
            Capturada em <SortIcon col="capturedAt" />
          </button>
        </th>
      );
      case "inactivity": return (
        <th key={key} className="px-4 py-3 text-left">
          <button onClick={() => handleSort("inactivity")} className="flex items-center text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)] hover:text-[var(--text)] transition-colors">
            Dias inativo <SortIcon col="inactivity" />
          </button>
        </th>
      );
      case "totalSales": return (
        <th key={key} className="px-4 py-3 text-left">
          <button onClick={() => handleSort("totalSales")} className="flex items-center text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)] hover:text-[var(--text)] transition-colors">
            Vol. Compras <SortIcon col="totalSales" />
          </button>
        </th>
      );
      case "lastSale": return (
        <th key={key} className="px-4 py-3 text-left">
          <button onClick={() => handleSort("lastSale")} className="flex items-center text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)] hover:text-[var(--text)] transition-colors">
            Última Compra <SortIcon col="lastSale" />
          </button>
        </th>
      );
      default: return null;
    }
  }

  function renderBodyCell(key: ColumnKey, lead: Lead, canEditStage: boolean) {
    switch (key) {
      case "phone": return <td key={key} className="px-4 py-3.5 text-[var(--text-muted)]">{lead.customer.phone}</td>;
      case "email": return (
        <td key={key} className="px-4 py-3.5 text-[var(--text-muted)]">
          <span className="truncate block max-w-[180px]" title={lead.customer.email ?? "—"}>{lead.customer.email || "—"}</span>
        </td>
      );
      case "document": return <td key={key} className="px-4 py-3.5 text-[var(--text-muted)]">{lead.customer.document || "—"}</td>;
      case "status": return (
        <td key={key} className="px-4 py-3.5">
          <LeadStatusBadge status={lead.status} pipelineStage={null} />
        </td>
      );
      case "pipeline": {
        if (pipelineStages.length === 0) return null;
        return (
          <td key={key} className="px-4 py-3.5" onClick={e => e.stopPropagation()}>
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
                    onChange={e => handleInlineStageChange(lead, e.target.value)}
                    className="h-7 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2 pr-6 text-xs text-[var(--text)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)] disabled:opacity-50 appearance-none cursor-pointer"
                  >
                    <option value="">— Sem etapa</option>
                    {pipelineStages.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
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
        );
      }
      case "lastRequirement": return (
        <td key={key} className="px-4 py-3.5 text-[var(--text-muted)]">
          {lead.lastCheckedRequirement ? (
            <span
              className="truncate block max-w-[200px]"
              title={[
                lead.lastCheckedRequirement.text,
                lead.lastCheckedRequirement.checkedAt
                  ? new Date(lead.lastCheckedRequirement.checkedAt).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })
                  : null,
              ].filter(Boolean).join(" · ")}
            >
              {lead.lastCheckedRequirement.text}
            </span>
          ) : "—"}
        </td>
      );
      case "state": return <td key={key} className="px-4 py-3.5 text-[var(--text-muted)]">{lead.customer.state || "—"}</td>;
      case "consultant": {
        if (consultants.length === 0) return null;
        return (
          <td key={key} className="px-4 py-3.5">
            <div className="relative">
              <select
                value={lead.consultant ?? ""}
                disabled={updatingConsultant.has(lead.id)}
                onChange={e => handleInlineConsultantChange(lead, e.target.value)}
                className="h-7 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2 pr-6 text-xs text-[var(--text)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)] disabled:opacity-50 appearance-none cursor-pointer"
              >
                <option value="">— Sem consultor</option>
                {consultants.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              {updatingConsultant.has(lead.id)
                ? <Loader2 size={10} className="absolute right-1.5 top-1/2 -translate-y-1/2 animate-spin text-[var(--text-muted)]" />
                : <ChevronDown size={10} className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
              }
            </div>
          </td>
        );
      }
      case "capturedAt": return (
        <td key={key} className="px-4 py-3.5 text-[var(--text-muted)]">
          {new Date(lead.capturedAt).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}
        </td>
      );
      case "inactivity": {
        const d = getInactivityDays(lead);
        return (
          <td key={key} className="px-4 py-3.5">
            <span className={`font-semibold tabular-nums ${d >= 30 ? "text-[var(--danger)]" : d >= 15 ? "text-[var(--warning)]" : "text-[var(--text-muted)]"}`}>{d}d</span>
          </td>
        );
      }
      case "totalSales": return (
        <td key={key} className="px-4 py-3.5">
          {lead.sales.length > 0
            ? <span className="font-semibold text-[var(--success)]">{formatBRL(getTotalSalesValue(lead))}</span>
            : <span className="text-[var(--text-muted)]">—</span>}
        </td>
      );
      case "lastSale": return (
        <td key={key} className="px-4 py-3.5">
          {lead.sales[0]
            ? <span className="font-medium text-[var(--text)]">{formatBRL(Number(lead.sales[0].value))}</span>
            : <span className="text-[var(--text-muted)]">—</span>}
        </td>
      );
      default: return null;
    }
  }

  // Filter
  const filtered = leads.filter(lead => {
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
        sales:           lead.sales.map(s => ({ value: s.value, soldAt: new Date(s.soldAt) })),
      }, advancedRules);
      if (!matches) return false;
    }

    const q = search.toLowerCase();
    const matchSearch = !q ||
      lead.customer.name.toLowerCase().includes(q) ||
      lead.customer.phone.includes(q) ||
      lead.customer.document?.includes(q) ||
      lead.customer.email?.toLowerCase().includes(q);

    const matchStatus =
      statusFilter === "ALL" ||
      (statusFilter === "NEW" && (lead.status === "NEW" || lead.status === "REGISTERED")) ||
      lead.status === statusFilter;

    const matchState      = stateFilter      === "ALL" || lead.customer.state === stateFilter;
    const matchConsultant = consultantFilter  === "ALL" || lead.consultant     === consultantFilter;
    const matchStage      = stageFilter       === "ALL" || lead.pipelineStage?.id === stageFilter;

    return matchSearch && matchStatus && matchState && matchConsultant && matchStage;
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

  const counts = {
    ALL:  leads.length,
    NEW:  leads.filter(l => l.status === "NEW" || l.status === "REGISTERED").length,
    SOLD: leads.filter(l => l.status === "SOLD").length,
    LOST: leads.filter(l => l.status === "LOST").length,
  };

  return (
    <div className="space-y-4">

      {/* Filters row */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none" />
          <input
            value={search}
            onChange={e => { setSearch(e.target.value); resetPage(); }}
            placeholder="Buscar por nome, telefone ou documento..."
            className="input w-full"
            style={{ paddingLeft: "3rem" }}
          />
        </div>

        <select value={stateFilter} onChange={e => { setStateFilter(e.target.value); resetPage(); }} className="input w-full lg:w-28">
          <option value="ALL">Estado</option>
          {ESTADOS.map(e => <option key={e} value={e}>{e}</option>)}
        </select>

        {consultants.length > 0 && (
          <select value={consultantFilter} onChange={e => { setConsultantFilter(e.target.value); resetPage(); }} className="input w-full lg:w-36">
            <option value="ALL">Consultor</option>
            {consultants.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        )}

        {pipelineStages.length > 0 && (
          <select value={stageFilter} onChange={e => { setStageFilter(e.target.value); resetPage(); }} className="input w-full lg:w-36">
            <option value="ALL">Etapa</option>
            {pipelineStages.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        )}
      </div>

      {/* Status tabs + column editor */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="soft-panel flex flex-wrap gap-1 p-1.5 w-fit">
          {(["ALL", "NEW", "SOLD", "LOST"] as const).map(tab => {
            const labels = { ALL: "Todas", NEW: "Novas", SOLD: "Vendidas", LOST: "Perdidas" };
            const active = statusFilter === tab;
            return (
              <button
                key={tab}
                onClick={() => { setStatusFilter(tab); resetPage(); }}
                className={`flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold transition-all ${
                  active ? "bg-[var(--surface-strong)] text-[var(--text)] shadow-sm" : "text-[var(--text-muted)] hover:text-[var(--text)]"
                }`}
              >
                {labels[tab]}
                <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                  active ? "bg-[var(--accent-soft)] text-[var(--accent)]" : "bg-[var(--border)] text-[var(--text-muted)]"
                }`}>{counts[tab]}</span>
              </button>
            );
          })}
        </div>

        {/* Column editor — apenas visível na tabela desktop */}
        <div className="relative hidden md:block" ref={colPanelRef}>
          <button
            onClick={() => setColPanelOpen(v => !v)}
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
            <div className="absolute right-0 top-11 z-20 w-56 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3 shadow-lg">
              <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Colunas — arraste para reordenar</p>
              <div className="space-y-0.5">
                {colOrder.map((key, idx) => {
                  const col = COLUMNS.find(c => c.key === key)!;
                  const on  = visibleCols.has(key);
                  return (
                    <div
                      key={key}
                      draggable
                      onDragStart={() => handleColDragStart(idx)}
                      onDragOver={(e) => handleColDragOver(e, idx)}
                      onDragEnd={handleColDragEnd}
                      className="flex items-center gap-1.5 rounded-xl px-2 py-1.5 cursor-grab active:cursor-grabbing hover:bg-[var(--surface-muted)] transition-colors"
                    >
                      <GripVertical size={12} className="shrink-0 text-[var(--text-muted)] opacity-40" />
                      <button
                        onClick={() => toggleCol(key)}
                        className="flex flex-1 items-center gap-2 text-sm text-[var(--text)]"
                      >
                        <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-[4px] border transition-colors ${
                          on ? "border-[var(--accent)] bg-[var(--accent)]" : "border-[var(--border)]"
                        }`}>
                          {on && <Check size={10} className="text-white" />}
                        </span>
                        {col.label}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      <AdvancedFiltersPanel
        pipelineStages={pipelineStages}
        matchCount={filtered.length}
        totalCount={leads.length}
        activeRules={advancedRules}
        onChange={(rules) => { setAdvancedRules(rules); resetPage(); }}
        hideSaveButton
      />

      {isFetching && (
        <div className="flex items-center gap-2 rounded-xl border border-[var(--accent)] bg-[var(--accent-soft)] px-3 py-2 text-xs font-medium text-[var(--accent)]">
          <Loader2 size={13} className="animate-spin" /> Atualizando...
        </div>
      )}

      {/* ── Mobile cards (< md) ──────────────────────────────────────────────── */}
      <div className="md:hidden space-y-3">
        {paginated.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--surface-muted)] text-[var(--text-muted)]">
              <Users size={22} />
            </div>
            <p className="text-sm font-semibold text-[var(--text)]">Nenhuma lead encontrada</p>
          </div>
        ) : paginated.map(lead => {
          const canEditStage = lead.status === "NEW" || lead.status === "REGISTERED";
          const inactivity   = getInactivityDays(lead);
          const totalSales   = getTotalSalesValue(lead);
          return (
            <div key={lead.id} className="card p-4 space-y-3">
              {/* Nome + status */}
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-semibold text-[var(--text)] truncate">{lead.customer.name}</p>
                  <p className="text-xs text-[var(--text-muted)] mt-0.5">{lead.customer.phone}</p>
                </div>
                <LeadStatusBadge status={lead.status} pipelineStage={null} />
              </div>

              {/* Etapa */}
              {pipelineStages.length > 0 && canEditStage && (
                <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                  <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ backgroundColor: lead.pipelineStage?.color ?? "var(--border)" }}
                  />
                  <div className="relative flex-1">
                    <select
                      value={lead.pipelineStage?.id ?? ""}
                      disabled={updatingStage.has(lead.id)}
                      onChange={e => handleInlineStageChange(lead, e.target.value)}
                      className="w-full h-9 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 pr-8 text-sm text-[var(--text)] focus:outline-none disabled:opacity-50 appearance-none"
                    >
                      <option value="">— Sem etapa</option>
                      {pipelineStages.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                    <div className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]">
                      {updatingStage.has(lead.id)
                        ? <Loader2 size={13} className="animate-spin" />
                        : <ChevronDown size={13} />}
                    </div>
                  </div>
                </div>
              )}
              {pipelineStages.length > 0 && !canEditStage && lead.pipelineStage && (
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: lead.pipelineStage.color }} />
                  <span className="text-sm text-[var(--text-muted)]">{lead.pipelineStage.name}</span>
                </div>
              )}

              {/* Métricas */}
              <div className="flex items-center gap-4 text-xs">
                <div>
                  <p className="text-[var(--text-muted)]">Inativo</p>
                  <p className={`font-semibold tabular-nums ${
                    inactivity >= 30 ? "text-[var(--danger)]" : inactivity >= 15 ? "text-[var(--warning)]" : "text-[var(--text)]"
                  }`}>{inactivity}d</p>
                </div>
                {totalSales > 0 && (
                  <div>
                    <p className="text-[var(--text-muted)]">Vol. compras</p>
                    <p className="font-semibold text-[var(--success)]">{formatBRL(totalSales)}</p>
                  </div>
                )}
                <div className="ml-auto text-right">
                  <p className="text-[var(--text-muted)]">Capturada</p>
                  <p className="font-medium text-[var(--text)]">{new Date(lead.capturedAt).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}</p>
                </div>
              </div>

              {/* Ações */}
              <div className="flex items-center gap-2 pt-1 border-t border-[var(--border)]">
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
                    onClick={() => openSaleModal(lead)}
                    className="flex h-10 flex-1 items-center justify-center gap-2 rounded-xl border border-[var(--success)] text-[var(--success)] text-sm font-medium hover:bg-[var(--success)] hover:text-white transition-colors"
                  >
                    <DollarSign size={15} />
                    {lead.status === "SOLD" ? "Recompra" : "Registrar venda"}
                  </button>
                )}
                <a
                  href={`/consultor/leads/${lead.id}`}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors"
                >
                  <Eye size={15} />
                </a>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Desktop table (≥ md) ─────────────────────────────────────────────── */}
      <div className="hidden md:block table-shell">
        {paginated.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--surface-muted)] text-[var(--text-muted)]">
              <Users size={22} />
            </div>
            <p className="text-sm font-semibold text-[var(--text)]">Nenhuma lead encontrada</p>
          </div>
        ) : (
          <div className="table-scroll">
            <table className="w-full text-sm">
              <thead className="bg-[var(--surface-muted)]">
                <tr className="border-b border-[var(--border)]">
                  <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">Nome</th>
                  {colOrder.filter(k => visibleCols.has(k)).map(k => renderHeaderCell(k))}
                  <th />
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {paginated.map(lead => {
                  const canEditStage = lead.status === "NEW" || lead.status === "REGISTERED";
                  return (
                    <tr key={lead.id} className="hover:bg-[var(--surface-muted)] transition-colors">
                      <td className="px-4 py-3.5">
                        <span className="font-semibold text-[var(--text)] block max-w-[180px] truncate" title={lead.customer.name}>
                          {lead.customer.name}
                        </span>
                      </td>
                      {colOrder.filter(k => visibleCols.has(k)).map(k => renderBodyCell(k, lead, canEditStage))}

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
                          {lead.status !== "LOST" && (
                            <button
                              onClick={() => openSaleModal(lead)}
                              title={lead.status === "SOLD" ? "Registrar recompra" : "Registrar venda"}
                              className="flex h-7 w-7 items-center justify-center rounded-lg border border-[var(--success)] text-[var(--success)] hover:bg-[var(--success)] hover:text-white transition-colors"
                            >
                              <DollarSign size={13} />
                            </button>
                          )}
                          <a
                            href={`/consultor/leads/${lead.id}`}
                            title="Ver detalhes"
                            className="flex h-7 w-7 items-center justify-center rounded-lg border border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors"
                          >
                            <Eye size={13} />
                          </a>
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

      {/* Footer */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <p className="text-xs text-[var(--text-muted)]">
            {sorted.length === 0 ? "0 leads" : `${safePage * pageSize + 1}–${Math.min((safePage + 1) * pageSize, sorted.length)} de ${sorted.length} leads`}
          </p>
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-[var(--text-muted)]">Por página:</span>
            <div className="flex gap-0.5 rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] p-0.5">
              {PAGE_SIZES.map(size => (
                <button
                  key={size}
                  onClick={() => { setPageSize(size); resetPage(); }}
                  className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-all ${
                    pageSize === size ? "bg-[var(--surface)] text-[var(--text)] shadow-sm" : "text-[var(--text-muted)] hover:text-[var(--text)]"
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
            <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={safePage === 0} className="flex h-8 w-8 items-center justify-center rounded-xl border border-[var(--border)] text-[var(--text-muted)] disabled:opacity-40">
              <ChevronLeft size={15} />
            </button>
            {pageNums.map((n, i) =>
              n === "..." ? (
                <span key={`e${i}`} className="flex h-8 w-8 items-center justify-center text-xs text-[var(--text-muted)]">…</span>
              ) : (
                <button key={n} onClick={() => setPage(n)} className={`flex h-8 w-8 items-center justify-center rounded-xl text-xs font-semibold ${
                  n === safePage ? "bg-[var(--accent)] text-white shadow-sm" : "border border-[var(--border)] text-[var(--text-muted)]"
                }`}>{n + 1}</button>
              )
            )}
            <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={safePage === totalPages - 1} className="flex h-8 w-8 items-center justify-center rounded-xl border border-[var(--border)] text-[var(--text-muted)] disabled:opacity-40">
              <ChevronRight size={15} />
            </button>
          </div>
        )}
      </div>

      {/* ── Checklist modal ──────────────────────────────────────────────────────── */}
      {checklistModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-2xl">
            <div className="p-6">
              {/* Header */}
              <div className="flex items-start justify-between mb-1">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent)]">
                    <ListChecks size={16} />
                  </div>
                  <div>
                    <h2 className="text-base font-semibold text-[var(--text)]">Requisitos da etapa</h2>
                    <p className="text-xs text-[var(--text-muted)]">
                      {checklistModal.stageName} · {checklistModal.lead.customer.name}
                    </p>
                  </div>
                </div>
                <button onClick={() => setChecklistModal(null)} className="text-[var(--text-muted)] hover:text-[var(--text)]">
                  <X size={16} />
                </button>
              </div>

              <p className="text-xs text-[var(--text-muted)] mt-3 mb-4">
                Confirme os itens abaixo antes de avançar a lead para esta etapa. Itens não marcados serão registrados como não concluídos.
              </p>

              {/* Checklist items */}
              <div className="space-y-2 mb-6">
                {checklistModal.reqs.map((req, idx) => {
                  const checked = checkedReqs.has(req.id);
                  return (
                    <button
                      key={req.id}
                      type="button"
                      onClick={() => toggleReq(req.id)}
                      className={`flex w-full items-start gap-3 rounded-xl border p-3 text-left transition-all ${
                        checked
                          ? "border-[var(--accent)] bg-[var(--accent-soft)]"
                          : "border-[var(--border)] bg-[var(--surface-muted)] hover:border-[var(--accent)]"
                      }`}
                    >
                      <div className={`mt-0.5 shrink-0 ${checked ? "text-[var(--accent)]" : "text-[var(--text-muted)]"}`}>
                        {checked ? <CheckSquare size={16} /> : <Square size={16} />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className={`text-sm ${checked ? "text-[var(--accent)] font-medium" : "text-[var(--text)]"}`}>
                          {idx + 1}. {req.text}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Progress */}
              <div className="mb-4">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs text-[var(--text-muted)]">
                    {checkedReqs.size} de {checklistModal.reqs.length} confirmados
                  </span>
                  {checkedReqs.size === checklistModal.reqs.length && (
                    <span className="text-xs font-semibold text-[var(--success)]">Tudo confirmado!</span>
                  )}
                </div>
                <div className="h-1.5 rounded-full bg-[var(--border)]">
                  <div
                    className="h-1.5 rounded-full bg-[var(--accent)] transition-all"
                    style={{ width: `${(checkedReqs.size / checklistModal.reqs.length) * 100}%` }}
                  />
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                <button
                  onClick={() => setChecklistModal(null)}
                  className="flex-1 h-10 rounded-xl border border-[var(--border)] text-sm text-[var(--text-muted)] hover:text-[var(--text)] transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleChecklistConfirm}
                  disabled={checklistLoading}
                  className="flex-1 h-10 rounded-xl bg-[var(--accent)] text-sm font-semibold text-white disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {checklistLoading
                    ? <Loader2 size={15} className="animate-spin" />
                    : checkedReqs.size < checklistModal.reqs.length
                    ? "Confirmar mesmo assim"
                    : "Confirmar e avançar"
                  }
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Sale modal ───────────────────────────────────────────────────────────── */}
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
                  <button onClick={() => setSaleModal(null)} className="flex-1 h-10 rounded-xl border border-[var(--border)] text-sm text-[var(--text-muted)]">Cancelar</button>
                  <button onClick={() => setSaleModalStep("form")} className="flex-1 h-10 rounded-xl bg-[var(--accent)] text-sm font-semibold text-white">Sim, é esta lead</button>
                </div>
              </div>
            ) : (
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-base font-semibold text-[var(--text)]">Registrar venda</h2>
                    <p className="text-xs text-[var(--text-muted)]">{saleModal.customer.name}</p>
                  </div>
                  <button onClick={() => setSaleModal(null)} className="text-[var(--text-muted)]"><X size={16} /></button>
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">Valor (R$) *</label>
                    <CurrencyInput value={saleValue} onValueChange={setSaleValue} className="input w-full" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">Data da venda</label>
                    <input type="date" value={saleDate} onChange={e => setSaleDate(e.target.value)} className="input w-full" />
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-medium text-[var(--text-muted)]">Itens (opcional)</label>
                      <button type="button" onClick={() => setSaleItems(p => [...p, { name: "", quantity: 1, price: 0 }])} className="flex items-center gap-1 text-xs text-[var(--accent)]">
                        <Plus size={12} /> Adicionar
                      </button>
                    </div>
                    {saleItems.map((item, i) => (
                      <div key={i} className="flex gap-2 items-center mb-2">
                        <input type="text" placeholder="Nome" value={item.name} onChange={e => setSaleItems(p => p.map((x, idx) => idx === i ? { ...x, name: e.target.value } : x))} className="input flex-1 text-xs h-8" />
                        <input type="number" min="1" value={item.quantity} onChange={e => setSaleItems(p => p.map((x, idx) => idx === i ? { ...x, quantity: parseInt(e.target.value) || 1 } : x))} className="input w-14 text-xs h-8 text-center" />
                        <input type="number" min="0" step="0.01" value={item.price || ""} onChange={e => setSaleItems(p => p.map((x, idx) => idx === i ? { ...x, price: parseFloat(e.target.value) || 0 } : x))} className="input w-24 text-xs h-8" placeholder="Preço" />
                        <button onClick={() => setSaleItems(p => p.filter((_, idx) => idx !== i))} className="text-[var(--text-muted)] hover:text-[var(--danger)]"><Minus size={13} /></button>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="flex gap-2 mt-6">
                  <button onClick={() => setSaleModalStep("confirm")} className="flex-1 h-10 rounded-xl border border-[var(--border)] text-sm text-[var(--text-muted)]">Voltar</button>
                  <button onClick={handleRegisterSale} disabled={saleLoading || !saleValue} className="flex-1 h-10 rounded-xl bg-[var(--success)] text-sm font-semibold text-white disabled:opacity-50">
                    {saleLoading ? <Loader2 size={15} className="mx-auto animate-spin" /> : "Registrar venda"}
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
