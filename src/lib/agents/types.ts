import { RuleGroup, isGroup } from "@/lib/audiences/types";
import type { ValidationType } from "@/lib/flows/types";

export type AgentExitAction =
  | { type: "end_with_message"; message: string }
  | { type: "move_stage_and_end"; stageId: string; message?: string }
  | { type: "end_silent" };

export type AgentExitRule = {
  id: string;
  name: string;
  rules: RuleGroup;
  action: AgentExitAction;
};

export function emptyExitRule(): AgentExitRule {
  return {
    id: crypto.randomUUID(),
    name: "",
    rules: { id: crypto.randomUUID(), operator: "AND", rules: [] },
    action: { type: "end_with_message", message: "" },
  };
}

function hasAnyCondition(group: RuleGroup): boolean {
  return group.rules.some((r) => (isGroup(r) ? hasAnyCondition(r) : true));
}

function validateExitAction(action: AgentExitAction, label: string): void {
  if (action.type === "end_with_message" && !action.message.trim()) {
    throw new Error(`"${label}": a mensagem de encerramento não pode ficar vazia`);
  }
  if (action.type === "move_stage_and_end" && !action.stageId) {
    throw new Error(`"${label}": selecione a etapa do pipeline`);
  }
}

/** Valida a lista de regras antes de salvar. Lança Error com a primeira violação encontrada. */
export function validateExitRules(rules: AgentExitRule[]): void {
  for (const rule of rules) {
    const label = rule.name.trim() || "Regra sem nome";
    if (!rule.name.trim()) throw new Error("Toda regra de saída precisa de um nome");
    if (!hasAnyCondition(rule.rules)) {
      throw new Error(`"${label}": adicione pelo menos uma condição (regra sem condição encerraria a conversa sempre)`);
    }
    validateExitAction(rule.action, label);
  }
}

export function parseExitRules(stored: unknown): AgentExitRule[] {
  if (Array.isArray(stored)) return stored as AgentExitRule[];
  return [];
}

// ── Objetivos (pivô #2 — Agente autônomo com tool calling dinâmico) ─────────

export type AgentObjective = {
  id: string;
  description: string; // o que capturar, ex: "o CNPJ da empresa do lead"
  validation: ValidationType;
  saveField: string; // campo nativo do lead ou customFields
};

export function emptyObjective(): AgentObjective {
  return { id: crypto.randomUUID(), description: "", validation: "none", saveField: "" };
}

export function parseObjectives(stored: unknown): AgentObjective[] {
  if (Array.isArray(stored)) return stored as AgentObjective[];
  return [];
}

export function validateObjectives(objectives: AgentObjective[]): void {
  const seenFields = new Set<string>();
  for (const obj of objectives) {
    const label = obj.description.trim() || "Objetivo sem descrição";
    if (!obj.description.trim()) throw new Error("Todo objetivo precisa de uma descrição do que capturar");
    if (!obj.saveField.trim()) throw new Error(`"${label}": selecione o campo onde salvar`);
    if (seenFields.has(obj.saveField)) throw new Error(`"${label}": esse campo já está sendo usado por outro objetivo`);
    seenFields.add(obj.saveField);
  }
}

export function parseCompletionAction(stored: unknown): AgentExitAction | null {
  if (stored && typeof stored === "object" && "type" in stored) return stored as AgentExitAction;
  return null;
}

export function validateCompletionAction(action: AgentExitAction | null): void {
  if (!action) return;
  validateExitAction(action, "Ação de conclusão");
}
