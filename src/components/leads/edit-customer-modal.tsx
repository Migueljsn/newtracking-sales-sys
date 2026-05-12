"use client";

import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Pencil, X } from "lucide-react";
import { toast } from "sonner";
import { updateCustomerAction } from "@/app/(dashboard)/leads/[id]/actions";

const ESTADOS = ["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"];

interface Customer {
  name:      string;
  phone:     string;
  email:     string | null;
  document:  string | null;
  zipCode:   string | null;
  city:      string | null;
  state:     string | null;
}

interface Props {
  leadId:   string;
  customer: Customer;
}

function digitsOnly(v: string) { return v.replace(/\D/g, ""); }

function formatPhone(v: string) {
  const d = digitsOnly(v).slice(0, 11);
  if (d.length <= 2)  return d;
  if (d.length <= 7)  return `(${d.slice(0,2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0,2)}) ${d.slice(2,6)}-${d.slice(6)}`;
  return `(${d.slice(0,2)}) ${d.slice(2,7)}-${d.slice(7)}`;
}

function formatDocument(v: string) {
  const d = digitsOnly(v).slice(0, 14);
  if (d.length <= 11) {
    if (d.length <= 3)  return d;
    if (d.length <= 6)  return `${d.slice(0,3)}.${d.slice(3)}`;
    if (d.length <= 9)  return `${d.slice(0,3)}.${d.slice(3,6)}.${d.slice(6)}`;
    return `${d.slice(0,3)}.${d.slice(3,6)}.${d.slice(6,9)}-${d.slice(9)}`;
  }
  if (d.length <= 2)  return d;
  if (d.length <= 5)  return `${d.slice(0,2)}.${d.slice(2)}`;
  if (d.length <= 8)  return `${d.slice(0,2)}.${d.slice(2,5)}.${d.slice(5)}`;
  if (d.length <= 12) return `${d.slice(0,2)}.${d.slice(2,5)}.${d.slice(5,8)}/${d.slice(8)}`;
  return `${d.slice(0,2)}.${d.slice(2,5)}.${d.slice(5,8)}/${d.slice(8,12)}-${d.slice(12)}`;
}

function formatZip(v: string) {
  const d = digitsOnly(v).slice(0, 8);
  return d.length <= 5 ? d : `${d.slice(0,5)}-${d.slice(5)}`;
}

export function EditCustomerModal({ leadId, customer }: Props) {
  const [open, setOpen]       = useState(false);
  const [loading, setLoading] = useState(false);
  const [phone, setPhone]     = useState(formatPhone(customer.phone));
  const [doc, setDoc]         = useState(customer.document ? formatDocument(customer.document) : "");
  const [zip, setZip]         = useState(customer.zipCode ? formatZip(customer.zipCode) : "");
  const formRef               = useRef<HTMLFormElement>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await updateCustomerAction(new FormData(formRef.current!));
      toast.success("Dados do contato atualizados");
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
        title="Editar contato"
        className="flex h-8 w-8 items-center justify-center rounded-xl border border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors"
      >
        <Pencil size={14} />
      </button>

      {open && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm">
          <div className="card max-h-[90vh] w-full max-w-xl overflow-y-auto">
            <div className="sticky top-0 flex items-center justify-between border-b border-[var(--border)] bg-[var(--surface)]/96 px-6 py-4 backdrop-blur">
              <h2 className="text-base font-semibold text-[var(--text)]">Editar dados do contato</h2>
              <button type="button" onClick={() => setOpen(false)} className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--surface-muted)] text-[var(--text-muted)] hover:text-[var(--text)]">
                <X size={18} />
              </button>
            </div>

            <form ref={formRef} onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 px-6 py-5 sm:grid-cols-2">
              <input type="hidden" name="leadId" value={leadId} />

              <div className="col-span-2">
                <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">Nome *</label>
                <input name="name" required defaultValue={customer.name} className="input w-full" />
              </div>

              <div className="col-span-2">
                <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">Telefone *</label>
                <input
                  name="phone"
                  required
                  inputMode="numeric"
                  value={phone}
                  onChange={(e) => setPhone(formatPhone(e.target.value))}
                  className="input w-full"
                  placeholder="(11) 99999-8888"
                />
              </div>

              <div className="col-span-2">
                <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">Email</label>
                <input name="email" type="email" defaultValue={customer.email ?? ""} className="input w-full" />
              </div>

              <div className="col-span-2">
                <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">CPF / CNPJ</label>
                <input
                  name="document"
                  inputMode="numeric"
                  value={doc}
                  onChange={(e) => setDoc(formatDocument(e.target.value))}
                  className="input w-full"
                  placeholder="000.000.000-00"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">CEP</label>
                <input
                  name="zipCode"
                  inputMode="numeric"
                  value={zip}
                  onChange={(e) => setZip(formatZip(e.target.value))}
                  className="input w-full"
                  placeholder="00000-000"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">Estado</label>
                <select name="state" defaultValue={customer.state ?? ""} className="input w-full">
                  <option value="">—</option>
                  {ESTADOS.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">Cidade</label>
                <input name="city" defaultValue={customer.city ?? ""} className="input w-full" />
              </div>

              <div className="col-span-2 flex gap-3 pt-2">
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
