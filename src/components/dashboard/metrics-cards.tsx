"use client";

import { useQuery } from "@tanstack/react-query";
import { AlertCircle, Clock, TrendingUp, Users } from "lucide-react";
import { HintTooltip } from "@/components/ui/hint-tooltip";

interface Metrics {
  totalLeads:    number;
  totalSales:    number;
  pendingEvents: number;
  failedEvents:  number;
}

const cardConfig = [
  {
    key:        "totalLeads" as const,
    label:      "Total de leads",
    hint:       "Número total de leads cadastradas no CRM, incluindo todos os status: Nova, Cadastrada, Vendida e Perdida.",
    Icon:       Users,
    iconBg:     "var(--accent-soft)",
    iconColor:  "var(--accent)",
    valueColor: "var(--accent)",
  },
  {
    key:        "totalSales" as const,
    label:      "Vendas realizadas",
    hint:       "Total de vendas registradas no sistema desde o início. Cada venda está vinculada a uma lead e pode incluir recompras.",
    Icon:       TrendingUp,
    iconBg:     "var(--success-soft)",
    iconColor:  "var(--success)",
    valueColor: "var(--success)",
  },
  {
    key:        "pendingEvents" as const,
    label:      "Eventos pendentes",
    hint:       "Vendas cujos eventos Purchase ainda não foram enviados ao Meta Conversions API. São processados automaticamente pelo sistema ou pelo cron diário às 8h.",
    Icon:       Clock,
    iconBg:     "var(--warning-soft)",
    iconColor:  "var(--warning)",
    valueColor: "var(--warning)",
  },
  {
    key:        "failedEvents" as const,
    label:      "Eventos com falha",
    hint:       "Envios ao Meta que falharam após todas as tentativas. Verifique o Pixel ID e Access Token em Configurações. Você pode reenviar manualmente pelo detalhe da lead.",
    Icon:       AlertCircle,
    iconBg:     "var(--danger-soft)",
    iconColor:  "var(--danger)",
    valueColor: "var(--danger)",
  },
];

export function MetricsCards() {
  const { data } = useQuery<Metrics>({
    queryKey: ["dashboard", "metrics"],
    queryFn:  () => fetch("/api/dashboard/metrics").then((r) => r.json()),
    staleTime: 5 * 60 * 1000,
  });

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {cardConfig.map((card, i) => (
        <div
          key={card.label}
          className="stat-card animate-slide-up"
          style={{ animationDelay: `${i * 80}ms` }}
        >
          <div className="flex items-start justify-between gap-3">
            <div
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-transform duration-200 group-hover:scale-110"
              style={{ background: card.iconBg, color: card.iconColor }}
            >
              <card.Icon size={18} />
            </div>
            <p
              className="text-3xl font-bold tabular-nums leading-none"
              style={{ color: card.valueColor }}
            >
              {data?.[card.key] ?? "—"}
            </p>
          </div>
          <div className="mt-3 flex items-center gap-1.5">
            <p className="text-sm font-medium text-[var(--text-muted)]">{card.label}</p>
            <HintTooltip text={card.hint} />
          </div>
        </div>
      ))}
    </div>
  );
}
