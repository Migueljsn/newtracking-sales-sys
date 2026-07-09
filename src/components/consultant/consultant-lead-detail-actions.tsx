"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronDown, DollarSign, Loader2, X,
  Plus, Minus, CheckSquare, Square, ListChecks, XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { CurrencyInput } from "@/components/ui/currency-input";
import { PasteSaleItems } from "@/components/sales/paste-sale-items";
import {
  consultantRegisterSaleAction,
  consultantMoveToStageWithChecklistAction,
  consultantMarkAsLostAction,
  getStageRequirementsAction,
} from "@/app/consultor/actions";
import type { LeadStatus } from "@prisma/client";

interface Stage       { id: string; name: string; color: string }
interface Requirement { id: string; text: string }
interface SaleItem    { name: string; quantity: number; price: number }

interface LeadInfo {
  id:              string;
  status:          LeadStatus;
  pipelineStageId: string | null;
  pipelineStage:   { id: string; name: string; color: string } | null;
  customer: { name: string; document: string | null; phone: string };
}

interface Props {
  lead:           LeadInfo;
  pipelineStages: Stage[];
}

export function ConsultantLeadDetailActions({ lead, pipelineStages }: Props) {
  const router = useRouter();

  const [updatingStage,    setUpdatingStage]    = useState(false);
  const [checklistModal,   setChecklistModal]   = useState<{ stageId: string; stageName: string; reqs: Requirement[] } | null>(null);
  const [checkedReqs,      setCheckedReqs]      = useState<Set<string>>(new Set());
  const [checklistLoading, setChecklistLoading] = useState(false);

  const [saleOpen,    setSaleOpen]    = useState(false);
  const [saleValue,   setSaleValue]   = useState("");
  const [saleDate,    setSaleDate]    = useState(new Date().toISOString().slice(0, 10));
  const [saleItems,   setSaleItems]   = useState<SaleItem[]>([]);
  const [saleLoading, setSaleLoading] = useState(false);

  function syncSaleValueFromItems(list: SaleItem[]) {
    const total = list.reduce((sum, item) => item.name.trim() ? sum + item.quantity * item.price : sum, 0);
    if (total > 0) setSaleValue(String(total));
  }

  function updateSaleItem(i: number, patch: Partial<SaleItem>) {
    const next = saleItems.map((x, idx) => idx === i ? { ...x, ...patch } : x);
    setSaleItems(next);
    syncSaleValueFromItems(next);
  }

  function removeSaleItem(i: number) {
    const next = saleItems.filter((_, idx) => idx !== i);
    setSaleItems(next);
    syncSaleValueFromItems(next);
  }

  const [lostConfirm, setLostConfirm] = useState(false);
  const [lostLoading, setLostLoading] = useState(false);

  const canEditStage = lead.status === "NEW" || lead.status === "REGISTERED";
  const canSell      = lead.status !== "LOST";
  const canMarkLost  = lead.status !== "LOST" && lead.status !== "SOLD";

  async function handleMarkLost() {
    setLostLoading(true);
    try {
      await consultantMarkAsLostAction(lead.id);
      toast.success("Lead marcada como perdida");
      setLostConfirm(false);
      router.refresh();
    } catch (e: unknown) {
      toast.error((e as Error).message || "Erro ao marcar como perdida");
    } finally {
      setLostLoading(false);
    }
  }

  async function handleStageChange(stageId: string) {
    if (!stageId) {
      setUpdatingStage(true);
      try {
        await consultantMoveToStageWithChecklistAction(lead.id, null, []);
        router.refresh();
      } catch (e: unknown) {
        toast.error((e as Error).message || "Erro ao atualizar etapa");
      } finally {
        setUpdatingStage(false);
      }
      return;
    }

    setUpdatingStage(true);
    try {
      const reqs = await getStageRequirementsAction(stageId);
      setUpdatingStage(false);
      const stageName = pipelineStages.find(s => s.id === stageId)?.name ?? stageId;
      if (reqs.length === 0) {
        setUpdatingStage(true);
        try {
          await consultantMoveToStageWithChecklistAction(lead.id, stageId, []);
          router.refresh();
        } finally {
          setUpdatingStage(false);
        }
      } else {
        setCheckedReqs(new Set());
        setChecklistModal({ stageId, stageName, reqs });
      }
    } catch (e: unknown) {
      setUpdatingStage(false);
      toast.error((e as Error).message || "Erro ao carregar requisitos");
    }
  }

  async function handleChecklistConfirm() {
    if (!checklistModal) return;
    setChecklistLoading(true);
    try {
      await consultantMoveToStageWithChecklistAction(lead.id, checklistModal.stageId, Array.from(checkedReqs));
      toast.success(`Etapa atualizada para "${checklistModal.stageName}"`);
      setChecklistModal(null);
      router.refresh();
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

  async function handleRegisterSale() {
    if (!saleValue) return;
    const value = parseFloat(saleValue.replace(",", "."));
    if (isNaN(value) || value <= 0) { toast.error("Valor inválido"); return; }
    setSaleLoading(true);
    try {
      await consultantRegisterSaleAction(lead.id, value, saleDate || undefined, saleItems.filter(i => i.name.trim()));
      toast.success("Venda registrada!");
      setSaleOpen(false);
      setSaleValue("");
      setSaleItems([]);
      router.refresh();
    } catch (e: unknown) {
      toast.error((e as Error).message || "Erro ao registrar venda");
    } finally {
      setSaleLoading(false);
    }
  }

  if (!canEditStage && !canSell && !canMarkLost && pipelineStages.length === 0) return null;

  return (
    <>
      <div className="card p-5 space-y-4">
        <h2 className="text-sm font-semibold text-[var(--text)]">Ações</h2>

        {canEditStage && pipelineStages.length > 0 && (
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-sm text-[var(--text-muted)] shrink-0">Etapa atual:</span>
            <div className="flex items-center gap-2">
              <span
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ backgroundColor: lead.pipelineStage?.color ?? "var(--border)" }}
              />
              <div className="relative">
                <select
                  value={lead.pipelineStage?.id ?? ""}
                  disabled={updatingStage}
                  onChange={e => handleStageChange(e.target.value)}
                  className="h-9 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 pr-8 text-sm text-[var(--text)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)] disabled:opacity-50 appearance-none cursor-pointer"
                >
                  <option value="">— Sem etapa</option>
                  {pipelineStages.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
                {updatingStage
                  ? <Loader2 size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 animate-spin text-[var(--text-muted)]" />
                  : <ChevronDown size={13} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
                }
              </div>
            </div>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2">
          {canSell && (
            <button
              onClick={() => { setSaleOpen(true); setSaleValue(""); setSaleDate(new Date().toISOString().slice(0, 10)); setSaleItems([]); }}
              className="flex items-center gap-2 h-9 rounded-xl border border-[var(--success)] px-4 text-sm font-semibold text-[var(--success)] hover:bg-[var(--success)] hover:text-white transition-colors"
            >
              <DollarSign size={15} />
              {lead.status === "SOLD" ? "Registrar recompra" : "Registrar venda"}
            </button>
          )}

          {canMarkLost && (
            lostConfirm ? (
              <div className="flex items-center gap-2">
                <span className="text-xs text-[var(--danger)]">Marcar como perdida?</span>
                <button
                  onClick={handleMarkLost}
                  disabled={lostLoading}
                  className="flex h-9 items-center gap-1.5 rounded-xl bg-[var(--danger)] px-3 text-sm font-semibold text-white disabled:opacity-50"
                >
                  {lostLoading && <Loader2 size={13} className="animate-spin" />}
                  Confirmar
                </button>
                <button onClick={() => setLostConfirm(false)} className="text-sm text-[var(--text-muted)]">
                  Cancelar
                </button>
              </div>
            ) : (
              <button
                onClick={() => setLostConfirm(true)}
                className="flex items-center gap-2 h-9 rounded-xl border border-[var(--border)] px-4 text-sm font-medium text-[var(--text-muted)] hover:border-[var(--danger)] hover:text-[var(--danger)] transition-colors"
              >
                <XCircle size={15} />
                Marcar como perdida
              </button>
            )
          )}
        </div>
      </div>

      {/* ── Checklist modal ─────────────────────────────────────────────────────── */}
      {checklistModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-2xl">
            <div className="p-6">
              <div className="flex items-start justify-between mb-1">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent)]">
                    <ListChecks size={16} />
                  </div>
                  <div>
                    <h2 className="text-base font-semibold text-[var(--text)]">Requisitos da etapa</h2>
                    <p className="text-xs text-[var(--text-muted)]">{checklistModal.stageName}</p>
                  </div>
                </div>
                <button onClick={() => setChecklistModal(null)} className="text-[var(--text-muted)] hover:text-[var(--text)]">
                  <X size={16} />
                </button>
              </div>
              <p className="text-xs text-[var(--text-muted)] mt-3 mb-4">
                Confirme os itens antes de avançar para esta etapa.
              </p>
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
                      <span className={`text-sm ${checked ? "text-[var(--accent)] font-medium" : "text-[var(--text)]"}`}>
                        {idx + 1}. {req.text}
                      </span>
                    </button>
                  );
                })}
              </div>
              <div className="mb-4">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs text-[var(--text-muted)]">{checkedReqs.size} de {checklistModal.reqs.length} confirmados</span>
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
              <div className="flex gap-2">
                <button onClick={() => setChecklistModal(null)} className="flex-1 h-10 rounded-xl border border-[var(--border)] text-sm text-[var(--text-muted)]">
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
      {saleOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-2xl">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-base font-semibold text-[var(--text)]">Registrar venda</h2>
                  <p className="text-xs text-[var(--text-muted)]">{lead.customer.name}</p>
                </div>
                <button onClick={() => setSaleOpen(false)} className="text-[var(--text-muted)] hover:text-[var(--text)]">
                  <X size={16} />
                </button>
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
                    <button
                      type="button"
                      onClick={() => setSaleItems(p => [...p, { name: "", quantity: 1, price: 0 }])}
                      className="flex items-center gap-1 text-xs text-[var(--accent)]"
                    >
                      <Plus size={12} /> Adicionar
                    </button>
                  </div>
                  <div className="mb-2">
                    <PasteSaleItems onImport={(items, total) => { setSaleItems(items); setSaleValue(String(total)); }} />
                  </div>
                  {saleItems.map((item, i) => (
                    <div key={i} className="flex gap-2 items-center mb-2">
                      <input
                        type="text" placeholder="Nome" value={item.name}
                        onChange={e => updateSaleItem(i, { name: e.target.value })}
                        className="input flex-1 text-xs h-8"
                      />
                      <input
                        type="number" min="1" value={item.quantity}
                        onChange={e => updateSaleItem(i, { quantity: parseInt(e.target.value) || 1 })}
                        className="input w-14 text-xs h-8 text-center"
                      />
                      <CurrencyInput
                        value={String(item.price)}
                        onValueChange={v => updateSaleItem(i, { price: parseFloat(v) || 0 })}
                        className="input w-28 text-xs h-8"
                      />
                      <button onClick={() => removeSaleItem(i)} className="text-[var(--text-muted)] hover:text-[var(--danger)]">
                        <Minus size={13} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex gap-2 mt-6">
                <button onClick={() => setSaleOpen(false)} className="flex-1 h-10 rounded-xl border border-[var(--border)] text-sm text-[var(--text-muted)]">
                  Cancelar
                </button>
                <button
                  onClick={handleRegisterSale}
                  disabled={saleLoading || !saleValue}
                  className="flex-1 h-10 rounded-xl bg-[var(--success)] text-sm font-semibold text-white disabled:opacity-50 flex items-center justify-center"
                >
                  {saleLoading ? <Loader2 size={15} className="animate-spin" /> : "Registrar venda"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
