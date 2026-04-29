"use client";

import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, ChevronUp, Pencil, X } from "lucide-react";
import { toast } from "sonner";
import { updateLeadAction } from "@/app/(dashboard)/leads/[id]/actions";

interface Props {
  leadId:      string;
  notes:       string | null;
  utmSource:   string | null;
  utmMedium:   string | null;
  utmCampaign: string | null;
  utmContent:  string | null;
  utmTerm:     string | null;
}

export function EditLeadModal({ leadId, notes, utmSource, utmMedium, utmCampaign, utmContent, utmTerm }: Props) {
  const [open, setOpen]       = useState(false);
  const [loading, setLoading] = useState(false);
  const [utmOpen, setUtmOpen] = useState(!!(utmSource || utmMedium || utmCampaign));
  const formRef               = useRef<HTMLFormElement>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await updateLeadAction(new FormData(formRef.current!));
      toast.success("Dados da lead atualizados");
      setOpen(false);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Erro ao salvar");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        title="Editar lead"
        className="flex h-8 w-8 items-center justify-center rounded-xl border border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors"
      >
        <Pencil size={14} />
      </button>

      {open && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm">
          <div className="card max-h-[90vh] w-full max-w-xl overflow-y-auto">
            <div className="sticky top-0 flex items-center justify-between border-b border-[var(--border)] bg-[var(--surface)]/96 px-6 py-4 backdrop-blur">
              <h2 className="text-base font-semibold text-[var(--text)]">Editar lead</h2>
              <button type="button" onClick={() => setOpen(false)} className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--surface-muted)] text-[var(--text-muted)] hover:text-[var(--text)]">
                <X size={18} />
              </button>
            </div>

            <form ref={formRef} onSubmit={handleSubmit} className="space-y-4 px-6 py-5">
              <input type="hidden" name="leadId" value={leadId} />

              <div>
                <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">Observações</label>
                <textarea
                  name="notes"
                  rows={3}
                  defaultValue={notes ?? ""}
                  className="input w-full resize-none"
                  placeholder="Notas sobre esta lead..."
                />
              </div>

              <div>
                <button
                  type="button"
                  onClick={() => setUtmOpen((v) => !v)}
                  className="flex items-center gap-1.5 text-xs font-medium text-[var(--accent)] hover:text-[var(--accent-strong)]"
                >
                  {utmOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  {utmOpen ? "Ocultar" : "Editar"} dados de campanha (UTM)
                </button>

                {utmOpen && (
                  <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {[
                      { name: "utmSource",   label: "UTM Source",   placeholder: "facebook",           dv: utmSource },
                      { name: "utmMedium",   label: "UTM Medium",   placeholder: "cpc",                dv: utmMedium },
                      { name: "utmCampaign", label: "UTM Campaign", placeholder: "nome-da-campanha",    dv: utmCampaign },
                      { name: "utmContent",  label: "UTM Content",  placeholder: "variação-do-anuncio", dv: utmContent },
                      { name: "utmTerm",     label: "UTM Term",     placeholder: "palavra-chave",       dv: utmTerm },
                    ].map(({ name, label, placeholder, dv }) => (
                      <div key={name}>
                        <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">{label}</label>
                        <input name={name} className="input w-full" placeholder={placeholder} defaultValue={dv ?? ""} />
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setOpen(false)} className="flex-1 btn-secondary">Cancelar</button>
                <button type="submit" disabled={loading} className="flex-1 btn-primary">
                  {loading ? "Salvando..." : "Salvar alterações"}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
