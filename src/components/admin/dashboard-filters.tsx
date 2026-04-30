"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useState } from "react";
import { CalendarDays } from "lucide-react";

interface Props {
  defaultFrom: string;
  defaultTo: string;
}

const presets = [
  { label: "7 dias",    days: 7   },
  { label: "30 dias",   days: 30  },
  { label: "90 dias",   days: 90  },
  { label: "Este ano",  days: 365 },
];

function toDateInput(d: Date) {
  return d.toISOString().split("T")[0];
}

export function DashboardFilters({ defaultFrom, defaultTo }: Props) {
  const router     = useRouter();
  const pathname   = usePathname();
  const params     = useSearchParams();

  const [from, setFrom] = useState(params.get("from") ?? defaultFrom);
  const [to,   setTo  ] = useState(params.get("to")   ?? defaultTo);

  function apply(f: string, t: string) {
    const p = new URLSearchParams({ from: f, to: t });
    router.push(`${pathname}?${p.toString()}`);
  }

  function applyPreset(days: number) {
    const t = toDateInput(new Date());
    const f = toDateInput(new Date(Date.now() - days * 24 * 60 * 60 * 1000));
    setFrom(f);
    setTo(t);
    apply(f, t);
  }

  return (
    <div className="card p-4 space-y-3">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex items-center gap-2 text-xs font-semibold text-[var(--text-muted)] self-center">
          <CalendarDays size={14} />
          Período
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="input text-sm h-9 px-3"
          />
          <span className="text-xs text-[var(--text-muted)]">até</span>
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="input text-sm h-9 px-3"
          />
          <button
            onClick={() => apply(from, to)}
            className="btn btn-primary h-9 px-4 text-sm"
          >
            Aplicar
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {presets.map((p) => (
          <button
            key={p.days}
            onClick={() => applyPreset(p.days)}
            className="rounded-xl border border-[var(--border)] px-3 py-1.5 text-xs font-medium text-[var(--text-muted)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors"
          >
            Últimos {p.label}
          </button>
        ))}
      </div>
    </div>
  );
}
