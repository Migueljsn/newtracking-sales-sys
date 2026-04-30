"use client";

import { useState, useTransition } from "react";
import { Pencil, X } from "lucide-react";
import { toast } from "sonner";
import { updateClientAction } from "@/app/admin/actions";

interface Props {
  client: {
    id: string;
    name: string;
    isActive: boolean;
  };
}

export function EditClientModal({ client }: Props) {
  const [open, setOpen]       = useState(false);
  const [pending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      try {
        await updateClientAction(client.id, formData);
        toast.success("Cliente atualizado.");
        setOpen(false);
      } catch (err: unknown) {
        toast.error(err instanceof Error ? err.message : "Erro ao atualizar cliente.");
      }
    });
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex h-8 w-8 items-center justify-center rounded-xl border border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text)] transition-colors"
        title="Editar"
      >
        <Pencil size={13} />
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
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-base font-semibold text-[var(--text)]">Editar cliente</h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-xl border border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text)]"
              >
                <X size={15} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-[var(--text-muted)]">
                  Nome da empresa
                </label>
                <input
                  name="name"
                  required
                  defaultValue={client.name}
                  className="input w-full"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-[var(--text-muted)]">
                  Status
                </label>
                <select
                  name="isActive"
                  defaultValue={String(client.isActive)}
                  className="input w-full"
                >
                  <option value="true">Ativo</option>
                  <option value="false">Inativo</option>
                </select>
              </div>

              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setOpen(false)} className="btn btn-ghost flex-1">
                  Cancelar
                </button>
                <button type="submit" disabled={pending} className="btn btn-primary flex-1">
                  {pending ? "Salvando..." : "Salvar"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
