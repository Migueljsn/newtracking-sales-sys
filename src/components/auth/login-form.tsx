"use client";

import { useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Eye, EyeOff } from "lucide-react";

export function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading,  setLoading]  = useState(false);
  const [showPass, setShowPass] = useState(false);
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
        <div className="relative">
          <input
            type={showPass ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="input w-full pr-10"
            placeholder="Sua senha"
          />
          <button
            type="button"
            onClick={() => setShowPass(v => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text)] transition-colors"
          >
            {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
          </button>
        </div>
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
