"use client";

import { ArrowLeft, Eye } from "lucide-react";

interface Props {
  clientName: string;
  stopAction: () => Promise<void>;
}

export function ImpersonationBanner({ clientName, stopAction }: Props) {
  return (
    <div className="sticky top-0 z-50 flex items-center justify-between gap-4 bg-amber-500 px-4 py-2.5 text-sm font-medium text-white shadow-sm">
      <div className="flex items-center gap-2">
        <Eye size={15} className="shrink-0" />
        <span>
          Visualizando como <strong>{clientName}</strong>
        </span>
      </div>
      <form action={stopAction}>
        <button
          type="submit"
          className="flex items-center gap-1.5 rounded-lg bg-white/20 px-3 py-1 text-xs font-semibold transition-colors hover:bg-white/30"
        >
          <ArrowLeft size={13} />
          Voltar ao painel admin
        </button>
      </form>
    </div>
  );
}
