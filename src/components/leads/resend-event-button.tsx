"use client";

import { useState } from "react";
import { Send } from "lucide-react";
import { toast } from "sonner";
import { resendPurchaseEventAction } from "@/app/(dashboard)/leads/[id]/actions";

interface Props {
  saleId:          string;
  hasSuccessEvent: boolean;
}

export function ResendEventButton({ saleId, hasSuccessEvent }: Props) {
  const [loading,  setLoading]  = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  async function handleClick() {
    if (hasSuccessEvent && !confirmed) {
      setConfirmed(true);
      toast.warning(
        "Este evento já foi enviado ao Meta. Reenviar criará um novo registro de conversão. Clique novamente para confirmar.",
        { duration: 6000 }
      );
      setTimeout(() => setConfirmed(false), 7000);
      return;
    }

    setLoading(true);
    setConfirmed(false);
    try {
      await resendPurchaseEventAction(saleId);
      toast.success("Evento reenviado ao Meta com as UTMs atuais.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao reenviar evento");
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      title={confirmed ? "Clique novamente para confirmar" : "Reenviar evento para o Meta"}
      className={`flex h-8 w-8 items-center justify-center rounded-xl border transition-colors ${
        confirmed
          ? "border-[var(--warning)] bg-[var(--warning-soft)] text-[var(--warning)]"
          : "border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--accent)] hover:text-[var(--accent)]"
      } disabled:opacity-40`}
    >
      <Send size={13} />
    </button>
  );
}
