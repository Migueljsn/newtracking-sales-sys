"use client";

import { useState } from "react";

interface Props {
  name: string;
  required?: boolean;
  className?: string;
  defaultValue?: number;
}

function formatDisplay(cents: number): string {
  if (cents === 0) return "";
  return (cents / 100).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function CurrencyInput({ name, required, className, defaultValue }: Props) {
  const [cents, setCents] = useState(() =>
    defaultValue && defaultValue > 0 ? Math.round(defaultValue * 100) : 0
  );

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const digits = e.target.value.replace(/\D/g, "");
    const num    = digits ? parseInt(digits, 10) : 0;
    setCents(num);
  }

  const display      = formatDisplay(cents);
  const numericValue = cents > 0 ? String(cents / 100) : "";

  return (
    <div className="relative">
      {cents > 0 && (
        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 select-none text-sm text-[var(--text-muted)] pointer-events-none">
          R$
        </span>
      )}
      <input
        type="text"
        inputMode="numeric"
        value={display}
        onChange={handleChange}
        placeholder="0,00"
        required={required}
        className={className}
        style={cents > 0 ? { paddingLeft: "2.75rem" } : undefined}
      />
      <input type="hidden" name={name} value={numericValue} />
    </div>
  );
}
