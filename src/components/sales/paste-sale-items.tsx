"use client";

import { useState } from "react";
import { ClipboardPaste, Copy, Check, AlertTriangle, X } from "lucide-react";
import { toast } from "sonner";
import { parseSaleItemsText, SALE_ITEMS_AI_PROMPT, type ParsedSaleItem } from "@/lib/sale-items/parse-sale-items";

interface Props {
  onImport: (items: ParsedSaleItem[], total: number) => void;
}

export function PasteSaleItems({ onImport }: Props) {
  const [open,    setOpen]    = useState(false);
  const [text,    setText]    = useState("");
  const [errors,  setErrors]  = useState<{ line: number; raw: string }[]>([]);
  const [copied,  setCopied]  = useState(false);

  function close() {
    setOpen(false);
    setText("");
    setErrors([]);
  }

  async function handleCopyPrompt() {
    await navigator.clipboard.writeText(SALE_ITEMS_AI_PROMPT);
    setCopied(true);
    toast.success("Prompt copiado — cole numa IA junto com o PDF do pedido");
    setTimeout(() => setCopied(false), 2000);
  }

  function handleImport() {
    const { items, errors: parseErrors, total } = parseSaleItemsText(text);
    setErrors(parseErrors);

    if (items.length === 0) {
      toast.error("Nenhum item reconhecido no texto colado");
      return;
    }

    onImport(items, total);
    toast.success(
      `${items.length} ite${items.length !== 1 ? "ns" : "m"} importado${items.length !== 1 ? "s" : ""}` +
      (parseErrors.length > 0 ? ` — ${parseErrors.length} linha${parseErrors.length !== 1 ? "s" : ""} não reconhecida${parseErrors.length !== 1 ? "s" : ""}` : "")
    );

    if (parseErrors.length === 0) close();
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-1 text-xs text-[var(--accent)] hover:text-[var(--accent-strong)]"
      >
        <ClipboardPaste size={12} /> Colar itens da IA
      </button>
    );
  }

  return (
    <div className="soft-panel space-y-2 p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-[var(--text-muted)]">Colar itens gerados por IA</p>
        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={handleCopyPrompt}
            className="flex items-center gap-1 text-[11px] text-[var(--accent)] hover:text-[var(--accent-strong)]"
          >
            {copied ? <Check size={11} /> : <Copy size={11} />} Copiar prompt p/ IA
          </button>
          <button type="button" onClick={close} className="text-[var(--text-muted)] hover:text-[var(--text)]">
            <X size={14} />
          </button>
        </div>
      </div>

      <textarea
        value={text}
        onChange={e => setText(e.target.value)}
        rows={4}
        placeholder={"- 10x Coca-Cola 2L | 6,50\n- 5x Guaraná Antarctica 2L | 5,90"}
        className="input w-full resize-none font-mono text-xs"
      />

      {errors.length > 0 && (
        <div className="flex items-start gap-1.5 rounded-lg bg-[var(--warning-soft)] px-2.5 py-2 text-[11px] text-[var(--warning)]">
          <AlertTriangle size={12} className="mt-0.5 shrink-0" />
          <span>
            {errors.length} linha{errors.length !== 1 ? "s" : ""} não reconhecida{errors.length !== 1 ? "s" : ""}: {errors.map(e => `#${e.line}`).join(", ")}
          </span>
        </div>
      )}

      <button
        type="button"
        onClick={handleImport}
        disabled={!text.trim()}
        className="flex h-8 w-full items-center justify-center rounded-xl bg-[var(--accent)] text-xs font-semibold text-white disabled:opacity-40"
      >
        Importar itens
      </button>
    </div>
  );
}
