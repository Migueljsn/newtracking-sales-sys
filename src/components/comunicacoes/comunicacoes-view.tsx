"use client";

import {
  Mail, MessageSquare, Radio, Send, UserX, Eye, MousePointerClick,
  AlertTriangle, Users, Clock, CheckCircle, XCircle, BarChart2,
} from "lucide-react";
import type {
  EmailChannelStats, WhatsAppChannelStats, DailyDispatch,
  JourneyDispatchRow, TemplateBreakdown, RecentDispatch,
} from "@/lib/queries/comunicacoes";
import { DateRangePicker } from "./date-range-picker";

interface Stats {
  email:             EmailChannelStats;
  whatsapp:          WhatsAppChannelStats;
  daily:             DailyDispatch[];
  byJourney:         JourneyDispatchRow[];
  templateBreakdown: TemplateBreakdown[];
  recentDispatches:  RecentDispatch[];
}

const TABS = [
  { key: "visao-geral", label: "Visão geral",  icon: Radio        },
  { key: "email",       label: "E-mail",        icon: Mail         },
  { key: "whatsapp",    label: "WhatsApp",      icon: MessageSquare },
  { key: "historico",   label: "Histórico",     icon: Clock        },
] as const;

type Tab = typeof TABS[number]["key"];

const PERIODS = [
  { dias: 7,  label: "7 dias"  },
  { dias: 30, label: "30 dias" },
  { dias: 90, label: "90 dias" },
];

