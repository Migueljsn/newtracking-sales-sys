"use client";

import { useState, useTransition } from "react";
import { Bot, X } from "lucide-react";
import { toast } from "sonner";
import { startAiAgentAction } from "@/app/(dashboard)/leads/[id]/actions";

type Agent = { id: string; name: string };

interface AiAgentButtonProps {
  leadId: string;
  agents: Agent[];
  activeSession: { agentName: string } | null;
}

export function AiAgentButton({ leadId, agents, activeSession }: AiAgentButtonProps) {
  const [open, setOpen] = useState(false);
  const [agentId, setAgentId] = useState(agents[0]?.id ?? "");
  const [isPending, startTransition] = useTransition();

  if (activeSession) {
    return (
      <span className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[var(--success-soft)] text-[var(--success)] text-sm font-medium">
        <Bot size={16} /> {activeSession.agentName} ativo
      </span>
    );
  }

  if (agents.length === 0) return null;

  function handleStart() {
    if (!agentId) return;
    startTransition(async () => {
      try {
        await startAiAgentAction(leadId, agentId);
        toast.success("Agente IA iniciado");
        setOpen(false);
      } catch (e) {
        toast.error((e as Error).message || "Erro ao iniciar agente IA");
      }
    });
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-3 py-2 rounded-xl border border-[var(--border)] text-sm text-[var(--text)] hover:bg-[var(--surface-2)] transition-colors"
      >
        <Bot size={16} /> Agente IA (conversa autônoma)
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-[var(--text)]">Ativar agente IA</h2>
              <button onClick={() => setOpen(false)} className="text-[var(--text-muted)] hover:text-[var(--text)]">
                <X size={16} />
              </button>
            </div>

            <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">Agente</label>
            <select value={agentId} onChange={(e) => setAgentId(e.target.value)} className="input w-full mb-6">
              {agents.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>

            <div className="flex gap-2">
              <button
                onClick={() => setOpen(false)}
                className="flex-1 h-10 rounded-xl border border-[var(--border)] text-sm text-[var(--text-muted)] hover:text-[var(--text)] transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleStart}
                disabled={isPending}
                className="flex-1 h-10 rounded-xl bg-[var(--accent)] text-sm font-semibold text-white hover:bg-[var(--accent-strong)] disabled:opacity-50 transition-colors"
              >
                {isPending ? "Ativando..." : "Ativar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
