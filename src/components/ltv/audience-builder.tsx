"use client";

import { useState, useCallback, useTransition, useRef, useEffect } from "react";
import { Loader2, Users, Zap, ShieldMinus, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { RuleGroup, emptyGroup } from "@/lib/audiences/types";
import { RuleGroupEditor } from "./rule-group-editor";
import { AUDIENCE_TEMPLATES } from "@/lib/audiences/templates";
import {
  previewAudienceAction,
  createAudienceAction,
  updateAudienceAction,
} from "@/app/(dashboard)/ltv/audience-actions";

type PipelineStage = { id: string; name: string }

type ExistingAudience = {
  id:          string
  name:        string
  description: string | null
  include:     RuleGroup
  exclude:     RuleGroup | null
}

interface AudienceBuilderProps {
  pipelineStages: PipelineStage[]
  audience?:      ExistingAudience
  onSaved:        () => void
  onCancel:       () => void
}

function freshGroup(): RuleGroup {
  return { id: crypto.randomUUID(), operator: "AND", rules: [] }
}

function cloneTemplate(tpl: RuleGroup): RuleGroup {
  return {
    ...tpl,
    id:    crypto.randomUUID(),
    rules: tpl.rules.map((r) =>
      "rules" in r
        ? { ...r, id: crypto.randomUUID(), rules: (r as RuleGroup).rules.map((rr) => ({ ...rr, id: crypto.randomUUID() })) }
        : { ...r, id: crypto.randomUUID() }
    ),
  }
}

export function AudienceBuilder({ pipelineStages, audience, onSaved, onCancel }: AudienceBuilderProps) {
  const isEdit = !!audience

  const [step,        setStep]        = useState<"template" | "form">(isEdit ? "form" : "template")
  const [name,        setName]        = useState(audience?.name        ?? "")
  const [description, setDescription] = useState(audience?.description ?? "")
  const [include,     setInclude]     = useState<RuleGroup>(() => audience?.include ?? freshGroup())
  const [exclude,     setExclude]     = useState<RuleGroup | null>(() => audience?.exclude ?? null)

  const [count,        setCount]       = useState<number | null>(null)
  const [isPreviewing, startPreview]   = useTransition()
  const [isSaving,     startSave]      = useTransition()
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const triggerPreview = useCallback((inc: RuleGroup, exc: RuleGroup | null) => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      startPreview(async () => {
        try {
          const result = await previewAudienceAction(inc, exc)
          setCount(result.count)
        } catch { /* silent */ }
      })
    }, 600)
  }, [])

  useEffect(() => {
    if (step === "form") triggerPreview(include, exclude)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [step]) // eslint-disable-line react-hooks/exhaustive-deps

  function handleIncludeChange(next: RuleGroup) {
    setInclude(next)
    triggerPreview(next, exclude)
  }

  function handleExcludeChange(next: RuleGroup) {
    setExclude(next)
    triggerPreview(include, next)
  }

  function addExclusion() {
    const g = emptyGroup()
    setExclude(g)
    triggerPreview(include, g)
  }

  function removeExclusion() {
    setExclude(null)
    triggerPreview(include, null)
  }

  function applyTemplate(tpl: RuleGroup, label: string) {
    const cloned = cloneTemplate(tpl)
    setInclude(cloned)
    setName((prev) => prev || label)
    setStep("form")
    triggerPreview(cloned, null)
  }

  function handleSave() {
    if (!name.trim()) { toast.error("Dê um nome ao público"); return }
    startSave(async () => {
      try {
        if (isEdit) {
          await updateAudienceAction(audience.id, {
            name:        name.trim(),
            description: description.trim() || undefined,
            include,
            exclude,
          })
          toast.success("Público atualizado")
        } else {
          await createAudienceAction({
            name:        name.trim(),
            description: description.trim() || undefined,
            include,
            exclude,
          })
          toast.success("Público criado")
        }
        onSaved()
      } catch {
        toast.error("Erro ao salvar público")
      }
    })
  }

  // ── Step: template picker ──────────────────────────────────────────────────
  if (step === "template") {
    return (
      <div className="space-y-5">
        <div>
          <p className="text-sm font-medium text-[var(--text)]">Escolha um ponto de partida</p>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">Ou comece do zero e adicione suas próprias condições.</p>
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          {AUDIENCE_TEMPLATES.map((tpl) => (
            <button
              key={tpl.label}
              type="button"
              onClick={() => applyTemplate(tpl.rules, tpl.label)}
              className="text-left rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3.5 hover:border-[var(--accent)] hover:bg-[var(--accent-soft)] transition-all group"
            >
              <div className="flex items-start gap-2.5">
                <Zap size={14} className="mt-0.5 shrink-0 text-[var(--accent)] opacity-70 group-hover:opacity-100" />
                <div>
                  <p className="text-sm font-medium text-[var(--text)]">{tpl.label}</p>
                  <p className="text-xs text-[var(--text-muted)] mt-0.5">{tpl.description}</p>
                </div>
              </div>
            </button>
          ))}
        </div>

        <div className="flex gap-3 pt-1">
          <button type="button" onClick={onCancel}
            className="h-9 rounded-xl border border-[var(--border)] px-4 text-sm font-medium text-[var(--text-muted)] hover:bg-[var(--surface-muted)] transition-colors"
          >
            Cancelar
          </button>
          <button type="button" onClick={() => setStep("form")}
            className="h-9 rounded-xl border border-[var(--border)] px-4 text-sm font-medium text-[var(--text)] hover:bg-[var(--surface-muted)] transition-colors"
          >
            Começar do zero
          </button>
        </div>
      </div>
    )
  }

  // ── Step: form ─────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">
      {/* Name + description */}
      <div className="space-y-3">
        <div>
          <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">Nome do público</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex: Leads sem contato há 7+ dias"
            className="w-full h-9 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 text-sm text-[var(--text)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">
            Descrição <span className="font-normal">(opcional)</span>
          </label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Adicione uma descrição"
            className="w-full h-9 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 text-sm text-[var(--text)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
          />
        </div>
      </div>

      {/* ── Inclusion rules ─────────────────────────────────────────────────── */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <div className="flex h-5 w-5 items-center justify-center rounded-md bg-[var(--accent-soft)]">
            <Users size={11} className="text-[var(--accent)]" />
          </div>
          <p className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">Incluir quem</p>
        </div>
        <RuleGroupEditor
          group={include}
          depth={0}
          pipelineStages={pipelineStages}
          onChange={handleIncludeChange}
        />
      </div>

      {/* ── Exclusion rules ─────────────────────────────────────────────────── */}
      {exclude ? (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-5 w-5 items-center justify-center rounded-md bg-[var(--danger-soft)]">
                <ShieldMinus size={11} className="text-[var(--danger)]" />
              </div>
              <p className="text-xs font-semibold uppercase tracking-wider text-[var(--danger)]">Excluir quem</p>
            </div>
            <button
              type="button"
              onClick={removeExclusion}
              className="flex items-center gap-1 text-xs text-[var(--text-muted)] hover:text-[var(--danger)] transition-colors"
            >
              <X size={12} /> Remover exclusão
            </button>
          </div>
          <div className="rounded-xl border border-[var(--danger)]/30 bg-[var(--danger-soft)]/30 p-3">
            <RuleGroupEditor
              group={exclude}
              depth={0}
              pipelineStages={pipelineStages}
              onChange={handleExcludeChange}
            />
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={addExclusion}
          className="flex items-center gap-2 text-xs font-medium text-[var(--text-muted)] hover:text-[var(--danger)] transition-colors rounded-xl border border-dashed border-[var(--border)] hover:border-[var(--danger)]/50 w-full px-4 py-2.5 justify-center"
        >
          <ShieldMinus size={13} />
          Adicionar critérios de exclusão
        </button>
      )}

      {/* Preview */}
      <div className="flex items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3">
        <Users size={15} className="shrink-0 text-[var(--text-muted)]" />
        {isPreviewing ? (
          <Loader2 size={14} className="animate-spin text-[var(--text-muted)]" />
        ) : count === null ? (
          <span className="text-sm text-[var(--text-muted)]">Adicione condições para ver o preview.</span>
        ) : (
          <span className="text-sm text-[var(--text)]">
            <span className="text-xl font-bold">{count.toLocaleString("pt-BR")}</span>
            {" "}lead{count !== 1 ? "s" : ""} corresponde{count !== 1 ? "m" : ""} a este público
            {exclude && exclude.rules.length > 0 && (
              <span className="ml-1 text-xs text-[var(--danger)]">(após exclusão)</span>
            )}
          </span>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => isEdit ? onCancel() : setStep("template")}
          className="flex-1 h-9 rounded-xl border border-[var(--border)] text-sm font-medium text-[var(--text-muted)] hover:bg-[var(--surface-muted)] transition-colors"
        >
          {isEdit ? "Cancelar" : "Voltar"}
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={isSaving || !name.trim()}
          className="flex-1 h-9 rounded-xl bg-[var(--accent)] text-sm font-medium text-white hover:bg-[var(--accent-strong)] disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
        >
          {isSaving && <Loader2 size={13} className="animate-spin" />}
          {isEdit ? "Salvar alterações" : "Criar público"}
        </button>
      </div>
    </div>
  )
}
