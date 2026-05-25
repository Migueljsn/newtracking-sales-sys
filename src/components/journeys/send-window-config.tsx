"use client";

import { useState, useTransition } from "react";
import { Clock, X, Check } from "lucide-react";
import { updateSendWindowAction } from "@/app/(dashboard)/journeys/actions";
import type { SendWindowConfig } from "@/lib/journeys/send-window";
import { DEFAULT_SEND_WINDOW } from "@/lib/journeys/send-window";
import { toast } from "sonner";

const WEEKDAYS = [
  { label: "Dom", value: 0 },
  { label: "Seg", value: 1 },
  { label: "Ter", value: 2 },
  { label: "Qua", value: 3 },
  { label: "Qui", value: 4 },
  { label: "Sex", value: 5 },
  { label: "Sáb", value: 6 },
];

const HOURS = Array.from({ length: 24 }, (_, i) => i);

const TIMEZONES = [
  { label: "Brasília (BRT)",      value: "America/Sao_Paulo" },
  { label: "Manaus (AMT)",        value: "America/Manaus" },
  { label: "Fortaleza (BRT-1h)",  value: "America/Fortaleza" },
  { label: "Lisboa (WET/WEST)",   value: "Europe/Lisbon" },
  { label: "UTC",                 value: "UTC" },
];

interface Props {
  journeyId:  string;
  initialConfig: SendWindowConfig | null;
}

