"use client";

import { useRef, useState, useEffect } from "react";
import { createPortal } from "react-dom";
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
  anchorRef,
  onSelect,
  onClose,
}: {
  anchorRef: React.RefObject<HTMLButtonElement | null>;
  onSelect:  (key: string) => void;
  onClose:   () => void;
}) {
  const dropRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ top: 0, left: 0, width: 0 });

  useEffect(() => {
    if (anchorRef.current) {
      const r = anchorRef.current.getBoundingClientRect();
      setPos({ top: r.bottom + 4, left: r.left, width: r.width });
    }
  }, [anchorRef]);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (
        dropRef.current && !dropRef.current.contains(e.target as Node) &&
        anchorRef.current && !anchorRef.current.contains(e.target as Node)
      ) onClose();
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose, anchorRef]);

  return createPortal(
    <div
      ref={dropRef}
      style={{ position: "fixed", top: pos.top, left: pos.left, minWidth: Math.max(pos.width, 192) }}
      className="z-[9999] rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-lg py-1"
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
    </div>,
    document.body
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
  const taRef     = useRef<HTMLTextAreaElement>(null);
  const btnRef    = useRef<HTMLButtonElement>(null);
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
        <button
          ref={btnRef}
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="flex items-center gap-1 text-[10px] font-medium text-[var(--text-muted)] hover:text-[var(--accent)] transition-colors px-1.5 py-0.5 rounded-lg border border-[var(--border)] hover:border-[var(--accent)]"
        >
          <Braces size={11} />
          Variáveis
        </button>
      </div>
      {open && <VarsDropdown anchorRef={btnRef} onSelect={insert} onClose={() => setOpen(false)} />}
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
  const inputRef  = useRef<HTMLInputElement>(null);
  const btnRef    = useRef<HTMLButtonElement>(null);
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
      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        title="Inserir variável"
        className="flex items-center justify-center h-9 w-9 rounded-xl border border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--accent)] hover:border-[var(--accent)] transition-colors shrink-0"
      >
        <Braces size={14} />
      </button>
      {open && <VarsDropdown anchorRef={btnRef} onSelect={insert} onClose={() => setOpen(false)} />}
    </div>
  );
}
