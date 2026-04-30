"use client";

import { useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { Pencil, X } from "lucide-react";
import { toast } from "sonner";
import { updateClientAction } from "@/app/admin/actions";

interface Props {
  client: {
    id: string;
    name: string;
    slug: string;
    isActive: boolean;
    user: { name: string; email: string } | null;
  };
}

export function EditClientModal({ client }: Props) {
  const [open, setOpen]            = useState(false);
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

      {open && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            type="button"
            aria-label="Fechar"
            className="absolute inset-0 bg-slate-950/50 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />
          <div className="card relative w-full max-w-md p-6 shadow-xl">
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
              <fieldset className="space-y-3">
                <legend className="text-[11px] font-bold uppercase tracking-[0.2em] text-[var(--text-muted)]">Empresa</legend>
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-[var(--text-muted)]">Nome</label>
                  <input name="name" required defaultValue={client.name} className="input w-full" />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-[var(--text-muted)]">Slug</label>
                  <input name="slug" required defaultValue={client.slug} className="input w-full font-mono text-sm" />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-[var(--text-muted)]">Status</label>
                  <select name="isActive" defaultValue={String(client.isActive)} className="input w-full">
                    <option value="true">Ativo</option>
                    <option value="false">Inativo</option>
                  </select>
                </div>
              </fieldset>

              <fieldset className="space-y-3 border-t border-[var(--border)] pt-4">
                <legend className="text-[11px] font-bold uppercase tracking-[0.2em] text-[var(--text-muted)]">Usuário</legend>
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-[var(--text-muted)]">Nome</label>
                  <input name="userName" required defaultValue={client.user?.name ?? ""} className="input w-full" />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-[var(--text-muted)]">Email de acesso</label>
                  <input name="email" type="email" required defaultValue={client.user?.email ?? ""} className="input w-full" />
                </div>
              </fieldset>

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
        </div>,
        document.body
      )}
    </>
  );
}
