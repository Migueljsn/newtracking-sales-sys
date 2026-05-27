"use client";

import { useState } from "react";
import { Node } from "@xyflow/react";
import { X, Trash2, Copy, Eye, EyeOff } from "lucide-react";
import {
  TriggerData, WaitData, ConditionData, EmailData,
  WhatsAppData, ChangeStatusData, AssignData, NodeType,
} from "@/lib/journeys/types";
import { FIELD_DEFS, OPERATORS_BY_TYPE, getFieldDef, defaultOperator, defaultValue } from "@/lib/audiences/fields";

type PipelineStage  = { id: string; name: string }
type EmailTemplate  = { id: string; name: string; subject: string; body: string }
type AudienceOption = { id: string; name: string }

const SAMPLE_VARS: Record<string, string> = {
  nome:                "João",
  nome_completo:       "João Silva",
  telefone:            "11999999999",
  email:               "joao@email.com",
  consultor:           "Maria Vendas",
  empresa:             "Minha Empresa",
  dias:                "15",
  data_ultima_compra:  new Date().toLocaleDateString("pt-BR"),
  valor_ultima_compra: "R$ 350,00",
  total_compras:       "3",
  valor_total_ltv:     "R$ 1.050,00",
  unsub_url:           "#",
};

function renderSample(text: string): string {
  return text.replace(/\{(\w+)\}/g, (match, key) => (SAMPLE_VARS as Record<string, string>)[key] ?? match);
}

function buildPreviewHtml(body: string): string {
  const rendered = renderSample(body);
  if (rendered.trimStart().toLowerCase().startsWith("<!doctype") || rendered.trimStart().startsWith("<html")) {
    return rendered;
  }
  return `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="margin:0;padding:16px;font-family:Arial,sans-serif;">${rendered}</body></html>`;
}

interface NodeConfigPanelProps {
  node:           Node
  onUpdate:       (id: string, data: Record<string, unknown>) => void
  onDelete:       (id: string) => void
  onDuplicate:    (node: Node) => void
  onClose:        () => void
  pipelineStages: PipelineStage[]
  emailTemplates: EmailTemplate[]
  audiences:      AudienceOption[]
  consultants:    string[]
}

const inputClass = "w-full h-9 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 text-sm text-[var(--text)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]";
const selectClass = inputClass;
const labelClass  = "block text-xs font-medium text-[var(--text-muted)] mb-1";

