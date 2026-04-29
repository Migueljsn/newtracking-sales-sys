"use client";

import { useState } from "react";
import { toast } from "sonner";
import { markAsLostAction } from "@/app/(dashboard)/leads/[id]/actions";

export function MarkLostButton({ leadId }: { leadId: string }) {
  const [loading, setLoading] = useState(false);
  const [confirm, setConfirm] = useState(false);

  async function handleConfirm() {
    setLoading(true);
    try {
      await markAsLostAction(leadId);
      toast.success("Lead marcada como perdida");
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
          className="rounded-xl bg-[var(--danger)] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {loading ? "Salvando..." : "Confirmar"}
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => setConfirm(true)}
      className="rounded-xl border border-[var(--border)] px-4 py-2 text-sm font-medium text-[var(--text-muted)] hover:border-[var(--danger)] hover:text-[var(--danger)]"
    >
      Marcar como perdida
    </button>
  );
}
