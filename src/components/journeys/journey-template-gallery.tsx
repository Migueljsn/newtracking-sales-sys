"use client";

import { useTransition, useState } from "react";
import { X, Zap, Clock, Mail, MessageCircle, GitBranch, CheckCircle } from "lucide-react";
import { JOURNEY_TEMPLATES, CATEGORY_LABEL, CATEGORY_COLOR } from "@/lib/journeys/templates";
import { createJourneyFromTemplateAction } from "@/app/(dashboard)/journeys/actions";

const NODE_ICON: Record<string, React.ReactNode> = {
  trigger:      <Zap size={11} />,
  wait:         <Clock size={11} />,
  email:        <Mail size={11} />,
  whatsapp:     <MessageCircle size={11} />,
  condition:    <GitBranch size={11} />,
  end:          <CheckCircle size={11} />,
};

const NODE_COLOR: Record<string, string> = {
  trigger:      "#6366f1",
  wait:         "#f59e0b",
  email:        "#3b82f6",
  whatsapp:     "#10b981",
  condition:    "#8b5cf6",
  changeStatus: "#f97316",
  assign:       "#06b6d4",
  end:          "#ef4444",
};

const CATEGORIES = ["captacao", "nutricao", "reativacao", "pos-venda"] as const;

interface Props {
  open:    boolean;
  onClose: () => void;
}

export function JourneyTemplateGallery({ open, onClose }: Props) {
  const [isPending, startTransition] = useTransition();
  const [using, setUsing]            = useState<string | null>(null);
  const [activeCategory, setCategory] = useState<string>("all");

  if (!open) return null;

  const filtered = activeCategory === "all"
    ? JOURNEY_TEMPLATES
    : JOURNEY_TEMPLATES.filter(t => t.category === activeCategory);

  function handleUse(templateId: string) {
    setUsing(templateId);
    startTransition(() => createJourneyFromTemplateAction(templateId));
  }

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="fixed inset-x-4 top-[10%] z-50 mx-auto max-w-3xl rounded-2xl bg-[var(--bg)] border border-[var(--border)] shadow-[var(--shadow-lg)] flex flex-col max-h-[80vh] animate-scale-in">

        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--border)] px-6 py-4 shrink-0">
          <div>
            <h2 className="text-base font-semibold text-[var(--text)]">Templates de jornada</h2>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">
              Selecione um modelo pronto e personalize no canvas
            </p>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-xl border border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text)] transition-colors"
          >
            <X size={15} />
          </button>
        </div>

        {/* Category filter */}
        <div className="flex gap-2 px-6 pt-4 shrink-0 flex-wrap">
          {[{ key: "all", label: "Todos" }, ...CATEGORIES.map(c => ({ key: c, label: CATEGORY_LABEL[c] }))].map(cat => (
            <button
              key={cat.key}
              onClick={() => setCategory(cat.key)}
              className="rounded-full border px-3 py-1 text-xs font-semibold transition-all"
              style={{
                borderColor: activeCategory === cat.key
                  ? (cat.key === "all" ? "var(--accent)" : CATEGORY_COLOR[cat.key])
                  : "var(--border)",
                backgroundColor: activeCategory === cat.key
                  ? (cat.key === "all" ? "var(--accent-soft)" : `${CATEGORY_COLOR[cat.key]}18`)
                  : "transparent",
                color: activeCategory === cat.key
                  ? (cat.key === "all" ? "var(--accent)" : CATEGORY_COLOR[cat.key])
                  : "var(--text-muted)",
              }}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Template grid */}
        <div className="overflow-y-auto p-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {filtered.map(tpl => {
            const catColor = CATEGORY_COLOR[tpl.category];
            const isUsing  = using === tpl.id && isPending;

            return (
              <div
                key={tpl.id}
                className="soft-panel rounded-xl border border-[var(--border)] p-5 flex flex-col gap-4 hover:border-[var(--border-strong)] transition-colors"
              >
                {/* Title + category */}
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-sm font-semibold text-[var(--text)] leading-snug">{tpl.name}</h3>
                    <span
                      className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold"
                      style={{ backgroundColor: `${catColor}18`, color: catColor }}
                    >
                      {CATEGORY_LABEL[tpl.category]}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-[var(--text-muted)] leading-relaxed">{tpl.description}</p>
                </div>

                {/* Steps preview */}
                <div className="space-y-1.5">
                  {tpl.steps.map((step, i) => {
                    const node = tpl.nodes[i];
                    const nodeType = node?.type ?? "trigger";
                    const color = NODE_COLOR[nodeType] ?? "var(--text-muted)";
                    return (
                      <div key={i} className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
                        <span
                          className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md"
                          style={{ backgroundColor: `${color}20`, color }}
                        >
                          {NODE_ICON[nodeType] ?? <Zap size={11} />}
                        </span>
                        <span>{step}</span>
                      </div>
                    );
                  })}
                </div>

                {/* CTA */}
                <button
                  onClick={() => handleUse(tpl.id)}
                  disabled={isPending}
                  className="mt-auto w-full rounded-xl py-2 text-xs font-semibold transition-all border disabled:opacity-50"
                  style={{
                    borderColor:     catColor,
                    backgroundColor: `${catColor}14`,
                    color:           catColor,
                  }}
                  onMouseEnter={e => {
                    (e.currentTarget as HTMLButtonElement).style.backgroundColor = catColor;
                    (e.currentTarget as HTMLButtonElement).style.color = "#fff";
                  }}
                  onMouseLeave={e => {
                    (e.currentTarget as HTMLButtonElement).style.backgroundColor = `${catColor}14`;
                    (e.currentTarget as HTMLButtonElement).style.color = catColor;
                  }}
                >
                  {isUsing ? "Criando jornada…" : "Usar este template"}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
