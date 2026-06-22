"use client";

import { useState, useTransition } from "react";
import { Plus, Info } from "lucide-react";
import { toast } from "sonner";
import { createAiAgentAction, updateAiAgentAction } from "@/app/(dashboard)/agents/actions";
import { ExitRuleCard } from "./exit-rule-card";
import { emptyExitRule, type AgentExitRule } from "@/lib/agents/types";

type PipelineStage = { id: string; name: string };

type AgentRow = {
  id:             string;
  name:           string;
  systemPrompt:   string;
  negativePrompt: string | null;
  temperature:    number;
  memoryWindow:   number;
  exitRules:      AgentExitRule[];
};

interface AgentFormProps {
  agent?:         AgentRow;
  pipelineStages: PipelineStage[];
  onSaved:        () => void;
  onCancel:       () => void;
}

export function AgentForm({ agent, pipelineStages, onSaved, onCancel }: AgentFormProps) {
  const isEdit = !!agent;

  const [name, setName]                     = useState(agent?.name ?? "");
  const [systemPrompt, setSystemPrompt]     = useState(agent?.systemPrompt ?? "");
  const [negativePrompt, setNegativePrompt] = useState(agent?.negativePrompt ?? "");
  const [temperature, setTemperature]       = useState(agent?.temperature ?? 0.7);
  const [memoryWindow, setMemoryWindow]     = useState(agent?.memoryWindow ?? 20);
  const [exitRules, setExitRules]           = useState<AgentExitRule[]>(agent?.exitRules ?? []);
  const [saving, startSaving]               = useTransition();

  function addExitRule() {
    setExitRules((prev) => [...prev, emptyExitRule()]);
  }

  function updateExitRule(id: string, updated: AgentExitRule) {
    setExitRules((prev) => prev.map((r) => (r.id === id ? updated : r)));
  }

  function removeExitRule(id: string) {
    setExitRules((prev) => prev.filter((r) => r.id !== id));
  }

  function handleSubmit() {
    if (!name.trim() || !systemPrompt.trim()) {
      toast.error("Nome e prompt do sistema são obrigatórios");
      return;
    }
    const data = { name, systemPrompt, negativePrompt, temperature, memoryWindow, exitRules };
    startSaving(async () => {
      try {
        if (isEdit) {
          await updateAiAgentAction(agent.id, data);
          toast.success("Agente atualizado");
        } else {
          await createAiAgentAction(data);
          toast.success("Agente criado");
        }
        onSaved();
      } catch (e) {
        toast.error((e as Error).message || "Erro ao salvar agente");
      }
    });
  }

  return (
    <div className="card max-w-3xl space-y-6 p-6">
      <div>
        <h2 className="text-base font-semibold text-[var(--text)]">
          {isEdit ? "Editar agente" : "Novo agente IA"}
        </h2>
        <p className="mt-1 text-xs text-[var(--text-muted)]">
          A persona definida aqui pode ser usada de duas formas: conduzindo uma conversa inteira sozinha com
          uma lead (botão &quot;Agente IA — conversa autônoma&quot; na página da lead), ou dando a voz natural a um
          nó &quot;Pergunta IA&quot;/&quot;Mensagem IA&quot; dentro de um Flow. As <strong>regras de saída</strong> abaixo só valem
          para o primeiro caso.
        </p>
      </div>

      {/* Identidade */}
      <section className="space-y-4">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">Identidade</h3>
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
      </section>

      {/* Comportamento */}
      <section className="space-y-4">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">Comportamento</h3>
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
      </section>

      {/* Regras de saída */}
      <section className="space-y-3">
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
            Regras de saída <span className="font-normal text-[var(--text-muted)]">(só conversa autônoma)</span>
          </h3>
          <p className="mt-1 flex items-start gap-1.5 text-xs text-[var(--text-muted)]">
            <Info size={13} className="mt-0.5 shrink-0" />
            Avaliadas a cada turno, na ordem abaixo, quando este agente conduz uma conversa autônoma com uma
            lead. A primeira que bater encerra a conversa direto (sem nem chamar a IA). Se nenhuma bater, a
            conversa continua normalmente. Não têm efeito quando o agente é usado só pra dar voz a um nó de
            Flow ("Pergunta IA"/"Mensagem IA") — nesse caso, o próprio Flow controla a ramificação.
          </p>
        </div>

        {exitRules.length === 0 ? (
          <p className="rounded-xl border border-dashed border-[var(--border)] p-4 text-center text-sm text-[var(--text-muted)]">
            Nenhuma regra — o encerramento fica só a critério da IA.
          </p>
        ) : (
          <div className="space-y-3">
            {exitRules.map((rule) => (
              <ExitRuleCard
                key={rule.id}
                rule={rule}
                onChange={(updated) => updateExitRule(rule.id, updated)}
                onRemove={() => removeExitRule(rule.id)}
                pipelineStages={pipelineStages}
              />
            ))}
          </div>
        )}

        <button
          onClick={addExitRule}
          className="flex items-center gap-1.5 text-sm text-[var(--accent)] hover:text-[var(--accent-strong)] transition-colors"
        >
          <Plus size={14} /> Adicionar regra de saída
        </button>
      </section>

      <div className="flex gap-2 pt-2">
        <button
          onClick={onCancel}
          className="flex-1 h-10 rounded-xl border border-[var(--border)] text-sm text-[var(--text-muted)] hover:text-[var(--text)] transition-colors"
        >
          Cancelar
        </button>
        <button
          onClick={handleSubmit}
          disabled={saving}
          className="flex-1 h-10 rounded-xl bg-[var(--accent)] text-sm font-semibold text-white hover:bg-[var(--accent-strong)] disabled:opacity-50 transition-colors"
        >
          {saving ? "Salvando..." : isEdit ? "Salvar alterações" : "Criar agente"}
        </button>
      </div>
    </div>
  );
}
