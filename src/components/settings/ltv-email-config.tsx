"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { saveLtvEmailConfigAction } from "@/app/(dashboard)/settings/actions";

type Threshold = { days: number; templateId: string | null; enabled: boolean };

interface Template { id: string; name: string }

interface Props {
  config: {
    enabled:    boolean;
    teamEmails: string[];
    thresholds: Threshold[];
  } | null;
  templates: Template[];
}

const DEFAULT_THRESHOLDS: Threshold[] = [
  { days: 15, templateId: null, enabled: true },
  { days: 20, templateId: null, enabled: true },
  { days: 30, templateId: null, enabled: true },
];

export function LtvEmailConfig({ config, templates }: Props) {
  const [loading, setLoading]         = useState(false);
  const [thresholds, setThresholds]   = useState<Threshold[]>(
    config?.thresholds ?? DEFAULT_THRESHOLDS
  );
  const [teamEmails, setTeamEmails]   = useState(
    config?.teamEmails.join("\n") ?? ""
  );

  function addThreshold() {
    setThresholds(prev => [...prev, { days: 7, templateId: null, enabled: true }]);
  }

  function removeThreshold(i: number) {
    setThresholds(prev => prev.filter((_, idx) => idx !== i));
  }

  function updateThreshold(i: number, patch: Partial<Threshold>) {
    setThresholds(prev => prev.map((t, idx) => idx === i ? { ...t, ...patch } : t));
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    try {
      const fd = new FormData(e.currentTarget);
      fd.set("thresholds", JSON.stringify(thresholds));
      fd.set("teamEmails", teamEmails);
      await saveLtvEmailConfigAction(fd);
      toast.success("Configurações de email salvas");
    } catch {
      toast.error("Erro ao salvar configurações de email");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="card space-y-5 p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-sm font-semibold text-[var(--text)]">Campanhas de LTV por Email</h2>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">Dispara emails automáticos para clientes inativos</p>
        </div>
        <label className="flex items-center gap-2 cursor-pointer">
          <span className="text-xs text-[var(--text-muted)]">Ativo</span>
          <div className="relative">
            <input
              type="checkbox"
              name="enabled"
              defaultChecked={config?.enabled ?? false}
              className="sr-only peer"
            />
            <div className="h-5 w-9 rounded-full bg-[var(--border)] transition-colors peer-checked:bg-[var(--accent)]" />
            <div className="absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform peer-checked:translate-x-4" />
          </div>
        </label>
      </div>

      {/* Thresholds */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs font-medium text-[var(--text-muted)]">Intervalos de disparo</label>
          <button
            type="button"
            onClick={addThreshold}
            className="flex items-center gap-1 text-xs text-[var(--accent)] hover:underline"
          >
            <Plus size={12} /> Adicionar
          </button>
        </div>
        <div className="space-y-2">
          {thresholds.map((t, i) => (
            <div key={i} className="flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-2">
              <input
                type="checkbox"
                checked={t.enabled}
                onChange={e => updateThreshold(i, { enabled: e.target.checked })}
                className="accent-[var(--accent)]"
              />
              <input
                type="number"
                min={1}
                value={t.days}
                onChange={e => updateThreshold(i, { days: Number(e.target.value) })}
                className="input w-16 text-center text-sm py-1"
              />
              <span className="text-xs text-[var(--text-muted)]">dias sem compra</span>
              <select
                value={t.templateId ?? ""}
                onChange={e => updateThreshold(i, { templateId: e.target.value || null })}
                className="input flex-1 text-xs py-1"
              >
                <option value="">Template padrão</option>
                {templates.map(tmpl => (
                  <option key={tmpl.id} value={tmpl.id}>{tmpl.name}</option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => removeThreshold(i)}
                className="text-[var(--danger)] hover:opacity-70"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Team emails */}
      <div>
        <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">
          Emails da equipe de vendas
          <span className="font-normal ml-1">(um por linha ou separados por vírgula)</span>
        </label>
        <textarea
          value={teamEmails}
          onChange={e => setTeamEmails(e.target.value)}
          rows={3}
          className="input w-full text-sm"
          placeholder={"vendedor1@empresa.com\nvendedor2@empresa.com"}
        />
        <p className="text-xs text-[var(--text-muted)] mt-1">
          Recebem um digest diário às 8h com todos os clientes que atingiram algum threshold.
        </p>
      </div>

      <button type="submit" disabled={loading} className="btn-primary px-6 py-2">
        {loading ? "Salvando..." : "Salvar configurações de email"}
      </button>
    </form>
  );
}
