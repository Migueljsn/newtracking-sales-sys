"use client";

import { useState, useTransition } from "react";
import { Globe, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { addAuthorizedDomainAction, deleteAuthorizedDomainAction } from "@/app/(dashboard)/settings/actions";

interface Domain {
  id:        string;
  url:       string;
  label:     string | null;
  createdAt: Date;
}

interface Props {
  domains: Domain[];
}

export function AuthorizedDomains({ domains }: Props) {
  const [pending, startTransition] = useTransition();
  const [confirmId, setConfirmId]  = useState<string | null>(null);

  function handleAdd(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    e.currentTarget.reset();
    startTransition(async () => {
      try {
        await addAuthorizedDomainAction(fd);
        toast.success("Domínio adicionado");
      } catch (err: unknown) {
        toast.error(err instanceof Error ? err.message : "Erro ao adicionar");
      }
    });
  }

  function handleDelete(id: string) {
    startTransition(async () => {
      try {
        await deleteAuthorizedDomainAction(id);
        toast.success("Domínio removido");
        setConfirmId(null);
      } catch {
        toast.error("Erro ao remover");
      }
    });
  }

  return (
    <div className="card p-6 space-y-5">
      <div>
        <h2 className="text-sm font-semibold text-[var(--text)]">Domínios autorizados</h2>
        <p className="text-xs text-[var(--text-muted)] mt-0.5">
          Somente requisições originadas destes domínios podem enviar leads para a sua API de captura.
          Se a lista estiver vazia, qualquer origem é aceita.
        </p>
      </div>

      {/* Lista */}
      {domains.length > 0 ? (
        <ul className="space-y-2">
          {domains.map((d) => (
            <li key={d.id} className="soft-panel flex items-center justify-between gap-3 px-4 py-3">
              <div className="flex items-center gap-3 min-w-0">
                <Globe size={14} className="shrink-0 text-[var(--accent)]" />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-[var(--text)] truncate">{d.url}</p>
                  {d.label && (
                    <p className="text-xs text-[var(--text-muted)] truncate">{d.label}</p>
                  )}
                </div>
              </div>

              {confirmId === d.id ? (
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs text-[var(--danger)]">Remover?</span>
                  <button
                    onClick={() => handleDelete(d.id)}
                    disabled={pending}
                    className="flex h-7 items-center rounded-xl bg-[var(--danger)] px-3 text-xs font-medium text-white disabled:opacity-60"
                  >
                    Sim
                  </button>
                  <button
                    onClick={() => setConfirmId(null)}
                    disabled={pending}
                    className="flex h-7 items-center rounded-xl border border-[var(--border)] px-3 text-xs text-[var(--text-muted)]"
                  >
                    Não
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setConfirmId(d.id)}
                  disabled={pending}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--danger)] hover:text-[var(--danger)] transition-colors"
                >
                  <Trash2 size={14} />
                </button>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-[var(--text-muted)] italic">Nenhum domínio cadastrado — qualquer origem é aceita.</p>
      )}

      {/* Formulário de adição */}
      <form onSubmit={handleAdd} className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_160px_auto] items-end border-t border-[var(--border)] pt-5">
        <div>
          <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">URL do domínio *</label>
          <input
            name="url"
            required
            className="input w-full"
            placeholder="https://meusite.com.br"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">Apelido (opcional)</label>
          <input
            name="label"
            className="input w-full"
            placeholder="Landing Page 1"
          />
        </div>
        <button
          type="submit"
          disabled={pending}
          className="btn-primary flex items-center gap-2 justify-center"
        >
          <Plus size={15} />
          Adicionar
        </button>
      </form>
    </div>
  );
}
