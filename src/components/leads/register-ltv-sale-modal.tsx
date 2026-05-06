"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, ChevronDown, ChevronUp, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { createLtvSaleAction } from "@/app/(dashboard)/leads/[id]/actions";
import { CurrencyInput } from "@/components/ui/currency-input";
import type { LeadStatus } from "@prisma/client";

interface Props {
  sourceLeadId:      string;
  customerName:      string;
  hasEmail:          boolean; // true = cliente não tem email cadastrado
  leadStatus:        LeadStatus;
  previousSalesCount: number;
}

interface Item {
  name: string;
  quantity: string;
  price: string;
}

export function RegisterLtvSaleModal({
  sourceLeadId,
  customerName,
  hasEmail,
  leadStatus,
  previousSalesCount,
}: Props) {
  const router = useRouter();

  const [open, setOpen]       = useState(false);
  const [loading, setLoading] = useState(false);
  const [utmOpen, setUtmOpen] = useState(false);
  const [items, setItems]     = useState<Item[]>([]);
  const formRef               = useRef<HTMLFormElement>(null);

  function addItem() {
    setItems((prev) => [...prev, { name: "", quantity: "1", price: "" }]);
  }

  function removeItem(i: number) {
    setItems((prev) => prev.filter((_, idx) => idx !== i));
  }

  function updateItem(i: number, field: keyof Item, value: string) {
    setItems((prev) => prev.map((item, idx) => idx === i ? { ...item, [field]: value } : item));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const fd = new FormData(formRef.current!);
      items.forEach((item) => {
        fd.append("itemName",     item.name);
        fd.append("itemQuantity", item.quantity);
        fd.append("itemPrice",    item.price);
      });
      const newLeadId = await createLtvSaleAction(fd);
      toast.success("Nova venda registrada! Redirecionando...");
      setOpen(false);
      setItems([]);
      router.push(`/leads/${newLeadId}`);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Erro ao registrar venda");
    } finally {
      setLoading(false);
    }
  }

  const isRepeat = previousSalesCount > 0;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="btn-primary px-5 py-2"
      >
        {isRepeat ? "Registrar recompra" : "Registrar venda"}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm">
          <div className="card max-h-[92vh] w-full max-w-2xl overflow-y-auto">

            {/* Header */}
            <div className="sticky top-0 flex items-center justify-between border-b border-[var(--border)] bg-[var(--surface)]/96 px-6 py-4 backdrop-blur">
              <div>
                <h2 className="text-base font-semibold text-[var(--text)]">
                  {isRepeat ? "Registrar recompra" : "Registrar venda"}
                </h2>
                <p className="text-xs text-[var(--text-muted)] mt-0.5">{customerName}</p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--surface-muted)] text-[var(--text-muted)] hover:text-[var(--text)]"
              >
                <X size={18} />
              </button>
            </div>

            {/* Warning banner */}
            <div className="mx-6 mt-5 flex items-start gap-3 rounded-xl border border-[var(--warning)] bg-[var(--warning-soft)] px-4 py-3">
              <AlertTriangle size={16} className="mt-0.5 shrink-0 text-[var(--warning)]" />
              <div className="text-sm text-[var(--warning)]">
                <p className="font-semibold">
                  {leadStatus === "SOLD"
                    ? "Esta lead já tem uma venda registrada."
                    : "Esta lead está marcada como perdida."}
                </p>
                <p className="mt-0.5 text-xs opacity-90">
                  Uma nova entrada será criada automaticamente para registrar esta{" "}
                  {isRepeat ? "recompra" : "venda"}.
                  {isRepeat && ` ${customerName} terá ${previousSalesCount + 1}ª venda no total.`}
                </p>
              </div>
            </div>

            <form ref={formRef} onSubmit={handleSubmit} className="space-y-5 px-6 py-5">
              <input type="hidden" name="sourceLeadId" value={sourceLeadId} />

              {/* Email opcional */}
              {hasEmail && (
                <div>
                  <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">
                    Email do cliente{" "}
                    <span className="font-normal">(não cadastrado — melhora match rate no Meta)</span>
                  </label>
                  <input
                    name="email"
                    type="email"
                    className="input w-full"
                    placeholder="email@exemplo.com"
                  />
                </div>
              )}

              {/* Data + Valor */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">
                    Data da venda *
                  </label>
                  <input
                    type="date"
                    name="soldAt"
                    required
                    defaultValue={new Date().toISOString().split("T")[0]}
                    max={new Date().toISOString().split("T")[0]}
                    className="input w-full"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">
                    Valor da venda (R$) *
                  </label>
                  <CurrencyInput name="value" required className="input w-full" />
                </div>
              </div>

              {/* Observações */}
              <div>
                <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">
                  Observações
                </label>
                <textarea
                  name="notes"
                  rows={2}
                  className="input w-full resize-none"
                  placeholder="Detalhes sobre a venda..."
                />
              </div>

              {/* UTMs colapsável */}
              <div>
                <button
                  type="button"
                  onClick={() => setUtmOpen((v) => !v)}
                  className="flex items-center gap-1.5 text-xs font-medium text-[var(--accent)] hover:text-[var(--accent-strong)]"
                >
                  {utmOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  {utmOpen ? "Ocultar" : "Adicionar"} dados de campanha (UTM)
                </button>

                {utmOpen && (
                  <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {[
                      { name: "utmSource",   label: "UTM Source",   placeholder: "facebook" },
                      { name: "utmMedium",   label: "UTM Medium",   placeholder: "cpc" },
                      { name: "utmCampaign", label: "UTM Campaign", placeholder: "nome-da-campanha" },
                      { name: "utmContent",  label: "UTM Content",  placeholder: "variação-do-anuncio" },
                      { name: "utmTerm",     label: "UTM Term",     placeholder: "palavra-chave" },
                    ].map(({ name, label, placeholder }) => (
                      <div key={name}>
                        <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">{label}</label>
                        <input name={name} className="input w-full" placeholder={placeholder} />
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Itens */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-medium text-[var(--text-muted)]">
                    Itens da venda (opcional)
                  </label>
                  <button type="button" onClick={addItem} className="link-accent flex items-center gap-1 text-xs">
                    <Plus size={13} /> Adicionar item
                  </button>
                </div>

                {items.length > 0 && (
                  <div className="space-y-2">
                    {items.map((item, i) => (
                      <div
                        key={i}
                        className="soft-panel grid grid-cols-1 items-center gap-2 p-3 sm:grid-cols-[minmax(0,1fr)_84px_110px_40px]"
                      >
                        <input
                          value={item.name}
                          onChange={(e) => updateItem(i, "name", e.target.value)}
                          className="input min-w-0"
                          placeholder="Produto / serviço"
                        />
                        <input
                          value={item.quantity}
                          onChange={(e) => updateItem(i, "quantity", e.target.value)}
                          type="number"
                          min="1"
                          className="input text-center"
                          placeholder="Qtd"
                        />
                        <input
                          value={item.price}
                          onChange={(e) => updateItem(i, "price", e.target.value)}
                          type="number"
                          step="0.01"
                          min="0"
                          className="input"
                          placeholder="Preço"
                        />
                        <button
                          type="button"
                          onClick={() => removeItem(i)}
                          className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--danger-soft)] text-[var(--danger)]"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setOpen(false)} className="flex-1 btn-secondary">
                  Cancelar
                </button>
                <button type="submit" disabled={loading} className="flex-1 btn-primary">
                  {loading ? "Salvando..." : "Confirmar venda"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
