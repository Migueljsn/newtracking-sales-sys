"use client";

import { NodeProps } from "@xyflow/react";
import {
  Zap, MessageCircle, HelpCircle, GitBranch,
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
  const d = data as unknown as FlowMessageData;
  const icon =
    d.messageType === "document" ? <FileArchive size={13} /> :
    d.messageType === "media"    ? <Image       size={13} /> :
                                   <FileText    size={13} />;
  const summary = d.text
    ? d.text.slice(0, 40) + (d.text.length > 40 ? "…" : "")
    : d.messageType === "document" ? "Documento não configurado"
    : d.messageType === "media"    ? "Mídia não configurada"
    : "Mensagem não configurada";
  return (
    <BaseNode label="Mensagem" color="#10b981" icon={icon}
      summary={summary} selected={!!selected} />
  );
}

// ── Question ──────────────────────────────────────────────────────────────────
export function FlowQuestionNode({ data, selected }: NodeProps) {
  const d       = data as unknown as FlowQuestionData;
  const buttons = d.buttons ?? [];

  if (d.mode === "choice") {
    // saídas: btn_1, btn_2, ..., timeout
    const totalOutputs = buttons.length + 1; // +1 para timeout
    const handles = [
      ...buttons.map((b, i) => ({
        id:    `btn_${b.id}`,
        label: b.text || `Botão ${i + 1}`,
        color: "#10b981",
        left:  totalOutputs <= 2
          ? `${33 + i * 34}%`
          : `${15 + i * (70 / Math.max(buttons.length, 1))}%`,
      })),
      { id: "timeout", label: "timeout", color: "#f97316", left: "85%" },
    ];
    const modeLabel = buttons.length ? `${buttons.length} botão${buttons.length > 1 ? "ões" : ""}` : "Escolha (sem botões)";
    const summary   = d.questionText
      ? `${modeLabel} — ${d.questionText.slice(0, 30)}${d.questionText.length > 30 ? "…" : ""}`
      : "Pergunta não configurada";
    return (
      <BaseNode label="Pergunta" color="#0ea5e9" icon={<MousePointerClick size={13} />}
        summary={summary} selected={!!selected} dualOutputs={handles} />
    );
  }

  // modo texto: saídas válido / inválido / timeout
  const fieldLabel = FIELD_DEFS.find((f) => f.value === d.saveField)?.label ?? d.saveField;
  const valLabel   = d.validation !== "none" ? ` · valida ${d.validation.toUpperCase()}` : "";
  const summary    = d.questionText
    ? `${fieldLabel}${valLabel}`
    : "Pergunta não configurada";
  return (
    <BaseNode label="Pergunta" color="#0ea5e9" icon={<Type size={13} />}
      summary={summary} selected={!!selected}
      dualOutputs={[
        { id: "valid",   label: "válido",  color: "#10b981", left: "25%" },
        { id: "invalid", label: "inválido", color: "#ef4444", left: "50%" },
        { id: "timeout", label: "timeout",  color: "#f97316", left: "75%" },
      ]}
    />
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
