"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  MessageSquare, Phone, MessageCircle, Calendar,
  Mail, Tag, Plus, Trash2,
  ArrowRight, DollarSign, Flag, MessageCircleMore,
} from "lucide-react";

type InteractionType = "NOTE" | "CALL" | "WHATSAPP" | "WHATSAPP_INBOUND" | "MEETING" | "EMAIL" | "OTHER";

// Tipos que o usuário pode registrar manualmente no formulário
const MANUAL_TYPES: InteractionType[] = ["NOTE", "CALL", "WHATSAPP", "MEETING", "EMAIL", "OTHER"];

interface Interaction {
  id:        string;
  type:      InteractionType;
  content:   string;
  createdBy: string | null;
  createdAt: string | Date;
}

interface StatusHistoryEntry {
  id:        string;
  from:      string | null;
  to:        string;
  changedBy: string | null;
  createdAt: string | Date;
}

interface SaleEntry {
  id:     string;
  value:  number;
  soldAt: string | Date;
  notes:  string | null;
}

interface Props {
  leadId:        string;
  interactions:  Interaction[];
  statusHistory: StatusHistoryEntry[];
  sales:         SaleEntry[];
  capturedAt:    string | Date;
}

const typeConfig: Record<InteractionType, { label: string; icon: React.ReactNode; color: string }> = {
  NOTE:             { label: "Anotação",          icon: <MessageSquare size={13} />,    color: "var(--text-muted)" },
  CALL:             { label: "Ligação",            icon: <Phone size={13} />,            color: "var(--accent)" },
  WHATSAPP:         { label: "WhatsApp",           icon: <MessageCircle size={13} />,    color: "#25d366" },
  WHATSAPP_INBOUND: { label: "Resposta WhatsApp",  icon: <MessageCircleMore size={13} />, color: "#128c7e" },
  MEETING:          { label: "Reunião",            icon: <Calendar size={13} />,         color: "var(--warning)" },
  EMAIL:            { label: "E-mail",             icon: <Mail size={13} />,             color: "var(--accent-strong)" },
  OTHER:            { label: "Outro",              icon: <Tag size={13} />,              color: "var(--text-muted)" },
};

type TimelineEvent =
  | { kind: "interaction"; data: Interaction; date: Date }
  | { kind: "status";      data: StatusHistoryEntry; date: Date }
  | { kind: "sale";        data: SaleEntry; date: Date }
  | { kind: "captured";    date: Date };

function buildTimeline(
  interactions: Interaction[],
  statusHistory: StatusHistoryEntry[],
  sales: SaleEntry[],
  capturedAt: string | Date,
): TimelineEvent[] {
  const events: TimelineEvent[] = [
    ...interactions.map(d  => ({ kind: "interaction" as const, data: d, date: new Date(d.createdAt) })),
    ...statusHistory.map(d => ({ kind: "status"      as const, data: d, date: new Date(d.createdAt) })),
    ...sales.map(d         => ({ kind: "sale"         as const, data: d, date: new Date(d.soldAt) })),
    { kind: "captured", date: new Date(capturedAt) },
  ];
  return events.sort((a, b) => b.date.getTime() - a.date.getTime());
}

function fmt(date: Date) {
  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
}

