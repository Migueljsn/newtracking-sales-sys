"use client";

import { useState } from "react";
import { Node }     from "@xyflow/react";
import { X, Trash2, Copy, Plus, Type, MousePointerClick } from "lucide-react";
import type {
  FlowNodeType, FlowTriggerData, FlowMessageData, FlowQuestionData,
  FlowConditionData, FlowChangeStatusData, FlowAssignData,
  FlowAddToAudienceData, FlowStartFlowData, FlowButton,
} from "@/lib/flows/types";
import { FIELD_DEFS, OPERATORS_BY_TYPE, getFieldDef, defaultOperator, defaultValue } from "@/lib/audiences/fields";

type AudienceOption  = { id: string; name: string }
type PipelineStage   = { id: string; name: string }
type FlowOption      = { id: string; name: string }

interface FlowNodeConfigPanelProps {
  node:           Node
  onUpdate:       (id: string, data: Record<string, unknown>) => void
  onDelete:       (id: string) => void
  onDuplicate:    (node: Node) => void
  onClose:        () => void
  audiences:      AudienceOption[]
  pipelineStages: PipelineStage[]
  consultants:    string[]
  flows:          FlowOption[]
}

const inputClass  = "w-full h-9 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 text-sm text-[var(--text)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]";
const selectClass = inputClass;
const labelClass  = "block text-xs font-medium text-[var(--text-muted)] mb-1";
const taClass     = "w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] resize-none";

const VALIDATION_OPTIONS = [
  { value: "none",   label: "Nenhuma — aceita qualquer texto" },
  { value: "cnpj",   label: "CNPJ — valida dígitos verificadores" },
  { value: "cep",    label: "CEP — 8 dígitos numéricos" },
  { value: "email",  label: "E-mail — formato válido" },
  { value: "phone",  label: "Telefone — 10 ou 11 dígitos" },
  { value: "number", label: "Número — apenas numérico" },
];

