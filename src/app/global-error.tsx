"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[Global Error Boundary]", error);
  }, [error]);

  return (
    <html>
      <body
        style={{
          display: "flex", flexDirection: "column", alignItems: "center",
          justifyContent: "center", minHeight: "100vh", gap: "16px",
          padding: "32px", textAlign: "center", fontFamily: "sans-serif",
        }}
      >
        <h2 style={{ fontSize: "1.25rem", fontWeight: 600 }}>Algo deu errado</h2>
        <p style={{ fontSize: "0.875rem", color: "#6b7280", maxWidth: "400px" }}>
          {error.message || "Ocorreu um erro inesperado."}
        </p>
        {error.digest && (
          <p style={{ fontSize: "0.75rem", color: "#9ca3af" }}>Código: {error.digest}</p>
        )}
        <button
          onClick={reset}
          style={{
            padding: "8px 16px", border: "1px solid #d1d5db", borderRadius: "6px",
            background: "white", cursor: "pointer", fontSize: "0.875rem",
          }}
        >
          Tentar novamente
        </button>
      </body>
    </html>
  );
}
