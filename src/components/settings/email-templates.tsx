"use client";

import { useState, useTransition, useRef } from "react";
import { toast } from "sonner";
import {
  Plus, Pencil, Trash2, X, Copy, CheckSquare, Square,
  Mail, Eye, Code2, Send, MessageSquare, Image, Mic, FileText,
  ChevronDown,
} from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { createPortal } from "react-dom";
import {
  saveEmailTemplateAction,
  deleteEmailTemplateAction,
  duplicateEmailTemplateAction,
  bulkDeleteEmailTemplatesAction,
  bulkDuplicateEmailTemplatesAction,
  sendTestEmailAction,
} from "@/app/(dashboard)/settings/actions";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Template {
  id:           string;
  name:         string;
  channel:      string;
  subject:      string;
  body:         string;
  waType:       string | null;
  mediaUrl:     string | null;
  mediaCaption: string | null;
  isDefault:    boolean;
  clientId:     string | null;
}

interface Props {
  templates:  Template[];
  userEmail:  string;
  clientName: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const EMAIL_VARIABLES = [
  "{nome}", "{nome_completo}", "{telefone}", "{email}", "{consultor}",
  "{dias}", "{data_ultima_compra}", "{valor_ultima_compra}", "{total_compras}",
  "{valor_total_ltv}", "{empresa}",
];

const SAMPLE_VARS: Record<string, string> = {
  nome:                "João",
  nome_completo:       "João Silva",
  telefone:            "11999999999",
  email:               "joao@email.com",
  consultor:           "Maria Vendas",
  empresa:             "Empresa Exemplo",
  dias:                "15",
  data_ultima_compra:  new Date().toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" }),
  valor_ultima_compra: "R$ 350,00",
  total_compras:       "3",
  valor_total_ltv:     "R$ 1.050,00",
  unsub_url:           "#",
};

function renderSample(text: string, clientName: string) {
  const vars: Record<string, string> = { ...SAMPLE_VARS, empresa: clientName };
  return text.replace(/\{(\w+)\}|\((\w+)\)/g, (match, k1, k2) => vars[k1 ?? k2] ?? match);
}

function buildPreviewHtml(body: string, clientName: string): string {
  const rendered = renderSample(body, clientName);
  if (rendered.trimStart().toLowerCase().startsWith("<!doctype") || rendered.trimStart().startsWith("<html")) {
    return rendered;
  }
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;padding:16px;font-family:Arial,sans-serif;">${rendered}</body></html>`;
}

// ─── WhatsApp Bubble Preview ──────────────────────────────────────────────────

function WhatsAppBubble({ waType, body, mediaUrl, mediaCaption, clientName }: {
  waType: string; body: string; mediaUrl: string; mediaCaption: string; clientName: string;
}) {
  const text    = renderSample(body, clientName);
  const caption = renderSample(mediaCaption, clientName);
  const now     = new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

  return (
    <div className="flex flex-col items-center gap-3 py-4">
      {/* Fake WA header */}
      <div className="w-full max-w-xs rounded-2xl overflow-hidden shadow-lg">
        <div className="bg-[#075E54] flex items-center gap-2 px-3 py-2">
          <div className="w-7 h-7 rounded-full bg-[#128C7E] flex items-center justify-center">
            <MessageSquare size={14} className="text-white" />
          </div>
          <div>
            <p className="text-white text-xs font-semibold">{clientName}</p>
            <p className="text-[#8FD3CC] text-[10px]">online</p>
          </div>
        </div>

        {/* Chat area */}
        <div className="bg-[#ECE5DD] min-h-[180px] p-3 flex flex-col gap-1">
          {/* Bubble */}
          <div className="self-end max-w-[85%] bg-[#DCF8C6] rounded-2xl rounded-tr-sm shadow-sm overflow-hidden">

            {/* MEDIA */}
            {waType === "MEDIA" && (
              <div className="bg-[#c5e8a4] flex items-center justify-center min-h-[120px]">
                {mediaUrl ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={mediaUrl} alt="mídia" className="max-h-48 w-full object-cover" onError={(e) => { (e.target as HTMLElement).style.display="none"; }} />
                ) : (
                  <div className="flex flex-col items-center gap-1 py-6 px-4 text-[#128C7E]">
                    <Image size={28} />
                    <span className="text-[10px]">Imagem / Vídeo</span>
                  </div>
                )}
              </div>
            )}

            {/* AUDIO */}
            {waType === "AUDIO" && (
              <div className="flex items-center gap-2 px-3 py-2">
                <div className="w-8 h-8 rounded-full bg-[#128C7E] flex items-center justify-center shrink-0">
                  <Mic size={14} className="text-white" />
                </div>
                <div className="flex gap-0.5 items-end h-6">
                  {[3,5,8,5,3,7,4,6,9,5,3,6,8,4,5].map((h, i) => (
                    <div key={i} className="w-0.5 bg-[#128C7E] rounded-full" style={{ height: `${h * 2}px` }} />
                  ))}
                </div>
                <span className="text-[10px] text-[#667781] ml-1">0:12</span>
              </div>
            )}

            {/* TEXT body or media caption */}
            {(waType === "TEXT" || waType === "MEDIA") && (
              <div className="px-3 py-2">
                {waType === "MEDIA" && caption && (
                  <p className="text-[13px] text-[#111B21] leading-snug whitespace-pre-wrap">{caption}</p>
                )}
                {waType === "TEXT" && (
                  <p className="text-[13px] text-[#111B21] leading-snug whitespace-pre-wrap">{text || <span className="italic text-[#667781]">Mensagem vazia</span>}</p>
                )}
                <p className="text-[10px] text-[#667781] text-right mt-0.5">{now} ✓✓</p>
              </div>
            )}

            {waType === "AUDIO" && (
              <div className="px-3 pb-2">
                <p className="text-[10px] text-[#667781] text-right mt-0.5">{now} ✓✓</p>
              </div>
            )}
          </div>
        </div>
      </div>
      <p className="text-[10px] text-[var(--text-muted)] text-center">
        Prévia simulada — variáveis substituídas por dados de exemplo
      </p>
    </div>
  );
}