function EmailNodeConfig({
  data, tpl, emailTemplates, onUpdate,
}: {
  data:           EmailData;
  tpl:            EmailTemplate | undefined;
  emailTemplates: EmailTemplate[];
  onUpdate:       (next: Partial<EmailData>) => void;
}) {
  const [showPreview, setShowPreview] = useState(false);

  return (
    <div className="space-y-3">
      <div>
        <label className={labelClass}>Template de e-mail</label>
        <select
          value={data.templateId ?? ""}
          onChange={(e) => {
            const t = emailTemplates.find((t) => t.id === e.target.value);
            onUpdate({ templateId: t?.id ?? null, templateName: t?.name ?? null });
            setShowPreview(false);
          }}
          className={selectClass}
        >
          <option value="">Selecione um template…</option>
          {emailTemplates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
        {emailTemplates.length === 0 && (
          <p className="text-xs text-[var(--text-muted)] mt-1">Crie templates em Jornadas → Templates.</p>
        )}
      </div>

      {tpl && (
        <>
          {/* Assunto */}
          <div className="rounded-lg bg-[var(--surface-muted)] px-3 py-2 text-xs text-[var(--text-muted)]">
            <span className="font-semibold">Assunto: </span>
            <span className="text-[var(--text)]">{renderSample(tpl.subject)}</span>
          </div>

          {/* Toggle prévia */}
          <button
            type="button"
            onClick={() => setShowPreview((v) => !v)}
            className="flex items-center gap-1.5 text-xs font-medium text-[var(--accent)] hover:underline"
          >
            {showPreview ? <EyeOff size={12} /> : <Eye size={12} />}
            {showPreview ? "Fechar prévia" : "Ver prévia do e-mail"}
          </button>

          {showPreview && (
            <div className="rounded-xl border border-[var(--border)] overflow-hidden bg-white" style={{ height: 340 }}>
              <iframe
                srcDoc={buildPreviewHtml(tpl.body)}
                sandbox="allow-same-origin"
                className="w-full h-full"
                title="Prévia do e-mail"
              />
            </div>
          )}
        </>
      )}
    </div>
  );
}

export function NodeConfigPanel({
  node, onUpdate, onDelete, onDuplicate, onClose,
  pipelineStages, emailTemplates, audiences, consultants,
}: NodeConfigPanelProps) {
  const type = node.type as NodeType;
  const data = node.data as Record<string, unknown>;
  const [confirmDelete, setConfirmDelete] = useState(false);

  function set(key: string, value: unknown) {
    onUpdate(node.id, { ...data, [key]: value });
  }

  function handleDelete() {
    if (!confirmDelete) { setConfirmDelete(true); return; }
    onDelete(node.id);
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)]">
        <p className="text-sm font-semibold text-[var(--text)]">Configurar nó</p>
        <button type="button" onClick={onClose} className="text-[var(--text-muted)] hover:text-[var(--text)]">
          <X size={16} />
        </button>
      </div>

      {/* Fields */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">

        {/* ── Trigger ── */}
        {type === "trigger" && (() => {
          const d = data as unknown as TriggerData;
          return (
            <div>
              <label className={labelClass}>Público de entrada</label>
              <select
                value={d.audienceId ?? ""}
                onChange={(e) => {
                  const aud = audiences.find((a) => a.id === e.target.value);
                  onUpdate(node.id, { ...data, audienceId: aud?.id ?? null, audienceName: aud?.name ?? null });
                }}
                className={selectClass}
              >
                <option value="">Selecione um público…</option>
                {audiences.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
          );
        })()}

        {/* ── Wait ── */}
        {type === "wait" && (() => {
          const d = data as unknown as WaitData;
          return (
            <div>
              <label className={labelClass}>Aguardar quantos dias</label>
              <input
                type="number" min={1} value={d.days}
                onChange={(e) => set("days", Math.max(1, parseInt(e.target.value) || 1))}
                className={inputClass}
              />
            </div>
          );
        })()}

        {/* ── Condition ── */}
        {type === "condition" && (() => {
          const d = data as unknown as ConditionData;
          const fieldDef = getFieldDef(d.field);
          const fieldType = fieldDef?.type ?? "text";
          const operators = OPERATORS_BY_TYPE[fieldType];
          return (
            <div className="space-y-3">
              <div>
                <label className={labelClass}>Campo</label>
                <select
                  value={d.field}
                  onChange={(e) => {
                    const def = getFieldDef(e.target.value);
                    const type = def?.type ?? "text";
                    onUpdate(node.id, { ...data, field: e.target.value, operator: defaultOperator(type), value: defaultValue(e.target.value) });
                  }}
                  className={selectClass}
                >
                  {["lead", "cliente", "vendas"].map((cat) => (
                    <optgroup key={cat} label={cat.charAt(0).toUpperCase() + cat.slice(1)}>
                      {FIELD_DEFS.filter((f) => f.category === cat).map((f) => (
                        <option key={f.value} value={f.value}>{f.label}</option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelClass}>Operador</label>
                <select value={d.operator} onChange={(e) => set("operator", e.target.value)} className={selectClass}>
                  {operators.map((op) => <option key={op.value} value={op.value}>{op.label}</option>)}
                </select>
              </div>
              {fieldDef?.type === "select" && (
                <div>
                  <label className={labelClass}>Valor</label>
                  <select value={d.value} onChange={(e) => set("value", e.target.value)} className={selectClass}>
                    {fieldDef.options?.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
              )}
              {(fieldDef?.type === "number" || fieldDef?.type === "text") && d.operator !== "empty" && d.operator !== "not_empty" && (
                <div>
                  <label className={labelClass}>Valor</label>
                  <input
                    type={fieldDef.type === "number" ? "number" : "text"}
                    value={d.value}
                    onChange={(e) => set("value", e.target.value)}
                    className={inputClass}
                  />
                </div>
              )}
              <p className="text-xs text-[var(--text-muted)] bg-[var(--surface-muted)] rounded-lg p-2">
                <span className="text-[#10b981] font-medium">Sim</span> → saída esquerda &nbsp;·&nbsp; <span className="text-[#ef4444] font-medium">Não</span> → saída direita
              </p>
            </div>
          );
        })()}

        {/* ── Email ── */}
        {type === "email" && (() => {
          const d   = data as unknown as EmailData;
          const tpl = emailTemplates.find((t) => t.id === d.templateId);
          return (
            <EmailNodeConfig
              data={d}
              tpl={tpl}
              emailTemplates={emailTemplates}
              onUpdate={(next) => onUpdate(node.id, { ...data, ...next })}
            />
          );
        })()}

        {/* ── WhatsApp ── */}
        {type === "whatsapp" && (() => {
          const d = data as unknown as WhatsAppData;
          return (
            <div>
              <label className={labelClass}>Mensagem</label>
              <textarea
                value={d.message}
                onChange={(e) => set("message", e.target.value)}
                rows={5}
                placeholder="Olá {nome}, tudo bem?"
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] resize-none"
              />
              <p className="text-xs text-[var(--text-muted)] mt-1">Variáveis: {"{nome}"}, {"{estado}"}, {"{cidade}"}</p>
            </div>
          );
        })()}

        {/* ── Change Status ── */}
        {type === "changeStatus" && (() => {
          const d = data as unknown as ChangeStatusData;
          return (
            <div className="space-y-3">
              <div>
                <label className={labelClass}>Ação</label>
                <select
                  value={d.action}
                  onChange={(e) => onUpdate(node.id, { ...data, action: e.target.value, stageId: null, stageName: null })}
                  className={selectClass}
                >
                  <option value="stage">Mover para etapa do pipeline</option>
                  <option value="lost">Marcar como perdida</option>
                </select>
              </div>
              {d.action === "stage" && (
                <div>
                  <label className={labelClass}>Etapa</label>
                  <select
                    value={d.stageId ?? ""}
                    onChange={(e) => {
                      const s = pipelineStages.find((s) => s.id === e.target.value);
                      onUpdate(node.id, { ...data, stageId: s?.id ?? null, stageName: s?.name ?? null });
                    }}
                    className={selectClass}
                  >
                    <option value="">Selecione uma etapa…</option>
                    {pipelineStages.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
              )}
            </div>
          );
        })()}

        {/* ── Assign ── */}
        {type === "assign" && (() => {
          const d = data as unknown as AssignData;
          return (
            <div>
              <label className={labelClass}>Consultor</label>
              {consultants.length > 0 ? (
                <select value={d.consultant} onChange={(e) => set("consultant", e.target.value)} className={selectClass}>
                  <option value="">Selecione…</option>
                  {consultants.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              ) : (
                <input
                  type="text"
                  value={d.consultant}
                  onChange={(e) => set("consultant", e.target.value)}
                  placeholder="Nome do consultor"
                  className={inputClass}
                />
              )}
            </div>
          );
        })()}

        {/* ── End ── */}
        {type === "end" && (
          <p className="text-sm text-[var(--text-muted)]">Este nó não tem configurações. Ele encerra a jornada para o lead.</p>
        )}
      </div>

      {/* Footer — duplicar + remover nó */}
      <div className="shrink-0 px-4 py-3 border-t border-[var(--border)] space-y-2">
        <button
          type="button"
          onClick={() => onDuplicate(node)}
          className="w-full flex items-center justify-center gap-2 h-9 rounded-xl text-sm font-medium border border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors"
        >
          <Copy size={13} />
          Duplicar nó
        </button>
        <button
          type="button"
          onClick={handleDelete}
          onBlur={() => setConfirmDelete(false)}
          className={`w-full flex items-center justify-center gap-2 h-9 rounded-xl text-sm font-medium transition-colors ${
            confirmDelete
              ? "bg-[var(--danger)] text-white"
              : "border border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--danger)] hover:text-[var(--danger)]"
          }`}
        >
          <Trash2 size={13} />
          {confirmDelete ? "Confirmar remoção" : "Remover nó"}
        </button>
      </div>
    </div>
  );
}
