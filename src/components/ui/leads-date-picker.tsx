"use client";

import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { Calendar, ChevronLeft, ChevronRight, X } from "lucide-react";
import type { DateRange } from "@/components/ui/date-range-picker";

export type DateFilterMode = "capture" | "sale";
export interface LeadsDateFilter { mode: DateFilterMode; range: DateRange }

const DAYS_LABEL = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
const MONTHS_PT  = [
  "Janeiro","Fevereiro","Março","Abril","Maio","Junho",
  "Julho","Agosto","Setembro","Outubro","Novembro","Dezembro",
];

function toYMD(d: Date) { return d.toISOString().slice(0, 10); }
function parseYMD(s: string): Date { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); }
function daysInMonth(year: number, month: number): Date[] {
  const days: Date[] = [];
  const d = new Date(year, month, 1);
  while (d.getMonth() === month) { days.push(new Date(d)); d.setDate(d.getDate() + 1); }
  return days;
}
function startPadding(year: number, month: number): number {
  return (new Date(year, month, 1).getDay() + 6) % 7;
}

interface Props {
  value:    LeadsDateFilter | null;
  onChange: (v: LeadsDateFilter | null) => void;
}

export function LeadsDatePicker({ value, onChange }: Props) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [pos,  setPos]  = useState<{ top: number; left: number } | null>(null);

  const today = new Date();
  const [view,  setView]  = useState({ year: today.getFullYear(), month: today.getMonth() });
  const [mode,  setMode]  = useState<DateFilterMode>(value?.mode ?? "capture");
  const [start, setStart] = useState<string | null>(value?.range.from ?? null);
  const [end,   setEnd]   = useState<string | null>(value?.range.to   ?? null);
  const [hover, setHover] = useState<string | null>(null);

  useEffect(() => {
    setMode(value?.mode ?? "capture");
    setStart(value?.range.from ?? null);
    setEnd(value?.range.to ?? null);
  }, [value]);

  function openPicker() {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const left = Math.min(rect.right - 288, window.innerWidth - 300);
    setPos({ top: rect.bottom + 8, left: Math.max(8, left) });
    setOpen(true);
  }

  useEffect(() => {
    if (!open) return;
    function handleOutside(e: MouseEvent) {
      const panel = document.getElementById("leads-date-panel");
      if (panel && !panel.contains(e.target as Node) && !triggerRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function handleScroll() { setOpen(false); }
    document.addEventListener("mousedown", handleOutside);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => { document.removeEventListener("mousedown", handleOutside); window.removeEventListener("scroll", handleScroll); };
  }, [open]);

  const days     = daysInMonth(view.year, view.month);
  const padding  = startPadding(view.year, view.month);
  const todayYMD = toYMD(today);

  function prevMonth() { setView(v => ({ month: v.month === 0 ? 11 : v.month - 1, year: v.month === 0 ? v.year - 1 : v.year })); }
  function nextMonth() { setView(v => ({ month: v.month === 11 ? 0 : v.month + 1, year: v.month === 11 ? v.year + 1 : v.year })); }

  function clickDay(ymd: string) {
    if (!start || (start && end)) { setStart(ymd); setEnd(null); }
    else if (ymd < start) { setEnd(start); setStart(ymd); }
    else { setEnd(ymd); }
  }

  function apply() {
    if (!start || !end) return;
    onChange({ mode, range: { from: start, to: end } });
    setOpen(false);
  }

  function clear(e?: React.MouseEvent) {
    e?.stopPropagation();
    setStart(null); setEnd(null);
    onChange(null);
    setOpen(false);
  }

  function dayClass(ymd: string): string {
    const isStart = ymd === start;
    const isEnd   = ymd === end;
    const inRange = start && end && ymd > start && ymd < end;
    const inHover = start && !end && hover && ymd > start && ymd <= hover;
    const isToday = ymd === todayYMD;
    if (isStart || isEnd) return "bg-[var(--accent)] text-white font-bold rounded-lg";
    if (inRange || inHover) return "bg-[var(--accent-soft)] text-[var(--accent)] rounded-lg";
    if (isToday) return "border border-[var(--accent)] text-[var(--accent)] rounded-lg";
    return "text-[var(--text)] hover:bg-[var(--surface-muted)] rounded-lg";
  }

  const hasValue = !!(value?.range.from && value?.range.to);
  const modeLabel = value?.mode === "sale" ? "Venda" : "Captura";
  const label = hasValue
    ? `${modeLabel}: ${parseYMD(value!.range.from).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })} → ${parseYMD(value!.range.to).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}`
    : "Data";

  const panel = open && pos ? createPortal(
    <div
      id="leads-date-panel"
      style={{ position: "fixed", top: pos.top, left: pos.left, zIndex: 9999 }}
      className="card p-4 w-72 shadow-xl animate-fade-in"
    >
      {/* Mode toggle */}
      <div className="flex gap-1 rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] p-1 mb-4">
        {(["capture", "sale"] as DateFilterMode[]).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className={`flex-1 rounded-lg py-1.5 text-xs font-semibold transition-all ${
              mode === m
                ? "bg-[var(--surface)] text-[var(--text)] shadow-sm"
                : "text-[var(--text-muted)] hover:text-[var(--text)]"
            }`}
          >
            {m === "capture" ? "Captura" : "Venda"}
          </button>
        ))}
      </div>

      {/* Calendar header */}
      <div className="flex items-center justify-between mb-3">
        <button type="button" onClick={prevMonth} className="p-1.5 rounded-lg hover:bg-[var(--surface-muted)] text-[var(--text-muted)]"><ChevronLeft size={14} /></button>
        <span className="text-sm font-semibold text-[var(--text)]">{MONTHS_PT[view.month]} {view.year}</span>
        <button type="button" onClick={nextMonth} className="p-1.5 rounded-lg hover:bg-[var(--surface-muted)] text-[var(--text-muted)]"><ChevronRight size={14} /></button>
      </div>

      {/* Day labels */}
      <div className="grid grid-cols-7 mb-1">
        {DAYS_LABEL.map(l => <div key={l} className="text-center text-[10px] font-semibold text-[var(--text-muted)] py-1">{l}</div>)}
      </div>

      {/* Days */}
      <div className="grid grid-cols-7 gap-px">
        {Array.from({ length: padding }).map((_, i) => <div key={`p${i}`} />)}
        {days.map(day => {
          const ymd = toYMD(day);
          return (
            <button key={ymd} type="button" disabled={ymd > todayYMD}
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

      <p className="text-[10px] text-[var(--text-muted)] text-center mt-3">
        {!start ? "Clique para definir o início" : !end ? "Clique para definir o fim" : `${start} → ${end}`}
      </p>

      {/* Actions */}
      <div className="flex gap-2 mt-3 pt-3 border-t border-[var(--border)]">
        <button type="button" onClick={() => setOpen(false)}
          className="flex-1 rounded-xl border border-[var(--border)] py-2 text-xs font-medium text-[var(--text-muted)] hover:bg-[var(--surface-muted)]">
          Cancelar
        </button>
        <button type="button" onClick={apply} disabled={!(start && end)}
          className="flex-1 rounded-xl bg-[var(--accent)] py-2 text-xs font-bold text-white disabled:opacity-40 disabled:cursor-not-allowed">
          Aplicar
        </button>
      </div>
    </div>,
    document.body
  ) : null;

  return (
    <>
      <button ref={triggerRef} type="button" onClick={open ? () => setOpen(false) : openPicker}
        className={`flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold transition-all whitespace-nowrap ${
          hasValue
            ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]"
            : "border-[var(--border)] bg-[var(--surface-muted)] text-[var(--text-muted)] hover:text-[var(--text)]"
        }`}
      >
        <Calendar size={12} />
        {label}
        {hasValue && (
          <span role="button" onClick={clear} className="ml-0.5 opacity-70 hover:opacity-100">
            <X size={11} />
          </span>
        )}
      </button>
      {panel}
    </>
  );
}