// ─── Channel Picker Modal ─────────────────────────────────────────────────────

function ChannelPickerModal({ onPick, onClose }: {
  onPick:  (channel: "EMAIL" | "WHATSAPP") => void;
  onClose: () => void;
}) {
  const modal = (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="card w-full max-w-sm p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-[var(--text)]">Novo template — escolha o canal</h3>
          <button onClick={onClose} className="text-[var(--text-muted)] hover:text-[var(--text)]"><X size={16} /></button>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => onPick("EMAIL")}
            className="flex flex-col items-center gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] p-5 hover:border-[var(--accent)] hover:bg-[var(--accent-soft)] transition-colors group"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/15 text-blue-500 group-hover:bg-blue-500/20">
              <Mail size={20} />
            </div>
            <div className="text-center">
              <p className="text-sm font-semibold text-[var(--text)]">E-mail</p>
              <p className="text-[11px] text-[var(--text-muted)] mt-0.5">HTML + assunto</p>
            </div>
          </button>
          <button
            type="button"
            onClick={() => onPick("WHATSAPP")}
            className="flex flex-col items-center gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] p-5 hover:border-[#25D366] hover:bg-[#25D366]/10 transition-colors group"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#25D366]/15 text-[#25D366] group-hover:bg-[#25D366]/20">
              <MessageSquare size={20} />
            </div>
            <div className="text-center">
              <p className="text-sm font-semibold text-[var(--text)]">WhatsApp</p>
              <p className="text-[11px] text-[var(--text-muted)] mt-0.5">Texto, mídia ou áudio</p>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
  return typeof window !== "undefined" ? createPortal(modal, document.body) : null;
}

// ─── WhatsApp Template Form ───────────────────────────────────────────────────

