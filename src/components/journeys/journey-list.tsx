"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import {
  Plus, Archive, Copy, Trash2, Zap, Users, GitBranch,
  Square, CheckSquare, CheckSquare as CheckSquareIcon,
  BarChart2, Play, Pause,
} from "lucide-react";
import { toast } from "sonner";
import {
  createJourneyAction, archiveJourneyAction,
  deleteJourneyAction, duplicateJourneyAction,
  bulkDeleteJourneysAction, bulkArchiveJourneysAction,
  bulkDuplicateJourneysAction, bulkPublishJourneysAction,
  bulkPauseJourneysAction, publishJourneyAction, pauseJourneyAction,
} from "@/app/(dashboard)/journeys/actions";
import { JourneyMetricsDrawer } from "@/components/journeys/journey-metrics-drawer";
import { JourneyTemplateGallery } from "@/components/journeys/journey-template-gallery";

type Journey = {
  id:                string
  name:              string
  description:       string | null
  status:            string
  audienceName:      string | null
  nodeCount:         number
  enrollCount:       number
  completedCount:    number
  conversionRate:    number
  attributedRevenue: number
  updatedAt:         Date
}

const STATUS_LABEL: Record<string, string> = {
  DRAFT:    "Rascunho",
  ACTIVE:   "Ativo",
  PAUSED:   "Pausado",
  ARCHIVED: "Arquivado",
}

const STATUS_COLOR: Record<string, string> = {
  DRAFT:    "bg-[var(--surface-muted)] text-[var(--text-muted)]",
  ACTIVE:   "bg-[#10b981]/15 text-[#10b981]",
  PAUSED:   "bg-[#f59e0b]/15 text-[#f59e0b]",
  ARCHIVED: "bg-[var(--surface-muted)] text-[var(--text-muted)]",
}

interface JourneyListProps {
  journeys: Journey[]
}

