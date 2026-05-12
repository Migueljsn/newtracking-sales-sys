"use client";

import { useState } from "react";
import { toast } from "sonner";
import { markAsRegisteredAction } from "@/app/(dashboard)/leads/[id]/actions";

export function MarkRegisteredButton({ leadId }: { leadId: string }) {
  const [loading, setLoading]   = useState(false);
  const [confirm, setConfirm]   = useState(false);

  async function handleConfirm() {
    setLoading(true);
    try {
      await markAsRegisteredAction(leadId);
      toast.success("Lead marcada como cadastrada");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Erro ao atualizar lead");
    } finally {
      setLoading(false);
      setConfirm(false);
    }
  }

  if (confirm) {
    return (
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setConfirm(false)}
          className="btn-secondary px-4 py-2 text-sm"
        >
          Cancelar
        </button>
        <button
          onClick={handleConfirm}
          disabled={loading}
          className="btn-primary px-4 py-2 text-sm disabled:opacity-50"
        >
          {loading ? "Salvando..." : "Confirmar cadastro"}
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => setConfirm(true)}
      className="btn-primary px-5 py-2"
    >
      Marcar como cadastrada
    </button>
  );
}
