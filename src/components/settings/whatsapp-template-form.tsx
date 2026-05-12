"use client";

import { useState } from "react";
import { toast } from "sonner";
import { MessageCircle } from "lucide-react";
import { saveWhatsappTemplateAction } from "@/app/(dashboard)/settings/actions";

const DEFAULT_TEMPLATE =
  "Olá {nome}! Aqui é da equipe do {estado}. Vi que você demonstrou interesse nos nossos produtos e tenho uma condição especial disponível por tempo limitado. Posso te passar os detalhes agora?";

interface Props {
  currentTemplate: string | null;
}

export function WhatsappTemplateForm({ currentTemplate }: Props) {
  const [loading, setLoading] = useState(false);
  const value = currentTemplate ?? DEFAULT_TEMPLATE;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    try {
      await saveWhatsappTemplateAction(new FormData(e.currentTarget));
      toast.success("Mensagem salva com sucesso");
    } catch {
      toast.error("Erro ao salvar mensagem");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card p-5 space-y-4">
      <div className="flex items-center gap-2">
        <MessageCircle size={16} className="text-[var(--success)]" />
        <h2 className="text-sm font-semibold text-[var(--text)]">Mensagem de contato (WhatsApp)</h2>
      </div>

      <p className="text-xs text-[var(--text-muted)]">
        Mensagem enviada ao clicar no botão de contato. Use as variáveis{" "}
        <code className="rounded bg-[var(--surface-muted)] px-1 py-0.5 text-[var(--accent)]">{"{nome}"}</code>,{" "}
        <code className="rounded bg-[var(--surface-muted)] px-1 py-0.5 text-[var(--accent)]">{"{estado}"}</code> e{" "}
        <code className="rounded bg-[var(--surface-muted)] px-1 py-0.5 text-[var(--accent)]">{"{cidade}"}</code>.
      </p>

      <form onSubmit={handleSubmit} className="space-y-3">
        <textarea
          name="whatsappTemplate"
          rows={4}
          defaultValue={value}
          className="input w-full resize-none text-sm"
          placeholder={DEFAULT_TEMPLATE}
        />
        <button type="submit" disabled={loading} className="btn-primary px-4 py-2 text-sm disabled:opacity-50">
          {loading ? "Salvando..." : "Salvar mensagem"}
        </button>
      </form>
    </div>
  );
}
