"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { deleteSaleAction } from "@/app/(dashboard)/leads/[id]/actions";

interface Props {
  saleId:          string;
  hasSuccessEvent: boolean;
}

export function DeleteSaleButton({ saleId, hasSuccessEvent }: Props) {
  const [confirm, setConfirm] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleDelete() {
    setLoading(true);
    try {
      await deleteSaleAction(saleId);
      toast.success("Venda excluída. Lead voltou para Nova.");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Erro ao excluir");
      setLoading(false);
      setConfirm(false);
    }
  }

  if (confirm) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        {hasSuccessEvent && (
          <span className="text-xs text-[var(--warning)]">Evento já enviado ao Meta!</span>
        )}
        <span className="text-xs text-[var(--danger)]">Excluir venda?</span>
        <button
          onClick={handleDelete}
          disabled={loading}
          className="flex h-8 items-center rounded-xl bg-[var(--danger)] px-3 text-xs font-medium text-white disabled:opacity-60"
        >
          {loading ? "Excluindo..." : "Sim, excluir"}
        </button>
        <button
          onClick={() => setConfirm(false)}
          disabled={loading}
          className="flex h-8 items-center rounded-xl border border-[var(--border)] px-3 text-xs text-[var(--text-muted)]"
        >
          Cancelar
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => setConfirm(true)}
      title="Excluir venda"
      className="flex h-8 w-8 items-center justify-center rounded-xl border border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--danger)] hover:text-[var(--danger)] transition-colors"
    >
      <Trash2 size={14} />
    </button>
  );
}
