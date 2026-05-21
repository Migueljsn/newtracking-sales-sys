"use client";

import { Plus, X, FolderPlus } from "lucide-react";
import { RuleGroup, Rule, isGroup, emptyRule } from "@/lib/audiences/types";
import { RuleRow } from "./rule-row";

type PipelineStage = { id: string; name: string }

interface RuleGroupEditorProps {
  group:          RuleGroup
  onChange:       (group: RuleGroup) => void
  onRemove?:      () => void        // só existe em sub-grupos
  depth:          number            // 0 = raiz, 1 = sub-grupo (limite)
  pipelineStages: PipelineStage[]
}

export function RuleGroupEditor({
  group, onChange, onRemove, depth, pipelineStages,
}: RuleGroupEditorProps) {

  function toggleOperator() {
    onChange({ ...group, operator: group.operator === "AND" ? "OR" : "AND" })
  }

  function addRule() {
    onChange({ ...group, rules: [...group.rules, emptyRule()] })
  }

  function addSubGroup() {
    const sub: RuleGroup = {
      id:       crypto.randomUUID(),
      operator: "OR",
      rules:    [emptyRule()],
    }
    onChange({ ...group, rules: [...group.rules, sub] })
  }

  function updateChild(id: string, updated: Rule | RuleGroup) {
    onChange({ ...group, rules: group.rules.map((r) => r.id === id ? updated : r) })
  }

  function removeChild(id: string) {
    onChange({ ...group, rules: group.rules.filter((r) => r.id !== id) })
  }

  const isRoot = depth === 0

  return (
    <div
      className={`rounded-xl p-4 space-y-3 ${
        isRoot
          ? "border border-[var(--border)] bg-[var(--surface-muted)]"
          : "border-l-2 border-[var(--accent)] bg-[var(--accent-soft)]/30 pl-4 pr-3 py-3"
      }`}
    >
      {/* AND/OR + remove (sub-grupos) */}
      <div className="flex items-center gap-2">
        {!isRoot && (
          <span className="text-xs text-[var(--text-muted)] font-medium">Sub-grupo:</span>
        )}
        <span className="text-sm text-[var(--text-muted)]">Corresponder</span>
        <button
          type="button"
          onClick={toggleOperator}
          className="rounded-lg border border-[var(--accent)] bg-[var(--accent-soft)] px-2.5 py-0.5 text-xs font-semibold text-[var(--accent)] hover:bg-[var(--accent)] hover:text-white transition-colors"
        >
          {group.operator === "AND" ? "TODAS" : "QUALQUER"}
        </button>
        <span className="text-sm text-[var(--text-muted)]">das condições</span>
        {onRemove && (
          <button
            type="button"
            onClick={onRemove}
            className="ml-auto flex h-6 w-6 items-center justify-center rounded-lg text-[var(--text-muted)] hover:bg-[var(--danger-soft)] hover:text-[var(--danger)] transition-colors"
            title="Remover sub-grupo"
          >
            <X size={13} />
          </button>
        )}
      </div>

      {/* Rules e sub-grupos */}
      {group.rules.length === 0 && (
        <p className="text-sm text-[var(--text-muted)] italic">
          {isRoot ? "Nenhuma condição — corresponde a todos os leads." : "Sub-grupo vazio."}
        </p>
      )}

      <div className="space-y-2">
        {group.rules.map((child) => {
          if (isGroup(child)) {
            return (
              <RuleGroupEditor
                key={child.id}
                group={child}
                depth={depth + 1}
                pipelineStages={pipelineStages}
                onChange={(updated) => updateChild(child.id, updated)}
                onRemove={() => removeChild(child.id)}
              />
            )
          }
          return (
            <RuleRow
              key={child.id}
              rule={child}
              pipelineStages={pipelineStages}
              onChange={(updated) => updateChild(child.id, updated)}
              onRemove={() => removeChild(child.id)}
            />
          )
        })}
      </div>

      {/* Botões de adição */}
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={addRule}
          className="flex items-center gap-1.5 text-sm text-[var(--accent)] hover:text-[var(--accent-strong)] transition-colors"
        >
          <Plus size={13} />
          Adicionar condição
        </button>
        {isRoot && (
          <button
            type="button"
            onClick={addSubGroup}
            className="flex items-center gap-1.5 text-sm text-[var(--text-muted)] hover:text-[var(--text)] transition-colors"
          >
            <FolderPlus size={13} />
            Adicionar sub-grupo
          </button>
        )}
      </div>
    </div>
  )
}
