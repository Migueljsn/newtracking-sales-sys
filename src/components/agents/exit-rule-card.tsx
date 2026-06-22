"use client";

import { X } from "lucide-react";
import { RuleGroupEditor } from "@/components/ltv/rule-group-editor";
import { ExitActionPicker } from "./exit-action-picker";
import type { AgentExitRule, AgentExitAction } from "@/lib/agents/types";
import type { RuleGroup } from "@/lib/audiences/types";

type PipelineStage = { id: string; name: string };

interface ExitRuleCardProps {
  rule:           AgentExitRule;
  onChange:       (rule: AgentExitRule) => void;
  onRemove:       () => void;
  pipelineStages: PipelineStage[];
}

export function ExitRuleCard({ rule, onChange, onRemove, pipelineStages }: ExitRuleCardProps) {
  function setRules(rules: RuleGroup) {
    onChange({ ...rule, rules });
  }

  function setAction(action: AgentExitAction) {
    onChange({ ...rule, action });
  }

  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 space-y-4">
      <div className="flex items-center gap-2">
        <input
          value={rule.name}
          onChange={(e) => onChange({ ...rule, name: e.target.value })}
          placeholder="Nome da regra (ex: Já comprou — encerrar)"
          className="input flex-1"
        />
        <button
          onClick={onRemove}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[var(--text-muted)] hover:bg-[var(--danger-soft)] hover:text-[var(--danger)] transition-colors"
          title="Remover regra"
        >
          <X size={15} />
        </button>
      </div>

      <div>
        <p className="text-xs font-medium text-[var(--text-muted)] mb-1.5">Se a lead atender:</p>
        <RuleGroupEditor group={rule.rules} onChange={setRules} depth={0} pipelineStages={pipelineStages} />
      </div>

      <ExitActionPicker action={rule.action} onChange={setAction} pipelineStages={pipelineStages} />
    </div>
  );
}