export function SendWindowConfig({ journeyId, initialConfig }: Props) {
  const [open, setOpen] = useState(false);
  const [config, setConfig] = useState<SendWindowConfig>(initialConfig ?? DEFAULT_SEND_WINDOW);
  const [isPending, startTransition] = useTransition();

  function toggleWeekday(day: number) {
    setConfig(prev => ({
      ...prev,
      weekdays: prev.weekdays.includes(day)
        ? prev.weekdays.filter(d => d !== day)
        : [...prev.weekdays, day].sort(),
    }));
  }

  function handleSave() {
    startTransition(async () => {
      try {
        await updateSendWindowAction(journeyId, config as object);
        toast.success("Janela de envio salva");
        setOpen(false);
      } catch {
        toast.error("Erro ao salvar");
      }
    });
  }

  const isActive = config.enabled && config.weekdays.length > 0;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`flex items-center gap-1.5 h-8 rounded-xl border px-3 text-sm font-medium transition-colors ${
          isActive
            ? "border-[var(--accent)] text-[var(--accent)] bg-[var(--accent-soft)]"
            : "border-[var(--border)] text-[var(--text-muted)] hover:bg-[var(--surface-muted)] hover:text-[var(--text)]"
        }`}
        title="Configurar janela de envio"
      >
        <Clock size={13} />
        Janela
        {isActive && (
          <span className="ml-0.5 text-[10px] font-semibold">
            {config.startHour}h–{config.endHour}h
          </span>
        )}
      </button>

      {open && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm" onClick={() => setOpen(false)} />

          {/* Modal */}
          <div className="fixed inset-x-4 top-1/4 z-50 mx-auto max-w-sm rounded-2xl bg-[var(--bg)] border border-[var(--border)] shadow-[var(--shadow-lg)] animate-scale-in">
            <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-4">
              <div>
                <h3 className="text-sm font-semibold text-[var(--text)]">Janela de envio</h3>
                <p className="text-xs text-[var(--text-muted)] mt-0.5">
                  Define quando e-mails e WhatsApp podem ser enviados
                </p>
              </div>
              <button onClick={() => setOpen(false)} className="text-[var(--text-muted)] hover:text-[var(--text)]">
                <X size={15} />
              </button>
            </div>

            <div className="p-5 space-y-5">
              {/* Enable toggle */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-[var(--text)]">Ativar janela de envio</p>
                  <p className="text-xs text-[var(--text-muted)]">Envios fora da janela aguardam o próximo horário válido</p>
                </div>
                <button
                  type="button"
                  onClick={() => setConfig(prev => ({ ...prev, enabled: !prev.enabled }))}
                  className={`relative h-6 w-11 rounded-full transition-colors ${config.enabled ? "bg-[var(--accent)]" : "bg-[var(--border-strong)]"}`}
                >
                  <span
                    className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${config.enabled ? "translate-x-5" : ""}`}
                  />
                </button>
              </div>

              {config.enabled && (
                <>
                  {/* Days */}
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">Dias permitidos</p>
                    <div className="flex gap-1.5 flex-wrap">
                      {WEEKDAYS.map(d => (
                        <button
                          key={d.value}
                          type="button"
                          onClick={() => toggleWeekday(d.value)}
                          className={`h-8 w-10 rounded-lg text-xs font-semibold transition-all border ${
                            config.weekdays.includes(d.value)
                              ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]"
                              : "border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--border-strong)]"
                          }`}
                        >
                          {d.label}
                        </button>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setConfig(prev => ({ ...prev, weekdays: [1, 2, 3, 4, 5] }))}
                        className="text-xs text-[var(--accent)] hover:underline"
                      >
                        Dias úteis
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfig(prev => ({ ...prev, weekdays: [0, 1, 2, 3, 4, 5, 6] }))}
                        className="text-xs text-[var(--text-muted)] hover:underline"
                      >
                        Todos os dias
                      </button>
                    </div>
                  </div>

                  {/* Hours */}
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">Horário</p>
                    <div className="flex items-center gap-3">
                      <div className="flex-1 space-y-1">
                        <p className="text-[10px] text-[var(--text-muted)]">Das</p>
                        <select
                          value={config.startHour}
                          onChange={e => setConfig(prev => ({ ...prev, startHour: parseInt(e.target.value) }))}
                          className="input w-full"
                        >
                          {HOURS.map(h => (
                            <option key={h} value={h}>{String(h).padStart(2, "0")}:00</option>
                          ))}
                        </select>
                      </div>
                      <span className="text-[var(--text-muted)] mt-4">até</span>
                      <div className="flex-1 space-y-1">
                        <p className="text-[10px] text-[var(--text-muted)]">Às</p>
                        <select
                          value={config.endHour}
                          onChange={e => setConfig(prev => ({ ...prev, endHour: parseInt(e.target.value) }))}
                          className="input w-full"
                        >
                          {HOURS.filter(h => h > config.startHour).map(h => (
                            <option key={h} value={h}>{String(h).padStart(2, "0")}:00</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Timezone */}
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">Fuso horário</p>
                    <select
                      value={config.timezone}
                      onChange={e => setConfig(prev => ({ ...prev, timezone: e.target.value }))}
                      className="input w-full"
                    >
                      {TIMEZONES.map(tz => (
                        <option key={tz.value} value={tz.value}>{tz.label}</option>
                      ))}
                    </select>
                  </div>

                  {/* Preview */}
                  <div className="rounded-xl bg-[var(--surface-muted)] border border-[var(--border)] px-4 py-3 text-xs text-[var(--text-muted)]">
                    Envios só ocorrem em&nbsp;
                    <strong className="text-[var(--text)]">
                      {config.weekdays.map(d => WEEKDAYS.find(w => w.value === d)?.label).join(", ")}
                    </strong>
                    &nbsp;das&nbsp;
                    <strong className="text-[var(--text)]">{String(config.startHour).padStart(2, "0")}h</strong>
                    &nbsp;às&nbsp;
                    <strong className="text-[var(--text)]">{String(config.endHour).padStart(2, "0")}h</strong>
                    &nbsp;(fuso {TIMEZONES.find(t => t.value === config.timezone)?.label ?? config.timezone}).
                    Mensagens fora deste horário aguardam o próximo slot.
                  </div>
                </>
              )}
            </div>

            <div className="flex justify-end gap-2 border-t border-[var(--border)] px-5 py-3">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="btn-secondary px-4 text-sm"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={isPending || (config.enabled && config.weekdays.length === 0)}
                className="btn-primary px-4 text-sm flex items-center gap-1.5"
              >
                <Check size={13} />
                {isPending ? "Salvando…" : "Salvar"}
              </button>
            </div>
          </div>
        </>
      )}
    </>
  );
}
