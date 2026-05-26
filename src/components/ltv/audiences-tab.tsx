"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Plus, Pencil, Trash2, Users, Copy, CheckSquare, Square, ExternalLink, Download, ShieldMinus } from "lucide-react";
import { toast } from "sonner";
import { RuleGroup, isGroup, parseAudienceRules } from "@/lib/audiences/types";
import { getFieldDef } from "@/lib/audiences/fields";
import { AudienceBuilder } from "./audience-builder";
import {
  deleteAudienceAction,
  duplicateAudienceAction,
  bulkDeleteAudiencesAction,
  bulkDuplicateAudiencesAction,
} from "@/app/(dashboard)/ltv/audience-actions";

type PipelineStage = { id: string; name: string }

type AudienceRow = {
  id:          string
  name:        string
  description: string | null
  rules:       RuleGroup   // raw JSON stored — use parseAudienceRules to read
  createdAt:   Date
}

interface AudiencesTabProps {
  audiences:      AudienceRow[]
  pipelineStages: PipelineStage[]
}

type View = "list" | "new" | { edit: AudienceRow }

export function AudiencesTab({ audiences, pipelineStages }: AudiencesTabProps) {
  const [view,           setView]           = useState<View>("list")
  const [selected,       setSelected]       = useState<Set<string>>(new Set())
  const [deleting,        startDelete]        = useTransition()
  const [duplicating,     startDuplicate]     = useTransition()
  const [bulkDeleting,    startBulkDelete]    = useTransition()
  const [bulkDuplicating, startBulkDuplicate] = useTransition()
  const [confirmDelete,   setConfirmDelete]   = useState<string | null>(null)
  const [confirmDup,      setConfirmDup]      = useState<string | null>(null)
  const [confirmBulkDel,  setConfirmBulkDel]  = useState(false)
  const [confirmBulkDup,  setConfirmBulkDup]  = useState(false)

  const allSelected = audiences.length > 0 && selected.size === audiences.length

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
    // limpa confirmações ao mudar seleção
    setConfirmDelete(null)
    setConfirmDup(null)
    setConfirmBulkDel(false)
  }

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(audiences.map((a) => a.id)))
    setConfirmBulkDel(false)
  }

  function clearSelection() {
    setSelected(new Set())
    setConfirmBulkDel(false)
    setConfirmBulkDup(false)
  }

  // ── Individual delete (2 cliques) ─────────────────────────────────────────
  function handleDelete(id: string) {
    setConfirmDup(null)
    if (confirmDelete !== id) { setConfirmDelete(id); return }
    setConfirmDelete(null)
    startDelete(async () => {
      try {
        await deleteAudienceAction(id)
        setSelected((p) => { const n = new Set(p); n.delete(id); return n })
        toast.success("Público removido")
      } catch { toast.error("Erro ao remover público") }
    })
  }

  // ── Individual duplicate (2 cliques) ──────────────────────────────────────
  function handleDuplicate(id: string) {
    setConfirmDelete(null)
    if (confirmDup !== id) { setConfirmDup(id); return }
    setConfirmDup(null)
    startDuplicate(async () => {
      try {
        await duplicateAudienceAction(id)
        toast.success("Público duplicado")
      } catch { toast.error("Erro ao duplicar público") }
    })
  }

  // ── Bulk delete (2 cliques na barra) ──────────────────────────────────────
  function handleBulkDelete() {
    setConfirmBulkDup(false)
    if (!confirmBulkDel) { setConfirmBulkDel(true); return }
    setConfirmBulkDel(false)
    const ids = [...selected]
    startBulkDelete(async () => {
      try {
        await bulkDeleteAudiencesAction(ids)
        setSelected(new Set())
        toast.success(`${ids.length} público${ids.length !== 1 ? "s" : ""} removido${ids.length !== 1 ? "s" : ""}`)
      } catch { toast.error("Erro ao remover públicos") }
    })
  }

  // ── Bulk duplicate (2 cliques na barra) ───────────────────────────────────
  function handleBulkDuplicate() {
    setConfirmBulkDel(false)
    if (!confirmBulkDup) { setConfirmBulkDup(true); return }
    setConfirmBulkDup(false)
    const ids = [...selected]
    startBulkDuplicate(async () => {
      try {
        await bulkDuplicateAudiencesAction(ids)
        setSelected(new Set())
        toast.success(`${ids.length} público${ids.length !== 1 ? "s" : ""} duplicado${ids.length !== 1 ? "s" : ""} com "-cópia"`)
      } catch { toast.error("Erro ao duplicar públicos") }
    })
  }

  // ── Views: new / edit ──────────────────────────────────────────────────────
  if (view === "new") {
    return (
      <div className="card p-5 max-w-2xl">
        <h2 className="text-base font-semibold text-[var(--text)] mb-5">Novo público</h2>
        <AudienceBuilder
          pipelineStages={pipelineStages}
          onSaved={() => setView("list")}
          onCancel={() => setView("list")}
        />
      </div>
    )
  }

  if (typeof view === "object" && "edit" in view) {
    const def = parseAudienceRules(view.edit.rules)
    return (
      <div className="card p-5 max-w-2xl">
        <h2 className="text-base font-semibold text-[var(--text)] mb-5">Editar público</h2>
        <AudienceBuilder
          pipelineStages={pipelineStages}
          audience={{ ...view.edit, include: def.include, exclude: def.exclude }}
          onSaved={() => setView("list")}
          onCancel={() => setView("list")}
        />
      </div>
    )
  }

  return (
    <div className="space-y-4">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          {audiences.length > 0 && (
            <button
              type="button"
              onClick={toggleAll}
              className="flex items-center gap-1.5 text-sm text-[var(--text-muted)] hover:text-[var(--text)] transition-colors"
              title={allSelected ? "Desmarcar todos" : "Selecionar todos"}
            >
              {allSelected
                ? <CheckSquare size={16} className="text-[var(--accent)]" />
                : <Square size={16} />
              }
              <span className="text-xs">Selecionar todos</span>
            </button>
          )}
          <p className="text-sm text-[var(--text-muted)]">
            {audiences.length === 0
              ? "Nenhum público salvo"
              : `${audiences.length} público${audiences.length !== 1 ? "s" : ""}`
            }
          </p>
        </div>
        <button
          type="button"
          onClick={() => setView("new")}
          className="flex items-center gap-2 h-9 rounded-xl bg-[var(--accent)] px-4 text-sm font-medium text-white hover:bg-[var(--accent-strong)] transition-colors"
        >
          <Plus size={15} />
          Novo público
        </button>
      </div>

      {/* ── Barra de ações em massa ────────────────────────────────────────── */}
      {selected.size > 0 && (
        <div className="flex items-center gap-3 rounded-xl border border-[var(--accent)] bg-[var(--accent-soft)] px-4 py-2.5">
          <span className="text-sm font-medium text-[var(--accent)]">
            {selected.size} selecionado{selected.size !== 1 ? "s" : ""}
          </span>
          <div className="flex-1" />
          <button
            type="button"
            onClick={handleBulkDuplicate}
            disabled={bulkDuplicating}
            className={`flex items-center gap-1.5 h-8 rounded-lg px-3 text-sm font-medium transition-colors ${
              confirmBulkDup
                ? "bg-[var(--accent)] text-white"
                : "border border-[var(--accent)] text-[var(--accent)] hover:bg-[var(--accent-soft)]"
            }`}
          >
            <Copy size={13} />
            {confirmBulkDup ? "Confirmar duplicação" : "Duplicar selecionados"}
          </button>
          <button
            type="button"
            onClick={handleBulkDelete}
            disabled={bulkDeleting}
            className={`flex items-center gap-1.5 h-8 rounded-lg px-3 text-sm font-medium transition-colors ${
              confirmBulkDel
                ? "bg-[var(--danger)] text-white"
                : "border border-[var(--danger)] text-[var(--danger)] hover:bg-[var(--danger-soft)]"
            }`}
          >
            <Trash2 size={13} />
            {confirmBulkDel ? "Confirmar exclusão" : "Excluir selecionados"}
          </button>
          <button
            type="button"
            onClick={clearSelection}
            className="text-sm text-[var(--text-muted)] hover:text-[var(--text)] transition-colors"
          >
            Cancelar
          </button>
        </div>
      )}

      {/* ── Empty state ────────────────────────────────────────────────────── */}
      {audiences.length === 0 && (
        <div className="card p-10 flex flex-col items-center gap-3 text-center">
          <div className="h-12 w-12 rounded-2xl bg-[var(--accent-soft)] flex items-center justify-center">
            <Users size={22} className="text-[var(--accent)]" />
          </div>
          <div>
            <p className="font-medium text-[var(--text)]">Nenhum público criado</p>
            <p className="text-sm text-[var(--text-muted)] mt-1 max-w-xs">
              Crie segmentações de leads com regras dinâmicas para usar em jornadas e campanhas.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setView("new")}
            className="flex items-center gap-2 h-9 rounded-xl bg-[var(--accent)] px-4 text-sm font-medium text-white hover:bg-[var(--accent-strong)] transition-colors"
          >
            <Plus size={15} />
            Criar primeiro público
          </button>
        </div>
      )}

      {/* ── Lista ──────────────────────────────────────────────────────────── */}
      <div className="space-y-3">
        {audiences.map((aud) => {
          const isSelected = selected.has(aud.id)
          return (
            <div
              key={aud.id}
              className={`card p-4 flex items-start gap-3 transition-colors ${
                isSelected ? "border-[var(--accent)] bg-[var(--accent-soft)]" : ""
              }`}
            >
              {/* Checkbox */}
              <button
                type="button"
                onClick={() => toggleSelect(aud.id)}
                className="mt-0.5 shrink-0 text-[var(--text-muted)] hover:text-[var(--accent)] transition-colors"
                title={isSelected ? "Desmarcar" : "Selecionar"}
              >
                {isSelected
                  ? <CheckSquare size={16} className="text-[var(--accent)]" />
                  : <Square size={16} />
                }
              </button>

              {/* Icon */}
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--accent-soft)]">
                <Users size={18} className="text-[var(--accent)]" />
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <p className="font-medium text-[var(--text)]">{aud.name}</p>
                {aud.description && (
                  <p className="text-sm text-[var(--text-muted)] mt-0.5">{aud.description}</p>
                )}
                <RuleSummary rules={aud.rules} pipelineStages={pipelineStages} />
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1 shrink-0">
                <Link
                  href={`/leads?audienceId=${aud.id}`}
                  className="h-8 w-8 flex items-center justify-center rounded-lg text-[var(--text-muted)] hover:bg-[var(--surface-muted)] hover:text-[var(--text)] transition-colors"
                  title="Ver leads"
                >
                  <ExternalLink size={14} />
                </Link>
                <a
                  href={`/api/audiences/${aud.id}/export`}
                  download
                  className="h-8 w-8 flex items-center justify-center rounded-lg text-[var(--text-muted)] hover:bg-[var(--surface-muted)] hover:text-[var(--text)] transition-colors"
                  title="Exportar leads (XLSX)"
                >
                  <Download size={14} />
                </a>
                <button
                  type="button"
                  onClick={() => { setView({ edit: aud }); setConfirmDelete(null); setConfirmDup(null) }}
                  className="h-8 w-8 flex items-center justify-center rounded-lg text-[var(--text-muted)] hover:bg-[var(--surface-muted)] hover:text-[var(--text)] transition-colors"
                  title="Editar"
                >
                  <Pencil size={14} />
                </button>

                {/* Duplicar — 2 cliques */}
                <button
                  type="button"
                  onClick={() => handleDuplicate(aud.id)}
                  disabled={duplicating}
                  className={`h-8 w-8 flex items-center justify-center rounded-lg transition-colors ${
                    confirmDup === aud.id
                      ? "bg-[var(--accent)] text-white"
                      : "text-[var(--text-muted)] hover:bg-[var(--surface-muted)] hover:text-[var(--text)]"
                  }`}
                  title={confirmDup === aud.id ? "Clique novamente para confirmar" : "Duplicar"}
                >
                  <Copy size={14} />
                </button>

                {/* Excluir — 2 cliques */}
                <button
                  type="button"
                  onClick={() => handleDelete(aud.id)}
                  disabled={deleting}
                  className={`h-8 w-8 flex items-center justify-center rounded-lg transition-colors ${
                    confirmDelete === aud.id
                      ? "bg-[var(--danger)] text-white"
                      : "text-[var(--text-muted)] hover:bg-[var(--danger-soft)] hover:text-[var(--danger)]"
                  }`}
                  title={confirmDelete === aud.id ? "Clique novamente para confirmar" : "Excluir"}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Rule summary ──────────────────────────────────────────────────────────────

function groupSummary(group: RuleGroup, pipelineStages: PipelineStage[]): string {
  const flat = group.rules.filter((r) => !isGroup(r)) as Array<{ id: string; field: string; operator: string; value: string }>
  if (flat.length === 0) return "todos"
  const parts = flat.slice(0, 2).map((r) => {
    const def = getFieldDef(r.field)
    const stageLabel = r.field === "pipelineStageId"
      ? (pipelineStages.find((s) => s.id === r.value)?.name ?? r.value)
      : null
    return `${def?.label ?? r.field} ${r.operator} ${stageLabel ?? r.value}`
  })
  const connector = group.operator === "AND" ? " · " : " ou "
  const extra = flat.length > 2 ? ` +${flat.length - 2}` : ""
  return parts.join(connector) + extra
}

function RuleSummary({ rules, pipelineStages }: { rules: RuleGroup; pipelineStages: PipelineStage[] }) {
  const def = parseAudienceRules(rules)
  const incText = groupSummary(def.include, pipelineStages)
  const hasExclude = def.exclude && def.exclude.rules.length > 0

  return (
    <div className="mt-1 space-y-0.5">
      <p className="text-xs text-[var(--text-muted)] truncate">
        <span className="font-medium text-[var(--text-muted)]">Incluir:</span> {incText}
      </p>
      {hasExclude && (
        <p className="text-xs text-[var(--danger)] truncate flex items-center gap-1">
          <ShieldMinus size={10} />
          <span className="font-medium">Excluir:</span> {groupSummary(def.exclude!, pipelineStages)}
        </p>
      )}
    </div>
  )
}
