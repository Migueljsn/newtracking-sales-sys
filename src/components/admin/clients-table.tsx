"use client";

import { useState, useTransition } from "react";
import { LogIn, KeyRound, Eye, EyeOff, Check, X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import { impersonateClientAction, resetClientPasswordAction } from "@/app/admin/actions";
import { EditClientModal } from "./edit-client-modal";
import { DeleteClientButton } from "./delete-client-button";

interface ClientRow {
  id: string;
  name: string;
  slug: string;
  isActive: boolean;
  createdAt: Date;
  user: { email: string; name: string } | null;
  _count: { leads: number; sales: number };
}

function EnterButton({ clientId }: { clientId: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <button
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          try { await impersonateClientAction(clientId); }
          catch (err) { if (isRedirectError(err)) throw err; toast.error("Erro ao entrar como cliente."); }
        })
      }
      className="flex items-center gap-1.5 rounded-xl border border-[var(--accent)] px-3 py-1.5 text-xs font-semibold text-[var(--accent)] transition-colors hover:bg-[var(--accent-soft)] disabled:opacity-50"
    >
      <LogIn size={12} />
      {pending ? "Entrando..." : "Entrar"}
    </button>
  );
}

function ResetPasswordButton({ clientId }: { clientId: string }) {
  const [open,     setOpen]     = useState(false);
  const [password, setPassword] = useState("");
  const [show,     setShow]     = useState(false);
  const [loading,  setLoading]  = useState(false);

  async function handleReset() {
    if (password.length < 6) { toast.error("Mínimo 6 caracteres"); return; }
    setLoading(true);
    try {
      await resetClientPasswordAction(clientId, password);
      toast.success("Senha redefinida com sucesso!");
      setOpen(false);
      setPassword("");
    } catch (err: unknown) {
      toast.error((err as Error).message || "Erro ao redefinir senha");
    } finally {
      setLoading(false);
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 rounded-xl border border-[var(--border)] px-3 py-1.5 text-xs text-[var(--text-muted)] hover:text-[var(--text)] hover:border-[var(--text-muted)] transition-colors"
        title="Redefinir senha"
      >
        <KeyRound size={12} /> Senha
      </button>
    );
  }

  return (
    <div className="flex items-center gap-1.5">
      <div className="relative">
        <input
          type={show ? "text" : "password"}
          value={password}
          onChange={e => setPassword(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") handleReset(); if (e.key === "Escape") { setOpen(false); setPassword(""); } }}
          placeholder="Nova senha"
          autoFocus
          className="h-8 w-36 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2 pr-7 text-xs text-[var(--text)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
        />
        <button type="button" onClick={() => setShow(v => !v)} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text)]">
          {show ? <EyeOff size={11} /> : <Eye size={11} />}
        </button>
      </div>
      <button
        onClick={handleReset}
        disabled={loading}
        className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--accent)] text-white disabled:opacity-50"
        title="Confirmar"
      >
        {loading ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
      </button>
      <button
        onClick={() => { setOpen(false); setPassword(""); }}
        className="flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text)]"
        title="Cancelar"
      >
        <X size={12} />
      </button>
    </div>
  );
}

export function ClientsTable({ clients }: { clients: ClientRow[] }) {
  if (clients.length === 0) {
    return (
      <div className="table-shell">
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <p className="text-sm font-semibold text-[var(--text)]">Nenhum cliente cadastrado</p>
          <p className="mt-1 text-xs text-[var(--text-muted)]">Use o botão acima para criar o primeiro cliente.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="table-shell">
      <div className="table-scroll">
        <table className="w-full text-sm">
          <thead className="bg-[var(--surface-muted)]">
            <tr className="border-b border-[var(--border)]">
              {["Empresa", "Usuário / Email", "Leads", "Vendas", "Status", "Criado em", ""].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]">
            {clients.map((client) => (
              <tr key={client.id} className="transition-colors hover:bg-[var(--surface-muted)]">
                <td className="px-4 py-3.5">
                  <p className="font-semibold text-[var(--text)]">{client.name}</p>
                  <p className="text-xs text-[var(--text-muted)]">{client.slug}</p>
                </td>
                <td className="px-4 py-3.5">
                  {client.user ? (
                    <>
                      <p className="text-[var(--text)]">{client.user.name}</p>
                      <p className="text-xs text-[var(--text-muted)]">{client.user.email}</p>
                    </>
                  ) : (
                    <span className="text-[var(--text-muted)]">—</span>
                  )}
                </td>
                <td className="px-4 py-3.5 tabular-nums text-[var(--text-muted)]">{client._count.leads}</td>
                <td className="px-4 py-3.5 tabular-nums text-[var(--text-muted)]">{client._count.sales}</td>
                <td className="px-4 py-3.5">
                  <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                    client.isActive
                      ? "bg-[var(--success-soft)] text-[var(--success)]"
                      : "bg-[var(--danger-soft)] text-[var(--danger)]"
                  }`}>
                    {client.isActive ? "Ativo" : "Inativo"}
                  </span>
                </td>
                <td className="px-4 py-3.5 text-[var(--text-muted)]">
                  {new Date(client.createdAt).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}
                </td>
                <td className="px-4 py-3.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <EnterButton clientId={client.id} />
                    <ResetPasswordButton clientId={client.id} />
                    <EditClientModal client={client} />
                    <DeleteClientButton client={client} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
