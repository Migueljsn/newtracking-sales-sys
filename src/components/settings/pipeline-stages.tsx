"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Check, X } from "lucide-react";
import {
  createPipelineStageAction,
  updatePipelineStageAction,
  deletePipelineStageAction,
} from "@/app/(dashboard)/settings/pipeline-actions";

interface Stage {
  id:       string;
  name:     string;
  color:    string;
  position: number;
}

const PRESET_COLORS = [
  "#6366f1", "#f59e0b", "#10b981", "#ef4444",
  "#3b82f6", "#8b5cf6", "#f97316", "#06b6d4",
];

interface Props {
  stages: Stage[];
}

export function PipelineStages({ stages }: Props) {
  const [editingId,   setEditingId]   = useState<string | null>(null);
  const [editName,    setEditName]    = useState("");
  const [editColor,   setEditColor]   = useState(PRESET_COLORS[0]);
  const [deletingId,  setDeletingId]  = useState<string | null>(null);
  const [adding,      setAdding]      = useState(false);
  const [newName,     setNewName]     = useState("");
  const [newColor,    setNewColor]    = useState(PRESET_COLORS[0]);
  const [loading,     setLoading]     = useState(false);

  function startEdit(stage: Stage) {
    setEditingId(stage.id);
    setEditName(stage.name);
    setEditColor(stage.color);
  }

  function cancelEdit() {
    setEditingId(null);
  }

  async function handleUpdate(stage: Stage) {
    if (!editName.trim()) { toast.error("Nome obrigatório"); return; }
    setLoading(true);
    try {
      const fd = new FormData();
      fd.set("id",    stage.id);
      fd.set("name",  editName.trim());
      fd.set("color", editColor);
      await updatePipelineStageAction(fd);
      toast.success("Etapa atualizada");
      setEditingId(null);
    } catch {
      toast.error("Erro ao atualizar etapa");
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: string) {
    setLoading(true);
    try {
      await deletePipelineStageAction(id);
      toast.success("Etapa removida");
      setDeletingId(null);
    } catch {
      toast.error("Erro ao remover etapa");
    } finally {
      setLoading(false);
    }
  }

  async function handleAdd() {
    if (!newName.trim()) { toast.error("Nome obrigatório"); return; }
    setLoading(true);
    try {
      const fd = new FormData();
      fd.set("name",  newName.trim());
      fd.set("color", newColor);
      await createPipelineStageAction(fd);
      toast.success("Etapa criada");
      setAdding(false);
      setNewName("");
      setNewColor(PRESET_COLORS[0]);
    } catch {
      toast.error("Erro ao criar etapa");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-[var(--text)]">Etapas do pipeline</h2>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">
            Crie etapas personalizadas para organizar suas leads no funil de vendas.
          </p>
        </div>
        <button
          onClick={() => { setAdding(true); setEditingId(null); }}
          className="flex items-center gap-1.5 rounded-xl border border-[var(--accent)] bg-[var(--accent-soft)] px-3 py-2 text-xs font-semibold text-[var(--accent)] transition-colors hover:bg-[var(--accent)] hover:text-white"
        >
          <Plus size={13} /> Adicionar
        </button>
      </div>

      {stages.length === 0 && !adding ? (
        <p className="rounded-xl border border-dashed border-[var(--border)] p-6 text-center text-sm text-[var(--text-muted)]">
          Nenhuma etapa criada. Clique em + Adicionar para criar a primeira etapa de pipeline.
        </p>
      ) : (
        <div className="space-y-2">
          {stages.map((stage) =>
            editingId === stage.id ? (
              <div key={stage.id} className="flex items-center gap-3 rounded-xl border border-[var(--accent)] bg-[var(--surface)] p-3">
                <div className="flex gap-1.5">
                  {PRESET_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setEditColor(c)}
                      className={`h-5 w-5 rounded-full transition-transform ${editColor === c ? "ring-2 ring-offset-1 ring-[var(--accent)] scale-110" : ""}`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
                <input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="input flex-1 text-sm py-1.5"
                  placeholder="Nome da etapa"
                  autoFocus
                />
                <button
                  onClick={() => handleUpdate(stage)}
                  disabled={loading}
                  className="flex items-center gap-1 rounded-xl bg-[var(--accent)] px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                >
                  <Check size={12} /> Salvar
                </button>
                <button
                  onClick={cancelEdit}
                  className="flex items-center gap-1 rounded-xl border border-[var(--border)] px-3 py-1.5 text-xs font-medium text-[var(--text-muted)] hover:text-[var(--text)]"
                >
                  <X size={12} />
                </button>
              </div>
            ) : (
              <div key={stage.id} className="flex items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3">
                <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: stage.color }} />
                <span className="flex-1 text-sm font-medium text-[var(--text)]">{stage.name}</span>
                <button
                  onClick={() => startEdit(stage)}
                  className="flex items-center gap-1 rounded-xl border border-[var(--border)] px-2.5 py-1.5 text-xs text-[var(--text-muted)] hover:text-[var(--text)] transition-colors"
                >
                  <Pencil size={12} />
                </button>
                {deletingId === stage.id ? (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-[var(--danger)]">Confirmar exclusão?</span>
                    <button
                      onClick={() => handleDelete(stage.id)}
                      disabled={loading}
                      className="rounded-xl bg-[var(--danger)] px-2.5 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                    >
                      Sim
                    </button>
                    <button
                      onClick={() => setDeletingId(null)}
                      className="rounded-xl border border-[var(--border)] px-2.5 py-1.5 text-xs text-[var(--text-muted)] hover:text-[var(--text)]"
                    >
                      Não
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setDeletingId(stage.id)}
                    className="flex items-center gap-1 rounded-xl border border-[var(--border)] px-2.5 py-1.5 text-xs text-[var(--text-muted)] hover:text-[var(--danger)] transition-colors"
                  >
                    <Trash2 size={12} />
                  </button>
                )}
              </div>
            )
          )}
        </div>
      )}

      {adding && (
        <div className="flex items-center gap-3 rounded-xl border border-[var(--accent)] bg-[var(--surface)] p-3">
          <div className="flex gap-1.5">
            {PRESET_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setNewColor(c)}
                className={`h-5 w-5 rounded-full transition-transform ${newColor === c ? "ring-2 ring-offset-1 ring-[var(--accent)] scale-110" : ""}`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            className="input flex-1 text-sm py-1.5"
            placeholder="Nome da nova etapa..."
            autoFocus
            onKeyDown={(e) => { if (e.key === "Enter") handleAdd(); if (e.key === "Escape") { setAdding(false); setNewName(""); } }}
          />
          <button
            onClick={handleAdd}
            disabled={loading}
            className="flex items-center gap-1 rounded-xl bg-[var(--accent)] px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
          >
            <Check size={12} /> Criar
          </button>
          <button
            onClick={() => { setAdding(false); setNewName(""); }}
            className="flex items-center gap-1 rounded-xl border border-[var(--border)] px-3 py-1.5 text-xs font-medium text-[var(--text-muted)] hover:text-[var(--text)]"
          >
            <X size={12} />
          </button>
        </div>
      )}
    </div>
  );
}
