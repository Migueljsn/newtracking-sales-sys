"use client";

import { useState, useTransition } from "react";
import { Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { deleteClientAction } from "@/app/admin/actions";

interface Props {
  client: { id: string; name: string };
}

export function DeleteClientButton({ client }: Props) {
  const [open, setOpen]       = useState(false);
  const [pending, startTransition] = useTransition();

  function handleDelete() {
    startTransition(async () => {
      try {
        await deleteClientAction(client.id);
        toast.success("Cliente excluído.");
        setOpen(false);
      } catch (err: unknown) {
        toast.error(err instanceof Error ? err.message : "Erro ao excluir cliente.");
      }
    });
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex h-8 w-8 items-center justify-center rounded-xl border border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--danger)] hover:text-[var(--danger)] transition-colors"
        title="Excluir"
      >
        <Trash2 size={13} />
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            type="button"
            aria-label="Fechar"
            className="absolute inset-0 bg-slate-950/50 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />
          <div className="card relative w-full max-w-sm p-6 shadow-xl">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-base font-semibold text-[var(--text)]">Excluir cliente</h2>
                <p className="mt-1 text-sm text-[var(--text-muted)]">
                  Tem certeza que deseja excluir <strong className="text-[var(--text)]">{client.name}</strong>?
                  Todos os dados serão permanentemente removidos e essa ação não pode ser desfeita.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text)]"
              >
                <X size={15} />
              </button>
            </div>

            <div className="flex gap-3">
              <button type="button" onClick={() => setOpen(false)} className="btn btn-ghost flex-1">
                Cancelar
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={handleDelete}
                className="btn flex-1 bg-[var(--danger)] text-white hover:opacity-90 disabled:opacity-50"
              >
                {pending ? "Excluindo..." : "Excluir"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
