"use client";

import { Mail, MessageSquare, Radio, TrendingUp, Send, UserX, Eye, MousePointerClick, AlertTriangle, Users } from "lucide-react";
import type { EmailChannelStats, WhatsAppChannelStats, DailyDispatch, JourneyDispatchRow } from "@/lib/queries/comunicacoes";

interface Stats {
  email:     EmailChannelStats;
  whatsapp:  WhatsAppChannelStats;
  daily:     DailyDispatch[];
  byJourney: JourneyDispatchRow[];
}

const TABS = [
  { key: "visao-geral", label: "Visão geral", icon: Radio },
  { key: "email",       label: "E-mail",       icon: Mail  },
  { key: "whatsapp",    label: "WhatsApp",     icon: MessageSquare },
] as const;

type Tab = typeof TABS[number]["key"];

export function ComunicacoesView({ stats, activeTab }: { stats: Stats; activeTab: Tab }) {
  return (
    <div className="space-y-6">
      {/* Tabs */}
      <div className="flex gap-1 rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] p-1 w-fit">
        {TABS.map(({ key, label, icon: Icon }) => (
          <a
            key={key}
            href={`/comunicacoes?aba=${key}`}
            className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition-all ${
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

      {activeTab === "visao-geral" && <VisaoGeral stats={stats} />}
      {activeTab === "email"       && <EmailTab   stats={stats} />}
      {activeTab === "whatsapp"    && <WhatsAppTab stats={stats} />}
    </div>
  );
}

// ── Visão Geral ───────────────────────────────────────────────────────────────

function VisaoGeral({ stats }: { stats: Stats }) {
  const { email, whatsapp, daily, byJourney } = stats;
  const totalEmail    = email.totalSent;
  const totalWhatsApp = whatsapp.journeyWaSent;
  const total         = totalEmail + totalWhatsApp;

  const maxDay = Math.max(...daily.map(d => d.email + d.whatsapp), 1);

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <KpiCard label="Total de disparos" value={total} icon={<Send size={16} />} color="var(--accent)" />
        <KpiCard label="E-mails enviados"  value={totalEmail} icon={<Mail size={16} />} color="#3b82f6" />
        <KpiCard label="WhatsApp enviados" value={totalWhatsApp} icon={<MessageSquare size={16} />} color="#10b981" />
      </div>

      {/* Mini gráfico diário */}
      <div className="card p-5 space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">Disparos — últimos 30 dias</p>
        <div className="flex items-end gap-0.5 h-24">
          {daily.map(d => {
            const emailH = maxDay > 0 ? ((d.email / maxDay) * 100) : 0;
            const waH    = maxDay > 0 ? ((d.whatsapp / maxDay) * 100) : 0;
            return (
              <div key={d.date} className="flex-1 flex flex-col items-center justify-end gap-0.5 h-full group relative">
                <div
                  className="w-full rounded-sm"
                  style={{ height: `${waH}%`, backgroundColor: "#10b981", minHeight: d.whatsapp > 0 ? 2 : 0 }}
                />
                <div
                  className="w-full rounded-sm"
                  style={{ height: `${emailH}%`, backgroundColor: "#3b82f6", minHeight: d.email > 0 ? 2 : 0 }}
                />
                {/* Tooltip */}
                {(d.email + d.whatsapp) > 0 && (
                  <div className="absolute bottom-full mb-1 hidden group-hover:block bg-[var(--surface)] border border-[var(--border)] rounded-lg px-2 py-1 text-[10px] whitespace-nowrap shadow-sm z-10 pointer-events-none">
                    <p className="font-medium text-[var(--text)]">{formatDay(d.date)}</p>
                    {d.email > 0    && <p className="text-[#3b82f6]">E-mail: {d.email}</p>}
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
          <div className="space-y-2">
            {byJourney.map(j => (
              <div key={j.journeyId} className="flex items-center gap-3 py-2 border-b border-[var(--border)] last:border-0">
                <span className="flex-1 text-sm font-medium text-[var(--text)] truncate">{j.journeyName}</span>
                {j.emailSent > 0 && (
                  <span className="flex items-center gap-1 text-xs text-[#3b82f6]">
                    <Mail size={11} />{j.emailSent}
                  </span>
                )}
                {j.waSent > 0 && (
                  <span className="flex items-center gap-1 text-xs text-[#10b981]">
                    <MessageSquare size={11} />{j.waSent}
                  </span>
                )}
                {j.emailOptOut > 0 && (
                  <span className="flex items-center gap-1 text-xs text-[var(--text-muted)]">
                    <UserX size={11} />{j.emailOptOut}
                  </span>
                )}
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
  const { email } = stats;

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <KpiCard label="Total enviados"   value={email.totalSent}   icon={<Send size={16} />}              color="var(--accent)" />
        <KpiCard label="Taxa de abertura" value={`${email.openRate}%`}  icon={<Eye size={16} />}           color="#f59e0b"
          sub={email.ltvSent > 0 ? `${email.ltvOpened} de ${email.ltvSent} LTV` : undefined} />
        <KpiCard label="Taxa de clique"   value={`${email.clickRate}%`} icon={<MousePointerClick size={16} />} color="#8b5cf6"
          sub={email.ltvSent > 0 ? `${email.ltvClicked} de ${email.ltvSent} LTV` : undefined} />
        <KpiCard label="Descadastros"     value={email.journeyEmailOptOut} icon={<UserX size={16} />}      color="var(--danger)" />
      </div>

      {/* Breakdown jornadas vs LTV */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="card p-5 space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">Jornadas</p>
          <StatRow label="Enviados"      value={email.journeyEmailSent}    color="#3b82f6" />
          <StatRow label="Sem e-mail"    value={email.journeyEmailSkipped} color="var(--text-muted)" />
          <StatRow label="Descadastrados" value={email.journeyEmailOptOut}  color="var(--danger)" />
        </div>
        <div className="card p-5 space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">LTV (reengajamento)</p>
          <StatRow label="Enviados"  value={email.ltvSent}    color="#3b82f6" />
          <StatRow label="Abertos"   value={email.ltvOpened}  color="#f59e0b" />
          <StatRow label="Clicados"  value={email.ltvClicked} color="#8b5cf6" />
          <StatRow label="Bounced"   value={email.ltvBounced} color="var(--danger)" />
        </div>
      </div>

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
        <KpiCard label="Enviados"       value={whatsapp.journeyWaSent}    icon={<Send size={16} />}  color="#10b981" />
        <KpiCard label="Sem número"     value={whatsapp.journeyWaSkipped} icon={<Users size={16} />} color="var(--text-muted)" />
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
