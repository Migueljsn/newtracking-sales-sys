"use client";

import type { AgentExitAction } from "@/lib/agents/types";

type PipelineStage = { id: string; name: string };

interface ExitActionPickerProps {
  action:         AgentExitAction;
  onChange:       (action: AgentExitAction) => void;
  pipelineStages: PipelineStage[];
  label?:         string;
}

export function ExitActionPicker({ action, onChange, pipelineStages, label = "Então:" }: ExitActionPickerProps) {
  function handleActionTypeChange(type: AgentExitAction["type"]) {
    if (type === "end_with_message") onChange({ type, message: "" });
    else if (type === "move_stage_and_end") onChange({ type, stageId: pipelineStages[0]?.id ?? "", message: "" });
    else onChange({ type: "end_silent" });
  }

  return (
    <div className="space-y-2">
      {label && <p className="text-xs font-medium text-[var(--text-muted)]">{label}</p>}
      <select
        value={action.type}
        onChange={(e) => handleActionTypeChange(e.target.value as AgentExitAction["type"])}
        className="input w-full"
      >
        <option value="end_with_message">Encerrar a conversa com uma mensagem</option>
        <option value="move_stage_and_end">Mover lead para outra etapa e encerrar</option>
        <option value="end_silent">Encerrar a conversa sem enviar mensagem</option>
      </select>

      {action.type === "end_with_message" && (
        <textarea
          value={action.message}
          onChange={(e) => onChange({ type: "end_with_message", message: e.target.value })}
          rows={2}
          placeholder="Mensagem de encerramento enviada ao lead..."
          className="input w-full resize-none"
        />
      )}

      {action.type === "move_stage_and_end" && (
        <div className="space-y-2">
          <select
            value={action.stageId}
            onChange={(e) => onChange({ type: "move_stage_and_end", stageId: e.target.value, message: action.type === "move_stage_and_end" ? action.message : "" })}
            className="input w-full"
          >
            {pipelineStages.length === 0 && <option value="">Nenhuma etapa cadastrada</option>}
            {pipelineStages.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
          <textarea
            value={action.message ?? ""}
            onChange={(e) => onChange({ type: "move_stage_and_end", stageId: action.type === "move_stage_and_end" ? action.stageId : "", message: e.target.value })}
            rows={2}
            placeholder="Mensagem de encerramento (opcional)..."
            className="input w-full resize-none"
          />
        </div>
      )}
    </div>
  );
}
