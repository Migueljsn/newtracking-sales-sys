import { Info, Lightbulb, TriangleAlert } from "lucide-react";

type Tone = "info" | "tip" | "warning";

interface GuideCardProps {
  title: string;
  description?: string;
  items: string[];
  tone?: Tone;
}

const toneConfig: Record<
  Tone,
  { icon: typeof Info; iconClass: string; borderClass: string }
> = {
  info: {
    icon: Info,
    iconClass: "bg-[var(--accent-soft)] text-[var(--accent)]",
    borderClass: "border-l-[var(--accent)]",
  },
  tip: {
    icon: Lightbulb,
    iconClass: "bg-[var(--success-soft)] text-[var(--success)]",
    borderClass: "border-l-[var(--success)]",
  },
  warning: {
    icon: TriangleAlert,
    iconClass: "bg-[var(--warning-soft)] text-[var(--warning)]",
    borderClass: "border-l-[var(--warning)]",
  },
};

export function GuideCard({ title, description, items, tone = "info" }: GuideCardProps) {
  const { icon: Icon, iconClass, borderClass } = toneConfig[tone];

  return (
    <div className={`soft-panel border-l-2 ${borderClass} px-4 py-4`}>
      <div className="flex items-start gap-3">
        <span
          className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${iconClass}`}
        >
          <Icon size={15} />
        </span>
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-[var(--text)]">{title}</h2>
          {description ? (
            <p className="mt-0.5 text-sm text-[var(--text-muted)]">{description}</p>
          ) : null}
          <ul className="mt-2.5 space-y-1.5">
            {items.map((item) => (
              <li key={item} className="flex items-start gap-2 text-sm text-[var(--text-muted)]">
                <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-[var(--border-strong)]" />
                {item}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
