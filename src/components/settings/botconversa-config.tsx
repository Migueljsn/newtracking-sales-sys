"use client";

import { useState, useTransition, useRef } from "react";
import { Bot, Check, Loader2, RefreshCw, ToggleLeft, ToggleRight } from "lucide-react";
import { toast } from "sonner";
import { saveBotconversaConfigAction } from "@/app/(dashboard)/settings/actions";

interface Flow { id: number; name: string }

interface Props {
  currentApiKey:   string | null;
  currentFlowId:   number | null;
  currentFlowName: string | null;
  currentEnabled:  boolean;
}

const inputClass = "w-full h-9 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 text-sm text-[var(--text)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]";

export function BotconversaConfig({ currentApiKey, currentFlowId, currentFlowName, currentEnabled }: Props) {
  const [apiKey,   setApiKey]   = useState(currentApiKey   ?? "");
  const [flows,    setFlows]    = useState<Flow[]>([]);
  const [flowId,   setFlowId]   = useState<number | null>(currentFlowId);
  const [flowName, setFlowName] = useState(currentFlowName ?? "");
  const [enabled,  setEnabled]  = useState(currentEnabled);
  const [loading,  setLoading]  = useState(false);
  const [fetched,  setFetched]  = useState(false);
  const [isPending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  async function handleFetchFlows() {
    if (!apiKey.trim()) { toast.error("Insira a API key primeiro"); return; }
    setLoading(true);
    try {
      const res  = await fetch("/api/botconversa/flows", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ apiKey: apiKey.trim() }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error ?? "Erro ao buscar fluxos"); return; }
      setFlows(data.flows);
      setFetched(true);
      toast.success(`${data.flows.length} fluxos encontrados`);
    } catch {
      toast.error("Não foi possível conectar ao Botconversa");
    } finally {
      setLoading(false);
    }
  }

  function handleFlowSelect(id: number, name: string) {
    setFlowId(id);
    setFlowName(name);
  }

  function handleSave() {
    if (!formRef.current) return;
    const fd = new FormData(formRef.current);
    fd.set("botconversaFlowName", flowName);
    if (enabled) fd.set("botconversaEnabled", "on");
    startTransition(async () => {
      await saveBotconversaConfigAction(fd);
      toast.success("Configuração salva");
    });
  }

  const selectedFlow = flows.find(f => f.id === flowId) ?? (flowId ? { id: flowId, name: flowName || `Fluxo #${flowId}` } : null);

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <Bot size={16} className="text-violet-500" />
        <h2 className="text-base font-semibold text-[var(--text)]">Integração Botconversa</h2>
        <span className="rounded-full bg-violet-500/10 px-2 py-0.5 text-[10px] font-semibold text-violet-500 uppercase">Beta</span>
      </div>

      <p className="text-sm text-[var(--text-muted)]">
        Quando um lead novo é capturado no CRM, o Botconversa dispara automaticamente o fluxo configurado
        para o número do lead. O bot coleta os dados que você quiser e os envia de volta ao CRM via webhook de fluxos.
      </p>

      <form ref={formRef} className="space-y-4" onSubmit={e => e.preventDefault()}>
        {/* API Key */}
        <div>
          <label className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide mb-1.5 block">
            API Key do Botconversa
          </label>
          <div className="flex gap-2">
            <input
              type="password"
              name="botconversaApiKey"
              value={apiKey}
              onChange={e => { setApiKey(e.target.value); setFetched(false); setFlows([]); }}
              placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
              className={inputClass + " flex-1 font-mono"}
            />
            <button
              type="button"
              onClick={handleFetchFlows}
              disabled={loading || !apiKey.trim()}
              className="flex items-center gap-1.5 h-9 rounded-xl border border-[var(--border)] px-3 text-sm font-medium text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--surface-muted)] disabled:opacity-40 transition-colors shrink-0"
            >
              {loading ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
              Buscar fluxos
            </button>
          </div>
        </div>

        {/* Seleção de fluxo */}
        <div>
          <label className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide mb-1.5 block">
            Fluxo a disparar
          </label>

          {/* Fluxo atual salvo */}
          {selectedFlow && !fetched && (
            <div className="flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-2 mb-2">
              <Check size={13} className="text-emerald-500 shrink-0" />
              <span className="text-sm text-[var(--text)]">{selectedFlow.name}</span>
              <span className="text-xs text-[var(--text-muted)]">(#{selectedFlow.id})</span>
            </div>
          )}

          {/* Lista de fluxos após busca */}
          {fetched && flows.length > 0 && (
            <div className="rounded-xl border border-[var(--border)] divide-y divide-[var(--border)] max-h-52 overflow-y-auto">
              {flows.map(f => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => handleFlowSelect(f.id, f.name)}
                  className={`w-full text-left flex items-center justify-between px-3 py-2.5 text-sm transition-colors ${
                    flowId === f.id
                      ? "bg-violet-500/10 text-violet-600 font-medium"
                      : "text-[var(--text)] hover:bg-[var(--surface-muted)]"
                  }`}
                >
                  <span>{f.name}</span>
                  <span className="text-xs text-[var(--text-muted)] shrink-0 ml-2">#{f.id}</span>
                </button>
              ))}
            </div>
          )}

          {!fetched && !selectedFlow && (
            <p className="text-xs text-[var(--text-muted)]">Insira a API key e clique em "Buscar fluxos" para selecionar.</p>
          )}

          {/* Hidden inputs */}
          <input type="hidden" name="botconversaFlowId" value={flowId ?? ""} />
        </div>

        {/* Toggle ativo */}
        <div className="flex items-center justify-between rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-3">
          <div>
            <p className="text-sm font-medium text-[var(--text)]">Disparar automaticamente</p>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">Ativa o envio ao Botconversa ao capturar cada novo lead</p>
          </div>
          <button
            type="button"
            onClick={() => setEnabled(v => !v)}
            className={`transition-colors ${enabled ? "text-violet-500" : "text-[var(--text-muted)]"}`}
          >
            {enabled ? <ToggleRight size={28} /> : <ToggleLeft size={28} />}
          </button>
        </div>

        <button
          type="button"
          onClick={handleSave}
          disabled={isPending || !flowId}
          className="h-9 rounded-xl bg-violet-500 px-5 text-sm font-semibold text-white hover:bg-violet-600 disabled:opacity-40 transition-colors"
        >
          {isPending ? <Loader2 size={14} className="animate-spin inline" /> : "Salvar configuração"}
        </button>
      </form>
    </div>
  );
}
