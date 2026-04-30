"use client";

import { useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { Plus, X } from "lucide-react";
import { toast } from "sonner";
import { createClientAction } from "@/app/admin/actions";

export function CreateClientModal() {
  const [open, setOpen]       = useState(false);
  const [pending, startTransition] = useTransition();
  const formRef               = useRef<HTMLFormElement>(null);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      try {
        await createClientAction(formData);
        toast.success("Cliente criado com sucesso.");
        setOpen(false);
        formRef.current?.reset();
      } catch (err: unknown) {
        toast.error(err instanceof Error ? err.message : "Erro ao criar cliente.");
      }
    });
  }

  return (
    <>
      <button onClick={() => setOpen(true)} className="btn btn-primary flex items-center gap-2">
        <Plus size={15} />
        Novo cliente
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
              <h2 className="text-base font-semibold text-[var(--text)]">Novo cliente</h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-xl border border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text)]"
              >
                <X size={15} />
              </button>
            </div>

            <form ref={formRef} onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-[var(--text-muted)]">
                  Nome da empresa
                </label>
                <input name="name" required className="input w-full" placeholder="Ex: Empresa ABC" />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-[var(--text-muted)]">
                  Nome do usuário
                </label>
                <input name="userName" required className="input w-full" placeholder="Ex: João Silva" />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-[var(--text-muted)]">
                  Email de acesso
                </label>
                <input name="email" type="email" required className="input w-full" placeholder="email@empresa.com" />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-[var(--text-muted)]">
                  Senha inicial
                </label>
                <input name="password" type="password" required minLength={6} className="input w-full" placeholder="Mínimo 6 caracteres" />
              </div>

              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="btn btn-ghost flex-1"
                >
                  Cancelar
                </button>
                <button type="submit" disabled={pending} className="btn btn-primary flex-1">
                  {pending ? "Criando..." : "Criar cliente"}
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
