"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Calendar, ChevronLeft, ChevronRight, X } from "lucide-react";

const DAYS_LABEL = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
const MONTHS_PT  = [
  "Janeiro","Fevereiro","Março","Abril","Maio","Junho",
  "Julho","Agosto","Setembro","Outubro","Novembro","Dezembro",
];

function toYMD(d: Date) {
  return d.toISOString().slice(0, 10);
}

function parseYMD(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function daysInMonth(year: number, month: number): Date[] {
  const days: Date[] = [];
  const d = new Date(year, month, 1);
  while (d.getMonth() === month) {
    days.push(new Date(d));
    d.setDate(d.getDate() + 1);
  }
  return days;
}

function startPadding(year: number, month: number): number {
  const day = new Date(year, month, 1).getDay();
  return (day + 6) % 7; // Mon = 0
}

interface Props {
  from:      string | undefined;
  to:        string | undefined;
  activeTab: string;
}

export function DateRangePicker({ from, to, activeTab }: Props) {
  const router  = useRef(useRouter());
  const ref     = useRef<HTMLDivElement>(null);
  const [open,  setOpen]  = useState(false);
  const today   = new Date();
  const [view,  setView]  = useState({ year: today.getFullYear(), month: today.getMonth() });
  const [start, setStart] = useState<string | null>(from ?? null);
  const [end,   setEnd]   = useState<string | null>(to   ?? null);
  const [hover, setHover] = useState<string | null>(null);

  // close on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // reset internal state when props change
  useEffect(() => {
    setStart(from ?? null);
    setEnd(to ?? null);
  }, [from, to]);

  const days    = daysInMonth(view.year, view.month);
  const padding = startPadding(view.year, view.month);

  function prevMonth() {
    setView(v => {
      const m = v.month === 0 ? 11 : v.month - 1;
      const y = v.month === 0 ? v.year - 1 : v.year;
      return { year: y, month: m };
    });
  }
  function nextMonth() {
    setView(v => {
      const m = v.month === 11 ? 0 : v.month + 1;
      const y = v.month === 11 ? v.year + 1 : v.year;
      return { year: y, month: m };
    });
  }

  function clickDay(ymd: string) {
    if (!start || (start && end)) {
      setStart(ymd);
      setEnd(null);
    } else {
      if (ymd < start) {
        setEnd(start);
        setStart(ymd);
      } else {
        setEnd(ymd);
      }
    }
  }

  function apply() {
    if (!start || !end) return;
    router.current.push(`/comunicacoes?aba=${activeTab}&de=${start}&ate=${end}`);
    setOpen(false);
  }

  function clear() {
    setStart(null);
    setEnd(null);
    router.current.push(`/comunicacoes?aba=${activeTab}&dias=30`);
    setOpen(false);
  }

  function dayClass(ymd: string): string {
    const isStart  = ymd === start;
    const isEnd    = ymd === end;
    const inRange  = start && end && ymd > start && ymd < end;
    const inHover  = start && !end && hover && ymd > start && ymd <= hover;
    const isToday  = ymd === toYMD(today);

    if (isStart || isEnd) {
      return "bg-[var(--accent)] text-white font-bold rounded-lg";
    }
    if (inRange || inHover) {
      return "bg-[var(--accent-soft)] text-[var(--accent)] rounded-lg";
    }
    if (isToday) {
      return "border border-[var(--accent)] text-[var(--accent)] rounded-lg";
    }
    return "text-[var(--text)] hover:bg-[var(--surface-muted)] rounded-lg";
  }

  const hasCustom = !!(from && to);
  const label = hasCustom
    ? `${parseYMD(from!).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })} → ${parseYMD(to!).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}`
    : "Personalizado";

  const selectionReady = !!(start && end);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className={`flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold transition-all ${
          hasCustom
            ? "border-[var(--accent)] bg-[var(--accent)] text-white"
            : "border-[var(--border)] bg-[var(--surface-muted)] text-[var(--text-muted)] hover:text-[var(--text)]"
        }`}
      >
        <Calendar size={12} />
        {label}
        {hasCustom && (
          <span
            role="button"
            onClick={e => { e.stopPropagation(); clear(); }}
            className="ml-0.5 opacity-70 hover:opacity-100"
          >
            <X size={11} />
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 z-50 card p-4 w-72 shadow-xl animate-fade-in">
          {/* Header */}
          <div className="flex items-center justify-between mb-3">
            <button type="button" onClick={prevMonth} className="p-1.5 rounded-lg hover:bg-[var(--surface-muted)] text-[var(--text-muted)]">
              <ChevronLeft size={14} />
            </button>
            <span className="text-sm font-semibold text-[var(--text)]">
              {MONTHS_PT[view.month]} {view.year}
            </span>
            <button type="button" onClick={nextMonth} className="p-1.5 rounded-lg hover:bg-[var(--surface-muted)] text-[var(--text-muted)]">
              <ChevronRight size={14} />
            </button>
          </div>

          {/* Day labels */}
          <div className="grid grid-cols-7 mb-1">
            {DAYS_LABEL.map(l => (
              <div key={l} className="text-center text-[10px] font-semibold text-[var(--text-muted)] py-1">{l}</div>
            ))}
          </div>

          {/* Days grid */}
          <div className="grid grid-cols-7 gap-px">
            {Array.from({ length: padding }).map((_, i) => <div key={`p${i}`} />)}
            {days.map(day => {
              const ymd     = toYMD(day);
              const isFuture = ymd > toYMD(today);
              return (
                <button
                  key={ymd}
                  type="button"
                  disabled={isFuture}
                  onClick={() => clickDay(ymd)}
                  onMouseEnter={() => setHover(ymd)}
                  onMouseLeave={() => setHover(null)}
                  className={`text-center text-xs py-1.5 transition-all disabled:opacity-30 disabled:cursor-not-allowed ${dayClass(ymd)}`}
                >
                  {day.getDate()}
                </button>
              );
            })}
          </div>

          {/* Hint */}
          <p className="text-[10px] text-[var(--text-muted)] text-center mt-3">
            {!start ? "Clique para definir o início" : !end ? "Clique para definir o fim" : `${start} → ${end}`}
          </p>

          {/* Actions */}
          <div className="flex gap-2 mt-3 pt-3 border-t border-[var(--border)]">
            <button type="button" onClick={() => setOpen(false)}
              className="flex-1 rounded-xl border border-[var(--border)] py-2 text-xs font-medium text-[var(--text-muted)] hover:bg-[var(--surface-muted)]">
              Cancelar
            </button>
            <button type="button" onClick={apply} disabled={!selectionReady}
              className="flex-1 rounded-xl bg-[var(--accent)] py-2 text-xs font-bold text-white disabled:opacity-40 disabled:cursor-not-allowed">
              Aplicar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
