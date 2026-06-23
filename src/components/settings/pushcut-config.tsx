"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Bell, ToggleLeft, ToggleRight } from "lucide-react";
import { savePushcutConfigAction } from "@/app/(dashboard)/settings/actions";
import { Spinner } from "@/components/ui/spinner";

interface Props {
  currentWebhookUrls: string[];
  currentEnabled:     boolean;
}

export function PushcutConfig({ currentWebhookUrls, currentEnabled }: Props) {
  const [webhookUrls, setWebhookUrls] = useState(currentWebhookUrls.join("\n"));
  const [enabled, setEnabled]         = useState(currentEnabled);
  const [loading, setLoading]         = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    try {
      const fd = new FormData(e.currentTarget);
      if (enabled) fd.set("pushcutEnabled", "on");
      await savePushcutConfigAction(fd);
      toast.success("Configuração salva");
    } catch {
      toast.error("Erro ao salvar configuração");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card p-5 space-y-4">
      <div className="flex items-center gap-2">
        <Bell size={16} className="text-amber-500" />
        <h2 className="text-sm font-semibold text-[var(--text)]">Notificação push (Pushcut)</h2>
      </div>

      <p className="text-xs text-[var(--text-muted)]">
        Envia uma notificação para o(s) seu(s) dispositivo(s) sempre que uma lead nova entrar no CRM. Crie uma
        notificação no app Pushcut para cada pessoa/dispositivo e cole as URLs abaixo, uma por linha.
      </p>

      <form onSubmit={handleSubmit} className="space-y-3">
        <textarea
          name="pushcutWebhookUrls"
          rows={4}
          value={webhookUrls}
          onChange={e => setWebhookUrls(e.target.value)}
          placeholder={"https://api.pushcut.io/xxxxxxxx/notifications/SuaNotificacao\nhttps://api.pushcut.io/yyyyyyyy/notifications/OutraNotificacao"}
          className="input w-full text-sm font-mono resize-none"
        />

        <div className="flex items-center justify-between rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-3">
          <div>
            <p className="text-sm font-medium text-[var(--text)]">Ativar notificações</p>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">Dispara ao capturar cada novo lead</p>
          </div>
          <button
            type="button"
            onClick={() => setEnabled(v => !v)}
            className={`transition-colors ${enabled ? "text-amber-500" : "text-[var(--text-muted)]"}`}
          >
            {enabled ? <ToggleRight size={28} /> : <ToggleLeft size={28} />}
          </button>
        </div>

        <button type="submit" disabled={loading} className="btn-primary flex items-center gap-2 px-4 py-2 text-sm disabled:opacity-50">
          {loading && <Spinner size={14} />}
          {loading ? "Salvando..." : "Salvar configuração"}
        </button>
      </form>
    </div>
  );
}
