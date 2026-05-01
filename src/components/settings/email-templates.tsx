"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, X, Check } from "lucide-react";
import { createPortal } from "react-dom";
import { saveEmailTemplateAction, deleteEmailTemplateAction } from "@/app/(dashboard)/settings/actions";

interface Template {
  id:      string;
  name:    string;
  subject: string;
  body:    string;
  isDefault: boolean;
  clientId: string | null;
}

interface Props { templates: Template[] }

const VARIABLES = ["{nome}", "{nome_completo}", "{telefone}", "{email}", "{dias}", "{data_ultima_compra}", "{valor_ultima_compra}", "{total_compras}", "{valor_total_ltv}", "{empresa}"];

function TemplateModal({
  template,
  onClose,
}: {
  template: Partial<Template> | null;
  onClose:  () => void;
}) {
  const [loading, setLoading] = useState(false);

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
            <input name="subject" defaultValue={template?.subject ?? ""} required className="input w-full" placeholder="Ex: {nome}, temos uma oferta especial para você!" />
            <p className="text-xs text-[var(--text-muted)] mt-1">O assunto é o fator mais importante para taxa de abertura.</p>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-medium text-[var(--text-muted)]">Corpo do email (HTML)</label>
            </div>
            <textarea
              name="body"
              defaultValue={template?.body ?? ""}
              required
              rows={10}
              className="input w-full font-mono text-xs"
              placeholder="<p>Olá, {nome}! ...</p>"
            />
          </div>

          <div>
            <p className="text-xs font-medium text-[var(--text-muted)] mb-2">Variáveis disponíveis:</p>
            <div className="flex flex-wrap gap-1.5">
              {VARIABLES.map(v => (
                <code key={v} className="rounded bg-[var(--surface-muted)] border border-[var(--border)] px-2 py-0.5 text-xs text-[var(--text)]">
                  {v}
                </code>
              ))}
            </div>
          </div>

          <div className="flex gap-2 justify-end pt-2">
            <button type="button" onClick={onClose} className="btn-secondary px-4 py-2 text-sm">Cancelar</button>
            <button type="submit" disabled={loading} className="btn-primary px-4 py-2 text-sm">
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
  const [editing, setEditing]   = useState<Partial<Template> | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  async function handleDelete(id: string) {
    if (!confirm("Excluir este template?")) return;
    try {
      await deleteEmailTemplateAction(id);
      toast.success("Template excluído");
    } catch {
      toast.error("Erro ao excluir template");
    }
  }

  return (
    <div className="card space-y-4 p-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-[var(--text)]">Templates de email</h2>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">Templates padrão e personalizados para as campanhas de LTV</p>
        </div>
        <button
          onClick={() => { setEditing({}); setModalOpen(true); }}
          className="flex items-center gap-1.5 btn-primary text-xs px-3 py-2"
        >
          <Plus size={13} /> Novo template
        </button>
      </div>

      <div className="space-y-2">
        {templates.map(t => (
          <div key={t.id} className="flex items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-[var(--text)] truncate">{t.name}</span>
                {t.isDefault && (
                  <span className="text-xs rounded-full bg-[var(--border)] px-2 py-0.5 text-[var(--text-muted)]">padrão</span>
                )}
              </div>
              <p className="text-xs text-[var(--text-muted)] truncate mt-0.5">{t.subject}</p>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              {!t.isDefault && (
                <>
                  <button
                    onClick={() => { setEditing(t); setModalOpen(true); }}
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text)]"
                  >
                    <Pencil size={13} />
                  </button>
                  <button
                    onClick={() => handleDelete(t.id)}
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--danger)]"
                  >
                    <Trash2 size={13} />
                  </button>
                </>
              )}
              {t.isDefault && (
                <span className="flex h-8 w-8 items-center justify-center text-[var(--success)]">
                  <Check size={13} />
                </span>
              )}
            </div>
          </div>
        ))}

        {templates.length === 0 && (
          <p className="text-xs text-[var(--text-muted)] text-center py-4">
            Nenhum template cadastrado. Os templates padrão serão carregados no primeiro disparo.
          </p>
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
