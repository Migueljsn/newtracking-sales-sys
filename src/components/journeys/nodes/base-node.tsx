"use client";

import { Handle, Position, NodeProps } from "@xyflow/react";

interface BaseNodeProps {
  label:    string
  color:    string
  icon:     React.ReactNode
  summary:  string
  selected: boolean
  hasInput?: boolean
  hasTrueOutput?:  boolean
  hasFalseOutput?: boolean
  hasOutput?: boolean
  dualOutputs?: { id: string; label: string; color: string; left: string }[]
}

export function BaseNode({
  label, color, icon, summary, selected,
  hasInput = true, hasOutput = true,
  hasTrueOutput = false, hasFalseOutput = false,
  dualOutputs,
}: BaseNodeProps) {
  const isCondition = hasTrueOutput || hasFalseOutput
  const isDual = !!dualOutputs?.length

  return (
    <div
      className={`min-w-[180px] max-w-[220px] rounded-2xl border-2 bg-[var(--surface)] shadow-sm transition-all ${
        selected ? "border-[var(--accent)] shadow-[var(--shadow-accent)]" : "border-[var(--border)]"
      }`}
    >
      {/* Header */}
      <div
        className="flex items-center gap-2 rounded-t-xl px-3 py-2"
        style={{ backgroundColor: `${color}18` }}
      >
        <span style={{ color }} className="shrink-0">{icon}</span>
        <span className="text-xs font-semibold" style={{ color }}>{label}</span>
      </div>

      {/* Summary */}
      <div className="px-3 py-2">
        <p className="text-xs text-[var(--text-muted)] leading-relaxed">{summary || "Não configurado"}</p>
      </div>

      {/* Handles */}
      {hasInput && (
        <Handle
          type="target"
          position={Position.Top}
          className="!w-3 !h-3 !border-2 !border-[var(--border)] !bg-[var(--surface)]"
        />
      )}

      {hasOutput && !isCondition && !isDual && (
        <Handle
          type="source"
          position={Position.Bottom}
          className="!w-3 !h-3 !border-2 !border-[var(--border)] !bg-[var(--surface)]"
        />
      )}

      {isCondition && (
        <>
          <Handle
            type="source"
            position={Position.Bottom}
            id="true"
            style={{ left: "30%" }}
            className="!w-3 !h-3 !border-2 !border-[#10b981] !bg-[#10b981]"
          />
          <Handle
            type="source"
            position={Position.Bottom}
            id="false"
            style={{ left: "70%" }}
            className="!w-3 !h-3 !border-2 !border-[#ef4444] !bg-[#ef4444]"
          />
        </>
      )}

      {isDual && dualOutputs!.map((o) => (
        <Handle
          key={o.id}
          type="source"
          position={Position.Bottom}
          id={o.id}
          style={{ left: o.left, borderColor: o.color, backgroundColor: o.color }}
          className="!w-3 !h-3 !border-2"
        />
      ))}
    </div>
  )
}
