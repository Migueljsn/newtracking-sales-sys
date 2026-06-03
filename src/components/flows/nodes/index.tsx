"use client";

import { useRef, useLayoutEffect, useState } from "react";
import { Handle, Position, NodeProps } from "@xyflow/react";
import {
  Zap, HelpCircle, GitBranch,
  ArrowRightLeft, UserCheck, UserPlus, ExternalLink, Square,
  FileText, Image, FileArchive, Type, MousePointerClick,
} from "lucide-react";
import { BaseNode } from "@/components/journeys/nodes/base-node";
import type {
  FlowTriggerData, FlowMessageData, FlowQuestionData,
  FlowConditionData, FlowChangeStatusData, FlowAssignData,
  FlowAddToAudienceData, FlowStartFlowData,
} from "@/lib/flows/types";
import { FIELD_DEFS } from "@/lib/audiences/fields";

// ── Trigger ───────────────────────────────────────────────────────────────────
export function FlowTriggerNode({ data, selected }: NodeProps) {
  const d = data as unknown as FlowTriggerData;
  const summary =
    d.triggerType === "audience"      ? (d.audienceName ?? "Público não selecionado") :
    d.triggerType === "keyword"       ? (d.keyword ? `Palavra: "${d.keyword}"` : "Palavra-chave não definida") :
    d.triggerType === "first_message" ? "Primeiro contato do lead" :
    "Não configurado";
  return (
    <BaseNode label="Gatilho" color="#6366f1" icon={<Zap size={13} />}
      summary={summary} selected={!!selected} hasInput={false} />
  );
}

// ── Message ───────────────────────────────────────────────────────────────────
export function FlowMessageNode({ data, selected }: NodeProps) {
  const d    = data as unknown as FlowMessageData;
  const msgs = d.messages?.length
    ? d.messages
    : [{ messageType: d.messageType ?? "text", text: d.text ?? "" }];

  const first = msgs[0];
  const icon  =
    first.messageType === "document" ? <FileArchive size={13} /> :
    first.messageType === "media"    ? <Image       size={13} /> :
                                       <FileText    size={13} />;

  const preview = first.text
    ? first.text.slice(0, 40) + (first.text.length > 40 ? "…" : "")
    : first.messageType === "document" ? "Documento não configurado"
    : first.messageType === "media"    ? "Mídia não configurada"
    : "Mensagem não configurada";

  const summary = msgs.length > 1
    ? `${preview} (+${msgs.length - 1} mensagem${msgs.length - 1 > 1 ? "s" : ""})`
    : preview;

  return (
    <BaseNode label="Mensagem" color="#10b981" icon={icon}
      summary={summary} selected={!!selected} />
  );
}

// ── Question ──────────────────────────────────────────────────────────────────
type QuestionOutput = { id: string; label: string; color: string };

