"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  Plus, Pencil, Trash2, Check, X, ChevronUp, ChevronDown,
  ChevronRight, ListChecks, GripVertical,
} from "lucide-react";
import {
  createPipelineStageAction,
  updatePipelineStageAction,
  deletePipelineStageAction,
  reorderPipelineStagesAction,
  addRequirementAction,
  updateRequirementAction,
  deleteRequirementAction,
  reorderRequirementsAction,
} from "@/app/(dashboard)/settings/pipeline-actions";

interface Requirement {
  id:       string;
  text:     string;
  position: number;
}

interface Stage {
  id:           string;
  name:         string;
  color:        string;
  position:     number;
  requirements: Requirement[];
}

const PRESET_COLORS = [
  "#6366f1", "#f59e0b", "#10b981", "#ef4444",
  "#3b82f6", "#8b5cf6", "#f97316", "#06b6d4",
];

interface Props {
  stages: Stage[];
}

export function PipelineStages({ stages: initial }: Props) {
  const [stages,      setStages]      = useState<Stage[]>(initial);
  const [editingId,   setEditingId]   = useState<string | null>(null);
  const [editName,    setEditName]    = useState("");
  const [editColor,   setEditColor]   = useState(PRESET_COLORS[0]);
  const [deletingId,  setDeletingId]  = useState<string | null>(null);
  const [adding,      setAdding]      = useState(false);
  const [newName,     setNewName]     = useState("");
  const [newColor,    setNewColor]    = useState(PRESET_COLORS[0]);
  const [loading,     setLoading]     = useState(false);
  const [expandedId,  setExpandedId]  = useState<string | null>(null);

  // requirements state per stage
  const [reqAdding,    setReqAdding]    = useState<Record<string, boolean>>({});
  const [reqNewText,   setReqNewText]   = useState<Record<string, string>>({});
  const [reqEditingId, setReqEditingId] = useState<string | null>(null);
  const [reqEditText,  setReqEditText]  = useState("");
  const [reqLoading,   setReqLoading]   = useState(false);

  // ── Stage reorder ────────────────────────────────────────────────────────────

  async function moveStage(index: number, dir: -1 | 1) {
    const next = [...stages];
    const swap = index + dir;
    if (swap < 0 || swap >= next.length) return;
    [next[index], next[swap]] = [next[swap], next[index]];
    setStages(next);
    try {
      await reorderPipelineStagesAction(next.map((s) => s.id));
    } catch {
      setStages(stages);
      toast.error("Erro ao reordenar etapas");
    }
  }

  // ── Stage CRUD ───────────────────────────────────────────────────────────────

  function startEdit(stage: Stage) {
    setEditingId(stage.id);
    setEditName(stage.name);
    setEditColor(stage.color);
  }

  function cancelEdit() { setEditingId(null); }

  async function handleUpdate(stage: Stage) {
    if (!editName.trim()) { toast.error("Nome obrigatório"); return; }
    setLoading(true);
    try {
      const fd = new FormData();
      fd.set("id", stage.id); fd.set("name", editName.trim()); fd.set("color", editColor);
      await updatePipelineStageAction(fd);
      setStages((prev) => prev.map((s) => s.id === stage.id ? { ...s, name: editName.trim(), color: editColor } : s));
      toast.success("Etapa atualizada");
      setEditingId(null);
    } catch { toast.error("Erro ao atualizar etapa"); }
    finally { setLoading(false); }
  }

  async function handleDelete(id: string) {
    setLoading(true);
    try {
      await deletePipelineStageAction(id);
      setStages((prev) => prev.filter((s) => s.id !== id));
      toast.success("Etapa removida");
      setDeletingId(null);
    } catch { toast.error("Erro ao remover etapa"); }
    finally { setLoading(false); }
  }

  async function handleAdd() {
    if (!newName.trim()) { toast.error("Nome obrigatório"); return; }
    setLoading(true);
    try {
      const fd = new FormData();
      fd.set("name", newName.trim()); fd.set("color", newColor);
      await createPipelineStageAction(fd);
      toast.success("Etapa criada");
      setAdding(false);
      setNewName("");
      setNewColor(PRESET_COLORS[0]);
      // full refresh to get new stage id
      window.location.reload();
    } catch { toast.error("Erro ao criar etapa"); }
    finally { setLoading(false); }
  }

  // ── Requirements CRUD ────────────────────────────────────────────────────────

  async function handleAddReq(stageId: string) {
    const text = (reqNewText[stageId] ?? "").trim();
    if (!text) { toast.error("Texto obrigatório"); return; }
    setReqLoading(true);
    try {
      await addRequirementAction(stageId, text);
      setStages((prev) => prev.map((s) => {
        if (s.id !== stageId) return s;
        const pos = (s.requirements[s.requirements.length - 1]?.position ?? -1) + 1;
        return { ...s, requirements: [...s.requirements, { id: `tmp-${Date.now()}`, text, position: pos }] };
      }));
      setReqNewText((p) => ({ ...p, [stageId]: "" }));
      setReqAdding((p) => ({ ...p, [stageId]: false }));
      toast.success("Requisito adicionado");
    } catch { toast.error("Erro ao adicionar requisito"); }
    finally { setReqLoading(false); }
  }

  async function handleUpdateReq(reqId: string, stageId: string) {
    const text = reqEditText.trim();
    if (!text) { toast.error("Texto obrigatório"); return; }
    setReqLoading(true);
    try {
      await updateRequirementAction(reqId, text);
      setStages((prev) => prev.map((s) => {
        if (s.id !== stageId) return s;
        return { ...s, requirements: s.requirements.map((r) => r.id === reqId ? { ...r, text } : r) };
      }));
      setReqEditingId(null);
      toast.success("Requisito atualizado");
    } catch { toast.error("Erro ao atualizar requisito"); }
    finally { setReqLoading(false); }
  }

  async function handleDeleteReq(reqId: string, stageId: string) {
    setReqLoading(true);
    try {
      await deleteRequirementAction(reqId);
      setStages((prev) => prev.map((s) => {
        if (s.id !== stageId) return s;
        return { ...s, requirements: s.requirements.filter((r) => r.id !== reqId) };
      }));
      toast.success("Requisito removido");
    } catch { toast.error("Erro ao remover requisito"); }
    finally { setReqLoading(false); }
  }

  async function moveReq(stageId: string, index: number, dir: -1 | 1) {
    const stage = stages.find((s) => s.id === stageId);
    if (!stage) return;
    const next = [...stage.requirements];
    const swap = index + dir;
    if (swap < 0 || swap >= next.length) return;
    [next[index], next[swap]] = [next[swap], next[index]];
    setStages((prev) => prev.map((s) => s.id === stageId ? { ...s, requirements: next } : s));
    try {
      await reorderRequirementsAction(stageId, next.map((r) => r.id));
    } catch {
      setStages(stages);
      toast.error("Erro ao reordenar requisitos");
    }
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-[var(--text)]">Etapas do pipeline</h2>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">
            Crie etapas e defina os requisitos que o consultor deve confirmar ao avançar a lead.
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
          {stages.map((stage, idx) => (
            <div key={stage.id} className="rounded-xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden">

              {/* Stage row */}
              {editingId === stage.id ? (
                <div className="flex items-center gap-3 p-3">
                  <div className="flex gap-1.5">
                    {PRESET_COLORS.map((c) => (
                      <button key={c} type="button" onClick={() => setEditColor(c)}
                        className={`h-5 w-5 rounded-full transition-transform ${editColor === c ? "ring-2 ring-offset-1 ring-[var(--accent)] scale-110" : ""}`}
                        style={{ backgroundColor: c }} />
                    ))}
                  </div>
                  <input value={editName} onChange={(e) => setEditName(e.target.value)}
                    className="input flex-1 text-sm py-1.5" placeholder="Nome da etapa" autoFocus />
                  <button onClick={() => handleUpdate(stage)} disabled={loading}
                    className="flex items-center gap-1 rounded-xl bg-[var(--accent)] px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50">
                    <Check size={12} /> Salvar
                  </button>
                  <button onClick={cancelEdit}
                    className="flex items-center gap-1 rounded-xl border border-[var(--border)] px-3 py-1.5 text-xs font-medium text-[var(--text-muted)] hover:text-[var(--text)]">
                    <X size={12} />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-3 p-3">
                  {/* reorder arrows */}
                  <div className="flex flex-col gap-0.5">
                    <button onClick={() => moveStage(idx, -1)} disabled={idx === 0}
                      className="text-[var(--text-muted)] hover:text-[var(--text)] disabled:opacity-20 transition-opacity">
                      <ChevronUp size={13} />
                    </button>
                    <button onClick={() => moveStage(idx, 1)} disabled={idx === stages.length - 1}
                      className="text-[var(--text-muted)] hover:text-[var(--text)] disabled:opacity-20 transition-opacity">
                      <ChevronDown size={13} />
                    </button>
                  </div>

                  <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: stage.color }} />
                  <span className="flex-1 text-sm font-medium text-[var(--text)]">{stage.name}</span>

                  {/* requirements count badge */}
                  <button
                    onClick={() => setExpandedId(expandedId === stage.id ? null : stage.id)}
                    className="flex items-center gap-1 rounded-xl border border-[var(--border)] px-2.5 py-1.5 text-xs text-[var(--text-muted)] hover:text-[var(--text)] transition-colors"
                    title="Requisitos"
                  >
                    <ListChecks size={12} />
                    {stage.requirements.length > 0 && (
                      <span className="text-[10px] font-semibold">{stage.requirements.length}</span>
                    )}
                    <ChevronRight size={11} className={`transition-transform ${expandedId === stage.id ? "rotate-90" : ""}`} />
                  </button>

                  <button onClick={() => startEdit(stage)}
                    className="flex items-center gap-1 rounded-xl border border-[var(--border)] px-2.5 py-1.5 text-xs text-[var(--text-muted)] hover:text-[var(--text)] transition-colors">
                    <Pencil size={12} />
                  </button>

                  {deletingId === stage.id ? (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-[var(--danger)]">Confirmar?</span>
                      <button onClick={() => handleDelete(stage.id)} disabled={loading}
                        className="rounded-xl bg-[var(--danger)] px-2.5 py-1.5 text-xs font-semibold text-white disabled:opacity-50">Sim</button>
                      <button onClick={() => setDeletingId(null)}
                        className="rounded-xl border border-[var(--border)] px-2.5 py-1.5 text-xs text-[var(--text-muted)] hover:text-[var(--text)]">Não</button>
                    </div>
                  ) : (
                    <button onClick={() => setDeletingId(stage.id)}
                      className="flex items-center gap-1 rounded-xl border border-[var(--border)] px-2.5 py-1.5 text-xs text-[var(--text-muted)] hover:text-[var(--danger)] transition-colors">
                      <Trash2 size={12} />
                    </button>
                  )}
                </div>
              )}

              {/* Requirements panel */}
              {expandedId === stage.id && (
                <div className="border-t border-[var(--border)] bg-[var(--surface-muted)] p-3 space-y-2">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide">Requisitos</span>
                    <button
                      onClick={() => setReqAdding((p) => ({ ...p, [stage.id]: true }))}
                      className="flex items-center gap-1 rounded-lg border border-[var(--accent)] bg-[var(--accent-soft)] px-2 py-1 text-[11px] font-semibold text-[var(--accent)] hover:bg-[var(--accent)] hover:text-white transition-colors"
                    >
                      <Plus size={11} /> Adicionar
                    </button>
                  </div>

                  {stage.requirements.length === 0 && !reqAdding[stage.id] ? (
                    <p className="text-xs text-[var(--text-muted)] py-1">
                      Nenhum requisito. O consultor pode avançar sem confirmação.
                    </p>
                  ) : (
                    <div className="space-y-1.5">
                      {stage.requirements.map((req, rIdx) => (
                        <div key={req.id} className="flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2.5 py-2">
                          {/* reorder */}
                          <div className="flex flex-col gap-0.5 shrink-0">
                            <button onClick={() => moveReq(stage.id, rIdx, -1)} disabled={rIdx === 0}
                              className="text-[var(--text-muted)] hover:text-[var(--text)] disabled:opacity-20">
                              <ChevronUp size={11} />
                            </button>
                            <button onClick={() => moveReq(stage.id, rIdx, 1)} disabled={rIdx === stage.requirements.length - 1}
                              className="text-[var(--text-muted)] hover:text-[var(--text)] disabled:opacity-20">
                              <ChevronDown size={11} />
                            </button>
                          </div>
                          <GripVertical size={12} className="text-[var(--text-muted)] shrink-0" />

                          {reqEditingId === req.id ? (
                            <>
                              <input value={reqEditText} onChange={(e) => setReqEditText(e.target.value)}
                                className="input flex-1 text-xs py-1"
                                onKeyDown={(e) => { if (e.key === "Enter") handleUpdateReq(req.id, stage.id); if (e.key === "Escape") setReqEditingId(null); }}
                                autoFocus />
                              <button onClick={() => handleUpdateReq(req.id, stage.id)} disabled={reqLoading}
                                className="flex items-center gap-1 rounded-lg bg-[var(--accent)] px-2 py-1 text-[11px] font-semibold text-white disabled:opacity-50">
                                <Check size={11} />
                              </button>
                              <button onClick={() => setReqEditingId(null)}
                                className="flex items-center rounded-lg border border-[var(--border)] px-2 py-1 text-[11px] text-[var(--text-muted)] hover:text-[var(--text)]">
                                <X size={11} />
                              </button>
                            </>
                          ) : (
                            <>
                              <span className="flex-1 text-xs text-[var(--text)]">{req.text}</span>
                              <button onClick={() => { setReqEditingId(req.id); setReqEditText(req.text); }}
                                className="flex items-center rounded-lg border border-[var(--border)] px-2 py-1 text-[11px] text-[var(--text-muted)] hover:text-[var(--text)] transition-colors">
                                <Pencil size={11} />
                              </button>
                              <button onClick={() => handleDeleteReq(req.id, stage.id)} disabled={reqLoading}
                                className="flex items-center rounded-lg border border-[var(--border)] px-2 py-1 text-[11px] text-[var(--text-muted)] hover:text-[var(--danger)] transition-colors">
                                <Trash2 size={11} />
                              </button>
                            </>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {reqAdding[stage.id] && (
                    <div className="flex items-center gap-2 rounded-lg border border-[var(--accent)] bg-[var(--surface)] px-2.5 py-2">
                      <input
                        value={reqNewText[stage.id] ?? ""}
                        onChange={(e) => setReqNewText((p) => ({ ...p, [stage.id]: e.target.value }))}
                        className="input flex-1 text-xs py-1"
                        placeholder="Ex: Enviar proposta por e-mail"
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleAddReq(stage.id);
                          if (e.key === "Escape") setReqAdding((p) => ({ ...p, [stage.id]: false }));
                        }}
                      />
                      <button onClick={() => handleAddReq(stage.id)} disabled={reqLoading}
                        className="flex items-center gap-1 rounded-lg bg-[var(--accent)] px-2.5 py-1 text-[11px] font-semibold text-white disabled:opacity-50">
                        <Check size={11} /> Salvar
                      </button>
                      <button onClick={() => { setReqAdding((p) => ({ ...p, [stage.id]: false })); setReqNewText((p) => ({ ...p, [stage.id]: "" })); }}
                        className="flex items-center rounded-lg border border-[var(--border)] px-2 py-1 text-[11px] text-[var(--text-muted)] hover:text-[var(--text)]">
                        <X size={11} />
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {adding && (
        <div className="flex items-center gap-3 rounded-xl border border-[var(--accent)] bg-[var(--surface)] p-3">
          <div className="flex gap-1.5">
            {PRESET_COLORS.map((c) => (
              <button key={c} type="button" onClick={() => setNewColor(c)}
                className={`h-5 w-5 rounded-full transition-transform ${newColor === c ? "ring-2 ring-offset-1 ring-[var(--accent)] scale-110" : ""}`}
                style={{ backgroundColor: c }} />
            ))}
          </div>
          <input value={newName} onChange={(e) => setNewName(e.target.value)}
            className="input flex-1 text-sm py-1.5" placeholder="Nome da nova etapa..."
            autoFocus
            onKeyDown={(e) => { if (e.key === "Enter") handleAdd(); if (e.key === "Escape") { setAdding(false); setNewName(""); } }} />
          <button onClick={handleAdd} disabled={loading}
            className="flex items-center gap-1 rounded-xl bg-[var(--accent)] px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50">
            <Check size={12} /> Criar
          </button>
          <button onClick={() => { setAdding(false); setNewName(""); }}
            className="flex items-center gap-1 rounded-xl border border-[var(--border)] px-3 py-1.5 text-xs font-medium text-[var(--text-muted)] hover:text-[var(--text)]">
            <X size={12} />
          </button>
        </div>
      )}
    </div>
  );
}