export function ComunicacoesView({ stats, activeTab, days, customFrom, customTo }: {
  stats: Stats; activeTab: Tab; days: number; customFrom?: string; customTo?: string;
}) {
  const isCustom = !!(customFrom && customTo);

  function tabHref(key: string) {
    if (isCustom) return `/comunicacoes?aba=${key}&de=${customFrom}&ate=${customTo}`;
    return `/comunicacoes?aba=${key}&dias=${days || 30}`;
  }
  function periodHref(d: number) {
    return `/comunicacoes?aba=${activeTab}&dias=${d}`;
  }

  const chartLabel = isCustom
    ? `${fmtShort(customFrom!)} → ${fmtShort(customTo!)}`
    : `últimos ${days} dias`;

  return (
    <div className="space-y-5">
      {/* Filtro de período + Tabs */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {/* Tabs */}
        <div className="flex gap-1 rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] p-1 w-fit overflow-x-auto">
          {TABS.map(({ key, label, icon: Icon }) => (
            <a
              key={key}
              href={tabHref(key)}
              className={`flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition-all whitespace-nowrap ${
                activeTab === key
                  ? "bg-[var(--surface)] text-[var(--text)] shadow-sm"
                  : "text-[var(--text-muted)] hover:text-[var(--text)]"
              }`}
            >
              <Icon size={14} />
              {label}
            </a>
          ))}
        </div>

        {/* Período */}
        <div className="flex items-center gap-2">
          <div className="flex gap-1 rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] p-1">
            {PERIODS.map(({ dias, label }) => (
              <a
                key={dias}
                href={periodHref(dias)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                  !isCustom && days === dias
                    ? "bg-[var(--accent)] text-white"
                    : "text-[var(--text-muted)] hover:text-[var(--text)]"
                }`}
              >
                {label}
              </a>
            ))}
          </div>
          <DateRangePicker from={customFrom} to={customTo} activeTab={activeTab} />
        </div>
      </div>

      {activeTab === "visao-geral" && <VisaoGeral stats={stats} chartLabel={chartLabel} />}
      {activeTab === "email"       && <EmailTab   stats={stats} />}
      {activeTab === "whatsapp"    && <WhatsAppTab stats={stats} />}
      {activeTab === "historico"   && <HistoricoTab dispatches={stats.recentDispatches} />}
    </div>
  );
}

// ── Visão Geral ───────────────────────────────────────────────────────────────

function VisaoGeral({ stats, chartLabel }: { stats: Stats; chartLabel: string }) {
  const { email, whatsapp, daily, byJourney } = stats;
  const total = email.totalSent + whatsapp.journeyWaSent;
  const maxDay = Math.max(...daily.map(d => d.email + d.whatsapp), 1);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <KpiCard label="Total de disparos" value={total}                    icon={<Send size={16} />}          color="var(--accent)" />
        <KpiCard label="E-mails enviados"  value={email.totalSent}          icon={<Mail size={16} />}          color="#3b82f6" />
        <KpiCard label="WhatsApp enviados" value={whatsapp.journeyWaSent}   icon={<MessageSquare size={16} />} color="#10b981" />
      </div>

      {/* Gráfico */}
      <div className="card p-5 space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
          Disparos — {chartLabel}
        </p>
        <div className="flex items-end gap-px h-24">
          {daily.map(d => {
            const emailH = (d.email    / maxDay) * 100;
            const waH    = (d.whatsapp / maxDay) * 100;
            return (
              <div key={d.date} className="flex-1 flex flex-col items-center justify-end gap-px h-full group relative">
                <div className="w-full rounded-sm" style={{ height: `${waH}%`,    backgroundColor: "#10b981", minHeight: d.whatsapp > 0 ? 2 : 0 }} />
                <div className="w-full rounded-sm" style={{ height: `${emailH}%`, backgroundColor: "#3b82f6", minHeight: d.email    > 0 ? 2 : 0 }} />
                {(d.email + d.whatsapp) > 0 && (
                  <div className="absolute bottom-full mb-1 hidden group-hover:block bg-[var(--surface)] border border-[var(--border)] rounded-lg px-2 py-1 text-[10px] whitespace-nowrap shadow-sm z-10 pointer-events-none">
                    <p className="font-medium text-[var(--text)]">{formatDay(d.date)}</p>
                    {d.email    > 0 && <p className="text-[#3b82f6]">E-mail: {d.email}</p>}
                    {d.whatsapp > 0 && <p className="text-[#10b981]">WhatsApp: {d.whatsapp}</p>}
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <div className="flex items-center gap-4 text-[10px] text-[var(--text-muted)]">
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-[#3b82f6]" />E-mail</span>
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-[#10b981]" />WhatsApp</span>
        </div>
      </div>

      {/* Por jornada */}
      {byJourney.length > 0 && (
        <div className="card p-5 space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">Por jornada</p>
          <div className="space-y-1">
            {byJourney.map(j => (
              <div key={j.journeyId} className="flex items-center gap-3 py-2 border-b border-[var(--border)] last:border-0">
                <span className="flex-1 text-sm font-medium text-[var(--text)] truncate">{j.journeyName}</span>
                {j.emailSent  > 0 && <span className="flex items-center gap-1 text-xs text-[#3b82f6]"><Mail size={11} />{j.emailSent}</span>}
                {j.waSent     > 0 && <span className="flex items-center gap-1 text-xs text-[#10b981]"><MessageSquare size={11} />{j.waSent}</span>}
                {j.emailOptOut > 0 && <span className="flex items-center gap-1 text-xs text-[var(--text-muted)]"><UserX size={11} />{j.emailOptOut}</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {total === 0 && <EmptyState channel="disparos" />}
    </div>
  );
}

// ── E-mail Tab ────────────────────────────────────────────────────────────────

function EmailTab({ stats }: { stats: Stats }) {
  const { email, templateBreakdown } = stats;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <KpiCard label="Total enviados"   value={email.totalSent}           icon={<Send size={16} />}              color="var(--accent)" />
        <KpiCard label="Taxa de abertura" value={`${email.openRate}%`}      icon={<Eye size={16} />}               color="#f59e0b"
          sub={email.ltvSent > 0 ? `${email.ltvOpened} de ${email.ltvSent} LTV` : undefined} />
        <KpiCard label="Taxa de clique"   value={`${email.clickRate}%`}     icon={<MousePointerClick size={16} />} color="#8b5cf6"
          sub={email.ltvSent > 0 ? `${email.ltvClicked} de ${email.ltvSent} LTV` : undefined} />
        <KpiCard label="Descadastros"     value={email.journeyEmailOptOut}  icon={<UserX size={16} />}             color="var(--danger)" />
      </div>

      {/* Breakdown Jornadas vs LTV */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="card p-5 space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">Jornadas</p>
          <StatRow label="Enviados"       value={email.journeyEmailSent}    color="#3b82f6" />
          <StatRow label="Sem e-mail"     value={email.journeyEmailSkipped} color="var(--text-muted)" />
          <StatRow label="Descadastrados" value={email.journeyEmailOptOut}  color="var(--danger)" />
        </div>
        <div className="card p-5 space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">LTV (reengajamento)</p>
          <StatRow label="Enviados" value={email.ltvSent}    color="#3b82f6" />
          <StatRow label="Abertos"  value={email.ltvOpened}  color="#f59e0b" />
          <StatRow label="Clicados" value={email.ltvClicked} color="#8b5cf6" />
          <StatRow label="Bounced"  value={email.ltvBounced} color="var(--danger)" />
        </div>
      </div>

      {/* Breakdown por template */}
      {templateBreakdown.length > 0 && (
        <div className="card p-5 space-y-4">
          <div className="flex items-center gap-2">
            <BarChart2 size={14} className="text-[var(--text-muted)]" />
            <p className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">Por template</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border)]">
                  <th className="text-left py-2 text-xs font-semibold text-[var(--text-muted)] pr-4">Template</th>
                  <th className="text-right py-2 text-xs font-semibold text-[var(--text-muted)] px-3">Enviados</th>
                  <th className="text-right py-2 text-xs font-semibold text-[var(--text-muted)] px-3">Abertos</th>
                  <th className="text-right py-2 text-xs font-semibold text-[var(--text-muted)] px-3">Cliques</th>
                  <th className="text-right py-2 text-xs font-semibold text-[var(--text-muted)] pl-3">Abertura%</th>
                </tr>
              </thead>
              <tbody>
                {templateBreakdown.map(t => (
                  <tr key={t.templateId} className="border-b border-[var(--border)] last:border-0">
                    <td className="py-2.5 font-medium text-[var(--text)] pr-4 max-w-[180px] truncate">{t.templateName}</td>
                    <td className="py-2.5 text-right text-[var(--text)] px-3">{t.sent}</td>
                    <td className="py-2.5 text-right text-[#f59e0b] px-3">{t.opened}</td>
                    <td className="py-2.5 text-right text-[#8b5cf6] px-3">{t.clicked}</td>
                    <td className="py-2.5 text-right pl-3">
                      <span className={`font-semibold ${t.openRate > 0 ? "text-[#f59e0b]" : "text-[var(--text-muted)]"}`}>
                        {t.openRate}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {email.ltvOpened === 0 && email.ltvSent > 0 && (
        <div className="flex items-start gap-3 rounded-xl border border-[var(--warning)]/40 bg-[var(--warning)]/10 px-4 py-3">
          <AlertTriangle size={15} className="mt-0.5 shrink-0 text-[var(--warning)]" />
          <p className="text-xs text-[var(--text-muted)]">
            As métricas de abertura e clique dependem dos webhooks do Resend. Configure o webhook em{" "}
            <code className="text-[var(--text)]">/api/webhooks/resend</code> no painel do Resend para ativar o rastreamento.
          </p>
        </div>
      )}

      {email.totalSent === 0 && <EmptyState channel="e-mails" />}
    </div>
  );
}

// ── WhatsApp Tab ──────────────────────────────────────────────────────────────

function WhatsAppTab({ stats }: { stats: Stats }) {
  const { whatsapp } = stats;
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4">
        <KpiCard label="Enviados"   value={whatsapp.journeyWaSent}    icon={<Send size={16} />}  color="#10b981" />
        <KpiCard label="Sem número" value={whatsapp.journeyWaSkipped} icon={<Users size={16} />} color="var(--text-muted)" />
      </div>
      <div className="flex items-start gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-3">
        <MessageSquare size={15} className="mt-0.5 shrink-0 text-[var(--text-muted)]" />
        <p className="text-xs text-[var(--text-muted)]">
          Métricas de entrega e leitura estarão disponíveis após integração com os webhooks da EvoAPI (WhatsApp).
          Os dados de envio já são registrados nas jornadas.
        </p>
      </div>
      {whatsapp.journeyWaSent === 0 && <EmptyState channel="mensagens de WhatsApp" />}
    </div>
  );
}

// ── Histórico Tab ─────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  sent:                  { label: "Enviado",      color: "#3b82f6",              icon: <Send size={11} /> },
  opened:                { label: "Aberto",       color: "#f59e0b",              icon: <Eye size={11} /> },
  clicked:               { label: "Clicado",      color: "#8b5cf6",              icon: <MousePointerClick size={11} /> },
  bounced:               { label: "Bounced",      color: "var(--danger)",        icon: <XCircle size={11} /> },
  email_sent:            { label: "Enviado",      color: "#3b82f6",              icon: <Mail size={11} /> },
  email_skipped:         { label: "Sem e-mail",   color: "var(--text-muted)",    icon: <UserX size={11} /> },
  email_skipped_optout:  { label: "Descadastrado",color: "var(--danger)",        icon: <UserX size={11} /> },
  whatsapp_sent:         { label: "Enviado",      color: "#10b981",              icon: <MessageSquare size={11} /> },
  whatsapp_skipped:      { label: "Sem número",   color: "var(--text-muted)",    icon: <Users size={11} /> },
};

function HistoricoTab({ dispatches }: { dispatches: RecentDispatch[] }) {
  if (dispatches.length === 0) return <EmptyState channel="disparos" />;

  return (
    <div className="card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--border)] bg-[var(--surface-muted)]">
              <th className="text-left px-4 py-3 text-xs font-semibold text-[var(--text-muted)]">Cliente</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-[var(--text-muted)] hidden sm:table-cell">Canal</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-[var(--text-muted)] hidden md:table-cell">Origem</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-[var(--text-muted)]">Status</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-[var(--text-muted)] hidden sm:table-cell">Data</th>
            </tr>
          </thead>
          <tbody>
            {dispatches.map(d => {
              const st = STATUS_CONFIG[d.status] ?? { label: d.status, color: "var(--text-muted)", icon: <CheckCircle size={11} /> };
              return (
                <tr key={d.id} className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--surface-muted)] transition-colors">
                  <td className="px-4 py-3">
                    <p className="font-medium text-[var(--text)] truncate max-w-[140px]">{d.customerName}</p>
                    {d.customerEmail && (
                      <p className="text-[10px] text-[var(--text-muted)] truncate max-w-[140px]">{d.customerEmail}</p>
                    )}
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell">
                    {d.channel === "email"
                      ? <span className="flex items-center gap-1.5 text-[#3b82f6] text-xs"><Mail size={12} /> E-mail</span>
                      : <span className="flex items-center gap-1.5 text-[#10b981] text-xs"><MessageSquare size={12} /> WhatsApp</span>
                    }
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <span className="inline-flex items-center gap-1 text-xs text-[var(--text-muted)]">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${d.source === "ltv" ? "bg-[var(--accent-soft)] text-[var(--accent)]" : "bg-[var(--surface-muted)] text-[var(--text-muted)]"}`}>
                        {d.source === "ltv" ? "LTV" : "Jornada"}
                      </span>
                      <span className="truncate max-w-[120px]">{d.context}</span>
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="flex items-center gap-1 text-xs font-medium" style={{ color: st.color }}>
                      {st.icon}
                      {st.label}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right hidden sm:table-cell text-xs text-[var(--text-muted)]">
                    {formatDateTime(d.sentAt)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="px-4 py-2 border-t border-[var(--border)] bg-[var(--surface-muted)]">
        <p className="text-[10px] text-[var(--text-muted)]">Mostrando os últimos {dispatches.length} disparos no período selecionado.</p>
      </div>
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function KpiCard({ label, value, icon, color, sub }: {
  label: string; value: string | number; icon: React.ReactNode; color: string; sub?: string;
}) {
  return (
    <div className="card px-4 py-4 space-y-2">
      <div className="flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
        <span style={{ color }}>{icon}</span>
        {label}
      </div>
      <p className="text-2xl font-bold text-[var(--text)]">{value}</p>
      {sub && <p className="text-[10px] text-[var(--text-muted)]">{sub}</p>}
    </div>
  );
}

function StatRow({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-[var(--text-muted)]">{label}</span>
      <span className="font-semibold" style={{ color }}>{value}</span>
    </div>
  );
}

function EmptyState({ channel }: { channel: string }) {
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] py-16 text-center">
      <Radio size={28} className="mx-auto mb-3 text-[var(--text-muted)] opacity-40" />
      <p className="text-sm text-[var(--text-muted)]">Nenhum {channel} registrado ainda.</p>
      <p className="text-xs text-[var(--text-muted)] mt-1 opacity-70">Os dados aparecerão quando as jornadas começarem a disparar.</p>
    </div>
  );
}

function formatDay(dateStr: string): string {
  const [, m, d] = dateStr.split("-");
  return `${d}/${m}`;
}

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }) + " " +
         d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function fmtShort(ymd: string): string {
  const [, m, d] = ymd.split("-");
  return `${d}/${m}`;
}
