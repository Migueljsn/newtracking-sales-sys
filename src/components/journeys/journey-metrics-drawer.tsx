"use client";

import { useEffect, useState } from "react";
import { X, Users, CheckCircle2, TrendingUp, DollarSign, Activity, AlertCircle } from "lucide-react";
import type { JourneyMetrics } from "@/lib/queries/journey-metrics";

const NODE_TYPE_LABEL: Record<string, string> = {
  trigger:      "Gatilho",
  wait:         "Aguardar",
  condition:    "Condição",
  email:        "E-mail",
  whatsapp:     "WhatsApp",
  changeStatus: "Mover etapa",
  assign:       "Atribuir",
  end:          "Fim",
};

const NODE_TYPE_COLOR: Record<string, string> = {
  trigger:      "#6366f1",
  wait:         "#f59e0b",
  condition:    "#8b5cf6",
  email:        "#3b82f6",
  whatsapp:     "#10b981",
  changeStatus: "#f97316",
  assign:       "#06b6d4",
  end:          "#ef4444",
};

interface Props {
  journeyId:   string;
  journeyName: string;
  open:        boolean;
  onClose:     () => void;
}

export function JourneyMetricsDrawer({ journeyId, journeyName, open, onClose }: Props) {
  const [metrics, setMetrics] = useState<JourneyMetrics | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    fetch(`/api/journeys/${journeyId}/metrics`)
      .then(r => r.json())
      .then(data => { setMetrics(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, [open, journeyId]);

  if (!open) return null;

  const maxNodeCount = metrics ? Math.max(...metrics.nodeMetrics.map(n => n.count), 1) : 1;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="fixed inset-y-0 right-0 z-50 flex w-full max-w-xl flex-col bg-[var(--bg)] shadow-[var(--shadow-lg)] animate-slide-in-left border-l border-[var(--border)]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--border)] px-6 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-[var(--text-muted)]">Métricas</p>
            <h2 className="text-base font-semibold text-[var(--text)] truncate max-w-xs">{journeyName}</h2>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-xl border border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text)] transition-colors"
          >
            <X size={15} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">

          {loading && (
            <div className="flex items-center justify-center py-16">
              <div className="h-6 w-6 rounded-full border-2 border-[var(--accent)] border-t-transparent animate-spin" />
            </div>
          )}

          {!loading && metrics && (
            <>
              {/* KPI cards */}
              <div className="grid grid-cols-2 gap-3">
                <KpiCard
                  icon={<Users size={14} />}
                  label="Inscritas"
                  value={metrics.enrolled}
                  color="var(--accent)"
                />
                <KpiCard
                  icon={<CheckCircle2 size={14} />}
                  label="Concluíram"
                  value={`${metrics.completed} (${metrics.completionRate}%)`}
                  color="var(--success)"
                />
                <KpiCard
                  icon={<TrendingUp size={14} />}
                  label="Conversão atribuída"
                  value={`${metrics.converted.length} leads`}
                  color="var(--warning)"
                />
                <KpiCard
                  icon={<DollarSign size={14} />}
                  label="Receita atribuída"
                  value={metrics.attributedRevenue.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                  color="#10b981"
                />
              </div>

              {/* Status breakdown */}
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-widest text-[var(--text-muted)]">Status das inscrições</p>
                <div className="soft-panel p-4 space-y-2">
                  {[
                    { label: "Ativas",     count: metrics.active,    color: "var(--accent)" },
                    { label: "Concluídas", count: metrics.completed, color: "var(--success)" },
                    { label: "Saíram",     count: metrics.exited,    color: "var(--warning)" },
                    { label: "Falhas",     count: metrics.failed,    color: "var(--danger)" },
                  ].map(row => (
                    <div key={row.label} className="flex items-center gap-3">
                      <span className="w-20 shrink-0 text-xs text-[var(--text-muted)]">{row.label}</span>
                      <div className="flex-1 h-1.5 rounded-full bg-[var(--border)]">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: metrics.enrolled > 0 ? `${(row.count / metrics.enrolled) * 100}%` : "0%",
                            backgroundColor: row.color,
                          }}
                        />
                      </div>
                      <span className="w-8 text-right text-xs font-semibold text-[var(--text)]">{row.count}</span>
                    </div>
                  ))}
                  {metrics.avgDaysToComplete !== null && (
                    <p className="text-[10px] text-[var(--text-muted)] pt-1">
                      Tempo médio de conclusão: <strong className="text-[var(--text)]">{metrics.avgDaysToComplete} dia{metrics.avgDaysToComplete !== 1 ? "s" : ""}</strong>
                    </p>
                  )}
                </div>
              </div>

              {/* Node funnel */}
              {metrics.nodeMetrics.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-widest text-[var(--text-muted)]">Funil por nó</p>
                  <div className="soft-panel p-4 space-y-3">
                    {metrics.nodeMetrics
                      .sort((a, b) => b.count - a.count)
                      .map(node => {
                        const color = NODE_TYPE_COLOR[node.nodeType] ?? "var(--accent)";
                        const label = NODE_TYPE_LABEL[node.nodeType] ?? node.nodeType;
                        const pct   = Math.round((node.count / maxNodeCount) * 100);
                        const emailSent    = node.results["email_sent"]    ?? 0;
                        const emailSkipped = node.results["email_skipped"] ?? 0;
                        const waSent       = node.results["whatsapp_sent"] ?? 0;
                        const condTrue     = node.results["condition_true"]  ?? 0;
                        const condFalse    = node.results["condition_false"] ?? 0;

                        return (
                          <div key={node.nodeId} className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span
                                className="rounded px-1.5 py-0.5 text-[10px] font-semibold shrink-0"
                                style={{ backgroundColor: `${color}22`, color }}
                              >
                                {label}
                              </span>
                              <div className="flex-1 h-1.5 rounded-full bg-[var(--border)]">
                                <div
                                  className="h-full rounded-full transition-all"
                                  style={{ width: `${pct}%`, backgroundColor: color }}
                                />
                              </div>
                              <span className="w-8 text-right text-xs font-semibold text-[var(--text)]">{node.count}</span>
                            </div>
                            {(emailSent > 0 || emailSkipped > 0) && (
                              <p className="pl-1 text-[10px] text-[var(--text-muted)]">
                                {emailSent} enviado{emailSent !== 1 ? "s" : ""}
                                {emailSkipped > 0 && `, ${emailSkipped} sem email`}
                              </p>
                            )}
                            {waSent > 0 && (
                              <p className="pl-1 text-[10px] text-[var(--text-muted)]">{waSent} WhatsApp enviado{waSent !== 1 ? "s" : ""}</p>
                            )}
                            {(condTrue > 0 || condFalse > 0) && (
                              <p className="pl-1 text-[10px] text-[var(--text-muted)]">
                                {condTrue} passaram · {condFalse} não passaram
                              </p>
                            )}
                          </div>
                        );
                      })}
                  </div>
                </div>
              )}

              {/* Converted leads */}
              {metrics.converted.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-widest text-[var(--text-muted)]">
                    Leads convertidas pela jornada ({metrics.converted.length})
                  </p>
                  <div className="soft-panel divide-y divide-[var(--border)]">
                    {metrics.converted.map(lead => (
                      <div key={lead.leadId} className="flex items-center justify-between px-4 py-3 text-sm">
                        <div>
                          <p className="font-medium text-[var(--text)]">{lead.customerName}</p>
                          <p className="text-[10px] text-[var(--text-muted)]">
                            Inscrita {new Date(lead.enrolledAt).toLocaleDateString("pt-BR")} · vendeu {new Date(lead.soldAt).toLocaleDateString("pt-BR")}
                          </p>
                        </div>
                        <span className="font-semibold text-[var(--success)]">
                          {lead.saleValue.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {metrics.enrolled === 0 && (
                <div className="flex flex-col items-center gap-2 py-12 text-center">
                  <Activity size={32} className="text-[var(--text-muted)] opacity-40" />
                  <p className="text-sm text-[var(--text-muted)]">Nenhuma lead inscrita ainda.</p>
                  <p className="text-xs text-[var(--text-muted)] opacity-70">Os dados aparecerão assim que a jornada processar as primeiras leads.</p>
                </div>
              )}
            </>
          )}

          {!loading && !metrics && (
            <div className="flex flex-col items-center gap-2 py-12 text-center">
              <AlertCircle size={28} className="text-[var(--danger)]" />
              <p className="text-sm text-[var(--text-muted)]">Não foi possível carregar as métricas.</p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function KpiCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string | number; color: string }) {
  return (
    <div className="soft-panel px-4 py-3 space-y-1">
      <div className="flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
        <span style={{ color }}>{icon}</span>
        {label}
      </div>
      <p className="text-base font-bold text-[var(--text)]">{value}</p>
    </div>
  );
}
