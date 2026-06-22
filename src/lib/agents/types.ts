import { RuleGroup, isGroup } from "@/lib/audiences/types";

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

/** Valida a lista de regras antes de salvar. Lança Error com a primeira violação encontrada. */
export function validateExitRules(rules: AgentExitRule[]): void {
  for (const rule of rules) {
    const label = rule.name.trim() || "Regra sem nome";
    if (!rule.name.trim()) throw new Error("Toda regra de saída precisa de um nome");
    if (!hasAnyCondition(rule.rules)) {
      throw new Error(`"${label}": adicione pelo menos uma condição (regra sem condição encerraria a conversa sempre)`);
    }
    if (rule.action.type === "end_with_message" && !rule.action.message.trim()) {
      throw new Error(`"${label}": a mensagem de encerramento não pode ficar vazia`);
    }
    if (rule.action.type === "move_stage_and_end" && !rule.action.stageId) {
      throw new Error(`"${label}": selecione a etapa do pipeline`);
    }
  }
}

export function parseExitRules(stored: unknown): AgentExitRule[] {
  if (Array.isArray(stored)) return stored as AgentExitRule[];
  return [];
}
