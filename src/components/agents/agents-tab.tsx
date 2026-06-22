"use client";

import { useState, useTransition } from "react";
import { Plus, Bot, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import {
  createAiAgentAction,
  toggleAiAgentActiveAction,
  deleteAiAgentAction,
} from "@/app/(dashboard)/agents/actions";

type AgentRow = {
  id:             string;
  name:           string;
  systemPrompt:   string;
  negativePrompt: string | null;
  model:          string;
  temperature:    number;
  memoryWindow:   number;
  isActive:       boolean;
  createdAt:      Date;
};

export function AgentsTab({ agents }: { agents: AgentRow[] }) {
  const [showNew, setShowNew] = useState(false);
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

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button
          onClick={() => setShowNew(true)}
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
              <div className="flex justify-end mt-3">
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

      {showNew && <NewAgentModal onClose={() => setShowNew(false)} />}
    </div>
  );
}

function NewAgentModal({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState("");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [negativePrompt, setNegativePrompt] = useState("");
  const [temperature, setTemperature] = useState(0.7);
  const [memoryWindow, setMemoryWindow] = useState(20);
  const [saving, startSaving] = useTransition();

  function handleSubmit() {
    if (!name.trim() || !systemPrompt.trim()) {
      toast.error("Nome e prompt do sistema são obrigatórios");
      return;
    }
    startSaving(async () => {
      try {
        await createAiAgentAction({ name, systemPrompt, negativePrompt, temperature, memoryWindow });
        toast.success("Agente criado");
        onClose();
      } catch (e) {
        toast.error((e as Error).message || "Erro ao criar agente");
      }
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-[var(--text)]">Novo agente IA</h2>
            <button onClick={onClose} className="text-[var(--text-muted)] hover:text-[var(--text)]">
              <X size={16} />
            </button>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">Nome *</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Atendente de qualificação"
                className="input w-full"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">
                Prompt do sistema (persona, tom, objetivo) *
              </label>
              <textarea
                value={systemPrompt}
                onChange={(e) => setSystemPrompt(e.target.value)}
                rows={6}
                placeholder="Você é um atendente simpático que qualifica leads perguntando..."
                className="input w-full resize-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">
                Negative prompt (o que ele nunca deve fazer/dizer)
              </label>
              <textarea
                value={negativePrompt}
                onChange={(e) => setNegativePrompt(e.target.value)}
                rows={3}
                placeholder="Nunca mencione concorrentes. Nunca prometa descontos."
                className="input w-full resize-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">
                  Temperatura ({temperature})
                </label>
                <input
                  type="range" min="0" max="1" step="0.1"
                  value={temperature}
                  onChange={(e) => setTemperature(Number(e.target.value))}
                  className="w-full"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">
                  Janela de memória (msgs)
                </label>
                <input
                  type="number" min="2" max="100"
                  value={memoryWindow}
                  onChange={(e) => setMemoryWindow(Number(e.target.value))}
                  className="input w-full"
                />
              </div>
            </div>
          </div>

          <div className="flex gap-2 mt-6">
            <button
              onClick={onClose}
              className="flex-1 h-10 rounded-xl border border-[var(--border)] text-sm text-[var(--text-muted)] hover:text-[var(--text)] transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handleSubmit}
              disabled={saving}
              className="flex-1 h-10 rounded-xl bg-[var(--accent)] text-sm font-semibold text-white hover:bg-[var(--accent-strong)] disabled:opacity-50 transition-colors"
            >
              {saving ? "Criando..." : "Criar agente"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
