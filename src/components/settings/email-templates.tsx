"use client";

import { useState, useTransition, useRef } from "react";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, X, Copy, CheckSquare, Square, Mail } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { createPortal } from "react-dom";
import {
  saveEmailTemplateAction,
  deleteEmailTemplateAction,
  duplicateEmailTemplateAction,
  bulkDeleteEmailTemplatesAction,
  bulkDuplicateEmailTemplatesAction,
} from "@/app/(dashboard)/settings/actions";

interface Template {
  id:        string;
  name:      string;
  subject:   string;
  body:      string;
  isDefault: boolean;
  clientId:  string | null;
}

interface Props { templates: Template[] }

const VARIABLES = ["{nome}", "{nome_completo}", "{telefone}", "{email}", "{dias}", "{data_ultima_compra}", "{valor_ultima_compra}", "{total_compras}", "{valor_total_ltv}", "{empresa}"];

function TemplateModal({ template, onClose }: { template: Partial<Template> | null; onClose: () => void }) {
  const [loading,     setLoading]     = useState(false);
  const [subject,     setSubject]     = useState(template?.subject ?? "");
  const [body,        setBody]        = useState(template?.body    ?? "");
  const [lastFocused, setLastFocused] = useState<"subject" | "body">("body");
  const subjectRef = useRef<HTMLInputElement>(null);
  const bodyRef    = useRef<HTMLTextAreaElement>(null);

  function insertVariable(v: string) {
    const isSubject = lastFocused === "subject";
    const el        = isSubject ? subjectRef.current : bodyRef.current;
    if (!el) return;
    const start  = el.selectionStart ?? (isSubject ? subject : body).length;
    const end    = el.selectionEnd   ?? start;
    if (isSubject) {
      setSubject(subject.slice(0, start) + v + subject.slice(end));
    } else {
      setBody(body.slice(0, start) + v + body.slice(end));
    }
    setTimeout(() => {
      el.focus();
      el.setSelectionRange(start + v.length, start + v.length);
    }, 0);
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    try {
      await saveEmailTemplateAction(new FormData(e.currentTarget));
      toast.success(template?.id ? "Template atualizado" : "Template criado");
      onClose();
    } catch {
      toast.error("Erro ao salvar template");
    } finally {
      setLoading(false);
    }
  }

  const modal = (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="card w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-[var(--text)]">
            {template?.id ? "Editar template" : "Novo template"}
          </h3>
          <button onClick={onClose} className="text-[var(--text-muted)] hover:text-[var(--text)]">
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {template?.id && <input type="hidden" name="id" value={template.id} />}

          <div>
            <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">Nome do template</label>
            <input name="name" defaultValue={template?.name ?? ""} required className="input w-full" placeholder="Ex: Reengajamento verão" />
          </div>

          <div>
            <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">Assunto (subject)</label>
            <input
              ref={subjectRef}
              name="subject"
              value={subject}
              onChange={e => setSubject(e.target.value)}
              onFocus={() => setLastFocused("subject")}
              required
              className="input w-full"
              placeholder="Ex: {nome}, temos uma oferta especial para você!"
            />
            <p className="text-xs text-[var(--text-muted)] mt-1">O assunto é o fator mais importante para taxa de abertura.</p>
          </div>

          <div>
            <label className="text-xs font-medium text-[var(--text-muted)]">Corpo do email (HTML)</label>
            <textarea
              ref={bodyRef}
              name="body"
              value={body}
              onChange={e => setBody(e.target.value)}
              onFocus={() => setLastFocused("body")}
              required
              rows={10}
              className="input w-full font-mono text-xs mt-1"
              placeholder="<p>Olá, {nome}! ...</p>"
            />
          </div>

          <div>
            <p className="text-xs font-medium text-[var(--text-muted)] mb-2">
              Variáveis disponíveis — clique para inserir no campo em foco:
            </p>
            <div className="flex flex-wrap gap-1.5">
              {VARIABLES.map(v => (
                <button
                  key={v}
                  type="button"
                  onClick={() => insertVariable(v)}
                  className="rounded bg-[var(--surface-muted)] border border-[var(--border)] px-2 py-0.5 text-xs text-[var(--accent)] font-mono hover:border-[var(--accent)] hover:bg-[var(--accent-soft)] transition-colors cursor-pointer"
                >
                  {v}
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-2 justify-end pt-2">
            <button type="button" onClick={onClose} className="btn-secondary px-4 py-2 text-sm">Cancelar</button>
            <button type="submit" disabled={loading} className="btn-primary flex items-center gap-2 px-4 py-2 text-sm">
              {loading && <Spinner size={14} />}
              {loading ? "Salvando..." : "Salvar template"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  return typeof window !== "undefined" ? createPortal(modal, document.body) : null;
}

export function EmailTemplates({ templates }: Props) {
  const [editing,   setEditing]   = useState<Partial<Template> | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  // Selection
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Confirmations (2-click pattern)
  const [confirmDelete,  setConfirmDelete]  = useState<string | null>(null);
  const [confirmDup,     setConfirmDup]     = useState<string | null>(null);
  const [confirmBulkDel, setConfirmBulkDel] = useState(false);
  const [confirmBulkDup, setConfirmBulkDup] = useState(false);

  // Transitions
  const [deleting,        startDelete]        = useTransition();
  const [duplicating,     startDuplicate]     = useTransition();
  const [bulkDeleting,    startBulkDelete]    = useTransition();
  const [bulkDuplicating, startBulkDuplicate] = useTransition();

  // Only non-default templates are selectable
  const selectableIds = templates.filter(t => !t.isDefault).map(t => t.id);
  const allSelected   = selectableIds.length > 0 && selectableIds.every(id => selected.has(id));

  function toggleSelect(id: string) {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
    setConfirmDelete(null);
    setConfirmDup(null);
    setConfirmBulkDel(false);
  }

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(selectableIds));
    setConfirmBulkDel(false);
    setConfirmBulkDup(false);
  }

  function clearSelection() {
    setSelected(new Set());
    setConfirmBulkDel(false);
    setConfirmBulkDup(false);
  }

  // ── Individual delete (2 cliques) ──────────────────────────────────────────
  function handleDelete(id: string) {
    setConfirmDup(null);
    if (confirmDelete !== id) { setConfirmDelete(id); return; }
    setConfirmDelete(null);
    startDelete(async () => {
      try {
        await deleteEmailTemplateAction(id);
        setSelected(prev => { const n = new Set(prev); n.delete(id); return n; });
        toast.success("Template excluído");
      } catch { toast.error("Erro ao excluir template"); }
    });
  }

  // ── Individual duplicate (2 cliques) ───────────────────────────────────────
  function handleDuplicate(id: string) {
    setConfirmDelete(null);
    if (confirmDup !== id) { setConfirmDup(id); return; }
    setConfirmDup(null);
    startDuplicate(async () => {
      try {
        await duplicateEmailTemplateAction(id);
        toast.success("Template duplicado com \"-cópia\"");
      } catch { toast.error("Erro ao duplicar template"); }
    });
  }

  // ── Bulk delete (2 cliques na barra) ───────────────────────────────────────
  function handleBulkDelete() {
    setConfirmBulkDup(false);
    if (!confirmBulkDel) { setConfirmBulkDel(true); return; }
    setConfirmBulkDel(false);
    const ids = [...selected];
    startBulkDelete(async () => {
      try {
        await bulkDeleteEmailTemplatesAction(ids);
        setSelected(new Set());
        toast.success(`${ids.length} template${ids.length !== 1 ? "s" : ""} excluído${ids.length !== 1 ? "s" : ""}`);
      } catch { toast.error("Erro ao excluir templates"); }
    });
  }

  // ── Bulk duplicate (2 cliques na barra) ────────────────────────────────────
  function handleBulkDuplicate() {
    setConfirmBulkDel(false);
    if (!confirmBulkDup) { setConfirmBulkDup(true); return; }
    setConfirmBulkDup(false);
    const ids = [...selected];
    startBulkDuplicate(async () => {
      try {
        await bulkDuplicateEmailTemplatesAction(ids);
        setSelected(new Set());
        toast.success(`${ids.length} template${ids.length !== 1 ? "s" : ""} duplicado${ids.length !== 1 ? "s" : ""} com "-cópia"`);
      } catch { toast.error("Erro ao duplicar templates"); }
    });
  }

  return (
    <div className="space-y-4">

      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          {selectableIds.length > 0 && (
            <button
              type="button"
              onClick={toggleAll}
              className="flex items-center gap-1.5 text-sm text-[var(--text-muted)] hover:text-[var(--text)] transition-colors"
              title={allSelected ? "Desmarcar todos" : "Selecionar todos"}
            >
              {allSelected
                ? <CheckSquare size={16} className="text-[var(--accent)]" />
                : <Square size={16} />}
              <span className="text-xs">Selecionar todos</span>
            </button>
          )}
          <p className="text-sm text-[var(--text-muted)]">
            {templates.length === 0
              ? "Nenhum template"
              : `${templates.length} template${templates.length !== 1 ? "s" : ""}`}
          </p>
        </div>
        <button
          onClick={() => { setEditing({}); setModalOpen(true); }}
          className="flex items-center gap-1.5 btn-primary text-xs px-3 py-2"
        >
          <Plus size={13} /> Novo template
        </button>
      </div>

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div className="flex items-center gap-3 rounded-xl border border-[var(--accent)] bg-[var(--accent-soft)] px-4 py-2.5">
          <span className="text-sm font-medium text-[var(--accent)]">
            {selected.size} selecionado{selected.size !== 1 ? "s" : ""}
          </span>
          <div className="flex-1" />
          <button
            type="button"
            onClick={handleBulkDuplicate}
            disabled={bulkDuplicating}
            className={`flex items-center gap-1.5 h-8 rounded-lg px-3 text-sm font-medium transition-colors disabled:opacity-50 ${
              confirmBulkDup
                ? "bg-[var(--accent)] text-white"
                : "border border-[var(--accent)] text-[var(--accent)] hover:bg-white/20"
            }`}
          >
            {bulkDuplicating ? <Spinner size={13} /> : <Copy size={13} />}
            {confirmBulkDup ? "Confirmar duplicação" : "Duplicar selecionados"}
          </button>
          <button
            type="button"
            onClick={handleBulkDelete}
            disabled={bulkDeleting}
            className={`flex items-center gap-1.5 h-8 rounded-lg px-3 text-sm font-medium transition-colors disabled:opacity-50 ${
              confirmBulkDel
                ? "bg-[var(--danger)] text-white"
                : "border border-[var(--danger)] text-[var(--danger)] hover:bg-[var(--danger-soft)]"
            }`}
          >
            {bulkDeleting ? <Spinner size={13} /> : <Trash2 size={13} />}
            {confirmBulkDel ? "Confirmar exclusão" : "Excluir selecionados"}
          </button>
          <button
            type="button"
            onClick={clearSelection}
            className="text-sm text-[var(--text-muted)] hover:text-[var(--text)] transition-colors"
          >
            Cancelar
          </button>
        </div>
      )}

      {/* List */}
      <div className="space-y-2">
        {templates.map(t => {
          const isSelected  = selected.has(t.id);
          const isDeletingMe = confirmDelete === t.id;
          const isDupMe      = confirmDup    === t.id;

          return (
            <div
              key={t.id}
              className={`flex items-center gap-3 rounded-xl border px-4 py-3 transition-colors ${
                isSelected
                  ? "border-[var(--accent)] bg-[var(--accent-soft)]"
                  : "border-[var(--border)] bg-[var(--surface-muted)]"
              }`}
            >
              {/* Checkbox — só para não-padrão */}
              {!t.isDefault ? (
                <button
                  type="button"
                  onClick={() => toggleSelect(t.id)}
                  className="shrink-0 text-[var(--text-muted)] hover:text-[var(--accent)] transition-colors"
                >
                  {isSelected
                    ? <CheckSquare size={16} className="text-[var(--accent)]" />
                    : <Square size={16} />}
                </button>
              ) : (
                <div className="w-4 shrink-0" />
              )}

              {/* Icon */}
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--accent-soft)]">
                <Mail size={14} className="text-[var(--accent)]" />
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-[var(--text)] truncate">{t.name}</span>
                  {t.isDefault && (
                    <span className="text-[10px] rounded-full bg-[var(--border)] px-2 py-0.5 text-[var(--text-muted)] shrink-0">padrão</span>
                  )}
                </div>
                <p className="text-xs text-[var(--text-muted)] truncate mt-0.5">{t.subject}</p>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1 shrink-0">
                {!t.isDefault && (
                  <>
                    {/* Edit */}
                    <button
                      onClick={() => { setEditing(t); setModalOpen(true); setConfirmDelete(null); setConfirmDup(null); }}
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--text-muted)] hover:bg-[var(--surface-strong)] hover:text-[var(--text)] transition-colors"
                      title="Editar"
                    >
                      <Pencil size={13} />
                    </button>

                    {/* Duplicate — 2 cliques */}
                    <button
                      onClick={() => handleDuplicate(t.id)}
                      disabled={duplicating}
                      className={`flex h-8 w-8 items-center justify-center rounded-lg transition-colors disabled:opacity-50 ${
                        isDupMe
                          ? "bg-[var(--accent)] text-white"
                          : "text-[var(--text-muted)] hover:bg-[var(--surface-strong)] hover:text-[var(--text)]"
                      }`}
                      title={isDupMe ? "Clique novamente para confirmar" : "Duplicar"}
                    >
                      {duplicating ? <Spinner size={13} /> : <Copy size={13} />}
                    </button>

                    {/* Delete — 2 cliques */}
                    <button
                      onClick={() => handleDelete(t.id)}
                      disabled={deleting}
                      className={`flex h-8 w-8 items-center justify-center rounded-lg transition-colors disabled:opacity-50 ${
                        isDeletingMe
                          ? "bg-[var(--danger)] text-white"
                          : "text-[var(--text-muted)] hover:bg-[var(--danger-soft)] hover:text-[var(--danger)]"
                      }`}
                      title={isDeletingMe ? "Clique novamente para confirmar" : "Excluir"}
                    >
                      {deleting ? <Spinner size={13} /> : <Trash2 size={13} />}
                    </button>
                  </>
                )}
              </div>
            </div>
          );
        })}

        {templates.length === 0 && (
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] py-10 text-center">
            <p className="text-sm text-[var(--text-muted)]">Nenhum template cadastrado.</p>
            <p className="text-xs text-[var(--text-muted)] mt-1">Os templates padrão serão carregados no primeiro disparo.</p>
          </div>
        )}
      </div>

      {modalOpen && (
        <TemplateModal
          template={editing}
          onClose={() => { setModalOpen(false); setEditing(null); }}
        />
      )}
    </div>
  );
}
