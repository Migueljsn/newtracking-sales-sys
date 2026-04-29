"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { MonitorCog, MoonStar, SunMedium } from "lucide-react";

interface ThemeToggleProps {
  compact?: boolean;
}

export function ThemeToggle({ compact = false }: ThemeToggleProps) {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isDark = mounted ? resolvedTheme === "dark" : false;
  const nextTheme = isDark ? "light" : "dark";

  if (compact) {
    return (
      <button
        type="button"
        onClick={() => setTheme(nextTheme)}
        aria-label={isDark ? "Ativar modo claro" : "Ativar modo escuro"}
        className="flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] text-[var(--text-muted)] hover:border-[var(--border-strong)] hover:bg-[var(--surface-strong)] hover:text-[var(--text)]"
      >
        {mounted ? (isDark ? <SunMedium size={16} /> : <MoonStar size={16} />) : <MonitorCog size={16} />}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setTheme(nextTheme)}
      className="flex w-full items-center gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-2.5 text-sm text-[var(--text-muted)] hover:border-[var(--border-strong)] hover:bg-[var(--surface-strong)] hover:text-[var(--text)]"
    >
      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent)]">
        {mounted ? (isDark ? <SunMedium size={16} /> : <MoonStar size={16} />) : <MonitorCog size={16} />}
      </span>
      <span className="min-w-0 flex-1 text-left">
        <span className="block font-medium text-[var(--text)]">{isDark ? "Modo claro" : "Modo escuro"}</span>
        <span className="block text-xs text-[var(--text-muted)]">
          {mounted ? (isDark ? "Trocar para a versão clara" : "Trocar para a versão escura") : "Carregando preferências"}
        </span>
      </span>
    </button>
  );
}
