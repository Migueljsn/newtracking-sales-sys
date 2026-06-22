"use client";

import { useState, useTransition } from "react";
import { Plus, Bot, Trash2, Pencil } from "lucide-react";
import { toast } from "sonner";
import {
  toggleAiAgentActiveAction,
  deleteAiAgentAction,
} from "@/app/(dashboard)/agents/actions";
import { AgentForm } from "./agent-form";
import type { AgentExitRule, AgentObjective, AgentExitAction } from "@/lib/agents/types";

type PipelineStage = { id: string; name: string };

type AgentRow = {
  id:               string;
  name:             string;
  systemPrompt:     string;
  negativePrompt:   string | null;
  model:            string;
  temperature:      number;
  memoryWindow:     number;
  exitRules:        AgentExitRule[];
  objectives:       AgentObjective[];
  completionAction: AgentExitAction | null;
  isActive:         boolean;
  createdAt:        Date;
};

type View = "list" | "new" | { edit: AgentRow };

export function AgentsTab({ agents, pipelineStages }: { agents: AgentRow[]; pipelineStages: PipelineStage[] }) {
  const [view, setView] = useState<View>("list");
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleToggle(id: string, isActive: boolean) {
    startTransition(async () => {
      try {
        await toggleAiAgentActiveAction(id, isActive);
        toast.success(isActive ? "Agente ativado" : "Agente desativado");
      } catch {
        toast.error("Erro ao atualizar agente");
      }
    });
  }

  function handleDelete(id: string) {
    if (confirmDelete !== id) { setConfirmDelete(id); return; }
    setConfirmDelete(null);
    startTransition(async () => {
      try {
        await deleteAiAgentAction(id);
        toast.success("Agente removido");
      } catch {
        toast.error("Erro ao remover agente");
      }
    });
  }

  if (view === "new") {
    return <AgentForm pipelineStages={pipelineStages} onSaved={() => setView("list")} onCancel={() => setView("list")} />;
  }

  if (typeof view === "object" && "edit" in view) {
    return (
      <AgentForm
        agent={view.edit}
        pipelineStages={pipelineStages}
        onSaved={() => setView("list")}
        onCancel={() => setView("list")}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button
          onClick={() => setView("new")}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[var(--accent)] text-sm font-semibold text-white hover:bg-[var(--accent-strong)] transition-colors"
        >
          <Plus size={16} /> Novo agente
        </button>
      </div>

      {agents.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[var(--border)] p-10 text-center">
          <Bot className="mx-auto mb-3 text-[var(--text-muted)]" size={28} />
          <p className="text-sm text-[var(--text-muted)]">Nenhum agente criado ainda.</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {agents.map((agent) => (
            <div key={agent.id} className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-semibold text-[var(--text)] truncate">{agent.name}</p>
                  <p className="text-xs text-[var(--text-muted)] mt-0.5">
                    {agent.model} · memória: {agent.memoryWindow} msgs · temp: {agent.temperature}
                    {agent.objectives.length > 0 && <> · {agent.objectives.length} objetivo{agent.objectives.length !== 1 ? "s" : ""}</>}
                    {agent.exitRules.length > 0 && <> · {agent.exitRules.length} regra{agent.exitRules.length !== 1 ? "s" : ""} de saída</>}
                  </p>
                </div>
                <button
                  disabled={isPending}
                  onClick={() => handleToggle(agent.id, !agent.isActive)}
                  className={`shrink-0 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                    agent.isActive
                      ? "bg-[var(--success-soft)] text-[var(--success)]"
                      : "bg-[var(--surface-2)] text-[var(--text-muted)]"
                  }`}
                >
                  {agent.isActive ? "Ativo" : "Inativo"}
                </button>
              </div>
              <p className="text-sm text-[var(--text-muted)] mt-3 line-clamp-3">{agent.systemPrompt}</p>
              <div className="flex justify-end gap-2 mt-3">
                <button
                  onClick={() => setView({ edit: agent })}
                  className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg text-[var(--text-muted)] hover:text-[var(--text)] transition-colors"
                >
                  <Pencil size={12} /> Editar
                </button>
                <button
                  disabled={isPending}
                  onClick={() => handleDelete(agent.id)}
                  className={`flex items-center gap-1 text-xs px-2 py-1 rounded-lg transition-colors ${
                    confirmDelete === agent.id
                      ? "bg-red-500/10 text-red-500"
                      : "text-[var(--text-muted)] hover:text-red-500"
                  }`}
                >
                  <Trash2 size={12} /> {confirmDelete === agent.id ? "Confirmar exclusão" : "Excluir"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
