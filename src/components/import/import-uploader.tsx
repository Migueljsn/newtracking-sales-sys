"use client";

import { useRef, useState } from "react";
import { Upload, FileSpreadsheet, CheckCircle, XCircle, AlertCircle, Download } from "lucide-react";
import { toast } from "sonner";

interface ImportResult {
  total:   number;
  created: number;
  sold:    number;
  lost:    number;
  skipped: number;
  errors:  { row: number; message: string }[];
}

export function ImportUploader() {
  const inputRef              = useRef<HTMLInputElement>(null);
  const [file, setFile]       = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult]   = useState<ImportResult | null>(null);
  const [dragging, setDragging] = useState(false);

  function handleFile(f: File) {
    if (!f.name.endsWith(".xlsx") && !f.name.endsWith(".xls")) {
      toast.error("Apenas arquivos .xlsx ou .xls são aceitos");
      return;
    }
    setFile(f);
    setResult(null);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  }

  async function handleImport() {
    if (!file) return;
    setLoading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);

      const res = await fetch("/api/import", { method: "POST", body: fd });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || "Erro na importação");

      setResult(data);
      toast.success(`Importação concluída: ${data.created} leads criadas`);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Erro na importação");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Área de upload */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={`card cursor-pointer border-2 border-dashed p-10 text-center ${
          dragging
            ? "border-[var(--accent)] bg-[var(--accent-soft)]"
            : "hover:border-[var(--accent)]"
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,.xls"
          className="hidden"
          onChange={(e) => { if (e.target.files?.[0]) handleFile(e.target.files[0]); }}
        />
        <div className="flex flex-col items-center gap-3">
          {file ? (
            <>
              <FileSpreadsheet size={40} className="text-green-500" />
              <p className="text-sm font-medium text-[var(--text)]">{file.name}</p>
              <p className="text-xs text-[var(--text-muted)]">
                {(file.size / 1024).toFixed(1)} KB — clique para trocar
              </p>
            </>
          ) : (
            <>
              <Upload size={40} className="text-[var(--text-muted)]" />
              <p className="text-sm font-medium text-[var(--text)]">
                Arraste o arquivo aqui ou clique para selecionar
              </p>
              <p className="text-xs text-[var(--text-muted)]">Aceita .xlsx e .xls</p>
            </>
          )}
        </div>
      </div>

      {/* Ações */}
      <div className="flex flex-wrap gap-3">
        <button
          onClick={handleImport}
          disabled={!file || loading}
          className="btn-primary px-6 py-2 disabled:opacity-40"
        >
          {loading ? "Importando..." : "Importar planilha"}
        </button>

        <a
          href="/api/export"
          className="flex items-center gap-2 btn-secondary px-5 py-2 text-sm"
        >
          <Download size={15} /> Exportar XLSX
        </a>
      </div>

      {/* Resultado */}
      {result && (
        <div className="card space-y-4 p-5">
          <h3 className="text-sm font-semibold text-[var(--text)]">Resultado da importação</h3>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: "Total de linhas", value: result.total,   color: "text-[var(--text)]" },
              { label: "Leads criadas",   value: result.created, color: "text-[var(--accent)]" },
              { label: "Vendas",          value: result.sold,    color: "text-[var(--success)]" },
              { label: "Duplicatas",      value: result.skipped, color: "text-[var(--text-muted)]" },
            ].map(({ label, value, color }) => (
              <div key={label} className="soft-panel p-3 text-center">
                <p className={`text-xl font-bold ${color}`}>{value}</p>
                <p className="text-xs text-[var(--text-muted)] mt-0.5">{label}</p>
              </div>
            ))}
          </div>

          {result.errors.length > 0 && (
            <div>
              <div className="mb-2 flex items-center gap-2 text-[var(--danger)]">
                <AlertCircle size={15} />
                <p className="text-sm font-medium">{result.errors.length} erro(s) encontrado(s)</p>
              </div>
              <div className="space-y-1 max-h-40 overflow-y-auto">
                {result.errors.map((e, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs text-[var(--text-muted)]">
                    <XCircle size={13} className="mt-0.5 shrink-0 text-[var(--danger)]" />
                    <span><strong>Linha {e.row}:</strong> {e.message}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {result.errors.length === 0 && (
            <div className="flex items-center gap-2 text-sm text-[var(--success)]">
              <CheckCircle size={15} />
              <span>Importação concluída sem erros.</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
