"use client";

import { useState, useTransition } from "react";
import { Copy, Check, RefreshCw, Webhook, AlertCircle, CheckCircle2, Info } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import {
  generateWebhookTokenAction,
  regenerateWebhookTokenAction,
  toggleWebhookTokenAction,
} from "@/app/(dashboard)/settings/actions";

interface Log {
  id: string;
  phone: string;
  action: string;
  createdAt: Date;
  error: string | null;
}

interface Props {
  token: { id: string; token: string; enabled: boolean } | null;
  recentLogs: Log[];
  appUrl: string;
}

const ACTION_LABEL: Record<string, { label: string; color: string }> = {
  created:  { label: "Lead criada",     color: "text-emerald-500" },
  enriched: { label: "Dados enriquecidos", color: "text-blue-500" },
  duplicate:{ label: "Duplicata",       color: "text-amber-500"  },
  error:    { label: "Erro",            color: "text-red-500"    },
};

export function WebhookConfig({ token, recentLogs, appUrl }: Props) {
  const [copied, setCopied]       = useState(false);
  const [confirm, setConfirm]     = useState(false);
  const [isPending, startTransition] = useTransition();

  const webhookUrl = token
    ? `${appUrl}/api/webhooks/leads/${token.token}`
    : null;

  function copyUrl() {
    if (!webhookUrl) return;
    navigator.clipboard.writeText(webhookUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleGenerate() {
    startTransition(() => generateWebhookTokenAction());
  }

  function handleRegenerate() {
    if (!confirm) { setConfirm(true); return; }
    setConfirm(false);
    startTransition(() => regenerateWebhookTokenAction());
  }

  function handleToggle() {
    if (!token) return;
    startTransition(() => toggleWebhookTokenAction(!token.enabled));
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <Webhook size={16} className="text-[var(--accent)]" />
        <h2 className="text-base font-semibold text-[var(--text)]">Webhook de entrada</h2>
      </div>

      <p className="text-sm text-[var(--text-muted)]">
        Envie leads de fontes externas (BotConversa, Make, Zapier, formulários) para o CRM
        via <code className="text-xs bg-[var(--surface-muted)] px-1 py-0.5 rounded">POST</code> neste endpoint.
        O telefone é usado para identificar se o lead já existe — se sim, enriquece os dados.
      </p>

      {!token ? (
        <button
          type="button"
          onClick={handleGenerate}
          disabled={isPending}
          className="flex items-center gap-2 rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
        >
          {isPending ? <Spinner size={14} /> : <Webhook size={14} />}
          Gerar token de webhook
        </button>
      ) : (
        <div className="space-y-4">
          {/* URL */}
          <div>
            <p className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide mb-1.5">URL do endpoint</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-2 text-xs text-[var(--text)] break-all font-mono">
                {webhookUrl}
              </code>
              <button
                type="button"
                onClick={copyUrl}
                className="shrink-0 flex items-center gap-1.5 rounded-xl border border-[var(--border)] px-3 py-2 text-xs font-semibold text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--surface-muted)] transition-all"
              >
                {copied ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} />}
                {copied ? "Copiado" : "Copiar"}
              </button>
            </div>
          </div>

          {/* Status + Ações */}
          <div className="flex items-center gap-3 flex-wrap">
            <button
              type="button"
              onClick={handleToggle}
              disabled={isPending}
              className={`flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold transition-all disabled:opacity-60 ${
                token.enabled
                  ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600"
                  : "border-[var(--border)] bg-[var(--surface-muted)] text-[var(--text-muted)]"
              }`}
            >
              {isPending ? <Spinner size={12} /> : token.enabled
                ? <CheckCircle2 size={13} />
                : <AlertCircle size={13} />
              }
              {token.enabled ? "Ativo" : "Desativado"}
            </button>

            {confirm ? (
              <div className="flex items-center gap-2">
                <span className="text-xs text-amber-500 font-medium">Confirmar — o token atual deixa de funcionar.</span>
                <button
                  type="button"
                  onClick={handleRegenerate}
                  disabled={isPending}
                  className="text-xs font-semibold text-red-500 hover:underline disabled:opacity-60"
                >
                  {isPending ? <Spinner size={12} /> : "Sim, regenerar"}
                </button>
                <button type="button" onClick={() => setConfirm(false)} className="text-xs text-[var(--text-muted)] hover:underline">
                  Cancelar
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={handleRegenerate}
                disabled={isPending}
                className="flex items-center gap-1.5 rounded-xl border border-[var(--border)] px-3 py-1.5 text-xs font-semibold text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--surface-muted)] transition-all disabled:opacity-60"
              >
                {isPending ? <Spinner size={12} /> : <RefreshCw size={12} />}
                Regenerar token
              </button>
            )}
          </div>

          {/* Formato esperado */}
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] p-4 space-y-2">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-[var(--text-muted)]">
              <Info size={12} /> Formato do payload (JSON)
            </div>
            <pre className="text-xs text-[var(--text)] font-mono leading-relaxed overflow-x-auto">{`POST ${appUrl}/api/webhooks/leads/{token}
Content-Type: application/json

{
  "phone": "11999999999",       // obrigatório
  "name":  "João Silva",        // obrigatório na criação
  "email": "joao@email.com",    // opcional
  "document": "12345678000190", // opcional — CPF ou CNPJ
  "city": "São Paulo",          // opcional
  "state": "SP",                // opcional
  "pipeline_stage": "Qualificado", // opcional — avança no funil
  "consultant": "João Vendas"   // opcional — atribui consultor
}`}</pre>
            <p className="text-[10px] text-[var(--text-muted)]">
              Aceita também: <code>telefone</code>, <code>whatsapp</code>, <code>nome</code>, <code>cnpj</code>, <code>cpf</code>, <code>cidade</code>, <code>estado</code>, <code>consultor</code>.
            </p>
          </div>
        </div>
      )}

      {/* Logs recentes */}
      {recentLogs.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide mb-2">Últimas chamadas</p>
          <div className="rounded-xl border border-[var(--border)] overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-[var(--border)] bg-[var(--surface-muted)]">
                  <th className="px-3 py-2 text-left font-semibold text-[var(--text-muted)]">Telefone</th>
                  <th className="px-3 py-2 text-left font-semibold text-[var(--text-muted)]">Resultado</th>
                  <th className="px-3 py-2 text-left font-semibold text-[var(--text-muted)]">Data</th>
                </tr>
              </thead>
              <tbody>
                {recentLogs.map((log) => {
                  const cfg = ACTION_LABEL[log.action] ?? { label: log.action, color: "text-[var(--text-muted)]" };
                  return (
                    <tr key={log.id} className="border-b border-[var(--border)] last:border-0">
                      <td className="px-3 py-2 font-mono text-[var(--text)]">{log.phone}</td>
                      <td className={`px-3 py-2 font-semibold ${cfg.color}`}>
                        {cfg.label}
                        {log.error && <span className="ml-1 font-normal text-[var(--text-muted)]">— {log.error}</span>}
                      </td>
                      <td className="px-3 py-2 text-[var(--text-muted)]">
                        {new Date(log.createdAt).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
