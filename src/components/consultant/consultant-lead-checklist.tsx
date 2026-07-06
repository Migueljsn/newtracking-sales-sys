"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckSquare, Square, ListChecks, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { consultantSetChecklistItemAction } from "@/app/consultor/actions";

interface ChecklistItem {
  id:        string;
  text:      string;
  checked:   boolean;
  checkedAt: Date | string | null;
  checkedBy: string | null;
}

interface Props {
  leadId:  string;
  stage:   { name: string; color: string };
  items:   ChecklistItem[];
  canEdit: boolean;
}

export function ConsultantLeadChecklist({ leadId, stage, items, canEdit }: Props) {
  const router = useRouter();
  const [toggling, setToggling] = useState<Set<string>>(new Set());

  async function toggle(requirementId: string, checked: boolean) {
    setToggling(prev => new Set(prev).add(requirementId));
    try {
      await consultantSetChecklistItemAction(leadId, requirementId, checked);
      router.refresh();
    } catch (e: unknown) {
      toast.error((e as Error).message || "Erro ao atualizar requisito");
    } finally {
      setToggling(prev => { const n = new Set(prev); n.delete(requirementId); return n; });
    }
  }

  const checkedCount = items.filter(i => i.checked).length;

  return (
    <div className="card p-5">
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <ListChecks size={15} className="text-[var(--accent)]" />
        <h2 className="text-sm font-semibold text-[var(--text)]">Checklist da etapa</h2>
        <span
          className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
          style={{ backgroundColor: `${stage.color}22`, color: stage.color }}
        >
          {stage.name}
        </span>
        <span className="ml-auto text-xs font-semibold text-[var(--text-muted)]">{checkedCount}/{items.length}</span>
      </div>
      <div className="space-y-2">
        {items.map((item, idx) => {
          const isToggling = toggling.has(item.id);
          return (
            <button
              key={item.id}
              type="button"
              disabled={!canEdit || isToggling}
              onClick={() => toggle(item.id, !item.checked)}
              className={`flex w-full items-start gap-3 rounded-xl border p-3 text-left transition-colors disabled:opacity-60 disabled:cursor-not-allowed ${
                item.checked
                  ? "border-[var(--success)] bg-[var(--success-soft)]"
                  : "border-[var(--border)] bg-[var(--surface-muted)] hover:border-[var(--accent)]"
              }`}
            >
              <div className={`mt-0.5 shrink-0 ${item.checked ? "text-[var(--success)]" : "text-[var(--text-muted)]"}`}>
                {isToggling ? <Loader2 size={15} className="animate-spin" /> : item.checked ? <CheckSquare size={15} /> : <Square size={15} />}
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-sm ${item.checked ? "text-[var(--text)] font-medium" : "text-[var(--text-muted)]"}`}>
                  {idx + 1}. {item.text}
                </p>
                {item.checked && (item.checkedBy || item.checkedAt) && (
                  <p className="text-[10px] text-[var(--text-muted)] mt-0.5">
                    {item.checkedBy && <span className="font-medium">{item.checkedBy}</span>}
                    {item.checkedAt && (
                      <span> · {new Date(item.checkedAt).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}</span>
                    )}
                  </p>
                )}
              </div>
            </button>
          );
        })}
      </div>
      {!canEdit && (
        <p className="mt-3 text-xs text-[var(--text-muted)]">Não é possível editar o checklist de uma lead vendida ou perdida.</p>
      )}
    </div>
  );
}
