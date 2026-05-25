"use client";

import { X } from "lucide-react";
import { Rule } from "@/lib/audiences/types";
import { FIELD_DEFS, OPERATORS_BY_TYPE, getFieldDef, defaultOperator, defaultValue } from "@/lib/audiences/fields";

type PipelineStage = { id: string; name: string }

interface RuleRowProps {
  rule:           Rule
  pipelineStages: PipelineStage[]
  onChange:       (rule: Rule) => void
  onRemove:       () => void
}

export function RuleRow({ rule, pipelineStages, onChange, onRemove }: RuleRowProps) {
  const fieldDef = getFieldDef(rule.field)
  const fieldType = fieldDef?.type ?? "text"
  const operators = OPERATORS_BY_TYPE[fieldType]
  const needsValue = rule.operator !== "empty" && rule.operator !== "not_empty"
    && fieldType !== "boolean" && rule.operator !== "empty"

  function handleFieldChange(field: string) {
    const def = getFieldDef(field)
    const type = def?.type ?? "text"
    const op   = defaultOperator(type)
    let val = defaultValue(field)
    if (type === "pipeline_stage") val = pipelineStages[0]?.id ?? ""
    onChange({ ...rule, field, operator: op, value: val })
  }

  function handleOperatorChange(operator: string) {
    onChange({ ...rule, operator })
  }

  function handleValueChange(value: string) {
    onChange({ ...rule, value })
  }

  const selectClass = "h-8 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2 text-sm text-[var(--text)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
  const inputClass  = "h-8 w-28 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2 text-sm text-[var(--text)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Field */}
      <select
        value={rule.field}
        onChange={(e) => handleFieldChange(e.target.value)}
        className={selectClass}
      >
        {["lead", "cliente", "vendas"].map((cat) => (
          <optgroup key={cat} label={cat.charAt(0).toUpperCase() + cat.slice(1)}>
            {FIELD_DEFS.filter((f) => f.category === cat).map((f) => (
              <option key={f.value} value={f.value}>{f.label}</option>
            ))}
          </optgroup>
        ))}
      </select>

      {/* Operator */}
      {fieldType !== "boolean" && (
        <select
          value={rule.operator}
          onChange={(e) => handleOperatorChange(e.target.value)}
          className={selectClass}
        >
          {operators.map((op) => (
            <option key={op.value} value={op.value}>{op.label}</option>
          ))}
        </select>
      )}

      {/* Value */}
      {fieldType === "boolean" && (
        <select
          value={rule.operator}
          onChange={(e) => handleOperatorChange(e.target.value)}
          className={selectClass}
        >
          {operators.map((op) => (
            <option key={op.value} value={op.value}>{op.label}</option>
          ))}
        </select>
      )}

      {fieldType === "select" && needsValue && (
        <select
          value={rule.value}
          onChange={(e) => handleValueChange(e.target.value)}
          className={selectClass}
        >
          {fieldDef?.options?.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      )}

      {fieldType === "pipeline_stage" && needsValue && rule.operator !== "empty" && (
        <select
          value={rule.value}
          onChange={(e) => handleValueChange(e.target.value)}
          className={selectClass}
        >
          {pipelineStages.length === 0
            ? <option value="">Nenhuma etapa cadastrada</option>
            : pipelineStages.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))
          }
        </select>
      )}

      {fieldType === "number" && needsValue && (
        <input
          type="number"
          value={rule.value}
          onChange={(e) => handleValueChange(e.target.value)}
          className={inputClass}
          min={0}
        />
      )}

      {fieldType === "text" && needsValue && (
        <input
          type="text"
          value={rule.value}
          onChange={(e) => handleValueChange(e.target.value)}
          placeholder="valor"
          className={inputClass}
        />
      )}

      {/* Remove */}
      <button
        type="button"
        onClick={onRemove}
        className="flex h-7 w-7 items-center justify-center rounded-lg text-[var(--text-muted)] hover:bg-[var(--danger-soft)] hover:text-[var(--danger)] transition-colors"
      >
        <X size={14} />
      </button>
    </div>
  )
}
