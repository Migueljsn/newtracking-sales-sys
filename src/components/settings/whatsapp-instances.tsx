"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Plus, Trash2, Wifi, WifiOff, Loader2, QrCode, X, RefreshCw, Star } from "lucide-react";
import { toast } from "sonner";

type Instance = {
  id:           string;
  instanceName: string;
  status:       string;
  phone:        string | null;
  profileName:  string | null;
  priority:     number;
};

interface WhatsAppInstancesProps {
  initialInstances: Instance[];
}

const inputClass = "w-full h-9 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 text-sm text-[var(--text)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]";

export function WhatsAppInstances({ initialInstances }: WhatsAppInstancesProps) {
  const [instances,    setInstances]    = useState<Instance[]>(initialInstances);
  const [creating,     setCreating]     = useState(false);
  const [newName,      setNewName]      = useState("");
  const [showForm,     setShowForm]     = useState(false);
  const [actingOn,     setActingOn]     = useState<{ name: string; action: "refresh" | "delete" } | null>(null);

  // QR code modal
  const [qrInstance,   setQrInstance]   = useState<string | null>(null);
  const [qrBase64,     setQrBase64]     = useState<string | null>(null);
  const [qrLoading,    setQrLoading]    = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const pollingRef  = useRef<ReturnType<typeof setInterval> | null>(null);
  const syncedRef   = useRef(false);

  const stopPolling = useCallback(() => {
    if (pollingRef.current) { clearInterval(pollingRef.current); pollingRef.current = null; }
  }, []);

  const checkStatus = useCallback(async (instanceName: string): Promise<boolean> => {
    const res  = await fetch(`/api/whatsapp/instances/${instanceName}/status`);
    const data = await res.json();

    setInstances((prev) => prev.map((i) => {
      if (i.instanceName !== instanceName) return i;
      return data.connected
        ? { ...i, status: "connected",    phone: data.phone, profileName: data.profileName }
        : { ...i, status: "disconnected", phone: null,       profileName: null };
    }));

    return !!data.connected;
  }, []);

  const openQr = useCallback(async (instanceName: string) => {
    setQrInstance(instanceName);
    setQrBase64(null);
    setQrLoading(true);
    stopPolling();

    const fetchQr = async () => {
      const res  = await fetch(`/api/whatsapp/instances/${instanceName}/qr`);
      const data = await res.json();
      if (data.base64) { setQrBase64(data.base64); setQrLoading(false); }
    };

    await fetchQr();

    // Polling: atualiza QR a cada 20s e verifica conexão a cada 5s
    let qrTick = 0;
    pollingRef.current = setInterval(async () => {
      qrTick++;
      const connected = await checkStatus(instanceName);
      if (connected) {
        stopPolling();
        setQrInstance(null);
        setQrBase64(null);
        toast.success("WhatsApp conectado com sucesso!");
        return;
      }
      if (qrTick % 4 === 0) await fetchQr(); // renova QR a cada ~20s
    }, 5000);
  }, [checkStatus, stopPolling]);

  const closeQr = useCallback(() => {
    stopPolling();
    setQrInstance(null);
    setQrBase64(null);
  }, [stopPolling]);

  // Sincroniza status real de todas as instâncias ao montar
  useEffect(() => {
    if (syncedRef.current || instances.length === 0) return;
    syncedRef.current = true;
    instances.forEach(inst => checkStatus(inst.instanceName));
  }, [instances, checkStatus]);

  useEffect(() => () => stopPolling(), [stopPolling]);

  async function handleCreate() {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const res  = await fetch("/api/whatsapp/instances", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ instanceName: newName.trim() }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error ?? "Erro ao criar"); return; }

      const newInst: Instance = { id: data.id, instanceName: data.instanceName, status: "disconnected", phone: null, profileName: null, priority: 1 };
      setInstances((prev) => [...prev, newInst]);
      setNewName("");
      setShowForm(false);
      toast.success("Instância criada — conecte via QR code");
      await openQr(data.instanceName);
    } catch { toast.error("Erro ao criar instância"); }
    finally   { setCreating(false); }
  }

  async function handleDelete(instanceName: string) {
    if (confirmDelete !== instanceName) { setConfirmDelete(instanceName); return; }
    setActingOn({ name: instanceName, action: "delete" });
    try {
      await fetch("/api/whatsapp/instances", {
        method:  "DELETE",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ instanceName }),
      });
      setInstances((prev) => prev.filter((i) => i.instanceName !== instanceName));
      setConfirmDelete(null);
      toast.success("Instância removida");
    } catch { toast.error("Erro ao remover"); }
    finally   { setActingOn(null); }
  }

  async function handleSetDefault(instanceName: string) {
    setActingOn({ name: instanceName, action: "refresh" }); // reutiliza estado visual
    try {
      const res = await fetch("/api/whatsapp/instances", {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ instanceName }),
      });
      if (!res.ok) { toast.error("Erro ao definir padrão"); return; }
      setInstances(prev =>
        prev.map(i => ({ ...i, priority: i.instanceName === instanceName ? 0 : 1 }))
      );
      toast.success(`${instanceName} definida como instância padrão`);
    } catch { toast.error("Erro ao definir padrão"); }
    finally   { setActingOn(null); }
  }

  async function handleRefreshStatus(instanceName: string) {
    setActingOn({ name: instanceName, action: "refresh" });
    try {
      const connected = await checkStatus(instanceName);
      if (!connected) toast.info("Instância ainda desconectada");
    } finally {
      setActingOn(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-[var(--text)]">Instâncias WhatsApp</p>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">Gerencie os números conectados via EvoAPI</p>
        </div>
        <button
          type="button"
          onClick={() => setShowForm((v) => !v)}
          className="flex items-center gap-1.5 h-8 rounded-xl bg-[var(--accent)] px-3 text-sm font-medium text-white hover:bg-[var(--accent-strong)] transition-colors"
        >
          <Plus size={13} />
          Nova instância
        </button>
      </div>

      {/* Form nova instância */}
      {showForm && (
        <div className="flex items-center gap-2 p-3 rounded-xl border border-[var(--border)] bg-[var(--surface-muted)]">
          <input
            autoFocus
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleCreate(); if (e.key === "Escape") setShowForm(false); }}
            placeholder="Nome da instância (ex: CRM-RP-1)"
            className={inputClass + " flex-1"}
          />
          <button
            type="button"
            onClick={handleCreate}
            disabled={creating || !newName.trim()}
            className="h-9 rounded-xl bg-[var(--accent)] px-4 text-sm font-medium text-white disabled:opacity-50 transition-colors"
          >
            {creating ? <Loader2 size={14} className="animate-spin" /> : "Criar"}
          </button>
          <button type="button" onClick={() => setShowForm(false)} className="text-[var(--text-muted)] hover:text-[var(--text)]">
            <X size={16} />
          </button>
        </div>
      )}

      {/* Lista */}
      {instances.length === 0 && !showForm && (
        <div className="rounded-xl border border-dashed border-[var(--border)] p-8 text-center">
          <p className="text-sm text-[var(--text-muted)]">Nenhuma instância configurada.</p>
          <p className="text-xs text-[var(--text-muted)] mt-1">Crie uma instância e conecte um número via QR code.</p>
        </div>
      )}

      <div className="space-y-2">
        {instances.map((inst) => {
          const connected      = inst.status === "connected";
          const isRefreshing   = actingOn?.name === inst.instanceName && actingOn.action === "refresh";
          const isDeleting     = confirmDelete === inst.instanceName;
          const isDeletingNow  = actingOn?.name === inst.instanceName && actingOn.action === "delete";
          const isBusy         = !!actingOn;
          const isDefault      = inst.priority === 0 || instances.length === 1;
          const multipleInst   = instances.length > 1;

          return (
            <div key={inst.id} className="flex items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3">
              {/* Status icon */}
              <div className={`shrink-0 flex h-8 w-8 items-center justify-center rounded-lg ${
                connected ? "bg-[#10b981]/15 text-[#10b981]" : "bg-[var(--surface-muted)] text-[var(--text-muted)]"
              }`}>
                {isRefreshing
                  ? <Loader2 size={14} className="animate-spin" />
                  : connected ? <Wifi size={14} /> : <WifiOff size={14} />
                }
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-[var(--text)]">{inst.instanceName}</p>
                <p className="text-xs text-[var(--text-muted)]">
                  {isRefreshing
                    ? "Verificando status…"
                    : connected
                      ? `${inst.profileName ?? ""} · +${inst.phone ?? "—"}`
                      : "Desconectado"}
                </p>
              </div>

              {/* Badges */}
              <div className="flex items-center gap-1.5 shrink-0">
                {multipleInst && isDefault && (
                  <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase bg-[var(--accent)]/15 text-[var(--accent)]">
                    Padrão
                  </span>
                )}
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${
                  connected
                    ? "bg-[#10b981]/15 text-[#10b981]"
                    : "bg-[var(--surface-muted)] text-[var(--text-muted)]"
                }`}>
                  {connected ? "Conectado" : "Desconectado"}
                </span>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1 shrink-0">
                {multipleInst && !isDefault && (
                  <button
                    type="button"
                    onClick={() => handleSetDefault(inst.instanceName)}
                    disabled={isBusy}
                    title="Definir como padrão"
                    className="h-8 w-8 flex items-center justify-center rounded-lg text-[var(--text-muted)] hover:bg-[var(--accent)]/10 hover:text-[var(--accent)] transition-colors disabled:opacity-40"
                  >
                    <Star size={13} />
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => handleRefreshStatus(inst.instanceName)}
                  disabled={isBusy}
                  title="Verificar status"
                  className="h-8 w-8 flex items-center justify-center rounded-lg text-[var(--text-muted)] hover:bg-[var(--surface-muted)] hover:text-[var(--text)] transition-colors disabled:opacity-40"
                >
                  <RefreshCw size={13} className={isRefreshing ? "animate-spin" : ""} />
                </button>

                {!connected && (
                  <button
                    type="button"
                    onClick={() => openQr(inst.instanceName)}
                    disabled={isBusy}
                    className="flex items-center gap-1.5 h-8 rounded-lg px-2.5 text-xs font-medium border border-[var(--accent)]/40 text-[var(--accent)] hover:bg-[var(--accent)]/10 transition-colors disabled:opacity-40"
                  >
                    <QrCode size={12} />
                    Conectar
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => handleDelete(inst.instanceName)}
                  disabled={isBusy}
                  className={`flex items-center gap-1.5 h-8 rounded-lg px-2.5 text-xs font-medium transition-colors disabled:opacity-40 ${
                    isDeleting && !isDeletingNow
                      ? "bg-[var(--danger)] text-white"
                      : "text-[var(--text-muted)] hover:text-[var(--danger)] hover:bg-[var(--danger-soft)]"
                  }`}
                  onBlur={() => { if (!isDeletingNow) setConfirmDelete(null); }}
                >
                  {isDeletingNow
                    ? <Loader2 size={12} className="animate-spin" />
                    : <Trash2 size={12} />
                  }
                  {isDeletingNow ? "Removendo…" : isDeleting ? "Confirmar" : "Remover"}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* QR Code Modal */}
      {qrInstance && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="relative w-full max-w-sm rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-xl">
            <button
              type="button"
              onClick={closeQr}
              className="absolute right-4 top-4 text-[var(--text-muted)] hover:text-[var(--text)]"
            >
              <X size={16} />
            </button>

            <p className="text-sm font-semibold text-[var(--text)] mb-1">Conectar {qrInstance}</p>
            <p className="text-xs text-[var(--text-muted)] mb-4">
              Abra o WhatsApp → Dispositivos conectados → Conectar dispositivo → Escaneie o QR code
            </p>

            <div className="flex items-center justify-center rounded-xl border border-[var(--border)] bg-white p-4" style={{ minHeight: 280 }}>
              {qrLoading ? (
                <Loader2 size={32} className="animate-spin text-[var(--text-muted)]" />
              ) : qrBase64 ? (
                <img src={qrBase64} alt="QR Code WhatsApp" className="w-60 h-60 object-contain" />
              ) : (
                <p className="text-sm text-[var(--text-muted)]">Aguardando QR code…</p>
              )}
            </div>

            <p className="text-xs text-[var(--text-muted)] text-center mt-3">
              O QR code atualiza automaticamente a cada 20 segundos
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
