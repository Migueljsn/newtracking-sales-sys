"use client";

import { useState, useRef } from "react";
import { createPortal } from "react-dom";

const TOOLTIP_W   = 220;
const TOOLTIP_GAP = 8;

export function HintTooltip({ text }: { text: string }) {
  const [style, setStyle] = useState<React.CSSProperties | null>(null);
  const ref = useRef<HTMLSpanElement>(null);

  function show() {
    if (!ref.current) return;
    const rect    = ref.current.getBoundingClientRect();
    const rawLeft = rect.left + rect.width / 2 - TOOLTIP_W / 2;
    const left    = Math.max(TOOLTIP_GAP, Math.min(rawLeft, window.innerWidth - TOOLTIP_W - TOOLTIP_GAP));
    const top     = rect.top - TOOLTIP_GAP;
    setStyle({ position: "fixed", top, left, transform: "translateY(-100%)", zIndex: 9999, width: TOOLTIP_W });
  }

  return (
    <span ref={ref} onMouseEnter={show} onMouseLeave={() => setStyle(null)} className="inline-flex shrink-0">
      <span className={`flex h-4 w-4 cursor-help items-center justify-center rounded-full border text-[10px] font-bold leading-none transition-colors ${
        style
          ? "border-[var(--accent)] text-[var(--accent)]"
          : "border-[var(--border)] text-[var(--text-muted)]"
      }`}>
        ?
      </span>
      {style && createPortal(
        <div style={style} className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-xs leading-relaxed text-[var(--text-muted)] shadow-xl">
          {text}
        </div>,
        document.body,
      )}
    </span>
  );
}
