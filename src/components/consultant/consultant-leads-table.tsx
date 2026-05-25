"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Search, ChevronLeft, ChevronRight, Loader2,
  ChevronDown, DollarSign, X, Plus, Minus, Users,
  ArrowDown, ArrowUp, ChevronsUpDown, CheckSquare, Square, ListChecks,
} from "lucide-react";
import { toast } from "sonner";
import { LeadStatusBadge } from "@/components/leads/lead-status-badge";
import { WhatsAppButton } from "@/components/leads/whatsapp-button";
import {
  consultantRegisterSaleAction,
  consultantMoveToStageWithChecklistAction,
  consultantAssignConsultantAction,
  getStageRequirementsAction,
} from "@/app/consultor/actions";
import type { LeadStatus, LeadSource } from "@prisma/client";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Lead {
  id:         string;
  status:     LeadStatus;
  source:     LeadSource;
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

interface Requirement { id: string; text: string }
interface SaleItem    { name: string; quantity: number; price: number }

// ─── Helpers ──────────────────────────────────────────────────────────────────

const PAGE_SIZES = [25, 50, 100];
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

  const [search,           setSearch]           = useState("");
  const [statusFilter,     setStatusFilter]      = useState<"ALL" | "NEW" | "SOLD" | "LOST">("ALL");
  const [stateFilter,      setStateFilter]       = useState("ALL");
  const [consultantFilter, setConsultantFilter]  = useState("ALL");
  const [stageFilter,      setStageFilter]       = useState("ALL");
  const [page,             setPage]              = useState(0);
  const [pageSize,         setPageSize]          = useState(50);
  const [sortConfig,       setSortConfig]        = useState<SortConfig | null>(null);

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

  // Filter
  const filtered = leads.filter(lead => {
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

      {/* Status tabs */}
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

      {isFetching && (
        <div className="flex items-center gap-2 rounded-xl border border-[var(--accent)] bg-[var(--accent-soft)] px-3 py-2 text-xs font-medium text-[var(--accent)]">
          <Loader2 size={13} className="animate-spin" /> Atualizando...
        </div>
      )}

      {/* Table */}
      <div className="table-shell">
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
                  <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">Telefone</th>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">Email</th>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">Documento</th>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">Status</th>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">Estado</th>
                  {pipelineStages.length > 0 && (
                    <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">Etapa</th>
                  )}
                  {consultants.length > 0 && (
                    <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">Consultor</th>
                  )}
                  <th className="px-4 py-3 text-left">
                    <button onClick={() => handleSort("capturedAt")} className="flex items-center text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)] hover:text-[var(--text)] transition-colors">
                      Capturada em <SortIcon col="capturedAt" />
                    </button>
                  </th>
                  <th className="px-4 py-3 text-left">
                    <button onClick={() => handleSort("inactivity")} className="flex items-center text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)] hover:text-[var(--text)] transition-colors">
                      Dias inativo <SortIcon col="inactivity" />
                    </button>
                  </th>
                  <th className="px-4 py-3 text-left">
                    <button onClick={() => handleSort("totalSales")} className="flex items-center text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)] hover:text-[var(--text)] transition-colors">
                      Vol. Compras <SortIcon col="totalSales" />
                    </button>
                  </th>
                  <th className="px-4 py-3 text-left">
                    <button onClick={() => handleSort("lastSale")} className="flex items-center text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)] hover:text-[var(--text)] transition-colors">
                      Última Compra <SortIcon col="lastSale" />
                    </button>
                  </th>
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
                      <td className="px-4 py-3.5 text-[var(--text-muted)]">{lead.customer.phone}</td>
                      <td className="px-4 py-3.5 text-[var(--text-muted)]">
                        <span className="truncate block max-w-[180px]" title={lead.customer.email ?? "—"}>
                          {lead.customer.email || "—"}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-[var(--text-muted)]">{lead.customer.document || "—"}</td>
                      <td className="px-4 py-3.5">
                        <LeadStatusBadge status={lead.status} pipelineStage={null} />
                      </td>
                      <td className="px-4 py-3.5 text-[var(--text-muted)]">{lead.customer.state || "—"}</td>

                      {pipelineStages.length > 0 && (
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
                      )}

                      {consultants.length > 0 && (
                        <td className="px-4 py-3.5">
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
                      )}

                      <td className="px-4 py-3.5 text-[var(--text-muted)]">
                        {new Date(lead.capturedAt).toLocaleDateString("pt-BR")}
                      </td>
                      <td className="px-4 py-3.5">
                        {(() => {
                          const d = getInactivityDays(lead);
                          return (
                            <span className={`font-semibold tabular-nums ${
                              d >= 30 ? "text-[var(--danger)]" : d >= 15 ? "text-[var(--warning)]" : "text-[var(--text-muted)]"
                            }`}>{d}d</span>
                          );
                        })()}
                      </td>
                      <td className="px-4 py-3.5">
                        {lead.sales.length > 0
                          ? <span className="font-semibold text-[var(--success)]">{formatBRL(getTotalSalesValue(lead))}</span>
                          : <span className="text-[var(--text-muted)]">—</span>}
                      </td>
                      <td className="px-4 py-3.5">
                        {lead.sales[0]
                          ? <span className="font-medium text-[var(--text)]">{formatBRL(Number(lead.sales[0].value))}</span>
                          : <span className="text-[var(--text-muted)]">—</span>}
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
                          {(lead.status === "NEW" || lead.status === "REGISTERED") && (
                            <button
                              onClick={() => openSaleModal(lead)}
                              title="Registrar venda"
                              className="flex h-7 w-7 items-center justify-center rounded-lg border border-[var(--success)] text-[var(--success)] hover:bg-[var(--success)] hover:text-white transition-colors"
                            >
                              <DollarSign size={13} />
                            </button>
                          )}
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
                    <input type="number" min="0" step="0.01" value={saleValue} onChange={e => setSaleValue(e.target.value)} placeholder="0,00" className="input w-full" />
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
