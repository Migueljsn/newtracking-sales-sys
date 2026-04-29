"use client";

import { useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

export function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      toast.error("Email ou senha inválidos");
      setLoading(false);
      return;
    }

    router.push("/");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="card space-y-5 p-6 sm:p-7">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold text-[var(--text)]">Entrar</h2>
        <p className="text-sm text-[var(--text-muted)]">Use o email do operador vinculado ao cliente.</p>
      </div>

      <div>
        <label className="mb-1.5 block text-sm font-medium text-[var(--text)]">Email</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="input w-full"
          placeholder="voce@empresa.com"
        />
      </div>
      <div>
        <label className="mb-1.5 block text-sm font-medium text-[var(--text)]">Senha</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          className="input w-full"
          placeholder="Sua senha"
        />
      </div>
      <button
        type="submit"
        disabled={loading}
        className="btn-primary w-full"
      >
        {loading ? "Entrando..." : "Entrar"}
      </button>
    </form>
  );
}
