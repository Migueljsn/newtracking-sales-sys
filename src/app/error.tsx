"use client";

import { useEffect } from "react";

export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[Root Error Boundary]", error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-4 p-8 text-center">
      <h2 className="text-xl font-semibold">Algo deu errado</h2>
      <p className="text-sm text-muted-foreground max-w-md">
        {error.message || "Ocorreu um erro inesperado."}
      </p>
      {error.digest && (
        <p className="text-xs text-muted-foreground/60">Código: {error.digest}</p>
      )}
      <button
        onClick={reset}
        className="px-4 py-2 text-sm border rounded-md hover:bg-muted transition-colors"
      >
        Tentar novamente
      </button>
    </div>
  );
}
