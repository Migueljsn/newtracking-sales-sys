"use client";

import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Pencil, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { updateSaleAction } from "@/app/(dashboard)/leads/[id]/actions";
import { CurrencyInput } from "@/components/ui/currency-input";

interface SaleItem {
  id:       string;
  name:     string;
  quantity: number;
  price:    number;
}

interface Props {
  saleId:          string;
  defaultValue:    number;
  defaultNotes:    string | null;
  defaultItems:    SaleItem[];
  hasSuccessEvent: boolean;
}

interface Item {
  name:     string;
  quantity: string;
  price:    string;
}

export function EditSaleModal({ saleId, defaultValue, defaultNotes, defaultItems, hasSuccessEvent }: Props) {
  const [open, setOpen]       = useState(false);
  const [loading, setLoading] = useState(false);
  const [items, setItems]     = useState<Item[]>(() =>
    defaultItems.map((i) => ({ name: i.name, quantity: String(i.quantity), price: String(i.price) }))
  );
  const formRef = useRef<HTMLFormElement>(null);

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
      await updateSaleAction(fd);
      toast.success("Venda atualizada");
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
        title="Editar venda"
        className="flex h-8 w-8 items-center justify-center rounded-xl border border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors"
      >
        <Pencil size={14} />
      </button>

      {open && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm">
          <div className="card max-h-[90vh] w-full max-w-xl overflow-y-auto">
            <div className="sticky top-0 flex items-center justify-between border-b border-[var(--border)] bg-[var(--surface)]/96 px-6 py-4 backdrop-blur">
              <h2 className="text-base font-semibold text-[var(--text)]">Editar venda</h2>
              <button type="button" onClick={() => setOpen(false)} className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--surface-muted)] text-[var(--text-muted)] hover:text-[var(--text)]">
                <X size={18} />
              </button>
            </div>

            {hasSuccessEvent && (
              <div className="mx-6 mt-5 rounded-xl bg-[var(--warning-soft)] px-4 py-3 text-xs text-[var(--warning)]">
                O evento de tracking já foi enviado ao Meta. Alterar o valor aqui <strong>não</strong> reenvia o evento.
              </div>
            )}

            <form ref={formRef} onSubmit={handleSubmit} className="space-y-4 px-6 py-5">
              <input type="hidden" name="saleId" value={saleId} />

              <div>
                <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">Valor da venda (R$) *</label>
                <CurrencyInput name="value" required defaultValue={defaultValue} className="input w-full" />
              </div>

              <div>
                <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">Observações</label>
                <textarea
                  name="notes"
                  rows={2}
                  defaultValue={defaultNotes ?? ""}
                  className="input w-full resize-none"
                  placeholder="Detalhes sobre a venda..."
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-medium text-[var(--text-muted)]">Itens da venda</label>
                  <button type="button" onClick={addItem} className="link-accent flex items-center gap-1 text-xs">
                    <Plus size={13} /> Adicionar item
                  </button>
                </div>
                {items.length > 0 && (
                  <div className="space-y-2">
                    {items.map((item, i) => (
                      <div key={i} className="soft-panel grid grid-cols-1 items-center gap-2 p-3 sm:grid-cols-[minmax(0,1fr)_84px_110px_40px]">
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
