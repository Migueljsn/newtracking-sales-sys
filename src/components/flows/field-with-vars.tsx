"use client";

import { useRef, useState, useEffect } from "react";
import { Braces } from "lucide-react";

const VARS = [
  { key: "nome",          label: "Primeiro nome" },
  { key: "nome_completo", label: "Nome completo" },
  { key: "telefone",      label: "Telefone"      },
  { key: "email",         label: "E-mail"        },
  { key: "cidade",        label: "Cidade"        },
  { key: "estado",        label: "Estado (UF)"   },
  { key: "documento",     label: "CPF / CNPJ"    },
];

function VarsDropdown({
  onSelect,
  onClose,
}: {
  onSelect: (key: string) => void;
  onClose:  () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  return (
    <div
      ref={ref}
      className="absolute right-0 bottom-full mb-1 z-50 w-48 rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-lg py-1"
    >
      {VARS.map((v) => (
        <button
          key={v.key}
          type="button"
          onMouseDown={(e) => { e.preventDefault(); onSelect(v.key); }}
          className="w-full text-left px-3 py-1.5 text-xs hover:bg-[var(--accent-soft)] transition-colors flex items-center gap-2"
        >
          <span className="font-mono text-[var(--accent)]">{`{${v.key}}`}</span>
          <span className="text-[var(--text-muted)]">{v.label}</span>
        </button>
      ))}
    </div>
  );
}

// ── Textarea ──────────────────────────────────────────────────────────────────

interface TextareaProps {
  value:        string;
  onChange:     (v: string) => void;
  rows?:        number;
  placeholder?: string;
  className?:   string;
}

export function TextareaWithVars({ value, onChange, rows = 3, placeholder, className }: TextareaProps) {
  const taRef        = useRef<HTMLTextAreaElement>(null);
  const [open, setOpen] = useState(false);

  function insert(key: string) {
    const el    = taRef.current;
    const token = `{${key}}`;
    if (!el) { onChange(value + token); setOpen(false); return; }
    const start = el.selectionStart ?? value.length;
    const end   = el.selectionEnd   ?? value.length;
    onChange(value.slice(0, start) + token + value.slice(end));
    setOpen(false);
    requestAnimationFrame(() => {
      el.selectionStart = el.selectionEnd = start + token.length;
      el.focus();
    });
  }

  return (
    <div className="relative">
      <textarea
        ref={taRef}
        rows={rows}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={className}
      />
      <div className="flex justify-end mt-1">
        <div className="relative">
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            className="flex items-center gap-1 text-[10px] font-medium text-[var(--text-muted)] hover:text-[var(--accent)] transition-colors px-1.5 py-0.5 rounded-lg border border-[var(--border)] hover:border-[var(--accent)]"
          >
            <Braces size={11} />
            Variáveis
          </button>
          {open && <VarsDropdown onSelect={insert} onClose={() => setOpen(false)} />}
        </div>
      </div>
    </div>
  );
}

// ── Input (linha única) ───────────────────────────────────────────────────────

interface InputProps {
  value:        string;
  onChange:     (v: string) => void;
  placeholder?: string;
  className?:   string;
}

export function InputWithVars({ value, onChange, placeholder, className }: InputProps) {
  const inputRef     = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);

  function insert(key: string) {
    const el    = inputRef.current;
    const token = `{${key}}`;
    if (!el) { onChange(value + token); setOpen(false); return; }
    const start = el.selectionStart ?? value.length;
    const end   = el.selectionEnd   ?? value.length;
    onChange(value.slice(0, start) + token + value.slice(end));
    setOpen(false);
    requestAnimationFrame(() => {
      el.selectionStart = el.selectionEnd = start + token.length;
      el.focus();
    });
  }

  return (
    <div className="relative flex items-center gap-1.5">
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={className + " flex-1"}
      />
      <div className="relative shrink-0">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          title="Inserir variável"
          className="flex items-center justify-center h-9 w-9 rounded-xl border border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--accent)] hover:border-[var(--accent)] transition-colors"
        >
          <Braces size={14} />
        </button>
        {open && <VarsDropdown onSelect={insert} onClose={() => setOpen(false)} />}
      </div>
    </div>
  );
}