export function FlowQuestionNode({ data, selected }: NodeProps) {
  const d       = data as unknown as FlowQuestionData;
  const buttons = d.buttons ?? [];

  const outputs: QuestionOutput[] = d.mode === "choice"
    ? [
        ...buttons.map((b, i) => ({
          id:    `btn_${b.id}`,
          label: b.text || `Botão ${i + 1}`,
          color: "#10b981",
        })),
        { id: "timeout", label: "Timeout", color: "#f97316" },
      ]
    : [
        { id: "valid",   label: "Válido",   color: "#10b981" },
        { id: "invalid", label: "Inválido", color: "#ef4444" },
        { id: "timeout", label: "Timeout",  color: "#f97316" },
      ];

  const summary = d.questionText
    ? d.questionText.slice(0, 48) + (d.questionText.length > 48 ? "…" : "")
    : "Pergunta não configurada";

  const icon = d.mode === "choice"
    ? <MousePointerClick size={13} />
    : <Type size={13} />;

  const rowRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [tops, setTops] = useState<number[]>([]);

  useLayoutEffect(() => {
    // offsetTop usa coordenadas CSS locais — independente do zoom do canvas
    const next = rowRefs.current.slice(0, outputs.length).map((row) => {
      if (!row) return 0;
      return Math.round(row.offsetTop + row.offsetHeight / 2);
    });
    setTops((prev) =>
      prev.length === next.length && prev.every((v, i) => v === next[i]) ? prev : next
    );
  }, [outputs.length]);

  return (
    <div
      className={`relative min-w-[210px] max-w-[250px] rounded-2xl border-2 bg-[var(--surface)] shadow-sm transition-all ${
        selected
          ? "border-[var(--accent)] shadow-[var(--shadow-accent)]"
          : "border-[var(--border)]"
      }`}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!w-3 !h-3 !border-2 !border-[var(--border)] !bg-[var(--surface)]"
      />

      {/* Header */}
      <div
        className="flex items-center gap-2 rounded-t-xl px-3 py-2"
        style={{ backgroundColor: "#0ea5e918" }}
      >
        <span style={{ color: "#0ea5e9" }} className="shrink-0">{icon}</span>
        <span className="text-xs font-semibold" style={{ color: "#0ea5e9" }}>Pergunta</span>
      </div>

      {/* Summary */}
      <div className="px-3 py-2 border-b border-[var(--border)]">
        <p className="text-xs text-[var(--text-muted)] leading-relaxed">{summary}</p>
      </div>

      {/* Output rows — labeled, handle na borda direita */}
      <div className="py-1">
        {outputs.map((o, i) => (
          <div
            key={o.id}
            ref={(el) => { rowRefs.current[i] = el; }}
            className="flex items-center gap-1.5 px-3 py-1 pr-5"
          >
            <span
              className="text-[11px] font-semibold truncate flex-1"
              style={{ color: o.color }}
            >
              {o.label}
            </span>
            <span className="text-[10px] shrink-0" style={{ color: o.color }}>→</span>
            <Handle
              type="source"
              position={Position.Right}
              id={o.id}
              style={{
                top: tops[i] !== undefined ? tops[i] : undefined,
                borderColor: o.color,
                backgroundColor: o.color,
              }}
              className="!w-3 !h-3 !border-2"
            />
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Condition ─────────────────────────────────────────────────────────────────
export function FlowConditionNode({ data, selected }: NodeProps) {
  const d          = data as unknown as FlowConditionData;
  const fieldLabel = FIELD_DEFS.find((f) => f.value === d.field)?.label ?? d.field;
  return (
    <BaseNode label="Condição" color="#8b5cf6" icon={<GitBranch size={13} />}
      summary={`${fieldLabel} ${d.operator} ${d.value}`}
      selected={!!selected} hasTrueOutput hasFalseOutput />
  );
}

// ── Change Status ─────────────────────────────────────────────────────────────
export function FlowChangeStatusNode({ data, selected }: NodeProps) {
  const d       = data as unknown as FlowChangeStatusData;
  const summary = d.action === "lost" ? "Marcar como perdida" : (d.stageName ?? "Etapa não selecionada");
  return (
    <BaseNode label="Mover etapa" color="#f97316" icon={<ArrowRightLeft size={13} />}
      summary={summary} selected={!!selected} />
  );
}

// ── Assign ────────────────────────────────────────────────────────────────────
export function FlowAssignNode({ data, selected }: NodeProps) {
  const d = data as unknown as FlowAssignData;
  return (
    <BaseNode label="Atribuir" color="#06b6d4" icon={<UserCheck size={13} />}
      summary={d.consultant || "Consultor não definido"} selected={!!selected} />
  );
}

// ── Add to Audience ───────────────────────────────────────────────────────────
export function FlowAddToAudienceNode({ data, selected }: NodeProps) {
  const d = data as unknown as FlowAddToAudienceData;
  return (
    <BaseNode label="Adicionar ao público" color="#a855f7" icon={<UserPlus size={13} />}
      summary={d.audienceName ?? "Público não selecionado"} selected={!!selected} />
  );
}

// ── Start Flow ────────────────────────────────────────────────────────────────
export function FlowStartFlowNode({ data, selected }: NodeProps) {
  const d = data as unknown as FlowStartFlowData;
  return (
    <BaseNode label="Iniciar outro fluxo" color="#ec4899" icon={<ExternalLink size={13} />}
      summary={d.targetFlowName ?? "Fluxo não selecionado"} selected={!!selected} hasOutput={false} />
  );
}

// ── End ───────────────────────────────────────────────────────────────────────
export function FlowEndNode({ selected }: NodeProps) {
  return (
    <BaseNode label="Encerrar" color="#ef4444" icon={<Square size={13} />}
      summary="Finaliza o fluxo" selected={!!selected} hasOutput={false} />
  );
}

// ── HelpCircle placeholder ────────────────────────────────────────────────────
export function FlowUnknownNode({ selected }: NodeProps) {
  return (
    <BaseNode label="Desconhecido" color="#9ca3af" icon={<HelpCircle size={13} />}
      summary="Tipo de nó não reconhecido" selected={!!selected} />
  );
}

export const flowNodeTypes = {
  trigger:       FlowTriggerNode,
  message:       FlowMessageNode,
  question:      FlowQuestionNode,
  condition:     FlowConditionNode,
  changeStatus:  FlowChangeStatusNode,
  assign:        FlowAssignNode,
  addToAudience: FlowAddToAudienceNode,
  startFlow:     FlowStartFlowNode,
  end:           FlowEndNode,
};
