"use client";

import { X } from "lucide-react";
import { RuleGroupEditor } from "@/components/ltv/rule-group-editor";
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

  function handleActionTypeChange(type: AgentExitAction["type"]) {
    if (type === "end_with_message") setAction({ type, message: "" });
    else if (type === "move_stage_and_end") setAction({ type, stageId: pipelineStages[0]?.id ?? "", message: "" });
    else setAction({ type: "end_silent" });
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

      <div className="space-y-2">
        <p className="text-xs font-medium text-[var(--text-muted)]">Então:</p>
        <select
          value={rule.action.type}
          onChange={(e) => handleActionTypeChange(e.target.value as AgentExitAction["type"])}
          className="input w-full"
        >
          <option value="end_with_message">Encerrar a conversa com uma mensagem</option>
          <option value="move_stage_and_end">Mover lead para outra etapa e encerrar</option>
          <option value="end_silent">Encerrar a conversa sem enviar mensagem</option>
        </select>

        {rule.action.type === "end_with_message" && (
          <textarea
            value={rule.action.message}
            onChange={(e) => setAction({ type: "end_with_message", message: e.target.value })}
            rows={2}
            placeholder="Mensagem de encerramento enviada ao lead..."
            className="input w-full resize-none"
          />
        )}

        {rule.action.type === "move_stage_and_end" && (
          <div className="space-y-2">
            <select
              value={rule.action.stageId}
              onChange={(e) => setAction({ type: "move_stage_and_end", stageId: e.target.value, message: rule.action.type === "move_stage_and_end" ? rule.action.message : "" })}
              className="input w-full"
            >
              {pipelineStages.length === 0 && <option value="">Nenhuma etapa cadastrada</option>}
              {pipelineStages.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
            <textarea
              value={rule.action.message ?? ""}
              onChange={(e) => setAction({ type: "move_stage_and_end", stageId: rule.action.type === "move_stage_and_end" ? rule.action.stageId : "", message: e.target.value })}
              rows={2}
              placeholder="Mensagem de encerramento (opcional)..."
              className="input w-full resize-none"
            />
          </div>
        )}
      </div>
    </div>
  );
}