function WhatsAppTemplateModal({ template, onClose, clientName }: {
  template:   Partial<Template> | null;
  onClose:    () => void;
  clientName: string;
}) {
  const [loading,      setLoading]      = useState(false);
  const [waType,       setWaType]       = useState<"TEXT" | "MEDIA" | "AUDIO">(
    (template?.waType as "TEXT" | "MEDIA" | "AUDIO") ?? "TEXT"
  );
  const [body,         setBody]         = useState(template?.body ?? "");
  const [mediaUrl,     setMediaUrl]     = useState(template?.mediaUrl ?? "");
  const [mediaCaption, setMediaCaption] = useState(template?.mediaCaption ?? "");
  const [view,         setView]         = useState<"edit" | "preview">("edit");
  const bodyRef        = useRef<HTMLTextAreaElement>(null);
  const captionRef     = useRef<HTMLTextAreaElement>(null);
  const [lastFocused,  setLastFocused]  = useState<"body" | "caption">("body");

  function insertVariable(v: string) {
    const el = lastFocused === "body" ? bodyRef.current : captionRef.current;
    if (!el) return;
    const start = el.selectionStart ?? (lastFocused === "body" ? body : mediaCaption).length;
    const end   = el.selectionEnd ?? start;
    if (lastFocused === "body") setBody(body.slice(0, start) + v + body.slice(end));
    else setMediaCaption(mediaCaption.slice(0, start) + v + mediaCaption.slice(end));
    setTimeout(() => { el.focus(); el.setSelectionRange(start + v.length, start + v.length); }, 0);
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    try {
      const fd = new FormData(e.currentTarget);
      await saveEmailTemplateAction(fd);
      toast.success(template?.id ? "Template atualizado" : "Template criado");
      onClose();
    } catch {
      toast.error("Erro ao salvar template");
    } finally {
      setLoading(false);
    }
  }

  const waTypeOptions: { value: "TEXT" | "MEDIA" | "AUDIO"; label: string; icon: React.ReactNode; desc: string }[] = [
    { value: "TEXT",  label: "Texto",   icon: <FileText   size={14} />, desc: "Mensagem de texto simples" },
    { value: "MEDIA", label: "Mídia",   icon: <Image      size={14} />, desc: "Imagem, vídeo ou documento + legenda" },
    { value: "AUDIO", label: "Áudio",   icon: <Mic        size={14} />, desc: "Áudio push-to-talk" },
  ];

  const modal = (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className={`card flex flex-col w-full max-h-[92vh] p-6 gap-4 transition-all ${view === "preview" ? "max-w-sm" : "max-w-xl"}`}>

        <div className="flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded-md bg-[#25D366]/15">
              <MessageSquare size={13} className="text-[#25D366]" />
            </div>
            <h3 className="text-sm font-semibold text-[var(--text)]">
              {template?.id ? "Editar template WhatsApp" : "Novo template WhatsApp"}
            </h3>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] p-0.5">
              <button type="button" onClick={() => setView("edit")} className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${view === "edit" ? "bg-[var(--surface)] text-[var(--text)] shadow-sm" : "text-[var(--text-muted)] hover:text-[var(--text)]"}`}>
                <Code2 size={12} /> Editar
              </button>
              <button type="button" onClick={() => setView("preview")} className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${view === "preview" ? "bg-[var(--surface)] text-[var(--text)] shadow-sm" : "text-[var(--text-muted)] hover:text-[var(--text)]"}`}>
                <Eye size={12} /> Prévia
              </button>
            </div>
            <button onClick={onClose} className="text-[var(--text-muted)] hover:text-[var(--text)]"><X size={16} /></button>
          </div>
        </div>

        {view === "edit" ? (
          <form onSubmit={handleSubmit} className="space-y-4 overflow-y-auto">
            {template?.id && <input type="hidden" name="id" value={template.id} />}
            <input type="hidden" name="channel" value="WHATSAPP" />
            <input type="hidden" name="waType" value={waType} />
            <input type="hidden" name="body" value={body} />
            <input type="hidden" name="mediaCaption" value={mediaCaption} />

            <div>
              <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">Nome do template</label>
              <input name="name" defaultValue={template?.name ?? ""} required className="input w-full" placeholder="Ex: Promoção verão WA" />
            </div>

            {/* Type selector */}
            <div>
              <label className="block text-xs font-medium text-[var(--text-muted)] mb-2">Tipo de mensagem</label>
              <div className="grid grid-cols-3 gap-2">
                {waTypeOptions.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setWaType(opt.value)}
                    className={`flex flex-col items-center gap-1.5 rounded-xl border p-3 text-center transition-colors ${
                      waType === opt.value
                        ? "border-[#25D366] bg-[#25D366]/10 text-[#25D366]"
                        : "border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--text-muted)]"
                    }`}
                  >
                    {opt.icon}
                    <span className="text-xs font-medium">{opt.label}</span>
                    <span className="text-[10px] leading-tight opacity-70">{opt.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Media URL */}
            {(waType === "MEDIA" || waType === "AUDIO") && (
              <div>
                <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">
                  {waType === "AUDIO" ? "URL do áudio (mp3/ogg)" : "URL da mídia (imagem/vídeo/doc)"}
                </label>
                <input
                  name="mediaUrl"
                  value={mediaUrl}
                  onChange={(e) => setMediaUrl(e.target.value)}
                  className="input w-full"
                  placeholder="https://..."
                />
              </div>
            )}

            {/* Message body — TEXT or MEDIA caption */}
            {waType === "TEXT" && (
              <div>
                <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">Mensagem</label>
                <textarea
                  ref={bodyRef}
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  onFocus={() => setLastFocused("body")}
                  required
                  rows={5}
                  className="input w-full"
                  placeholder="Olá, {nome}! Temos uma oferta especial para você..."
                />
              </div>
            )}

            {waType === "MEDIA" && (
              <div>
                <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">Legenda (opcional)</label>
                <textarea
                  ref={captionRef}
                  value={mediaCaption}
                  onChange={(e) => setMediaCaption(e.target.value)}
                  onFocus={() => setLastFocused("caption")}
                  rows={3}
                  className="input w-full"
                  placeholder="Olá, {nome}! Confira nossa promoção..."
                />
              </div>
            )}

            {/* Variables */}
            {waType !== "AUDIO" && (
              <div>
                <p className="text-xs font-medium text-[var(--text-muted)] mb-2">Variáveis — clique para inserir:</p>
                <div className="flex flex-wrap gap-1.5">
                  {EMAIL_VARIABLES.map((v) => (
                    <button
                      key={v} type="button" onClick={() => insertVariable(v)}
                      className="rounded bg-[var(--surface-muted)] border border-[var(--border)] px-2 py-0.5 text-xs text-[var(--accent)] font-mono hover:border-[var(--accent)] hover:bg-[var(--accent-soft)] transition-colors"
                    >
                      {v}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-2 justify-end pt-2">
              <button type="button" onClick={onClose} className="btn-secondary px-4 py-2 text-sm">Cancelar</button>
              <button type="submit" disabled={loading} className="btn-primary flex items-center gap-2 px-4 py-2 text-sm">
                {loading ? <Spinner size={14} /> : null}
                {loading ? "Salvando..." : "Salvar template"}
              </button>
            </div>
          </form>
        ) : (
          <div className="overflow-y-auto">
            <WhatsAppBubble
              waType={waType}
              body={body}
              mediaUrl={mediaUrl}
              mediaCaption={mediaCaption}
              clientName={clientName}
            />
          </div>
        )}
      </div>
    </div>
  );

  return typeof window !== "undefined" ? createPortal(modal, document.body) : null;
}

// ─── Email Template Modal ─────────────────────────────────────────────────────

function EmailTemplateModal({ template, onClose, userEmail, clientName }: {
  template:   Partial<Template> | null;
  onClose:    () => void;
  userEmail:  string;
  clientName: string;
}) {
  const [loading,     setLoading]     = useState(false);
  const [subject,     setSubject]     = useState(template?.subject ?? "");
  const [body,        setBody]        = useState(template?.body    ?? "");
  const [lastFocused, setLastFocused] = useState<"subject" | "body">("body");
  const [view,        setView]        = useState<"edit" | "preview">("edit");
  const [testEmail,   setTestEmail]   = useState(userEmail);
  const [sendingTest, startSendTest]  = useTransition();
  const subjectRef = useRef<HTMLInputElement>(null);
  const bodyRef    = useRef<HTMLTextAreaElement>(null);

  function insertVariable(v: string) {
    const isSubject = lastFocused === "subject";
    const el        = isSubject ? subjectRef.current : bodyRef.current;
    if (!el) return;
    const start = el.selectionStart ?? (isSubject ? subject : body).length;
    const end   = el.selectionEnd   ?? start;
    if (isSubject) setSubject(subject.slice(0, start) + v + subject.slice(end));
    else           setBody(body.slice(0, start) + v + body.slice(end));
    setTimeout(() => { el.focus(); el.setSelectionRange(start + v.length, start + v.length); }, 0);
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

  function handleSendTest() {
    startSendTest(async () => {
      try {
        await sendTestEmailAction(subject, body, testEmail);
        toast.success(`E-mail de teste enviado para ${testEmail}`);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Erro ao enviar teste");
      }
    });
  }

  const previewSubject = renderSample(subject, clientName);
  const previewHtml    = buildPreviewHtml(body, clientName);

  const modal = (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className={`card flex flex-col w-full max-h-[92vh] p-6 gap-4 transition-all ${view === "preview" ? "max-w-4xl" : "max-w-2xl"}`}>

        <div className="flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded-md bg-blue-500/15">
              <Mail size={13} className="text-blue-500" />
            </div>
            <h3 className="text-sm font-semibold text-[var(--text)]">
              {template?.id ? "Editar template E-mail" : "Novo template E-mail"}
            </h3>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] p-0.5">
              <button type="button" onClick={() => setView("edit")} className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${view === "edit" ? "bg-[var(--surface)] text-[var(--text)] shadow-sm" : "text-[var(--text-muted)] hover:text-[var(--text)]"}`}>
                <Code2 size={12} /> Editar
              </button>
              <button type="button" onClick={() => setView("preview")} className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${view === "preview" ? "bg-[var(--surface)] text-[var(--text)] shadow-sm" : "text-[var(--text-muted)] hover:text-[var(--text)]"}`}>
                <Eye size={12} /> Prévia
              </button>
            </div>
            <button onClick={onClose} className="text-[var(--text-muted)] hover:text-[var(--text)]"><X size={16} /></button>
          </div>
        </div>

        {view === "edit" && (
          <form onSubmit={handleSubmit} className="space-y-4 overflow-y-auto">
            {template?.id && <input type="hidden" name="id" value={template.id} />}
            <input type="hidden" name="channel" value="EMAIL" />

            <div>
              <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">Nome do template</label>
              <input name="name" defaultValue={template?.name ?? ""} required className="input w-full" placeholder="Ex: Reengajamento verão" />
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">Assunto</label>
              <input
                ref={subjectRef} name="subject" value={subject}
                onChange={e => setSubject(e.target.value)} onFocus={() => setLastFocused("subject")}
                required className="input w-full" placeholder="Ex: {nome}, temos uma oferta especial para você!"
              />
              <p className="text-xs text-[var(--text-muted)] mt-1">O assunto é o fator mais importante para taxa de abertura.</p>
            </div>
            <div>
              <label className="text-xs font-medium text-[var(--text-muted)]">Corpo do e-mail (HTML)</label>
              <textarea
                ref={bodyRef} name="body" value={body}
                onChange={e => setBody(e.target.value)} onFocus={() => setLastFocused("body")}
                required rows={10} className="input w-full font-mono text-xs mt-1"
                placeholder="<p>Olá, {nome}! ...</p>"
              />
            </div>
            <div>
              <p className="text-xs font-medium text-[var(--text-muted)] mb-2">Variáveis — clique para inserir no campo em foco:</p>
              <div className="flex flex-wrap gap-1.5">
                {EMAIL_VARIABLES.map(v => (
                  <button key={v} type="button" onClick={() => insertVariable(v)}
                    className="rounded bg-[var(--surface-muted)] border border-[var(--border)] px-2 py-0.5 text-xs text-[var(--accent)] font-mono hover:border-[var(--accent)] hover:bg-[var(--accent-soft)] transition-colors">
                    {v}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex gap-2 justify-end pt-2">
              <button type="button" onClick={onClose} className="btn-secondary px-4 py-2 text-sm">Cancelar</button>
              <button type="submit" disabled={loading} className="btn-primary flex items-center gap-2 px-4 py-2 text-sm">
                {loading ? <Spinner size={14} /> : null}
                {loading ? "Salvando..." : "Salvar template"}
              </button>
            </div>
          </form>
        )}

        {view === "preview" && (
          <div className="flex flex-col gap-4 overflow-hidden min-h-0">
            <div className="shrink-0 rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-3">
              <span className="text-xs text-[var(--text-muted)] font-semibold uppercase tracking-wide">Assunto: </span>
              <span className="text-sm text-[var(--text)]">{previewSubject || <span className="italic text-[var(--text-muted)]">sem assunto</span>}</span>
            </div>
            <div className="flex-1 overflow-hidden rounded-xl border border-[var(--border)] bg-white min-h-[400px]">
              <iframe srcDoc={previewHtml} sandbox="allow-same-origin" className="w-full h-full" style={{ minHeight: 400 }} title="Prévia do e-mail" />
            </div>
            <p className="shrink-0 text-[10px] text-[var(--text-muted)] text-center">
              Variáveis substituídas por dados de exemplo. Renderização pode diferir levemente do Outlook desktop.
            </p>
            <div className="shrink-0 flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-2.5">
              <Send size={13} className="text-[var(--text-muted)] shrink-0" />
              <input type="email" value={testEmail} onChange={e => setTestEmail(e.target.value)} placeholder="seu@email.com"
                className="flex-1 bg-transparent text-sm text-[var(--text)] outline-none placeholder:text-[var(--text-muted)]" />
              <button type="button" onClick={handleSendTest} disabled={sendingTest || !testEmail}
                className="flex items-center gap-1.5 rounded-lg bg-[var(--accent)] px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50 shrink-0">
                {sendingTest ? <Spinner size={12} /> : <Send size={12} />}
                {sendingTest ? "Enviando..." : "Enviar teste"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  return typeof window !== "undefined" ? createPortal(modal, document.body) : null;
}

// ─── Channel Badge ────────────────────────────────────────────────────────────

function ChannelBadge({ channel, waType }: { channel: string; waType: string | null }) {
  if (channel === "WHATSAPP") {
    const icons: Record<string, React.ReactNode> = {
      TEXT:  <FileText  size={9} />,
      MEDIA: <Image     size={9} />,
      AUDIO: <Mic       size={9} />,
    };
    const labels: Record<string, string> = { TEXT: "Texto", MEDIA: "Mídia", AUDIO: "Áudio" };
    return (
      <span className="flex items-center gap-1 rounded-full bg-[#25D366]/15 px-2 py-0.5 text-[10px] font-semibold text-[#25D366] shrink-0">
        <MessageSquare size={9} />
        WA {waType ? `· ${labels[waType] ?? waType}` : ""}
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1 rounded-full bg-blue-500/15 px-2 py-0.5 text-[10px] font-semibold text-blue-500 shrink-0">
      <Mail size={9} />
      E-mail
    </span>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

type ChannelFilter = "all" | "EMAIL" | "WHATSAPP";

export function EmailTemplates({ templates, userEmail, clientName }: Props) {
  const [filter,      setFilter]      = useState<ChannelFilter>("all");
  const [editing,     setEditing]     = useState<Partial<Template> | null>(null);
  const [modalOpen,   setModalOpen]   = useState(false);
  const [pickerOpen,  setPickerOpen]  = useState(false);
  const [activeChannel, setActiveChannel] = useState<"EMAIL" | "WHATSAPP">("EMAIL");

  const [selected,       setSelected]       = useState<Set<string>>(new Set());
  const [confirmDelete,  setConfirmDelete]  = useState<string | null>(null);
  const [confirmDup,     setConfirmDup]     = useState<string | null>(null);
  const [confirmBulkDel, setConfirmBulkDel] = useState(false);
  const [confirmBulkDup, setConfirmBulkDup] = useState(false);

  const [deleting,        startDelete]        = useTransition();
  const [duplicating,     startDuplicate]     = useTransition();
  const [bulkDeleting,    startBulkDelete]    = useTransition();
  const [bulkDuplicating, startBulkDuplicate] = useTransition();

  const filtered      = filter === "all" ? templates : templates.filter(t => t.channel === filter);
  const selectableIds = filtered.filter(t => !t.isDefault).map(t => t.id);
  const allSelected   = selectableIds.length > 0 && selectableIds.every(id => selected.has(id));

  const emailCount = templates.filter(t => t.channel === "EMAIL").length;
  const waCount    = templates.filter(t => t.channel === "WHATSAPP").length;

  function openNew(channel: "EMAIL" | "WHATSAPP") {
    setActiveChannel(channel);
    setEditing({});
    setModalOpen(true);
    setPickerOpen(false);
  }

  function openEdit(t: Template) {
    setActiveChannel(t.channel as "EMAIL" | "WHATSAPP");
    setEditing(t);
    setModalOpen(true);
    setConfirmDelete(null);
    setConfirmDup(null);
  }

  function closeModal() { setModalOpen(false); setEditing(null); }

  function toggleSelect(id: string) {
    setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
    setConfirmDelete(null); setConfirmDup(null); setConfirmBulkDel(false);
  }
  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(selectableIds));
    setConfirmBulkDel(false); setConfirmBulkDup(false);
  }
  function clearSelection() {
    setSelected(new Set()); setConfirmBulkDel(false); setConfirmBulkDup(false);
  }

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
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          {/* Channel filter tabs */}
          <div className="flex rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] p-0.5">
            {([
              { key: "all",      label: `Todos (${templates.length})`  },
              { key: "EMAIL",    label: `E-mail (${emailCount})`       },
              { key: "WHATSAPP", label: `WhatsApp (${waCount})`        },
            ] as { key: ChannelFilter; label: string }[]).map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => { setFilter(tab.key); clearSelection(); }}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                  filter === tab.key
                    ? "bg-[var(--surface)] text-[var(--text)] shadow-sm"
                    : "text-[var(--text-muted)] hover:text-[var(--text)]"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {selectableIds.length > 0 && (
            <button type="button" onClick={toggleAll}
              className="flex items-center gap-1.5 text-[var(--text-muted)] hover:text-[var(--text)] transition-colors" title={allSelected ? "Desmarcar todos" : "Selecionar todos"}>
              {allSelected ? <CheckSquare size={16} className="text-[var(--accent)]" /> : <Square size={16} />}
              <span className="text-xs">Selecionar todos</span>
            </button>
          )}
        </div>

        {/* New template button */}
        <button onClick={() => setPickerOpen(true)} className="flex items-center gap-1.5 btn-primary text-xs px-3 py-2">
          <Plus size={13} /> Novo template
        </button>
      </div>

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div className="flex items-center gap-3 rounded-xl border border-[var(--accent)] bg-[var(--accent-soft)] px-4 py-2.5">
          <span className="text-sm font-medium text-[var(--accent)]">{selected.size} selecionado{selected.size !== 1 ? "s" : ""}</span>
          <div className="flex-1" />
          <button type="button" onClick={handleBulkDuplicate} disabled={bulkDuplicating}
            className={`flex items-center gap-1.5 h-8 rounded-lg px-3 text-sm font-medium transition-colors disabled:opacity-50 ${confirmBulkDup ? "bg-[var(--accent)] text-white" : "border border-[var(--accent)] text-[var(--accent)] hover:bg-white/20"}`}>
            {bulkDuplicating ? <Spinner size={13} /> : <Copy size={13} />}
            {confirmBulkDup ? "Confirmar duplicação" : "Duplicar selecionados"}
          </button>
          <button type="button" onClick={handleBulkDelete} disabled={bulkDeleting}
            className={`flex items-center gap-1.5 h-8 rounded-lg px-3 text-sm font-medium transition-colors disabled:opacity-50 ${confirmBulkDel ? "bg-[var(--danger)] text-white" : "border border-[var(--danger)] text-[var(--danger)] hover:bg-[var(--danger-soft)]"}`}>
            {bulkDeleting ? <Spinner size={13} /> : <Trash2 size={13} />}
            {confirmBulkDel ? "Confirmar exclusão" : "Excluir selecionados"}
          </button>
          <button type="button" onClick={clearSelection} className="text-sm text-[var(--text-muted)] hover:text-[var(--text)] transition-colors">Cancelar</button>
        </div>
      )}

      {/* List */}
      <div className="space-y-2">
        {filtered.map(t => {
          const isSelected   = selected.has(t.id);
          const isDeletingMe = confirmDelete === t.id;
          const isDupMe      = confirmDup    === t.id;

          return (
            <div key={t.id} className={`flex items-center gap-3 rounded-xl border px-4 py-3 transition-colors ${
              isSelected ? "border-[var(--accent)] bg-[var(--accent-soft)]" : "border-[var(--border)] bg-[var(--surface-muted)]"
            }`}>
              {/* Checkbox */}
              {!t.isDefault ? (
                <button type="button" onClick={() => toggleSelect(t.id)}
                  className="shrink-0 text-[var(--text-muted)] hover:text-[var(--accent)] transition-colors">
                  {isSelected ? <CheckSquare size={16} className="text-[var(--accent)]" /> : <Square size={16} />}
                </button>
              ) : (
                <div className="w-4 shrink-0" />
              )}

              {/* Icon */}
              <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                t.channel === "WHATSAPP" ? "bg-[#25D366]/15" : "bg-blue-500/15"
              }`}>
                {t.channel === "WHATSAPP"
                  ? <MessageSquare size={14} className="text-[#25D366]" />
                  : <Mail          size={14} className="text-blue-500"  />}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-[var(--text)] truncate">{t.name}</span>
                  {t.isDefault && (
                    <span className="text-[10px] rounded-full bg-[var(--border)] px-2 py-0.5 text-[var(--text-muted)] shrink-0">padrão</span>
                  )}
                  <ChannelBadge channel={t.channel} waType={t.waType} />
                </div>
                <p className="text-xs text-[var(--text-muted)] truncate mt-0.5">
                  {t.channel === "EMAIL" ? t.subject : (t.body?.slice(0, 60) || t.mediaCaption?.slice(0, 60) || "—")}
                </p>
              </div>

              {/* Actions */}
              {!t.isDefault && (
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => openEdit(t)}
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--text-muted)] hover:bg-[var(--surface-strong)] hover:text-[var(--text)] transition-colors" title="Editar">
                    <Pencil size={13} />
                  </button>
                  <button onClick={() => handleDuplicate(t.id)} disabled={duplicating}
                    className={`flex h-8 w-8 items-center justify-center rounded-lg transition-colors disabled:opacity-50 ${isDupMe ? "bg-[var(--accent)] text-white" : "text-[var(--text-muted)] hover:bg-[var(--surface-strong)] hover:text-[var(--text)]"}`}
                    title={isDupMe ? "Clique novamente para confirmar" : "Duplicar"}>
                    {duplicating ? <Spinner size={13} /> : <Copy size={13} />}
                  </button>
                  <button onClick={() => handleDelete(t.id)} disabled={deleting}
                    className={`flex h-8 w-8 items-center justify-center rounded-lg transition-colors disabled:opacity-50 ${isDeletingMe ? "bg-[var(--danger)] text-white" : "text-[var(--text-muted)] hover:bg-[var(--danger-soft)] hover:text-[var(--danger)]"}`}
                    title={isDeletingMe ? "Clique novamente para confirmar" : "Excluir"}>
                    {deleting ? <Spinner size={13} /> : <Trash2 size={13} />}
                  </button>
                </div>
              )}
            </div>
          );
        })}

        {filtered.length === 0 && (
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] py-10 text-center">
            <p className="text-sm text-[var(--text-muted)]">Nenhum template cadastrado.</p>
          </div>
        )}
      </div>

      {/* Channel picker */}
      {pickerOpen && (
        <ChannelPickerModal onPick={openNew} onClose={() => setPickerOpen(false)} />
      )}

      {/* Template modals */}
      {modalOpen && activeChannel === "EMAIL" && (
        <EmailTemplateModal template={editing} onClose={closeModal} userEmail={userEmail} clientName={clientName} />
      )}
      {modalOpen && activeChannel === "WHATSAPP" && (
        <WhatsAppTemplateModal template={editing} onClose={closeModal} clientName={clientName} />
      )}
    </div>
  );
}
