export const dynamic = "force-dynamic";

import Image from "next/image";
import { LoginForm } from "@/components/auth/login-form";

export default function LoginPage() {
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-10">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(37,99,235,0.18),_transparent_34%),radial-gradient(circle_at_bottom_right,_rgba(16,185,129,0.12),_transparent_26%)]" />
      <div className="relative w-full max-w-md">
        <div className="mb-8 flex flex-col items-center text-center">
          <Image src="/logo-light.png" alt="Portal CRM" height={48} width={218} className="object-contain dark:hidden mb-4" />
          <Image src="/logo-dark.png" alt="Portal CRM" height={48} width={218} className="object-contain hidden dark:block mb-4" />
          <h1 className="text-3xl font-semibold text-[var(--text)]">Acesse sua conta</h1>
          <p className="mt-2 text-sm text-[var(--text-muted)]">
            CRM operacional com tracking consistente para leads, vendas e Meta Conversions API.
          </p>
        </div>
        <LoginForm />
      </div>
    </main>
  );
}
