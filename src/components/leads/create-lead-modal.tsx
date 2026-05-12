"use client";

import { useRef, useState } from "react";
import { AlertTriangle, ChevronDown, ChevronUp, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { createLeadAction } from "@/app/(dashboard)/leads/actions";
import { CurrencyInput } from "@/components/ui/currency-input";
import { ConsultantSelect } from "@/components/leads/consultant-select";

const ESTADOS = ["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"];

interface Item {
  name: string;
  quantity: string;
  price: string;
}

function digitsOnly(value: string) {
  return value.replace(/\D/g, "");
}

function formatPhone(value: string) {
  const d = digitsOnly(value).slice(0, 11);
  if (d.length <= 2)  return d;
  if (d.length <= 7)  return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

function formatDocument(value: string) {
  const d = digitsOnly(value).slice(0, 14);
  if (d.length <= 11) {
    if (d.length <= 3)  return d;
    if (d.length <= 6)  return `${d.slice(0, 3)}.${d.slice(3)}`;
    if (d.length <= 9)  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
    return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
  }
  if (d.length <= 2)  return d;
  if (d.length <= 5)  return `${d.slice(0, 2)}.${d.slice(2)}`;
  if (d.length <= 8)  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5)}`;
  if (d.length <= 12) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8)}`;
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
}

function formatZipCode(value: string) {
  const d = digitsOnly(value).slice(0, 8);
  if (d.length <= 5) return d;
  return `${d.slice(0, 5)}-${d.slice(5)}`;
}

export function CreateLeadModal() {
  const [open, setOpen]       = useState(false);
  const [loading, setLoading] = useState(false);
  const [phone, setPhone]     = useState("");
  const [document, setDocument] = useState("");
  const [zipCode, setZipCode] = useState("");
  const [utmOpen, setUtmOpen] = useState(false);
  const [sellNow, setSellNow] = useState(false);
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

  function handleClose() {
    setOpen(false);
    setPhone(""); setDocument(""); setZipCode("");
    setUtmOpen(false); setSellNow(false); setItems([]);
    formRef.current?.reset();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const fd = new FormData(formRef.current!);
      if (sellNow) {
        items.forEach((item) => {
          fd.append("itemName",     item.name);
          fd.append("itemQuantity", item.quantity);
          fd.append("itemPrice",    item.price);
        });
      }
      const result = await createLeadAction(fd);
      if (result.duplicate) {
        toast.warning("Já existe uma lead ativa para este contato. Nenhuma ação foi tomada.");
      } else if (result.saleCreated) {
        toast.success("Lead criada e venda registrada com sucesso!");
      } else {
        toast.success("Lead criada com sucesso!");
      }
      handleClose();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Erro ao criar lead");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="btn-primary inline-flex items-center gap-2 px-4"
      >
        <Plus size={16} />
        Nova lead
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm">
          <div className="card max-h-[92vh] w-full max-w-xl overflow-y-auto">

            {/* Header */}
            <div className="sticky top-0 flex items-center justify-between border-b border-[var(--border)] bg-[var(--surface)]/96 px-6 py-4 backdrop-blur">
              <h2 className="text-base font-semibold text-[var(--text)]">Nova lead manual</h2>
              <button
                type="button"
                onClick={handleClose}
                className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--surface-muted)] text-[var(--text-muted)] hover:text-[var(--text)]"
              >
                <X size={18} />
              </button>
            </div>

            <form ref={formRef} onSubmit={handleSubmit} className="space-y-5 px-6 py-5">

              {/* Dados do contato */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">Nome *</label>
                  <input name="name" required className="input w-full" placeholder="Nome completo" />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">Telefone *</label>
                  <input
                    name="phone"
                    required
                    inputMode="numeric"
                    autoComplete="tel"
                    value={phone}
                    onChange={(e) => setPhone(formatPhone(e.target.value))}
                    className="input w-full"
                    placeholder="(11) 99999-8888"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">Email</label>
                  <input name="email" type="email" className="input w-full" placeholder="email@exemplo.com" />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">CPF / CNPJ</label>
                  <input
                    name="document"
                    inputMode="numeric"
                    value={document}
                    onChange={(e) => setDocument(formatDocument(e.target.value))}
                    className="input w-full"
                    placeholder="000.000.000-00"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">CEP</label>
                  <input
                    name="zipCode"
                    inputMode="numeric"
                    autoComplete="postal-code"
                    value={zipCode}
                    onChange={(e) => setZipCode(formatZipCode(e.target.value))}
                    className="input w-full"
                    placeholder="00000-000"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">Estado</label>
                  <select name="state" className="input w-full">
                    <option value="">—</option>
                    {ESTADOS.map((e) => <option key={e} value={e}>{e}</option>)}
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">Cidade</label>
                  <input name="city" className="input w-full" placeholder="São Paulo" />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">Consultor responsável</label>
                  <ConsultantSelect name="consultant" />
                </div>
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

              {/* Toggle — registrar venda agora */}
              <div className="soft-panel px-4 py-3">
                <label className="flex cursor-pointer items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-[var(--text)]">Registrar venda agora</p>
                    <p className="text-xs text-[var(--text-muted)] mt-0.5">
                      Cria a lead e registra a venda em um único passo
                    </p>
                  </div>
                  <div className="relative shrink-0">
                    <input
                      type="checkbox"
                      name="sellNow"
                      checked={sellNow}
                      onChange={(e) => setSellNow(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="h-5 w-9 rounded-full bg-[var(--border)] transition-colors peer-checked:bg-[var(--accent)]" />
                    <div className="absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform peer-checked:translate-x-4" />
                  </div>
                </label>

                {sellNow && (
                  <div className="mt-4 space-y-4 border-t border-[var(--border)] pt-4">

                    {/* Atenção */}
                    <div className="flex items-start gap-2 rounded-xl bg-[var(--warning-soft)] px-3 py-2.5">
                      <AlertTriangle size={14} className="mt-0.5 shrink-0 text-[var(--warning)]" />
                      <p className="text-xs text-[var(--warning)]">
                        Ao confirmar, um evento <strong>Lead</strong> e um evento <strong>Purchase</strong> serão
                        enviados ao Meta Conversions API.
                      </p>
                    </div>

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <div>
                        <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">
                          Data da venda *
                        </label>
                        <input
                          type="date"
                          name="soldAt"
                          required={sellNow}
                          defaultValue={new Date().toISOString().split("T")[0]}
                          max={new Date().toISOString().split("T")[0]}
                          className="input w-full"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">
                          Valor da venda (R$) *
                        </label>
                        <CurrencyInput name="saleValue" required={sellNow} className="input w-full" />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">
                        Observações da venda
                      </label>
                      <textarea
                        name="saleNotes"
                        rows={2}
                        className="input w-full resize-none"
                        placeholder="Detalhes sobre a venda..."
                      />
                    </div>

                    {/* Itens */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-xs font-medium text-[var(--text-muted)]">
                          Itens (opcional)
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
                              className="soft-panel grid grid-cols-1 items-center gap-2 p-3 sm:grid-cols-[minmax(0,1fr)_76px_100px_36px]"
                            >
                              <input
                                value={item.name}
                                onChange={(e) => updateItem(i, "name", e.target.value)}
                                className="input min-w-0"
                                placeholder="Produto"
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
                                className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--danger-soft)] text-[var(--danger)]"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={handleClose} className="flex-1 btn-secondary">
                  Cancelar
                </button>
                <button type="submit" disabled={loading} className="flex-1 btn-primary">
                  {loading
                    ? "Salvando..."
                    : sellNow
                    ? "Criar lead e registrar venda"
                    : "Criar lead"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
