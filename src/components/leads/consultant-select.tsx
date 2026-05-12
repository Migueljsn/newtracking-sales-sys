"use client";

import { useEffect, useRef, useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";

interface Props {
  name:         string;
  defaultValue?: string | null;
}

export function ConsultantSelect({ name, defaultValue }: Props) {
  const [consultants, setConsultants] = useState<string[]>([]);
  const [value, setValue]             = useState(defaultValue ?? "");
  const [adding, setAdding]           = useState(false);
  const [newName, setNewName]         = useState("");
  const [saving, setSaving]           = useState(false);
  const inputRef                      = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/consultants")
      .then((r) => r.json())
      .then((d: { consultants: string[] }) => setConsultants(d.consultants ?? []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (adding) inputRef.current?.focus();
  }, [adding]);

  async function handleAdd() {
    const trimmed = newName.trim();
    if (!trimmed) return;
    setSaving(true);
    try {
      const res  = await fetch("/api/consultants", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ name: trimmed }),
      });
      if (!res.ok) throw new Error("Falha ao salvar consultor");
      const data = await res.json() as { consultants: string[] };
      setConsultants(data.consultants ?? []);
      setValue(trimmed);
      setNewName("");
      setAdding(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao salvar consultor");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-2">
      <select
        name={name}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="input w-full"
      >
        <option value="">— Sem consultor —</option>
        {consultants.map((c) => (
          <option key={c} value={c}>{c}</option>
        ))}
      </select>

      {adding ? (
        <div className="flex gap-2">
          <input
            ref={inputRef}
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAdd(); } }}
            placeholder="Nome do consultor"
            className="input flex-1"
          />
          <button
            type="button"
            onClick={handleAdd}
            disabled={saving || !newName.trim()}
            className="btn-primary px-3 py-2 text-xs disabled:opacity-50"
          >
            {saving ? "..." : "Adicionar"}
          </button>
          <button
            type="button"
            onClick={() => { setAdding(false); setNewName(""); }}
            className="btn-secondary px-3 py-2 text-xs"
          >
            Cancelar
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="flex items-center gap-1 text-xs font-medium text-[var(--accent)] hover:text-[var(--accent-strong)]"
        >
          <Plus size={12} /> Adicionar consultor
        </button>
      )}
    </div>
  );
}
