"use client";

import { useState } from "react";
import { toast } from "sonner";
import { UserPlus, Trash2, KeyRound, ToggleLeft, ToggleRight, Loader2, Eye, EyeOff, Pencil, Check, X, Target, ChevronDown, ChevronUp } from "lucide-react";
import {
  createConsultantAction,
  updateConsultantAction,
  toggleConsultantAction,
  deleteConsultantAction,
  resetConsultantPasswordAction,
  saveConsultantGoalAction,
} from "@/app/(dashboard)/settings/actions";

type GoalPeriod  = "WEEKLY" | "MONTHLY";
type GoalKpi     = "SALES_COUNT" | "REVENUE";
type StageTarget = { stageId: string; stageName: string; target: number };

export interface ConsultantGoal {
  period:        GoalPeriod;
  primaryKpi:    GoalKpi;
  primaryTarget: number;
  stageTargets:  StageTarget[];
}

interface Consultant {
  id:        string;
  name:      string;
  email:     string;
  active:    boolean;
  goal:      ConsultantGoal | null;
  createdAt: Date;
}

interface PipelineStage { id: string; name: string }

function defaultGoal(stages: PipelineStage[]): ConsultantGoal {
  return {
    period:        "MONTHLY",
    primaryKpi:    "REVENUE",
    primaryTarget: 0,
    stageTargets:  stages.map(s => ({ stageId: s.id, stageName: s.name, target: 0 })),
  };
}

