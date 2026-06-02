"use client";

import { useState } from "react";
import { Bot, BotOff } from "lucide-react";

export function AutomationPauseToggle({
  leadId,
  initialPaused,
}: {
  leadId:         string;
  initialPaused:  boolean;
}) {
  const [paused,  setPaused]  = useState(initialPaused);
  const [loading, setLoading] = useState(false);

  async function toggle() {
    setLoading(true);
    try {
      await fetch(`/api/leads/${leadId}/automation-paused`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ paused: !paused }),
      });
      setPaused((p) => !p);
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={loading}
      title={paused ? "Clique para reativar automações" : "Clique para pausar automações desta lead"}
      className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold transition-all disabled:opacity-60 ${
        paused
          ? "border-[var(--warning)] bg-[var(--warning-soft)] text-[var(--warning)]"
          : "border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--warning)] hover:text-[var(--warning)]"
      }`}
    >
      {paused ? <BotOff size={13} /> : <Bot size={13} />}
      {paused ? "Automação pausada" : "Pausar automação"}
    </button>
  );
}
