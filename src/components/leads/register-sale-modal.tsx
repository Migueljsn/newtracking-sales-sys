"use client";

import { useRef, useState } from "react";
import { X, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { registerSaleAction } from "@/app/(dashboard)/leads/[id]/actions";
import { CurrencyInput } from "@/components/ui/currency-input";

interface Props {
  leadId: string;
  customerName: string;
}

interface Item {
  name: string;
  quantity: string;
  price: string;
}

export function RegisterSaleModal({ leadId, customerName }: Props) {
  const [open, setOpen]       = useState(false);
  const [loading, setLoading] = useState(false);
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
      await registerSaleAction(fd);
      toast.success("Venda registrada com sucesso!");
      setOpen(false);
      setItems([]);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Erro ao registrar venda");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="btn-primary px-5 py-2"
      >
        Registrar venda
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm">
          <div className="card max-h-[90vh] w-full max-w-2xl overflow-y-auto">
            <div className="sticky top-0 flex items-center justify-between border-b border-[var(--border)] bg-[var(--surface)]/96 px-6 py-4 backdrop-blur">
              <div>
                <h2 className="text-base font-semibold text-[var(--text)]">Registrar venda</h2>
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

            <form ref={formRef} onSubmit={handleSubmit} className="px-6 py-5 space-y-5">
              <input type="hidden" name="leadId" value={leadId} />

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