function fmtTime(date: Date) {
  return date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

export function LeadInteractions({ leadId, interactions, statusHistory, sales, capturedAt }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<InteractionType>("CALL");
  const [content, setContent] = useState("");
  const [createdBy, setCreatedBy] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const timeline = buildTimeline(interactions, statusHistory, sales, capturedAt);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!content.trim()) return;
    const res = await fetch(`/api/leads/${leadId}/interactions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, content, createdBy }),
    });
    if (!res.ok) return;
    setContent("");
    setOpen(false);
    startTransition(() => router.refresh());
  }

  async function handleDelete(interactionId: string) {
    setDeletingId(interactionId);
    await fetch(`/api/leads/${leadId}/interactions`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ interactionId }),
    });
    setDeletingId(null);
    startTransition(() => router.refresh());
  }

  return (
    <div className="card p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-[var(--text)]">
          Histórico de comunicações
          {timeline.length > 0 && (
            <span className="ml-2 text-[10px] font-normal text-[var(--text-muted)]">
              {timeline.length} evento{timeline.length !== 1 ? "s" : ""}
            </span>
          )}
        </h2>
        <button
          onClick={() => setOpen(o => !o)}
          className="flex items-center gap-1.5 rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-1.5 text-xs font-semibold text-[var(--text)] hover:bg-[var(--surface-strong)] transition-colors"
        >
          <Plus size={12} />
          Registrar
        </button>
      </div>

      {/* Form */}
      {open && (
        <form onSubmit={handleSubmit} className="rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] p-4 space-y-3 animate-scale-in">
          <div className="flex flex-wrap gap-2">
            {MANUAL_TYPES.map(t => {
              const cfg = typeConfig[t];
              const active = type === t;
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => setType(t)}
                  className="flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition-all"
                  style={{
                    borderColor: active ? cfg.color : "var(--border)",
                    backgroundColor: active ? `${cfg.color}18` : "var(--surface)",
                    color: active ? cfg.color : "var(--text-muted)",
                  }}
                >
                  {cfg.icon}
                  {cfg.label}
                </button>
              );
            })}
          </div>

          <textarea
            value={content}
            onChange={e => setContent(e.target.value)}
            placeholder={`Descreva a interação de ${typeConfig[type].label.toLowerCase()}…`}
            rows={3}
            className="input w-full resize-none"
            required
          />

          <div className="flex gap-2">
            <input
              value={createdBy}
              onChange={e => setCreatedBy(e.target.value)}
              placeholder="Registrado por (opcional)"
              className="input flex-1 text-xs"
            />
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="btn-secondary px-4 text-xs"
            >
              Cancelar
            </button>
            <button type="submit" disabled={!content.trim() || isPending} className="btn-primary px-4 text-xs">
              Salvar
            </button>
          </div>
        </form>
      )}

      {/* Timeline */}
      <div className="relative">
        {timeline.length === 0 ? (
          <p className="text-sm text-[var(--text-muted)]">Nenhum evento registrado ainda.</p>
        ) : (
          <div className="space-y-0">
            {timeline.map((event, idx) => (
              <TimelineRow
                key={`${event.kind}-${idx}`}
                event={event}
                isLast={idx === timeline.length - 1}
                onDelete={event.kind === "interaction" && event.data.type !== "WHATSAPP_INBOUND" ? () => handleDelete(event.data.id) : undefined}
                isDeleting={event.kind === "interaction" && deletingId === event.data.id}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function TimelineRow({
  event,
  isLast,
  onDelete,
  isDeleting,
}: {
  event: TimelineEvent;
  isLast: boolean;
  onDelete?: () => void;
  isDeleting?: boolean;
}) {
  if (event.kind === "interaction") {
    const cfg = typeConfig[event.data.type];
    return (
      <div className="flex gap-3">
        <div className="flex flex-col items-center">
          <div
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 border-[var(--bg)] shadow-sm"
            style={{ backgroundColor: `${cfg.color}22`, color: cfg.color }}
          >
            {cfg.icon}
          </div>
          {!isLast && <div className="mt-1 w-px flex-1 bg-[var(--border)]" style={{ minHeight: "1.5rem" }} />}
        </div>
        <div className="mb-4 flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-semibold" style={{ color: cfg.color }}>{cfg.label}</span>
              {event.data.createdBy && (
                <span className="rounded-full bg-[var(--surface-muted)] border border-[var(--border)] px-2 py-0.5 text-[10px] text-[var(--text-muted)]">
                  {event.data.createdBy}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-[10px] text-[var(--text-muted)]">{fmt(event.date)}</span>
              {onDelete && (
                <button
                  onClick={onDelete}
                  disabled={isDeleting}
                  className="text-[var(--text-muted)] hover:text-[var(--danger)] transition-colors opacity-0 group-hover:opacity-100"
                  title="Excluir"
                >
                  <Trash2 size={12} />
                </button>
              )}
            </div>
          </div>
          <p className="mt-1 text-sm text-[var(--text)] whitespace-pre-wrap">{event.data.content}</p>
        </div>
      </div>
    );
  }

  if (event.kind === "status") {
    return (
      <div className="flex gap-3">
        <div className="flex flex-col items-center">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--surface-muted)] border border-[var(--border)] text-[var(--text-muted)]">
            <ArrowRight size={12} />
          </div>
          {!isLast && <div className="mt-1 w-px flex-1 bg-[var(--border)]" style={{ minHeight: "1.5rem" }} />}
        </div>
        <div className="mb-4 flex-1">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 flex-wrap text-xs text-[var(--text-muted)]">
              <span>Alteração de status</span>
              {event.data.from && (
                <>
                  <span className="font-medium text-[var(--text)]">{event.data.from}</span>
                  <ArrowRight size={10} />
                </>
              )}
              <span className="font-medium text-[var(--text)]">{event.data.to}</span>
              {event.data.changedBy && (
                <span className="rounded-full bg-[var(--surface-muted)] border border-[var(--border)] px-2 py-0.5 text-[10px] text-[var(--text-muted)]">
                  {event.data.changedBy}
                </span>
              )}
            </div>
            <span className="shrink-0 text-[10px] text-[var(--text-muted)]">{fmt(event.date)}</span>
          </div>
        </div>
      </div>
    );
  }

  if (event.kind === "sale") {
    return (
      <div className="flex gap-3">
        <div className="flex flex-col items-center">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--success-soft)] border border-[var(--success)] text-[var(--success)]">
            <DollarSign size={12} />
          </div>
          {!isLast && <div className="mt-1 w-px flex-1 bg-[var(--border)]" style={{ minHeight: "1.5rem" }} />}
        </div>
        <div className="mb-4 flex-1">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 flex-wrap text-xs">
              <span className="font-semibold text-[var(--success)]">
                Venda registrada —{" "}
                {event.data.value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
              </span>
            </div>
            <span className="shrink-0 text-[10px] text-[var(--text-muted)]">{fmt(event.date)}</span>
          </div>
          {event.data.notes && (
            <p className="mt-1 text-xs text-[var(--text-muted)]">{event.data.notes}</p>
          )}
        </div>
      </div>
    );
  }

  // captured
  return (
    <div className="flex gap-3">
      <div className="flex flex-col items-center">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--accent-soft)] border border-[var(--accent)] text-[var(--accent)]">
          <Flag size={12} />
        </div>
      </div>
      <div className="flex-1">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-semibold text-[var(--accent)]">Lead capturada</span>
          <span className="shrink-0 text-[10px] text-[var(--text-muted)]">{fmt(event.date)}</span>
        </div>
      </div>
    </div>
  );
}
