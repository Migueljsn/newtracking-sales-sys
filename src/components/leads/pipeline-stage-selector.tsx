"use client";

import { useState } from "react";
import { toast } from "sonner";
import { ChevronDown } from "lucide-react";
import { moveToStageAction } from "@/app/(dashboard)/leads/[id]/actions";

interface Stage { id: string; name: string; color: string }

interface Props {
  leadId:         string;
  currentStageId: string | null;
  stages:         Stage[];
}

export function PipelineStageSelector({ leadId, currentStageId, stages }: Props) {
  const [open,    setOpen]    = useState(false);
  const [loading, setLoading] = useState(false);

  const current = stages.find(s => s.id === currentStageId) ?? null;

  async function handleSelect(stageId: string | null) {
    setOpen(false);
    setLoading(true);
    try {
      await moveToStageAction(leadId, stageId);
      toast.success(stageId ? "Etapa atualizada" : "Etapa removida");
    } catch {
      toast.error("Erro ao mover etapa");
    } finally {
      setLoading(false);
    }
  }

  if (stages.length === 0) return null;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        disabled={loading}
        className="btn-secondary flex items-center gap-2 px-4 py-2 text-sm disabled:opacity-50"
      >
        {current ? (
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: current.color }} />
            {current.name}
          </span>
        ) : "Mover para etapa"}
        <ChevronDown size={13} />
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-1 z-30 min-w-[180px] rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-xl py-1">
          {stages.map(stage => (
            <button
              key={stage.id}
              onClick={() => handleSelect(stage.id)}
              className="flex w-full items-center gap-2.5 px-3 py-2 text-sm text-[var(--text)] hover:bg-[var(--surface-muted)] transition-colors"
            >
              <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: stage.color }} />
              {stage.name}
            </button>
          ))}
          {currentStageId && (
            <button
              onClick={() => handleSelect(null)}
              className="flex w-full items-center gap-2.5 px-3 py-2 text-sm text-[var(--text-muted)] hover:bg-[var(--surface-muted)] transition-colors border-t border-[var(--border)] mt-1 pt-2"
            >
              Remover etapa
            </button>
          )}
        </div>
      )}
    </div>
  );
}
