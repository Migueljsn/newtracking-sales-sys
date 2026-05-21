"use client";

import { NodeProps } from "@xyflow/react";
import { Zap, Clock, GitBranch, Mail, MessageCircle, ArrowRightLeft, UserCheck, Square } from "lucide-react";
import { BaseNode } from "./base-node";
import {
  TriggerData, WaitData, ConditionData, EmailData,
  WhatsAppData, ChangeStatusData, AssignData,
} from "@/lib/journeys/types";
import { FIELD_DEFS } from "@/lib/audiences/fields";

export function TriggerNode({ data, selected }: NodeProps) {
  const d = data as unknown as TriggerData;
  return (
    <BaseNode
      label="Gatilho"
      color="#6366f1"
      icon={<Zap size={13} />}
      summary={d.audienceName ?? "Nenhum público selecionado"}
      selected={!!selected}
      hasInput={false}
    />
  );
}

export function WaitNode({ data, selected }: NodeProps) {
  const d = data as unknown as WaitData;
  return (
    <BaseNode
      label="Aguardar"
      color="#f59e0b"
      icon={<Clock size={13} />}
      summary={d.days === 1 ? "1 dia" : `${d.days} dias`}
      selected={!!selected}
    />
  );
}

export function ConditionNode({ data, selected }: NodeProps) {
  const d = data as unknown as ConditionData;
  const fieldLabel = FIELD_DEFS.find((f) => f.value === d.field)?.label ?? d.field;
  return (
    <BaseNode
      label="Condição"
      color="#8b5cf6"
      icon={<GitBranch size={13} />}
      summary={`${fieldLabel} ${d.operator} ${d.value}`}
      selected={!!selected}
      hasTrueOutput
      hasFalseOutput
    />
  );
}

export function EmailNode({ data, selected }: NodeProps) {
  const d = data as unknown as EmailData;
  return (
    <BaseNode
      label="E-mail"
      color="#3b82f6"
      icon={<Mail size={13} />}
      summary={d.templateName ?? "Nenhum template"}
      selected={!!selected}
    />
  );
}

export function WhatsAppNode({ data, selected }: NodeProps) {
  const d = data as unknown as WhatsAppData;
  return (
    <BaseNode
      label="WhatsApp"
      color="#10b981"
      icon={<MessageCircle size={13} />}
      summary={d.message ? d.message.slice(0, 50) + (d.message.length > 50 ? "…" : "") : "Mensagem não definida"}
      selected={!!selected}
    />
  );
}

export function ChangeStatusNode({ data, selected }: NodeProps) {
  const d = data as unknown as ChangeStatusData;
  const summary = d.action === "lost" ? "Marcar como perdida" : (d.stageName ?? "Etapa não selecionada");
  return (
    <BaseNode
      label="Mover etapa"
      color="#f97316"
      icon={<ArrowRightLeft size={13} />}
      summary={summary}
      selected={!!selected}
    />
  );
}

export function AssignNode({ data, selected }: NodeProps) {
  const d = data as unknown as AssignData;
  return (
    <BaseNode
      label="Atribuir"
      color="#06b6d4"
      icon={<UserCheck size={13} />}
      summary={d.consultant || "Consultor não definido"}
      selected={!!selected}
    />
  );
}

export function EndNode({ selected }: NodeProps) {
  return (
    <BaseNode
      label="Fim"
      color="#ef4444"
      icon={<Square size={13} />}
      summary="Encerra a jornada"
      selected={!!selected}
      hasOutput={false}
    />
  );
}

export const nodeTypes = {
  trigger:      TriggerNode,
  wait:         WaitNode,
  condition:    ConditionNode,
  email:        EmailNode,
  whatsapp:     WhatsAppNode,
  changeStatus: ChangeStatusNode,
  assign:       AssignNode,
  end:          EndNode,
};
