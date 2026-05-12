import type { LeadStatus } from "@prisma/client";

const config: Record<
  LeadStatus,
  { label: string; className: string; dotClass: string }
> = {
  NEW: {
    label: "Nova",
    className: "bg-[var(--accent-soft)] text-[var(--accent)]",
    dotClass: "bg-[var(--accent)] animate-pulse",
  },
  REGISTERED: {
    label: "Cadastrada",
    className: "bg-[var(--warning-soft)] text-[var(--warning)]",
    dotClass: "bg-[var(--warning)] animate-pulse",
  },
  SOLD: {
    label: "Vendida",
    className: "bg-[var(--success-soft)] text-[var(--success)]",
    dotClass: "bg-[var(--success)]",
  },
  LOST: {
    label: "Perdida",
    className: "bg-[var(--danger-soft)] text-[var(--danger)]",
    dotClass: "bg-[var(--danger)]",
  },
};

export function LeadStatusBadge({ status }: { status: LeadStatus }) {
  const { label, className, dotClass } = config[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${className}`}
    >
      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${dotClass}`} />
      {label}
    </span>
  );
}
