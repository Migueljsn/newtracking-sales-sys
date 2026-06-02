"use client";

import { useEffect } from "react";
import Link          from "next/link";

export default function FlowEditorError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[Flow Editor Error Boundary]", error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center h-screen gap-4 text-center">
      <h2 className="text-xl font-semibold">Erro no editor de fluxo</h2>
      <p className="text-sm text-muted-foreground max-w-md">
        {error.message || "Ocorreu um erro inesperado ao carregar o editor."}
      </p>
      <div className="flex gap-2">
        <button
          onClick={reset}
          className="px-4 py-2 text-sm border rounded-md hover:bg-muted transition-colors"
        >
          Tentar novamente
        </button>
        <Link
          href="/flows"
          className="px-4 py-2 text-sm rounded-md hover:bg-muted transition-colors"
        >
          Voltar para fluxos
        </Link>
      </div>
    </div>
  );
}
