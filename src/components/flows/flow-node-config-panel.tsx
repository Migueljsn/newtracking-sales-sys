"use client";

import { useState } from "react";
import { Node }     from "@xyflow/react";
import { X, Trash2, Copy, Plus, Type, MousePointerClick, Timer, ChevronUp, ChevronDown, FileText, Image, FileArchive, Sparkles } from "lucide-react";
import type {
  FlowNodeType, FlowTriggerData, FlowMessageData, FlowQuestionData,
  FlowConditionData, FlowChangeStatusData, FlowAssignData,
  FlowAddToAudienceData, FlowStartFlowData, FlowWaitData, FlowButton,
  FlowSequenceItem, FlowSeqMessage,
} from "@/lib/flows/types";
import { FIELD_DEFS, OPERATORS_BY_TYPE, getFieldDef, defaultOperator, defaultValue } from "@/lib/audiences/fields";
import { TextareaWithVars, InputWithVars } from "@/components/flows/field-with-vars";

type AudienceOption  = { id: string; name: string }
type PipelineStage   = { id: string; name: string }
type FlowOption      = { id: string; name: string }
type AgentOption     = { id: string; name: string }

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
  agents:         AgentOption[]
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
  audiences, pipelineStages, consultants, flows, agents,
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

          // Migração on-the-fly para formatos legados
          let seq: FlowSequenceItem[];
          if (d.sequence?.length) {
            seq = d.sequence;
          } else if (d.messages?.length) {
            seq = [];
            d.messages.forEach((m, i) => {
              if (i > 0 && m.delaySeconds > 0) seq.push({ kind: "delay", seconds: m.delaySeconds, typing: true });
              seq.push({ kind: "message", messageType: m.messageType, text: m.text, mediaUrl: m.mediaUrl, fileName: m.fileName });
            });
          } else {
            seq = [{ kind: "message", messageType: d.messageType ?? "text", text: d.text ?? "", mediaUrl: d.mediaUrl ?? null, fileName: d.fileName ?? null }];
          }

          function setSeq(next: FlowSequenceItem[]) { set("sequence", next); }
          function removeItem(idx: number) {
            const next = seq.filter((_, i) => i !== idx);
            setSeq(next.length ? next : [{ kind: "message", messageType: "text", text: "", mediaUrl: null, fileName: null }]);
          }
          function addMessage() {
            setSeq([...seq, { kind: "message", messageType: "text", text: "", mediaUrl: null, fileName: null }]);
          }
          function addDelay() {
            setSeq([...seq, { kind: "delay", seconds: 3, typing: true }]);
          }
          function patchMessage(idx: number, patch: Partial<FlowSeqMessage>) {
            setSeq(seq.map((item, i): FlowSequenceItem => {
              if (i !== idx || item.kind !== "message") return item;
              return { ...item, ...patch };
            }));
          }
          function patchDelay(idx: number, seconds: number) {
            setSeq(seq.map((item, i): FlowSequenceItem => i === idx && item.kind === "delay" ? { ...item, seconds } : item));
          }
          function moveItem(idx: number, dir: -1 | 1) {
            const next = [...seq];
            const target = idx + dir;
            if (target < 0 || target >= next.length) return;
            [next[idx], next[target]] = [next[target], next[idx]];
            setSeq(next);
          }
          function addMsg(messageType: "text" | "media" | "document") {
            setSeq([...seq, { kind: "message", messageType, text: "", mediaUrl: null, fileName: null }]);
          }

          const typeLabel: Record<string, string> = { text: "Texto", media: "Imagem", document: "Documento" };
          const canRemove  = seq.length > 1;

          return (
            <div className="space-y-2">
              {seq.map((item, idx) => {
                if (item.kind === "delay") {
                  return (
                    <div key={idx} className="rounded-xl border border-[var(--warning)] bg-[var(--warning-soft)] px-3 py-2.5">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-1.5 text-xs font-semibold text-[var(--warning)]">
                          <Timer size={13} />
                          Atraso — {item.seconds}s
                        </div>
                        <div className="flex items-center gap-0.5">
                          <button onClick={() => moveItem(idx, -1)} disabled={idx === 0}
                            className="text-[var(--warning)] hover:text-[var(--text)] disabled:opacity-20 transition-colors p-0.5">
                            <ChevronUp size={13} />
                          </button>
                          <button onClick={() => moveItem(idx, 1)} disabled={idx === seq.length - 1}
                            className="text-[var(--warning)] hover:text-[var(--text)] disabled:opacity-20 transition-colors p-0.5">
                            <ChevronDown size={13} />
                          </button>
                          <button onClick={() => removeItem(idx)} className="text-[var(--warning)] hover:text-[var(--danger)] transition-colors p-0.5 ml-1">
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-[10px] text-[var(--warning)] w-4 shrink-0">1s</span>
                        <input
                          type="range" min={1} max={10} step={1}
                          value={item.seconds}
                          onChange={(e) => patchDelay(idx, Number(e.target.value))}
                          className="flex-1 accent-[var(--warning)] h-1.5 cursor-pointer"
                        />
                        <span className="text-[10px] text-[var(--warning)] w-5 shrink-0 text-right">10s</span>
                      </div>
                      <label className="flex items-center gap-2 cursor-pointer select-none mt-1">
                        <input
                          type="checkbox"
                          checked={item.typing ?? true}
                          onChange={(e) => setSeq(seq.map((s, i): FlowSequenceItem =>
                            i === idx && s.kind === "delay" ? { ...s, typing: e.target.checked } : s
                          ))}
                          className="w-3.5 h-3.5 rounded accent-[var(--warning)] cursor-pointer"
                        />
                        <span className="text-xs text-[var(--warning)]">Ativar digitando</span>
                      </label>
                    </div>
                  );
                }

                // kind === "message"
                const msgIdx = seq.slice(0, idx).filter(i => i.kind === "message").length;
                return (
                  <div key={idx} className="rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] p-3 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-[var(--text-muted)]">
                        Mensagem {msgIdx + 1}
                        <span className="font-normal"> — {typeLabel[item.messageType]}</span>
                      </span>
                      <div className="flex items-center gap-0.5">
                        <button onClick={() => moveItem(idx, -1)} disabled={idx === 0}
                          className="text-[var(--text-muted)] hover:text-[var(--text)] disabled:opacity-20 transition-colors p-0.5">
                          <ChevronUp size={13} />
                        </button>
                        <button onClick={() => moveItem(idx, 1)} disabled={idx === seq.length - 1}
                          className="text-[var(--text-muted)] hover:text-[var(--text)] disabled:opacity-20 transition-colors p-0.5">
                          <ChevronDown size={13} />
                        </button>
                        {canRemove && (
                          <button onClick={() => removeItem(idx)} className="text-[var(--text-muted)] hover:text-[var(--danger)] transition-colors p-0.5 ml-1">
                            <Trash2 size={13} />
                          </button>
                        )}
                      </div>
                    </div>

                    {item.messageType === "text" && (
                      <div>
                        <label className={labelClass}>Mensagem</label>
                        <TextareaWithVars
                          rows={3}
                          value={item.text}
                          onChange={(v) => patchMessage(idx, { text: v })}
                          placeholder="Olá {nome}!"
                          className={taClass}
                        />
                      </div>
                    )}

                    {(item.messageType === "media" || item.messageType === "document") && (
                      <>
                        <div>
                          <label className={labelClass}>URL do arquivo</label>
                          <input
                            type="url"
                            value={item.mediaUrl ?? ""}
                            onChange={(e) => patchMessage(idx, { mediaUrl: e.target.value })}
                            placeholder="https://..."
                            className={inputClass}
                          />
                        </div>
                        {item.messageType === "document" && (
                          <div>
                            <label className={labelClass}>Nome do arquivo</label>
                            <input
                              type="text"
                              value={item.fileName ?? ""}
                              onChange={(e) => patchMessage(idx, { fileName: e.target.value })}
                              placeholder="catalogo.pdf"
                              className={inputClass}
                            />
                          </div>
                        )}
                        <div>
                          <label className={labelClass}>Legenda</label>
                          <TextareaWithVars
                            rows={2}
                            value={item.text}
                            onChange={(v) => patchMessage(idx, { text: v })}
                            placeholder="Opcional"
                            className={taClass}
                          />
                        </div>
                      </>
                    )}

                    <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-2.5 space-y-2">
                      <label className="flex items-center gap-2 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={item.aiRephrase?.enabled ?? false}
                          onChange={(e) => patchMessage(idx, {
                            aiRephrase: { enabled: e.target.checked, agentId: item.aiRephrase?.agentId ?? agents[0]?.id ?? null },
                          })}
                          className="w-3.5 h-3.5 rounded accent-[var(--accent)] cursor-pointer"
                        />
                        <span className="flex items-center gap-1 text-xs font-medium text-[var(--text)]">
                          <Sparkles size={12} className="text-[var(--accent)]" /> Variar com IA
                        </span>
                      </label>
                      {item.aiRephrase?.enabled && (
                        <>
                          <p className="text-[11px] text-[var(--text-muted)]">
                            A IA reescreve esse texto de um jeito diferente a cada envio (sem mudar fatos/números),
                            pra evitar disparos com texto idêntico.
                          </p>
                          <select
                            value={item.aiRephrase.agentId ?? ""}
                            onChange={(e) => patchMessage(idx, { aiRephrase: { enabled: true, agentId: e.target.value || null } })}
                            className={selectClass}
                          >
                            {agents.length === 0 && <option value="">Nenhum agente cadastrado</option>}
                            {agents.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                          </select>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}

              {/* Grade de adição */}
              <div className="grid grid-cols-2 gap-2 pt-1">
                {([
                  { label: "Texto",     icon: <FileText    size={12} />, action: () => addMsg("text"),     warn: false },
                  { label: "Imagem",    icon: <Image       size={12} />, action: () => addMsg("media"),    warn: false },
                  { label: "Documento", icon: <FileArchive size={12} />, action: () => addMsg("document"), warn: false },
                  { label: "Atraso",    icon: <Timer       size={12} />, action: addDelay,                 warn: true  },
                ] as const).map(({ label, icon, action, warn }) => (
                  <button key={label} type="button" onClick={action}
                    className={`flex items-center justify-center gap-1.5 rounded-xl border border-dashed py-2.5 text-xs font-semibold transition-colors ${
                      warn
                        ? "border-[var(--warning)] text-[var(--warning)] hover:bg-[var(--warning-soft)]"
                        : "border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--accent)] hover:text-[var(--accent)]"
                    }`}>
                    {icon} {label}
                  </button>
                ))}
              </div>

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
                    { value: "ai",     label: "Pergunta IA",  icon: <Sparkles size={12} /> },
                  ].map((opt) => (
                    <button key={opt.value} type="button"
                      onClick={() => onUpdate(node.id, {
                        ...data,
                        mode: opt.value,
                        ...(opt.value === "text" ? { buttons: [] } : {}),
                        ...(opt.value === "ai" && !d.aiAgentId ? { aiAgentId: agents[0]?.id ?? null } : {}),
                      })}
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

              {/* Pergunta (modos texto/botões — texto literal) */}
              {mode !== "ai" && (
                <div>
                  <label className={labelClass}>Pergunta</label>
                  <TextareaWithVars
                    rows={3}
                    value={d.questionText}
                    onChange={(v) => set("questionText", v)}
                    placeholder="Ex: Qual é o seu CNPJ? (apenas números)"
                    className={taClass}
                  />
                </div>
              )}

              {/* Modo ai (Pergunta IA): agente + o que capturar + campo + validação + retries */}
              {mode === "ai" && (
                <>
                  <div>
                    <label className={labelClass}>Agente</label>
                    <select value={d.aiAgentId ?? ""} onChange={(e) => set("aiAgentId", e.target.value || null)} className={selectClass}>
                      {agents.length === 0 && <option value="">Nenhum agente cadastrado</option>}
                      {agents.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                    </select>
                    <p className="text-[10px] text-[var(--text-muted)] mt-1">Persona usada pra gerar a pergunta e interpretar a resposta</p>
                  </div>
                  <div>
                    <label className={labelClass}>O que capturar do lead</label>
                    <TextareaWithVars
                      rows={2}
                      value={d.aiCaptureDescription ?? ""}
                      onChange={(v) => set("aiCaptureDescription", v)}
                      placeholder="Ex: o CNPJ da empresa do lead"
                      className={taClass}
                    />
                    <p className="text-[10px] text-[var(--text-muted)] mt-1">
                      A IA formula a pergunta a partir disso (variando a frase a cada tentativa) e extrai o valor da resposta livre do lead.
                    </p>
                  </div>
                  <div>
                    <label className={labelClass}>Salvar resposta no campo</label>
                    <select value={d.saveField} onChange={(e) => set("saveField", e.target.value)} className={selectClass}>
                      <optgroup label="Campos do lead">
                        <option value="name">Nome</option>
                        <option value="email">E-mail</option>
                        <option value="notes">Observações</option>
                      </optgroup>
                      <optgroup label="Dados coletados">
                        <option value="cnpj">CNPJ</option>
                        <option value="cep">CEP</option>
                        <option value="company">Empresa</option>
                        <option value="city">Cidade</option>
                        <option value="state">Estado (UF)</option>
                      </optgroup>
                    </select>
                  </div>
                  <div>
                    <label className={labelClass}>Validação do valor extraído</label>
                    <select value={d.validation} onChange={(e) => set("validation", e.target.value)} className={selectClass}>
                      {VALIDATION_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                    <p className="text-[10px] text-[var(--text-muted)] mt-1">
                      Depois da IA extrair o valor, ele ainda passa por esse validador determinístico — escolha "Nenhuma" pra respostas livres (ex: sim/não)
                    </p>
                  </div>
                  <div>
                    <label className={labelClass}>Tentativas se não conseguir capturar</label>
                    <select value={String(d.retries)} onChange={(e) => set("retries", Number(e.target.value))} className={selectClass}>
                      <option value="1">1 tentativa</option>
                      <option value="2">2 tentativas</option>
                      <option value="3">3 tentativas</option>
                    </select>
                    <p className="text-[10px] text-[var(--text-muted)] mt-1">A IA reformula a pergunta a cada nova tentativa, nunca repete a mesma frase</p>
                  </div>
                  <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] p-3 text-xs text-[var(--text-muted)] space-y-1">
                    <p>• Saída <strong className="text-[#10b981]">válido</strong> → IA capturou e o valor passou na validação</p>
                    <p>• Saída <strong className="text-[#ef4444]">inválido</strong> → esgotou tentativas sem capturar</p>
                    <p>• Saída <strong className="text-[#f97316]">timeout</strong> → não respondeu</p>
                  </div>
                </>
              )}

              {/* Modo texto: campo + validação + retries */}
              {mode === "text" && (
                <>
                  <div>
                    <label className={labelClass}>Salvar resposta no campo</label>
                    <select value={d.saveField} onChange={(e) => set("saveField", e.target.value)} className={selectClass}>
                      <optgroup label="Campos do lead">
                        <option value="name">Nome</option>
                        <option value="email">E-mail</option>
                        <option value="notes">Observações</option>
                      </optgroup>
                      <optgroup label="Dados coletados">
                        <option value="cnpj">CNPJ</option>
                        <option value="cep">CEP</option>
                        <option value="company">Empresa</option>
                        <option value="city">Cidade</option>
                        <option value="state">Estado (UF)</option>
                      </optgroup>
                    </select>
                    <p className="text-[10px] text-[var(--text-muted)] mt-1">Campos do lead atualizam o cadastro; dados coletados aparecem na seção de bot</p>
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
                        <InputWithVars
                          value={d.retryMessage}
                          onChange={(v) => set("retryMessage", v)}
                          placeholder="Resposta inválida, tente novamente:"
                          className={inputClass}
                        />
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
                  <InputWithVars
                    value={d.timeoutMessage}
                    onChange={(v) => set("timeoutMessage", v)}
                    placeholder="Ainda está aí? Aguardamos sua resposta 😊"
                    className={inputClass}
                  />
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

        {/* ── Wait ─────────────────────────────────────────────────────────── */}
        {type === "wait" && (() => {
          const d = data as unknown as FlowWaitData;
          const mode = d.mode ?? "duration";

          const UNITS = [
            { value: "minutes", label: "Minutos" },
            { value: "hours",   label: "Horas"   },
            { value: "days",    label: "Dias"     },
          ];

          return (
            <div className="space-y-4">
              {/* Tabs */}
              <div className="flex rounded-xl border border-[var(--border)] overflow-hidden">
                {(["duration", "datetime"] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => set("mode", m)}
                    className={`flex-1 py-2 text-xs font-semibold transition-colors ${
                      mode === m
                        ? "bg-[var(--text)] text-[var(--bg)]"
                        : "text-[var(--text-muted)] hover:text-[var(--text)]"
                    }`}
                  >
                    {m === "duration" ? "Duração" : "Data & Hora"}
                  </button>
                ))}
              </div>

              {/* Modo: Duração */}
              {mode === "duration" && (
                <div className="space-y-3">
                  <div>
                    <label className={labelClass}>Aguardar por</label>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        min={1}
                        value={d.value ?? 1}
                        onChange={(e) => set("value", Math.max(1, parseInt(e.target.value) || 1))}
                        className={inputClass + " w-24"}
                      />
                      <select
                        value={d.unit ?? "hours"}
                        onChange={(e) => set("unit", e.target.value)}
                        className={selectClass}
                      >
                        {UNITS.map((u) => (
                          <option key={u.value} value={u.value}>{u.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] p-3 text-xs text-[var(--text-muted)]">
                    O fluxo pausa exatamente por este tempo antes de continuar para o próximo nó.
                  </div>
                </div>
              )}

              {/* Modo: Data & Hora */}
              {mode === "datetime" && (
                <div className="space-y-3">
                  <div>
                    <label className={labelClass}>Continuar em</label>
                    <input
                      type="datetime-local"
                      value={d.datetime ?? ""}
                      onChange={(e) => set("datetime", e.target.value || null)}
                      className={inputClass}
                    />
                  </div>
                  <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] p-3 text-xs text-[var(--text-muted)]">
                    O fluxo pausa até a data e hora definidas, independente de quando o lead chegou aqui.
                  </div>
                </div>
              )}
            </div>
          );
        })()}

      </div>

      {/* Footer */}
      {type !== "trigger" && (
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
      )}
    </div>
  );
}
