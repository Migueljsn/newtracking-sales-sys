"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Plus, Trash2, Copy, GitBranch, Users, MessageSquareMore, Play, Pause, Loader2, Zap, Key } from "lucide-react";
import { toast } from "sonner";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import {
  createFlowAction, deleteFlowAction, duplicateFlowAction,
  publishFlowAction, pauseFlowAction, archiveFlowAction,
} from "@/app/(dashboard)/flows/actions";

type FlowRow = {
  id:             string
  name:           string
  description:    string | null
  status:         string
  nodeCount:      number
  enrollCount:    number
  completedCount: number
  triggers:       { type: string; keyword: string | null; audienceName: string | null }[]
  updatedAt:      Date
}

const STATUS_LABEL: Record<string, string> = { DRAFT: "Rascunho", ACTIVE: "Ativo", PAUSED: "Pausado" }
const STATUS_COLOR: Record<string, string> = {
  DRAFT:  "bg-[var(--surface-muted)] text-[var(--text-muted)]",
  ACTIVE: "bg-[#10b981]/15 text-[#10b981]",
  PAUSED: "bg-[#f59e0b]/15 text-[#f59e0b]",
}

export function FlowList({ flows }: { flows: FlowRow[] }) {
  const [name,       setName]      = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [creating,   startCreate]  = useTransition();
  const [,           startAction]  = useTransition();
  const [actingOn,   setActingOn]  = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  function runAction(key: string, fn: () => Promise<void>) {
    if (actingOn) return;
    setActingOn(key);
    startAction(async () => {
      try { await fn(); } finally { setActingOn(null); }
    });
  }

  function handleCreate() {
    if (!name.trim()) return;
    startCreate(async () => {
      try { await createFlowAction(name.trim()); }
      catch (e) { if (!isRedirectError(e)) toast.error("Erro ao criar fluxo"); }
    });
  }

  function handleDelete(id: string) {
    if (confirmDelete !== id) { setConfirmDelete(id); return; }
    setConfirmDelete(null);
    runAction(`delete-${id}`, async () => {
      try { await deleteFlowAction(id); toast.success("Fluxo removido"); }
      catch { toast.error("Erro ao remover"); }
    });
  }

  function handleToggle(id: string, status: string) {
    runAction(`toggle-${id}`, async () => {
      try {
        if (status === "ACTIVE") { await pauseFlowAction(id); toast.success("Fluxo pausado"); }
        else                     { await publishFlowAction(id); toast.success("Fluxo ativado"); }
      } catch { toast.error("Erro ao alterar status"); }
    });
  }

  function handleDuplicate(id: string) {
    runAction(`dup-${id}`, async () => {
      try { await duplicateFlowAction(id); toast.success("Fluxo duplicado"); }
      catch { toast.error("Erro ao duplicar"); }
    });
  }

  function triggerSummary(triggers: FlowRow["triggers"]) {
    if (!triggers.length) return "Sem gatilho";
    return triggers.map((t) =>
      t.type === "AUDIENCE"      ? (t.audienceName ?? "Público") :
      t.type === "KEYWORD"       ? `Palavra: "${t.keyword}"` :
      "Primeiro contato"
    ).join(" · ");
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-[var(--text-muted)]">
          {flows.length === 0 ? "Nenhum fluxo criado" : `${flows.length} fluxo${flows.length !== 1 ? "s" : ""}`}
        </p>
        <button type="button" onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 h-9 rounded-xl bg-[var(--accent)] px-4 text-sm font-medium text-white hover:bg-[var(--accent-strong)] transition-colors">
          <Plus size={15} />
          Novo fluxo
        </button>
      </div>

      {/* Create form */}
      {showCreate && (
        <div className="card p-4 flex items-center gap-3">
          <input
            autoFocus
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleCreate(); if (e.key === "Escape") setShowCreate(false); }}
            placeholder="Nome do fluxo…"
            className="flex-1 h-9 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 text-sm text-[var(--text)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
          />
          <button type="button" onClick={handleCreate} disabled={creating || !name.trim()}
            className="h-9 rounded-xl bg-[var(--accent)] px-4 text-sm font-medium text-white hover:bg-[var(--accent-strong)] disabled:opacity-50 transition-colors">
            {creating ? "Criando…" : "Criar"}
          </button>
          <button type="button" onClick={() => setShowCreate(false)} className="text-sm text-[var(--text-muted)] hover:text-[var(--text)]">Cancelar</button>
        </div>
      )}

      {/* Empty state */}
      {flows.length === 0 && !showCreate && (
        <div className="card p-12 flex flex-col items-center gap-3 text-center">
          <div className="h-14 w-14 rounded-2xl bg-[var(--accent-soft)] flex items-center justify-center">
            <MessageSquareMore size={26} className="text-[var(--accent)]" />
          </div>
          <div>
            <p className="font-semibold text-[var(--text)]">Nenhum fluxo criado</p>
            <p className="text-sm text-[var(--text-muted)] mt-1 max-w-sm">
              Crie conversas automatizadas via WhatsApp — SDR, qualificação e atendimento em tempo real.
            </p>
          </div>
          <button type="button" onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 h-9 rounded-xl bg-[var(--accent)] px-4 text-sm font-medium text-white hover:bg-[var(--accent-strong)] transition-colors">
            <Plus size={15} />
            Criar primeiro fluxo
          </button>
        </div>
      )}

      {/* List */}
      <div className="space-y-3">
        {flows.map((f) => {
          const isDeleting = confirmDelete === f.id;
          return (
            <div key={f.id} className="card p-4 flex items-center gap-4">
              {/* Icon */}
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--accent-soft)]">
                <MessageSquareMore size={18} className="text-[var(--accent)]" />
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <Link href={`/flows/${f.id}`} className="font-medium text-[var(--text)] hover:text-[var(--accent)] transition-colors">
                    {f.name}
                  </Link>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${STATUS_COLOR[f.status]}`}>
                    {STATUS_LABEL[f.status]}
                  </span>
                </div>
                <div className="flex items-center gap-3 mt-1 text-xs text-[var(--text-muted)]">
                  <span className="flex items-center gap-1">
                    {f.triggers.some(t => t.type === "AUDIENCE") ? <Users size={11} /> : <Key size={11} />}
                    {triggerSummary(f.triggers)}
                  </span>
                  <span className="flex items-center gap-1">
                    <GitBranch size={11} />
                    {f.nodeCount} nó{f.nodeCount !== 1 ? "s" : ""}
                  </span>
                  {f.enrollCount > 0 && (
                    <>
                      <span>{f.enrollCount} inscrita{f.enrollCount !== 1 ? "s" : ""}</span>
                      <span className="text-[var(--success)] font-semibold">{f.completedCount} concluídas</span>
                    </>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1 shrink-0">
                {f.status !== "ARCHIVED" && (
                  <button type="button" onClick={() => handleToggle(f.id, f.status)} disabled={!!actingOn}
                    className={`h-8 px-2.5 flex items-center gap-1.5 rounded-lg text-xs font-medium transition-colors disabled:opacity-50 ${
                      f.status === "ACTIVE"
                        ? "text-[#f59e0b] hover:bg-[#f59e0b]/10 border border-[#f59e0b]/30"
                        : "text-[#10b981] hover:bg-[#10b981]/10 border border-[#10b981]/30"
                    }`}>
                    {actingOn === `toggle-${f.id}` ? <Loader2 size={13} className="animate-spin" /> : f.status === "ACTIVE" ? <Pause size={13} /> : <Play size={13} />}
                    {f.status === "ACTIVE" ? "Pausar" : "Ativar"}
                  </button>
                )}
                <Link href={`/flows/${f.id}`}
                  className="h-8 px-3 flex items-center gap-1.5 rounded-lg text-sm text-[var(--text-muted)] hover:bg-[var(--surface-muted)] hover:text-[var(--text)] transition-colors">
                  Editar
                </Link>
                <button type="button" onClick={() => handleDuplicate(f.id)} disabled={!!actingOn}
                  className="h-8 w-8 flex items-center justify-center rounded-lg text-[var(--text-muted)] hover:bg-[var(--surface-muted)] hover:text-[var(--text)] transition-colors disabled:opacity-50"
                  title="Duplicar">
                  {actingOn === `dup-${f.id}` ? <Loader2 size={14} className="animate-spin" /> : <Copy size={14} />}
                </button>
                <button type="button" onClick={() => handleDelete(f.id)} disabled={!!actingOn}
                  onBlur={() => setConfirmDelete(null)}
                  className={`h-8 w-8 flex items-center justify-center rounded-lg transition-colors disabled:opacity-50 ${
                    isDeleting ? "bg-[var(--danger)] text-white" : "text-[var(--text-muted)] hover:bg-[var(--danger-soft)] hover:text-[var(--danger)]"
                  }`}
                  title={isDeleting ? "Confirmar exclusão" : "Excluir"}>
                  {actingOn === `delete-${f.id}` ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
