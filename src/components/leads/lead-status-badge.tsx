import type { LeadStatus } from "@prisma/client";

interface PipelineStage { name: string; color: string }

const systemConfig: Partial<Record<LeadStatus, { label: string; className: string; dotClass: string }>> = {
  NEW: {
    label:     "Nova",
    className: "bg-[var(--accent-soft)] text-[var(--accent)]",
    dotClass:  "bg-[var(--accent)] animate-pulse",
  },
  REGISTERED: {  // legacy — kept for backward compat
    label:     "Cadastrada",
    className: "bg-[var(--warning-soft)] text-[var(--warning)]",
    dotClass:  "bg-[var(--warning)] animate-pulse",
  },
  SOLD: {
    label:     "Vendida",
    className: "bg-[var(--success-soft)] text-[var(--success)]",
    dotClass:  "bg-[var(--success)]",
  },
  LOST: {
    label:     "Perdida",
    className: "bg-[var(--danger-soft)] text-[var(--danger)]",
    dotClass:  "bg-[var(--danger)]",
  },
};

export function LeadStatusBadge({
  status,
  pipelineStage,
}: {
  status:         LeadStatus;
  pipelineStage?: PipelineStage | null;
}) {
  // If lead is NEW and has a pipeline stage, show stage name
  if (status === "NEW" && pipelineStage) {
    return (
      <span
        className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold"
        style={{ backgroundColor: `${pipelineStage.color}18`, color: pipelineStage.color }}
      >
        <span
          className="h-1.5 w-1.5 shrink-0 rounded-full animate-pulse"
          style={{ backgroundColor: pipelineStage.color }}
        />
        {pipelineStage.name}
      </span>
    );
  }

  const cfg = systemConfig[status];
  if (!cfg) return null;

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${cfg.className}`}>
      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${cfg.dotClass}`} />
      {cfg.label}
    </span>
  );
}