export function FlowNodeConfigPanel({
  node, onUpdate, onDelete, onDuplicate, onClose,
  audiences, pipelineStages, consultants, flows,
}: FlowNodeConfigPanelProps) {
  const type = node.type as FlowNodeType;
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

        {/* ── Trigger ─────────────────────────────────────────────────────── */}
        {type === "trigger" && (() => {
          const d = data as unknown as FlowTriggerData;
          return (
            <div className="space-y-4">
              <div>
                <label className={labelClass}>Tipo de gatilho</label>
                <div className="space-y-2">
                  {[
                    { value: "audience",      label: "Público",             desc: "Lead entra em um público → inicia o fluxo" },
                    { value: "keyword",       label: "Palavra-chave",        desc: "Lead manda mensagem com a palavra → inicia o fluxo" },
                    { value: "first_message", label: "Primeiro contato",    desc: "Primeira mensagem recebida de qualquer lead" },
                  ].map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => set("triggerType", opt.value)}
                      className={`w-full text-left rounded-xl border px-3 py-2.5 transition-all ${
                        d.triggerType === opt.value
                          ? "border-[var(--accent)] bg-[var(--accent-soft)]"
                          : "border-[var(--border)] hover:border-[var(--accent)]/50"
                      }`}
                    >
                      <p className={`text-xs font-semibold ${d.triggerType === opt.value ? "text-[var(--accent)]" : "text-[var(--text)]"}`}>{opt.label}</p>
                      <p className="text-[10px] text-[var(--text-muted)] mt-0.5">{opt.desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              {d.triggerType === "audience" && (
                <div>
                  <label className={labelClass}>Público</label>
                  <select
                    value={d.audienceId ?? ""}
                    onChange={(e) => {
                      const a = audiences.find((a) => a.id === e.target.value);
                      onUpdate(node.id, { ...data, audienceId: a?.id ?? null, audienceName: a?.name ?? null });
                    }}
                    className={selectClass}
                  >
                    <option value="">Selecione um público…</option>
                    {audiences.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </select>
                </div>
              )}

              {d.triggerType === "keyword" && (
                <div className="space-y-3">
                  <div>
                    <label className={labelClass}>Palavra-chave</label>
                    <input
                      type="text"
                      value={d.keyword ?? ""}
                      onChange={(e) => set("keyword", e.target.value)}
                      placeholder="ex: oi, preço, catálogo"
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Tipo de correspondência</label>
                    <select value={d.keywordMatch} onChange={(e) => set("keywordMatch", e.target.value)} className={selectClass}>
                      <option value="contains">Contém</option>
                      <option value="exact">Exato</option>
                      <option value="starts_with">Começa com</option>
                    </select>
                  </div>
                </div>
              )}
            </div>
          );
        })()}

        {/* ── Message ──────────────────────────────────────────────────────── */}
        {type === "message" && (() => {
          const d = data as unknown as FlowMessageData;
          return (
            <div className="space-y-4">
              <div>
                <label className={labelClass}>Tipo de mensagem</label>
                <select value={d.messageType} onChange={(e) => set("messageType", e.target.value)} className={selectClass}>
                  <option value="text">Texto</option>
                  <option value="media">Imagem / Vídeo</option>
                  <option value="document">Documento (PDF, etc.)</option>
                </select>
              </div>

              {d.messageType === "text" && (
                <div>
                  <label className={labelClass}>Mensagem</label>
                  <textarea rows={4} value={d.text} onChange={(e) => set("text", e.target.value)}
                    placeholder="Olá {nome}, temos uma novidade para você!" className={taClass} />
                  <p className="text-[10px] text-[var(--text-muted)] mt-1">Use {"{nome}"}, {"{empresa}"} etc. para personalizar</p>
                </div>
              )}

              {(d.messageType === "media" || d.messageType === "document") && (
                <>
                  <div>
                    <label className={labelClass}>URL do arquivo</label>
                    <input type="url" value={d.mediaUrl ?? ""} onChange={(e) => set("mediaUrl", e.target.value)}
                      placeholder="https://..." className={inputClass} />
                  </div>
                  {d.messageType === "document" && (
                    <div>
                      <label className={labelClass}>Nome do arquivo</label>
                      <input type="text" value={d.fileName ?? ""} onChange={(e) => set("fileName", e.target.value)}
                        placeholder="catalogo.pdf" className={inputClass} />
                    </div>
                  )}
                  <div>
                    <label className={labelClass}>{d.messageType === "document" ? "Mensagem / legenda" : "Legenda"}</label>
                    <textarea rows={2} value={d.text} onChange={(e) => set("text", e.target.value)}
                      placeholder="Opcional" className={taClass} />
                  </div>
                </>
              )}
            </div>
          );
        })()}

        {/* ── Question ─────────────────────────────────────────────────────── */}
        {type === "question" && (() => {
          const d       = data as unknown as FlowQuestionData;
          const mode    = d.mode ?? "text";
          const buttons = (d.buttons ?? []) as FlowButton[];
          const maxReached = buttons.length >= 3;

          function updateButton(idx: number, text: string) {
            set("buttons", buttons.map((b, i) => i === idx ? { ...b, text } : b));
          }
          function addButton() {
            if (maxReached) return;
            set("buttons", [...buttons, { id: String(buttons.length + 1), text: "" }]);
          }
          function removeButton(idx: number) {
            set("buttons", buttons.filter((_, i) => i !== idx).map((b, i) => ({ ...b, id: String(i + 1) })));
          }

          return (
            <div className="space-y-4">
              {/* Modo */}
              <div>
                <label className={labelClass}>Modo</label>
                <div className="flex gap-2">
                  {[
                    { value: "text",   label: "Texto livre", icon: <Type size={12} /> },
                    { value: "choice", label: "Botões",      icon: <MousePointerClick size={12} /> },
                  ].map((opt) => (
                    <button key={opt.value} type="button"
                      onClick={() => { set("mode", opt.value); if (opt.value === "text") set("buttons", []); }}
                      className={`flex items-center gap-1.5 flex-1 justify-center rounded-xl border px-3 py-2 text-xs font-semibold transition-all ${
                        mode === opt.value
                          ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]"
                          : "border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text)]"
                      }`}
                    >
                      {opt.icon}{opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Pergunta */}
              <div>
                <label className={labelClass}>Pergunta</label>
                <textarea rows={3} value={d.questionText}
                  onChange={(e) => set("questionText", e.target.value)}
                  placeholder="Ex: Qual é o seu CNPJ? (apenas números)"
                  className={taClass} />
              </div>

              {/* Modo texto: campo + validação + retries */}
              {mode === "text" && (
                <>
                  <div>
                    <label className={labelClass}>Salvar resposta no campo</label>
                    <input type="text" value={d.saveField}
                      onChange={(e) => set("saveField", e.target.value)}
                      placeholder="cnpj, cep, notes, email…"
                      className={inputClass} />
                    <p className="text-[10px] text-[var(--text-muted)] mt-1">Campo onde a resposta será salva no lead</p>
                  </div>
                  <div>
                    <label className={labelClass}>Validação</label>
                    <select value={d.validation} onChange={(e) => set("validation", e.target.value)} className={selectClass}>
                      {VALIDATION_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </div>
                  {d.validation !== "none" && (
                    <>
                      <div>
                        <label className={labelClass}>Tentativas em caso de inválido</label>
                        <select value={String(d.retries)} onChange={(e) => set("retries", Number(e.target.value))} className={selectClass}>
                          <option value="1">1 tentativa</option>
                          <option value="2">2 tentativas</option>
                          <option value="3">3 tentativas</option>
                        </select>
                      </div>
                      <div>
                        <label className={labelClass}>Mensagem ao retentar</label>
                        <input type="text" value={d.retryMessage}
                          onChange={(e) => set("retryMessage", e.target.value)}
                          placeholder="Resposta inválida, tente novamente:"
                          className={inputClass} />
                      </div>
                    </>
                  )}
                  <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] p-3 text-xs text-[var(--text-muted)] space-y-1">
                    <p>• Saída <strong className="text-[#10b981]">válido</strong> → resposta passou na validação</p>
                    <p>• Saída <strong className="text-[#ef4444]">inválido</strong> → esgotou tentativas</p>
                    <p>• Saída <strong className="text-[#f97316]">timeout</strong> → não respondeu</p>
                  </div>
                </>
              )}

              {/* Modo choice: botões */}
              {mode === "choice" && (
                <div className="space-y-2">
                  <label className={labelClass}>Opções ({buttons.length}/3)</label>
                  {buttons.map((btn, idx) => (
                    <div key={btn.id} className="flex items-center gap-2">
                      <span className="shrink-0 flex h-6 w-6 items-center justify-center rounded-lg bg-[var(--surface-muted)] text-[10px] font-bold text-[var(--text-muted)]">
                        {idx + 1}
                      </span>
                      <input value={btn.text} onChange={(e) => updateButton(idx, e.target.value)}
                        placeholder={`Opção ${idx + 1}`} maxLength={24} className={inputClass + " flex-1"} />
                      <button type="button" onClick={() => removeButton(idx)}
                        className="shrink-0 text-[var(--text-muted)] hover:text-[var(--danger)] transition-colors">
                        <X size={13} />
                      </button>
                    </div>
                  ))}
                  <button type="button" onClick={addButton} disabled={maxReached}
                    className={`flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed py-2 text-xs font-semibold transition-all ${
                      maxReached
                        ? "cursor-not-allowed border-[var(--border)] text-[var(--text-muted)] opacity-30"
                        : "border-[var(--accent)]/50 text-[var(--accent)] hover:border-[var(--accent)] hover:bg-[var(--accent-soft)]"
                    }`}>
                    <Plus size={12} />
                    {maxReached ? "Máximo de 3 botões" : "Adicionar botão"}
                  </button>
                  <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] p-3 text-xs text-[var(--text-muted)] space-y-1">
                    {buttons.map((b, i) => (
                      <p key={b.id}>• Saída <strong className="text-[#10b981]">{b.text || `Botão ${i + 1}`}</strong> → lead clicou esta opção</p>
                    ))}
                    <p>• Saída <strong className="text-[#f97316]">timeout</strong> → não respondeu</p>
                  </div>
                </div>
              )}

              {/* Timeout (ambos os modos) */}
              <div className="space-y-3 pt-2 border-t border-[var(--border)]">
                <p className="text-xs font-semibold text-[var(--text)]">Configuração de timeout</p>
                <div>
                  <label className={labelClass}>Aguardar resposta por</label>
                  <div className="flex gap-2">
                    <input type="number" min={1} value={d.timeoutValue}
                      onChange={(e) => set("timeoutValue", Math.max(1, parseInt(e.target.value) || 1))}
                      className={inputClass + " w-24"} />
                    <select value={d.timeoutUnit} onChange={(e) => set("timeoutUnit", e.target.value)} className={inputClass}>
                      <option value="minutes">minuto(s)</option>
                      <option value="hours">hora(s)</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className={labelClass}>Mensagem de recuperação</label>
                  <input type="text" value={d.timeoutMessage}
                    onChange={(e) => set("timeoutMessage", e.target.value)}
                    placeholder="Ainda está aí? Aguardamos sua resposta 😊"
                    className={inputClass} />
                  <p className="text-[10px] text-[var(--text-muted)] mt-1">Enviada quando o lead não responde no prazo</p>
                </div>
                <div>
                  <label className={labelClass}>Aguardar mais após recuperação</label>
                  <div className="flex gap-2">
                    <input type="number" min={1} value={d.timeoutWaitValue}
                      onChange={(e) => set("timeoutWaitValue", Math.max(1, parseInt(e.target.value) || 1))}
                      className={inputClass + " w-24"} />
                    <select value={d.timeoutWaitUnit} onChange={(e) => set("timeoutWaitUnit", e.target.value)} className={inputClass}>
                      <option value="minutes">minuto(s)</option>
                      <option value="hours">hora(s)</option>
                    </select>
                  </div>
                  <p className="text-[10px] text-[var(--text-muted)] mt-1">Se ainda não responder → saída timeout</p>
                </div>
              </div>
            </div>
          );
        })()}

        {/* ── Condition ────────────────────────────────────────────────────── */}
        {type === "condition" && (() => {
          const d        = data as unknown as FlowConditionData;
          const fieldDef = getFieldDef(d.field);
          const fieldType = fieldDef?.type ?? "text";
          const operators = OPERATORS_BY_TYPE[fieldType];
          return (
            <div className="space-y-3">
              <div>
                <label className={labelClass}>Campo</label>
                <select value={d.field}
                  onChange={(e) => {
                    const def  = getFieldDef(e.target.value);
                    const type = def?.type ?? "text";
                    onUpdate(node.id, { ...data, field: e.target.value, operator: defaultOperator(type), value: defaultValue(e.target.value) });
                  }}
                  className={selectClass}>
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
              {(fieldDef?.type === "number" || fieldDef?.type === "text") && d.operator !== "empty" && d.operator !== "not_empty" && (
                <div>
                  <label className={labelClass}>Valor</label>
                  <input type={fieldDef.type === "number" ? "number" : "text"}
                    value={d.value} onChange={(e) => set("value", e.target.value)} className={inputClass} />
                </div>
              )}
              {fieldDef?.type === "select" && (
                <div>
                  <label className={labelClass}>Valor</label>
                  <select value={d.value} onChange={(e) => set("value", e.target.value)} className={selectClass}>
                    {fieldDef.options?.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
              )}
            </div>
          );
        })()}

        {/* ── Change Status ─────────────────────────────────────────────────── */}
        {type === "changeStatus" && (() => {
          const d = data as unknown as FlowChangeStatusData;
          return (
            <div className="space-y-3">
              <div>
                <label className={labelClass}>Ação</label>
                <select value={d.action}
                  onChange={(e) => onUpdate(node.id, { ...data, action: e.target.value, stageId: null, stageName: null })}
                  className={selectClass}>
                  <option value="stage">Mover para etapa do pipeline</option>
                  <option value="lost">Marcar como perdida</option>
                </select>
              </div>
              {d.action === "stage" && (
                <div>
                  <label className={labelClass}>Etapa</label>
                  <select value={d.stageId ?? ""}
                    onChange={(e) => {
                      const s = pipelineStages.find((s) => s.id === e.target.value);
                      onUpdate(node.id, { ...data, stageId: s?.id ?? null, stageName: s?.name ?? null });
                    }}
                    className={selectClass}>
                    <option value="">Selecione uma etapa…</option>
                    {pipelineStages.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
              )}
            </div>
          );
        })()}

        {/* ── Assign ───────────────────────────────────────────────────────── */}
        {type === "assign" && (() => {
          const d = data as unknown as FlowAssignData;
          return (
            <div>
              <label className={labelClass}>Consultor</label>
              {consultants.length > 0 ? (
                <select value={d.consultant} onChange={(e) => set("consultant", e.target.value)} className={selectClass}>
                  <option value="">Selecione…</option>
                  {consultants.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              ) : (
                <input type="text" value={d.consultant} onChange={(e) => set("consultant", e.target.value)}
                  placeholder="Nome do consultor" className={inputClass} />
              )}
            </div>
          );
        })()}

        {/* ── Add to Audience ───────────────────────────────────────────────── */}
        {type === "addToAudience" && (() => {
          const d = data as unknown as FlowAddToAudienceData;
          return (
            <div>
              <label className={labelClass}>Público</label>
              <select value={d.audienceId ?? ""}
                onChange={(e) => {
                  const a = audiences.find((a) => a.id === e.target.value);
                  onUpdate(node.id, { ...data, audienceId: a?.id ?? null, audienceName: a?.name ?? null });
                }}
                className={selectClass}>
                <option value="">Selecione um público…</option>
                {audiences.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
              <p className="text-xs text-[var(--text-muted)] mt-2">
                O lead será adicionado ao público selecionado, o que pode disparar outras jornadas ou fluxos.
              </p>
            </div>
          );
        })()}

        {/* ── Start Flow ────────────────────────────────────────────────────── */}
        {type === "startFlow" && (() => {
          const d = data as unknown as FlowStartFlowData;
          return (
            <div>
              <label className={labelClass}>Próximo fluxo</label>
              <select value={d.targetFlowId ?? ""}
                onChange={(e) => {
                  const f = flows.find((f) => f.id === e.target.value);
                  onUpdate(node.id, { ...data, targetFlowId: f?.id ?? null, targetFlowName: f?.name ?? null });
                }}
                className={selectClass}>
                <option value="">Selecione um fluxo…</option>
                {flows.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
              </select>
              <p className="text-xs text-[var(--text-muted)] mt-2">
                Este fluxo será encerrado e o lead iniciará o fluxo selecionado imediatamente.
              </p>
            </div>
          );
        })()}

        {/* ── End ──────────────────────────────────────────────────────────── */}
        {type === "end" && (
          <p className="text-sm text-[var(--text-muted)]">Este nó encerra o fluxo para o lead. Não há configurações adicionais.</p>
        )}
      </div>

      {/* Footer */}
      <div className="shrink-0 px-4 py-3 border-t border-[var(--border)] space-y-2">
        <button type="button" onClick={() => onDuplicate(node)}
          className="w-full flex items-center justify-center gap-2 h-9 rounded-xl text-sm font-medium border border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors">
          <Copy size={13} />
          Duplicar nó
        </button>
        <button type="button" onClick={handleDelete} onBlur={() => setConfirmDelete(false)}
          className={`w-full flex items-center justify-center gap-2 h-9 rounded-xl text-sm font-medium transition-colors ${
            confirmDelete
              ? "bg-[var(--danger)] text-white"
              : "border border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--danger)] hover:text-[var(--danger)]"
          }`}>
          <Trash2 size={13} />
          {confirmDelete ? "Confirmar remoção" : "Remover nó"}
        </button>
      </div>
    </div>
  );
}
