"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Copy, Eye, EyeOff, RefreshCw, Check } from "lucide-react";
import { saveSettingsAction, rotateLeadCaptureKeyAction } from "@/app/(dashboard)/settings/actions";

interface Props {
  settings: {
    metaPixelId:       string | null;
    metaAccessToken:   string | null;
    metaTestEventCode: string | null;
    trackingEnabled:   boolean;
  };
  leadCaptureKey: string;
}

export function SettingsForm({ settings, leadCaptureKey }: Props) {
  const [loading, setLoading]         = useState(false);
  const [rotating, setRotating]       = useState(false);
  const [showToken, setShowToken]     = useState(false);
  const [copied, setCopied]           = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    try {
      await saveSettingsAction(new FormData(e.currentTarget));
      toast.success("Configurações salvas");
    } catch {
      toast.error("Erro ao salvar configurações");
    } finally {
      setLoading(false);
    }
  }

  async function handleRotate() {
    if (!confirm("Ao rotacionar a chave, formulários antigos param de funcionar. Confirmar?")) return;
    setRotating(true);
    try {
      await rotateLeadCaptureKeyAction();
      toast.success("Chave de captura atualizada");
    } catch {
      toast.error("Erro ao rotacionar chave");
    } finally {
      setRotating(false);
    }
  }

  function copyKey() {
    navigator.clipboard.writeText(leadCaptureKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="space-y-6 max-w-2xl">

      <div className="card space-y-3 p-5">
        <div>
          <h2 className="text-sm font-semibold text-[var(--text)]">Chave de captura de leads</h2>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">
            Envie esta chave no header <code className="bg-[var(--border)] px-1 rounded">x-lead-capture-key</code> dos seus formulários.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <code className="min-w-0 flex-1 rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-2 text-xs font-mono text-[var(--text)]">
            {leadCaptureKey}
          </code>
          <button
            onClick={copyKey}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text)]"
            title="Copiar"
          >
            {copied ? <Check size={15} className="text-[var(--success)]" /> : <Copy size={15} />}
          </button>
          <button
            onClick={handleRotate}
            disabled={rotating}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--danger)] disabled:opacity-50"
            title="Rotacionar chave"
          >
            <RefreshCw size={15} className={rotating ? "animate-spin" : ""} />
          </button>
        </div>

        {/* Snippet de exemplo */}
        <div>
          <p className="text-xs text-[var(--text-muted)] mb-1.5">Exemplo de uso no formulário:</p>
          <pre className="overflow-x-auto rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] p-3 text-xs text-[var(--text)]">{`fetch("${typeof window !== "undefined" ? window.location.origin : "https://seudominio.com"}/api/public/leads", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "x-lead-capture-key": "${leadCaptureKey}"
  },
  body: JSON.stringify({
    name: "Nome do Lead",
    phone: "11999998888",
    email: "email@exemplo.com",
    ...getTrackingParams() // fbc, fbp, utms, event_id
  })
})`}</pre>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="card space-y-5 p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-sm font-semibold text-[var(--text)]">Meta Conversions API</h2>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">Configurações do Pixel e token de acesso</p>
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <span className="text-xs text-[var(--text-muted)]">Tracking ativo</span>
            <div className="relative">
              <input
                type="checkbox"
                name="trackingEnabled"
                defaultChecked={settings.trackingEnabled}
                className="sr-only peer"
              />
              <div className="h-5 w-9 rounded-full bg-[var(--border)] transition-colors peer-checked:bg-[var(--accent)]" />
              <div className="absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform peer-checked:translate-x-4" />
            </div>
          </label>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">
              Pixel ID
            </label>
            <input
              name="metaPixelId"
              defaultValue={settings.metaPixelId ?? ""}
              className="input w-full"
              placeholder="Ex: 1234567890"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">
              Access Token (Conversions API)
            </label>
            <div className="relative">
              <input
                name="metaAccessToken"
                type={showToken ? "text" : "password"}
                defaultValue={settings.metaAccessToken ?? ""}
                className="input w-full pr-10"
                placeholder="EAAxxxxxxxx..."
              />
              <button
                type="button"
                onClick={() => setShowToken(!showToken)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text)]"
              >
                {showToken ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
            <p className="text-xs text-[var(--text-muted)] mt-1">
              Encontre em: Meta Business → Events Manager → Configurações → Token de acesso
            </p>
          </div>

          <div>
            <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">
              Test Event Code <span className="text-[var(--text-muted)] font-normal">(apenas para testes)</span>
            </label>
            <input
              name="metaTestEventCode"
              defaultValue={settings.metaTestEventCode ?? ""}
              className="input w-full"
              placeholder="TEST12345"
            />
            <p className="text-xs text-[var(--text-muted)] mt-1">
              Deixe em branco em produção. Use para validar eventos no Events Manager.
            </p>
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="btn-primary px-6 py-2"
        >
          {loading ? "Salvando..." : "Salvar configurações"}
        </button>
      </form>
    </div>
  );
}