export function JourneyList({ journeys }: JourneyListProps) {
  const [name,        setName]       = useState("");
  const [creating,    startCreate]   = useTransition();
  const [acting,      startAction]   = useTransition();

  // Metrics drawer
  const [metricsOpen,    setMetricsOpen]    = useState(false);
  const [metricsJourney, setMetricsJourney] = useState<{ id: string; name: string } | null>(null);

  // Template gallery
  const [templateGalleryOpen, setTemplateGalleryOpen] = useState(false);

  // Individual confirmations
  const [confirmDelete,  setConfirmDelete]  = useState<string | null>(null);
  const [confirmArchive, setConfirmArchive] = useState<string | null>(null);

  // Multi-select
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Bulk confirmations
  const [confirmBulkDelete,     setConfirmBulkDelete]     = useState(false);
  const [confirmBulkArchive,    setConfirmBulkArchive]    = useState(false);
  const [confirmBulkDuplicate,  setConfirmBulkDuplicate]  = useState(false);

  const [showCreate, setShowCreate] = useState(false);

  const allIds      = journeys.map((j) => j.id);
  const allSelected = allIds.length > 0 && allIds.every((id) => selected.has(id));
  const anySelected = selected.size > 0;

  const selectedJourneys = journeys.filter((j) => selected.has(j.id));
  const activatableIds   = selectedJourneys.filter((j) => j.status !== "ACTIVE" && j.status !== "ARCHIVED").map((j) => j.id);
  const pausableIds      = selectedJourneys.filter((j) => j.status === "ACTIVE").map((j) => j.id);

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(allIds));
  }

  function clearSelection() {
    setSelected(new Set());
    setConfirmBulkDelete(false);
    setConfirmBulkArchive(false);
    setConfirmBulkDuplicate(false);
  }

  // ── Individual actions ─────────────────────────────────────────────────────

  function handleCreate() {
    if (!name.trim()) return;
    startCreate(async () => {
      await createJourneyAction(name.trim());
    });
  }

  function handleDelete(id: string) {
    if (confirmDelete !== id) { setConfirmDelete(id); setConfirmArchive(null); return; }
    setConfirmDelete(null);
    startAction(async () => {
      try {
        await deleteJourneyAction(id);
        toast.success("Jornada removida");
      } catch { toast.error("Erro ao remover") }
    });
  }

  function handleArchive(id: string) {
    if (confirmArchive !== id) { setConfirmArchive(id); setConfirmDelete(null); return; }
    setConfirmArchive(null);
    startAction(async () => {
      try {
        await archiveJourneyAction(id);
        toast.success("Jornada arquivada");
      } catch { toast.error("Erro ao arquivar") }
    });
  }

  function handleDuplicate(id: string) {
    startAction(async () => {
      await duplicateJourneyAction(id);
    });
  }

  function handleToggleStatus(id: string, status: string) {
    startAction(async () => {
      try {
        if (status === "ACTIVE") {
          await pauseJourneyAction(id);
          toast.success("Jornada pausada");
        } else {
          await publishJourneyAction(id);
          toast.success("Jornada ativada");
        }
      } catch { toast.error("Erro ao alterar status") }
    });
  }

  // ── Bulk actions ───────────────────────────────────────────────────────────

  function handleBulkPublish() {
    const ids = activatableIds;
    if (ids.length === 0) return;
    clearSelection();
    startAction(async () => {
      try {
        await bulkPublishJourneysAction(ids);
        toast.success(`${ids.length} jornada${ids.length !== 1 ? "s" : ""} ativada${ids.length !== 1 ? "s" : ""}`);
      } catch { toast.error("Erro ao ativar") }
    });
  }

  function handleBulkPause() {
    const ids = pausableIds;
    if (ids.length === 0) return;
    clearSelection();
    startAction(async () => {
      try {
        await bulkPauseJourneysAction(ids);
        toast.success(`${ids.length} jornada${ids.length !== 1 ? "s" : ""} pausada${ids.length !== 1 ? "s" : ""}`);
      } catch { toast.error("Erro ao pausar") }
    });
  }

  function handleBulkDelete() {
    if (!confirmBulkDelete) { setConfirmBulkDelete(true); setConfirmBulkArchive(false); setConfirmBulkDuplicate(false); return; }
    const ids = [...selected];
    clearSelection();
    startAction(async () => {
      try {
        await bulkDeleteJourneysAction(ids);
        toast.success(`${ids.length} jornada${ids.length !== 1 ? "s" : ""} removida${ids.length !== 1 ? "s" : ""}`);
      } catch { toast.error("Erro ao remover") }
    });
  }

  function handleBulkDuplicate() {
    if (!confirmBulkDuplicate) { setConfirmBulkDuplicate(true); setConfirmBulkDelete(false); setConfirmBulkArchive(false); return; }
    const ids = [...selected];
    clearSelection();
    startAction(async () => {
      try {
        await bulkDuplicateJourneysAction(ids);
        toast.success(`${ids.length} jornada${ids.length !== 1 ? "s" : ""} duplicada${ids.length !== 1 ? "s" : ""} com "-cópia"`);
      } catch { toast.error("Erro ao duplicar") }
    });
  }

  function handleBulkArchive() {
    if (!confirmBulkArchive) { setConfirmBulkArchive(true); setConfirmBulkDelete(false); setConfirmBulkDuplicate(false); return; }
    const ids = [...selected];
    clearSelection();
    startAction(async () => {
      try {
        await bulkArchiveJourneysAction(ids);
        toast.success(`${ids.length} jornada${ids.length !== 1 ? "s" : ""} arquivada${ids.length !== 1 ? "s" : ""}`);
      } catch { toast.error("Erro ao arquivar") }
    });
  }

  return (
    <div className="space-y-4">

      {/* Metrics drawer */}
      {metricsJourney && (
        <JourneyMetricsDrawer
          journeyId={metricsJourney.id}
          journeyName={metricsJourney.name}
          open={metricsOpen}
          onClose={() => setMetricsOpen(false)}
        />
      )}

      {/* Template gallery */}
      <JourneyTemplateGallery
        open={templateGalleryOpen}
        onClose={() => setTemplateGalleryOpen(false)}
      />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {/* Select all checkbox */}
          {journeys.length > 0 && (
            <button
              type="button"
              onClick={toggleAll}
              className="text-[var(--text-muted)] hover:text-[var(--text)] transition-colors"
              title={allSelected ? "Desselecionar todos" : "Selecionar todos"}
            >
              {allSelected
                ? <CheckSquareIcon size={16} className="text-[var(--accent)]" />
                : <Square size={16} />}
            </button>
          )}
          <p className="text-sm text-[var(--text-muted)]">
            {journeys.length === 0
              ? "Nenhuma jornada criada"
              : `${journeys.length} jornada${journeys.length !== 1 ? "s" : ""}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setTemplateGalleryOpen(true)}
            className="flex items-center gap-2 h-9 rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] px-4 text-sm font-medium text-[var(--text)] hover:bg-[var(--surface-strong)] transition-colors"
          >
            Usar template
          </button>
          <button
            type="button"
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 h-9 rounded-xl bg-[var(--accent)] px-4 text-sm font-medium text-white hover:bg-[var(--accent-strong)] transition-colors"
          >
            <Plus size={15} />
            Nova jornada
          </button>
        </div>
      </div>

      {/* Bulk action bar */}
      {anySelected && (
        <div className="card px-4 py-2.5 flex items-center gap-3 border-[var(--accent)]/30">
          <span className="text-sm font-medium text-[var(--text)]">
            {selected.size} selecionada{selected.size !== 1 ? "s" : ""}
          </span>
          <div className="ml-auto flex items-center gap-2">
            {activatableIds.length > 0 && (
              <button
                type="button"
                onClick={handleBulkPublish}
                disabled={acting}
                className="flex items-center gap-1.5 h-8 rounded-xl px-3 text-sm font-medium transition-colors disabled:opacity-50 border border-[#10b981]/40 text-[#10b981] hover:bg-[#10b981]/10"
              >
                <Play size={13} />
                Ativar{activatableIds.length !== selectedJourneys.length ? ` (${activatableIds.length})` : ""}
              </button>
            )}
            {pausableIds.length > 0 && (
              <button
                type="button"
                onClick={handleBulkPause}
                disabled={acting}
                className="flex items-center gap-1.5 h-8 rounded-xl px-3 text-sm font-medium transition-colors disabled:opacity-50 border border-[#f59e0b]/40 text-[#f59e0b] hover:bg-[#f59e0b]/10"
              >
                <Pause size={13} />
                Pausar{pausableIds.length !== selectedJourneys.length ? ` (${pausableIds.length})` : ""}
              </button>
            )}
            <button
              type="button"
              onClick={handleBulkDuplicate}
              disabled={acting}
              className={`flex items-center gap-1.5 h-8 rounded-xl px-3 text-sm font-medium transition-colors disabled:opacity-50 ${
                confirmBulkDuplicate
                  ? "bg-[var(--accent)] text-white"
                  : "border border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--accent)] hover:text-[var(--accent)]"
              }`}
            >
              <Copy size={13} />
              {confirmBulkDuplicate ? "Confirmar duplicação" : "Duplicar"}
            </button>
            <button
              type="button"
              onClick={handleBulkArchive}
              disabled={acting}
              className={`flex items-center gap-1.5 h-8 rounded-xl px-3 text-sm font-medium transition-colors disabled:opacity-50 ${
                confirmBulkArchive
                  ? "bg-[#f59e0b] text-white"
                  : "border border-[var(--border)] text-[var(--text-muted)] hover:border-[#f59e0b] hover:text-[#f59e0b]"
              }`}
            >
              <Archive size={13} />
              {confirmBulkArchive ? "Confirmar arquivo" : "Arquivar"}
            </button>
            <button
              type="button"
              onClick={handleBulkDelete}
              disabled={acting}
              className={`flex items-center gap-1.5 h-8 rounded-xl px-3 text-sm font-medium transition-colors disabled:opacity-50 ${
                confirmBulkDelete
                  ? "bg-[var(--danger)] text-white"
                  : "border border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--danger)] hover:text-[var(--danger)]"
              }`}
            >
              <Trash2 size={13} />
              {confirmBulkDelete ? "Confirmar exclusão" : "Excluir"}
            </button>
            <button
              type="button"
              onClick={clearSelection}
              className="text-xs text-[var(--text-muted)] hover:text-[var(--text)] transition-colors px-2"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Create form */}
      {showCreate && (
        <div className="card p-4 flex items-center gap-3">
          <input
            autoFocus
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleCreate(); if (e.key === "Escape") setShowCreate(false); }}
            placeholder="Nome da jornada…"
            className="flex-1 h-9 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 text-sm text-[var(--text)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
          />
          <button
            type="button"
            onClick={handleCreate}
            disabled={creating || !name.trim()}
            className="h-9 rounded-xl bg-[var(--accent)] px-4 text-sm font-medium text-white hover:bg-[var(--accent-strong)] disabled:opacity-50 transition-colors"
          >
            {creating ? "Criando…" : "Criar"}
          </button>
          <button type="button" onClick={() => setShowCreate(false)} className="text-sm text-[var(--text-muted)] hover:text-[var(--text)]">Cancelar</button>
        </div>
      )}

      {/* Empty state */}
      {journeys.length === 0 && !showCreate && (
        <div className="card p-12 flex flex-col items-center gap-3 text-center">
          <div className="h-14 w-14 rounded-2xl bg-[var(--accent-soft)] flex items-center justify-center">
            <Zap size={26} className="text-[var(--accent)]" />
          </div>
          <div>
            <p className="font-semibold text-[var(--text)]">Nenhuma jornada criada</p>
            <p className="text-sm text-[var(--text-muted)] mt-1 max-w-sm">
              Crie automações visuais para engajar leads com e-mails, WhatsApp e mudanças de status.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setTemplateGalleryOpen(true)}
              className="flex items-center gap-2 h-9 rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] px-4 text-sm font-medium text-[var(--text)] hover:bg-[var(--surface-strong)] transition-colors"
            >
              Usar template
            </button>
            <button
              type="button"
              onClick={() => setShowCreate(true)}
              className="flex items-center gap-2 h-9 rounded-xl bg-[var(--accent)] px-4 text-sm font-medium text-white hover:bg-[var(--accent-strong)] transition-colors"
            >
              <Plus size={15} />
              Criar do zero
            </button>
          </div>
        </div>
      )}

      {/* List */}
      <div className="space-y-3">
        {journeys.map((j) => {
          const isSelected   = selected.has(j.id);
          const isDeletingMe = confirmDelete  === j.id;
          const isArchivingMe= confirmArchive === j.id;

          return (
            <div
              key={j.id}
              className={`card p-4 flex items-center gap-4 transition-colors ${
                isSelected ? "border-[var(--accent)]/40 bg-[var(--accent-soft)]/30" : ""
              }`}
            >
              {/* Checkbox */}
              <button
                type="button"
                onClick={() => toggleSelect(j.id)}
                className="shrink-0 text-[var(--text-muted)] hover:text-[var(--accent)] transition-colors"
              >
                {isSelected
                  ? <CheckSquare size={16} className="text-[var(--accent)]" />
                  : <Square size={16} />}
              </button>

              {/* Icon */}
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--accent-soft)]">
                <Zap size={18} className="text-[var(--accent)]" />
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <Link href={`/journeys/${j.id}`} className="font-medium text-[var(--text)] hover:text-[var(--accent)] transition-colors truncate">
                    {j.name}
                  </Link>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${STATUS_COLOR[j.status]}`}>
                    {STATUS_LABEL[j.status]}
                  </span>
                </div>
                <div className="flex items-center gap-3 mt-1 text-xs text-[var(--text-muted)]">
                  {j.audienceName && (
                    <span className="flex items-center gap-1">
                      <Users size={11} />
                      {j.audienceName}
                    </span>
                  )}
                  <span className="flex items-center gap-1">
                    <GitBranch size={11} />
                    {j.nodeCount} nó{j.nodeCount !== 1 ? "s" : ""}
                  </span>
                  <span>{j.enrollCount} inscrita{j.enrollCount !== 1 ? "s" : ""}</span>
                  {j.enrollCount > 0 && (
                    <>
                      <span className="text-[var(--success)] font-semibold">
                        {j.completedCount} concluídas
                      </span>
                      {j.conversionRate > 0 && (
                        <span className="text-[var(--warning)] font-semibold">
                          {j.conversionRate}% conversão
                        </span>
                      )}
                      {j.attributedRevenue > 0 && (
                        <span className="text-[#10b981] font-semibold">
                          {j.attributedRevenue.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} atribuído
                        </span>
                      )}
                    </>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1 shrink-0">
                {j.enrollCount > 0 && (
                  <button
                    type="button"
                    onClick={() => { setMetricsJourney({ id: j.id, name: j.name }); setMetricsOpen(true); }}
                    className="h-8 px-3 flex items-center gap-1.5 rounded-lg text-sm text-[var(--text-muted)] hover:bg-[var(--surface-muted)] hover:text-[var(--accent)] transition-colors"
                    title="Ver métricas"
                  >
                    <BarChart2 size={14} />
                  </button>
                )}

                {/* Activate / Pause toggle */}
                {j.status !== "ARCHIVED" && (
                  <button
                    type="button"
                    onClick={() => handleToggleStatus(j.id, j.status)}
                    disabled={acting}
                    className={`h-8 px-2.5 flex items-center gap-1.5 rounded-lg text-xs font-medium transition-colors disabled:opacity-50 ${
                      j.status === "ACTIVE"
                        ? "text-[#f59e0b] hover:bg-[#f59e0b]/10 border border-[#f59e0b]/30"
                        : "text-[#10b981] hover:bg-[#10b981]/10 border border-[#10b981]/30"
                    }`}
                    title={j.status === "ACTIVE" ? "Pausar jornada" : "Ativar jornada"}
                  >
                    {j.status === "ACTIVE" ? <Pause size={13} /> : <Play size={13} />}
                    {j.status === "ACTIVE" ? "Pausar" : "Ativar"}
                  </button>
                )}

                <Link
                  href={`/journeys/${j.id}`}
                  className="h-8 px-3 flex items-center gap-1.5 rounded-lg text-sm text-[var(--text-muted)] hover:bg-[var(--surface-muted)] hover:text-[var(--text)] transition-colors"
                >
                  Editar
                </Link>
                <button
                  type="button"
                  onClick={() => handleDuplicate(j.id)}
                  disabled={acting}
                  className="h-8 w-8 flex items-center justify-center rounded-lg text-[var(--text-muted)] hover:bg-[var(--surface-muted)] hover:text-[var(--text)] transition-colors"
                  title="Duplicar"
                >
                  <Copy size={14} />
                </button>
                {j.status !== "ARCHIVED" && (
                  <button
                    type="button"
                    onClick={() => handleArchive(j.id)}
                    disabled={acting}
                    className={`h-8 w-8 flex items-center justify-center rounded-lg transition-colors ${
                      isArchivingMe
                        ? "bg-[#f59e0b] text-white"
                        : "text-[var(--text-muted)] hover:bg-[#f59e0b]/10 hover:text-[#f59e0b]"
                    }`}
                    title={isArchivingMe ? "Confirmar arquivo" : "Arquivar"}
                  >
                    <Archive size={14} />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => handleDelete(j.id)}
                  disabled={acting}
                  className={`h-8 w-8 flex items-center justify-center rounded-lg transition-colors ${
                    isDeletingMe
                      ? "bg-[var(--danger)] text-white"
                      : "text-[var(--text-muted)] hover:bg-[var(--danger-soft)] hover:text-[var(--danger)]"
                  }`}
                  title={isDeletingMe ? "Confirmar exclusão" : "Excluir"}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
