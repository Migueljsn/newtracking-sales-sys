"use client";

import { useState, useTransition } from "react";
import { SlidersHorizontal, X, Save, Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { RuleGroupEditor } from "@/components/ltv/rule-group-editor";
import { emptyGroup } from "@/lib/audiences/types";
import { createAudienceAction } from "@/app/(dashboard)/ltv/audience-actions";
import type { RuleGroup } from "@/lib/audiences/types";

interface Props {
  pipelineStages:  { id: string; name: string }[];
  matchCount:      number;
  totalCount:      number;
  activeRules:     RuleGroup | null;
  onChange:        (rules: RuleGroup | null) => void;
  hideSaveButton?: boolean;
}

export function AdvancedFiltersPanel({ pipelineStages, matchCount, totalCount, activeRules, onChange, hideSaveButton = false }: Props) {
  const [open,      setOpen]      = useState(false);
  const [group,     setGroup]     = useState<RuleGroup>(() => activeRules ?? emptyGroup());
  const [saveName,  setSaveName]  = useState("");
  const [showSave,  setShowSave]  = useState(false);
  const [isSaving,  startSave]    = useTransition();

  const hasRules = group.rules.length > 0;
  const isActive = activeRules !== null;

  function handleApply() {
    onChange(hasRules ? group : null);
  }

  function handleClear() {
    const fresh = emptyGroup();
    setGroup(fresh);
    onChange(null);
    setShowSave(false);
    setSaveName("");
  }

  function handleToggle() {
    if (!open && activeRules) setGroup(activeRules);
    if (!open && !activeRules) setGroup(emptyGroup());
    setOpen((v) => !v);
  }

  function handleSaveAsAudience() {
    if (!saveName.trim()) { toast.error("Informe um nome para o público"); return; }
    startSave(async () => {
      try {
        await createAudienceAction({ name: saveName.trim(), include: group, exclude: null });
        toast.success(`Público "${saveName.trim()}" salvo em Jornadas → Públicos`);
        setShowSave(false);
        setSaveName("");
      } catch {
        toast.error("Erro ao salvar público");
      }
    });
  }

  return (
    <div className="space-y-2">
      {/* Toggle button */}
      <button
        onClick={handleToggle}
        className={`flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-medium transition-colors ${
          isActive
            ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]"
            : "border-[var(--border)] bg-[var(--surface)] text-[var(--text-muted)] hover:text-[var(--text)] hover:border-[var(--border-strong)]"
        }`}
      >
        <SlidersHorizontal size={13} />
        Filtros avançados
        {isActive && (
          <span className="flex h-4 w-4 items-center justify-center rounded-full bg-[var(--accent)] text-[9px] font-bold text-white">
            ✓
          </span>
        )}
      </button>

      {/* Panel */}
      {open && (
        <div className="rounded-2xl border border-[var(--accent)] bg-[var(--surface)] shadow-sm">
          <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)]">
            <div className="flex items-center gap-2">
              <SlidersHorizontal size={14} className="text-[var(--accent)]" />
              <span className="text-sm font-semibold text-[var(--text)]">Filtros avançados</span>
              {isActive && (
                <span className="text-xs text-[var(--text-muted)]">
                  {matchCount} de {totalCount} leads
                </span>
              )}
            </div>
            <button onClick={() => setOpen(false)} className="text-[var(--text-muted)] hover:text-[var(--text)]">
              <X size={15} />
            </button>
          </div>

          <div className="p-4 space-y-4">
            <RuleGroupEditor
              group={group}
              onChange={setGroup}
              depth={0}
              pipelineStages={pipelineStages}
            />

            {/* Preview count */}
            {hasRules && (
              <p className="text-xs text-[var(--text-muted)]">
                {matchCount === totalCount
                  ? "Todas as leads correspondem às condições"
                  : `${matchCount} lead${matchCount !== 1 ? "s" : ""} corresponde${matchCount !== 1 ? "m" : ""} às condições`
                }
              </p>
            )}

            {/* Save as público */}
            {showSave ? (
              <div className="flex items-center gap-2">
                <input
                  value={saveName}
                  onChange={(e) => setSaveName(e.target.value)}
                  placeholder="Nome do público..."
                  className="input flex-1 text-xs h-8"
                  autoFocus
                  onKeyDown={(e) => { if (e.key === "Enter") handleSaveAsAudience(); if (e.key === "Escape") setShowSave(false); }}
                />
                <button
                  onClick={handleSaveAsAudience}
                  disabled={isSaving || !saveName.trim()}
                  className="flex items-center gap-1 rounded-xl bg-[var(--accent)] px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                >
                  {isSaving ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                  Salvar
                </button>
                <button onClick={() => setShowSave(false)} className="text-xs text-[var(--text-muted)] hover:text-[var(--text)]">
                  Cancelar
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  onClick={handleApply}
                  disabled={!hasRules}
                  className="flex items-center gap-1.5 rounded-xl bg-[var(--accent)] px-3 py-2 text-xs font-semibold text-white disabled:opacity-40 transition-opacity"
                >
                  <Check size={12} /> Aplicar filtros
                </button>
                {isActive && (
                  <button
                    onClick={handleClear}
                    className="flex items-center gap-1.5 rounded-xl border border-[var(--border)] px-3 py-2 text-xs font-medium text-[var(--text-muted)] hover:text-[var(--danger)] hover:border-[var(--danger)] transition-colors"
                  >
                    <X size={12} /> Limpar
                  </button>
                )}
                {hasRules && !hideSaveButton && (
                  <button
                    onClick={() => setShowSave(true)}
                    className="ml-auto flex items-center gap-1.5 rounded-xl border border-[var(--border)] px-3 py-2 text-xs font-medium text-[var(--text-muted)] hover:text-[var(--text)] transition-colors"
                  >
                    <Save size={12} /> Salvar como público
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