export function ConsultantAccess({ consultants, pipelineStages }: { consultants: Consultant[]; pipelineStages: PipelineStage[] }) {
  const [list,           setList]           = useState<Consultant[]>(consultants);
  const [showForm,       setShowForm]       = useState(false);
  const [loading,        setLoading]        = useState<string | null>(null);
  const [resetId,        setResetId]        = useState<string | null>(null);
  const [editId,         setEditId]         = useState<string | null>(null);
  const [editName,       setEditName]       = useState("");
  const [editEmail,      setEditEmail]      = useState("");
  const [newPass,        setNewPass]        = useState("");
  const [showCreatePass, setShowCreatePass] = useState(false);
  const [showResetPass,  setShowResetPass]  = useState(false);

  // Goals
  const [goalOpenId,  setGoalOpenId]  = useState<string | null>(null);
  const [goalDraft,   setGoalDraft]   = useState<ConsultantGoal>(defaultGoal(pipelineStages));
  const [goalLoading, setGoalLoading] = useState(false);

  function openGoal(c: Consultant) {
    setGoalOpenId(goalOpenId === c.id ? null : c.id);
    setGoalDraft(c.goal ?? defaultGoal(pipelineStages));
    setResetId(null);
    setEditId(null);
  }

  function patchGoal(patch: Partial<ConsultantGoal>) {
    setGoalDraft(prev => ({ ...prev, ...patch }));
  }

  function patchStageTarget(stageId: string, target: number) {
    setGoalDraft(prev => ({
      ...prev,
      stageTargets: prev.stageTargets.map(s => s.stageId === stageId ? { ...s, target } : s),
    }));
  }

  async function handleSaveGoal(id: string) {
    setGoalLoading(true);
    try {
      await saveConsultantGoalAction(id, goalDraft);
      setList(prev => prev.map(x => x.id === id ? { ...x, goal: goalDraft } : x));
      setGoalOpenId(null);
      toast.success("Meta salva com sucesso!");
    } catch {
      toast.error("Erro ao salvar meta");
    } finally {
      setGoalLoading(false);
    }
  }

  // Create
  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading("create");
    const fd = new FormData(e.currentTarget);
    try {
      await createConsultantAction(fd);
      toast.success("Consultor criado com sucesso!");
      setShowForm(false);
      (e.target as HTMLFormElement).reset();
      window.location.reload();
    } catch (err: unknown) {
      toast.error((err as Error).message || "Erro ao criar consultor");
    } finally {
      setLoading(null);
    }
  }

  // Edit
  function startEdit(c: Consultant) {
    setEditId(c.id);
    setEditName(c.name);
    setEditEmail(c.email);
    setResetId(null);
  }

  async function handleEdit(id: string) {
    setLoading(id + "-edit");
    const fd = new FormData();
    fd.set("name", editName);
    fd.set("email", editEmail);
    try {
      await updateConsultantAction(id, fd);
      setList(prev => prev.map(x => x.id === id ? { ...x, name: editName, email: editEmail } : x));
      setEditId(null);
      toast.success("Consultor atualizado");
    } catch (err: unknown) {
      toast.error((err as Error).message || "Erro ao atualizar consultor");
    } finally {
      setLoading(null);
    }
  }

  // Toggle
  async function handleToggle(c: Consultant) {
    setLoading(c.id + "-toggle");
    try {
      await toggleConsultantAction(c.id, !c.active);
      setList(prev => prev.map(x => x.id === c.id ? { ...x, active: !x.active } : x));
      toast.success(c.active ? "Acesso desativado" : "Acesso ativado");
    } catch {
      toast.error("Erro ao atualizar acesso");
    } finally {
      setLoading(null);
    }
  }

  // Delete
  async function handleDelete(id: string, name: string) {
    if (!confirm(`Excluir o consultor "${name}"? Esta ação não pode ser desfeita.`)) return;
    setLoading(id + "-delete");
    try {
      await deleteConsultantAction(id);
      setList(prev => prev.filter(x => x.id !== id));
      toast.success("Consultor excluído");
    } catch {
      toast.error("Erro ao excluir consultor");
    } finally {
      setLoading(null);
    }
  }

  // Reset password
  async function handleResetPassword(id: string) {
    if (!newPass || newPass.length < 6) { toast.error("Senha deve ter pelo menos 6 caracteres"); return; }
    setLoading(id + "-reset");
    const fd = new FormData();
    fd.set("password", newPass);
    try {
      await resetConsultantPasswordAction(id, fd);
      toast.success("Senha redefinida com sucesso!");
      setResetId(null);
      setNewPass("");
    } catch (err: unknown) {
      toast.error((err as Error).message || "Erro ao redefinir senha");
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-[var(--text)]">Acessos de Consultores</h2>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">Consultores têm acesso restrito à lista de leads operacional.</p>
        </div>
        <button
          onClick={() => setShowForm(v => !v)}
          className="flex items-center gap-2 rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--accent-strong)] transition-colors"
        >
          <UserPlus size={15} /> Novo consultor
        </button>
      </div>

      {/* Create form */}
      {showForm && (
        <form onSubmit={handleCreate} className="rounded-2xl border border-[var(--accent)] bg-[var(--accent-soft)] p-5 space-y-4">
          <p className="text-sm font-semibold text-[var(--accent)]">Novo consultor</p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">Nome *</label>
              <input name="name" required className="input w-full" placeholder="Ex: João Silva" />
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">E-mail *</label>
              <input name="email" type="email" required className="input w-full" placeholder="joao@empresa.com" />
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">Senha *</label>
              <div className="relative">
                <input name="password" type={showCreatePass ? "text" : "password"} required minLength={6} className="input w-full pr-10" placeholder="Mínimo 6 caracteres" />
                <button type="button" onClick={() => setShowCreatePass(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text)] transition-colors">
                  {showCreatePass ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <button type="button" onClick={() => setShowForm(false)} className="rounded-xl border border-[var(--border)] px-4 py-2 text-sm text-[var(--text-muted)] hover:text-[var(--text)]">
              Cancelar
            </button>
            <button type="submit" disabled={loading === "create"} className="flex items-center gap-2 rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
              {loading === "create" ? <Loader2 size={14} className="animate-spin" /> : null}
              Criar consultor
            </button>
          </div>
        </form>
      )}

      {/* List */}
      {list.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[var(--border)] p-10 text-center">
          <p className="text-sm text-[var(--text-muted)]">Nenhum consultor cadastrado ainda.</p>
        </div>
      ) : (
        <div className="divide-y divide-[var(--border)] rounded-2xl border border-[var(--border)]">
          {list.map((c) => (
            <div key={c.id} className="px-5 py-4 space-y-3">
              {/* Main row */}
              <div className="flex items-center gap-4">
                {editId === c.id ? (
                  /* ── Edit mode ── */
                  <div className="flex flex-1 items-center gap-2 min-w-0">
                    <input
                      value={editName}
                      onChange={e => setEditName(e.target.value)}
                      placeholder="Nome"
                      className="input h-8 flex-1 text-sm min-w-0"
                    />
                    <input
                      value={editEmail}
                      onChange={e => setEditEmail(e.target.value)}
                      type="email"
                      placeholder="E-mail"
                      className="input h-8 flex-1 text-sm min-w-0"
                    />
                    <button
                      onClick={() => handleEdit(c.id)}
                      disabled={loading === c.id + "-edit"}
                      title="Salvar"
                      className="shrink-0 flex items-center justify-center h-8 w-8 rounded-lg bg-[var(--accent)] text-white hover:bg-[var(--accent-strong)] disabled:opacity-50"
                    >
                      {loading === c.id + "-edit" ? <Loader2 size={13} className="animate-spin" /> : <Check size={14} />}
                    </button>
                    <button
                      onClick={() => setEditId(null)}
                      title="Cancelar"
                      className="shrink-0 flex items-center justify-center h-8 w-8 rounded-lg border border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text)]"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ) : (
                  /* ── View mode ── */
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-[var(--text)] truncate">{c.name}</p>
                    <p className="text-xs text-[var(--text-muted)] truncate">{c.email}</p>
                  </div>
                )}

                {editId !== c.id && (
                  <>
                    <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                      c.active
                        ? "bg-[var(--success-soft)] text-[var(--success)]"
                        : "bg-[var(--surface-muted)] text-[var(--text-muted)]"
                    }`}>
                      {c.active ? "Ativo" : "Inativo"}
                    </span>

                    {/* Edit */}
                    <button
                      onClick={() => startEdit(c)}
                      title="Editar nome/e-mail"
                      className="shrink-0 flex items-center gap-1.5 rounded-xl border border-[var(--border)] px-3 py-1.5 text-xs text-[var(--text-muted)] hover:text-[var(--text)] transition-colors"
                    >
                      <Pencil size={12} /> Editar
                    </button>

                    {/* Reset password toggle */}
                    <button
                      onClick={() => { setResetId(resetId === c.id ? null : c.id); setNewPass(""); setEditId(null); }}
                      title="Redefinir senha"
                      className="shrink-0 flex items-center gap-1.5 rounded-xl border border-[var(--border)] px-3 py-1.5 text-xs text-[var(--text-muted)] hover:text-[var(--text)] transition-colors"
                    >
                      <KeyRound size={13} /> Senha
                    </button>

                    {/* Metas */}
                    <button
                      onClick={() => openGoal(c)}
                      title="Configurar metas"
                      className={`shrink-0 flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs transition-colors ${
                        goalOpenId === c.id
                          ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]"
                          : c.goal
                          ? "border-[var(--success)]/40 text-[var(--success)] hover:border-[var(--success)]"
                          : "border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text)]"
                      }`}
                    >
                      <Target size={13} />
                      Metas
                      {goalOpenId === c.id ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                    </button>

                    {/* Toggle active */}
                    <button
                      onClick={() => handleToggle(c)}
                      disabled={loading === c.id + "-toggle"}
                      title={c.active ? "Desativar acesso" : "Ativar acesso"}
                      className="shrink-0 text-[var(--text-muted)] hover:text-[var(--accent)] transition-colors disabled:opacity-50"
                    >
                      {loading === c.id + "-toggle"
                        ? <Loader2 size={18} className="animate-spin" />
                        : c.active
                        ? <ToggleRight size={22} className="text-[var(--success)]" />
                        : <ToggleLeft  size={22} />
                      }
                    </button>

                    {/* Delete */}
                    <button
                      onClick={() => handleDelete(c.id, c.name)}
                      disabled={loading === c.id + "-delete"}
                      title="Excluir consultor"
                      className="shrink-0 text-[var(--text-muted)] hover:text-[var(--danger)] transition-colors disabled:opacity-50"
                    >
                      {loading === c.id + "-delete"
                        ? <Loader2 size={15} className="animate-spin" />
                        : <Trash2 size={15} />
                      }
                    </button>
                  </>
                )}
              </div>

              {/* Reset password inline */}
              {resetId === c.id && editId !== c.id && (
                <div className="flex items-center gap-2 pl-0">
                  <div className="relative">
                    <input
                      type={showResetPass ? "text" : "password"}
                      value={newPass}
                      onChange={e => setNewPass(e.target.value)}
                      placeholder="Nova senha (mín. 6 caracteres)"
                      minLength={6}
                      className="input h-8 w-56 text-xs pr-8"
                    />
                    <button type="button" onClick={() => setShowResetPass(v => !v)} className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text)] transition-colors">
                      {showResetPass ? <EyeOff size={12} /> : <Eye size={12} />}
                    </button>
                  </div>
                  <button
                    onClick={() => handleResetPassword(c.id)}
                    disabled={loading === c.id + "-reset"}
                    className="rounded-lg bg-[var(--accent)] px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                  >
                    {loading === c.id + "-reset" ? <Loader2 size={12} className="animate-spin" /> : "Salvar senha"}
                  </button>
                  <button onClick={() => { setResetId(null); setNewPass(""); setShowResetPass(false); }} className="text-xs text-[var(--text-muted)] hover:text-[var(--text)]">
                    Cancelar
                  </button>
                </div>
              )}
              {/* ── Seção de metas ── */}
              {goalOpenId === c.id && (
                <div className="rounded-xl border border-[var(--accent)]/30 bg-[var(--accent-soft)]/20 p-4 space-y-4">
                  <p className="text-xs font-semibold text-[var(--accent)] uppercase tracking-wider">Configurar metas</p>

                  {/* Período */}
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-medium text-[var(--text-muted)] w-24 shrink-0">Período</span>
                    <div className="flex rounded-xl border border-[var(--border)] overflow-hidden">
                      {(["WEEKLY", "MONTHLY"] as const).map(p => (
                        <button
                          key={p}
                          type="button"
                          onClick={() => patchGoal({ period: p })}
                          className={`px-4 py-1.5 text-xs font-semibold transition-colors ${
                            goalDraft.period === p
                              ? "bg-[var(--accent)] text-white"
                              : "text-[var(--text-muted)] hover:text-[var(--text)]"
                          }`}
                        >
                          {p === "WEEKLY" ? "Semanal" : "Mensal"}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* KPI principal */}
                  <div className="space-y-2">
                    <span className="text-xs font-medium text-[var(--text-muted)]">KPI principal</span>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      {([
                        { value: "SALES_COUNT", label: "Nº de vendas",    placeholder: "ex: 100" },
                        { value: "REVENUE",     label: "Receita (R$)",    placeholder: "ex: 50000" },
                      ] as const).map(opt => (
                        <label
                          key={opt.value}
                          onClick={() => patchGoal({ primaryKpi: opt.value })}
                          className={`flex items-center gap-3 rounded-xl border p-3 cursor-pointer transition-all ${
                            goalDraft.primaryKpi === opt.value
                              ? "border-[var(--accent)] bg-[var(--accent-soft)]"
                              : "border-[var(--border)] hover:border-[var(--accent)]/50"
                          }`}
                        >
                          <div className={`h-4 w-4 shrink-0 rounded-full border-2 transition-colors flex items-center justify-center ${
                            goalDraft.primaryKpi === opt.value ? "border-[var(--accent)]" : "border-[var(--border)]"
                          }`}>
                            {goalDraft.primaryKpi === opt.value && (
                              <div className="h-2 w-2 rounded-full bg-[var(--accent)]" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold text-[var(--text)]">{opt.label}</p>
                          </div>
                          {goalDraft.primaryKpi === opt.value && (
                            <input
                              type="number"
                              min={0}
                              value={goalDraft.primaryTarget || ""}
                              onChange={e => patchGoal({ primaryTarget: Number(e.target.value) })}
                              onClick={e => e.stopPropagation()}
                              placeholder={opt.placeholder}
                              className="w-24 h-7 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2 text-xs text-[var(--text)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
                            />
                          )}
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* KPIs secundárias por etapa */}
                  {pipelineStages.length > 0 && (
                    <div className="space-y-2">
                      <span className="text-xs font-medium text-[var(--text-muted)]">KPIs secundárias — leads por etapa</span>
                      <div className="space-y-2">
                        {goalDraft.stageTargets.map(st => (
                          <div key={st.stageId} className="flex items-center gap-3">
                            <span className="text-xs text-[var(--text)] flex-1 truncate">{st.stageName}</span>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <input
                                type="number"
                                min={0}
                                value={st.target || ""}
                                onChange={e => patchStageTarget(st.stageId, Number(e.target.value))}
                                placeholder="0"
                                className="w-20 h-7 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2 text-xs text-[var(--text)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)] text-right"
                              />
                              <span className="text-xs text-[var(--text-muted)]">leads</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Ações */}
                  <div className="flex items-center justify-end gap-2 pt-2 border-t border-[var(--border)]">
                    <button
                      type="button"
                      onClick={() => setGoalOpenId(null)}
                      className="rounded-xl border border-[var(--border)] px-4 py-2 text-xs text-[var(--text-muted)] hover:text-[var(--text)] transition-colors"
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSaveGoal(c.id)}
                      disabled={goalLoading}
                      className="flex items-center gap-2 rounded-xl bg-[var(--accent)] px-4 py-2 text-xs font-semibold text-white disabled:opacity-50 transition-colors hover:bg-[var(--accent-strong)]"
                    >
                      {goalLoading ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                      Salvar metas
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-3">
        <p className="text-xs text-[var(--text-muted)]">
          O link de acesso do consultor é: <code className="font-mono text-[var(--accent)]">/consultor/login</code>
        </p>
      </div>
    </div>
  );
}
