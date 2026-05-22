"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { consultantLoginAction } from "./actions";

export default function ConsultantLoginPage() {
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const fd = new FormData(e.currentTarget);
    try {
      await consultantLoginAction(fd);
    } catch (err: unknown) {
      toast.error((err as Error).message || "Erro ao fazer login");
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--bg)] p-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-[var(--text)]">Portal CRM</h1>
          <p className="mt-1 text-sm text-[var(--text-muted)]">Acesso de consultor</p>
        </div>

        <form onSubmit={handleSubmit} className="card p-6 space-y-4">
          <div>
            <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">E-mail</label>
            <input
              name="email"
              type="email"
              required
              autoComplete="email"
              className="input w-full"
              placeholder="seu@email.com"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">Senha</label>
            <input
              name="password"
              type="password"
              required
              autoComplete="current-password"
              className="input w-full"
              placeholder="••••••••"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--accent)] py-2.5 text-sm font-semibold text-white hover:bg-[var(--accent-strong)] disabled:opacity-60 transition-colors"
          >
            {loading && <Loader2 size={15} className="animate-spin" />}
            Entrar
          </button>
        </form>
      </div>
    </div>
  );
}
