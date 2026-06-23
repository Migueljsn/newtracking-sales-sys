"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { TextareaWithVars } from "@/components/flows/field-with-vars";
import type { AgentObjective } from "@/lib/agents/types";

const VALIDATION_OPTIONS: { value: AgentObjective["validation"]; label: string }[] = [
  { value: "none",  label: "Texto livre (sem validação de formato)" },
  { value: "cnpj",  label: "CNPJ" },
  { value: "cep",   label: "CEP" },
  { value: "email", label: "E-mail" },
  { value: "phone", label: "Telefone" },
  { value: "number", label: "Número" },
];

const KNOWN_FIELDS = ["name", "email", "notes", "cnpj", "cep", "company", "city", "state", "meetingPreference"];
const CUSTOM_VALUE = "__custom__";

interface ObjectiveCardProps {
  objective: AgentObjective;
  onChange:  (objective: AgentObjective) => void;
  onRemove:  () => void;
}

export function ObjectiveCard({ objective, onChange, onRemove }: ObjectiveCardProps) {
  const [forceCustom, setForceCustom] = useState(false);
  const isCustom = forceCustom || (objective.saveField !== "" && !KNOWN_FIELDS.includes(objective.saveField));

  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 space-y-3">
      <div className="flex items-start gap-2">
        <div className="flex-1 space-y-3">
          <div>
            <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">O que capturar</label>
            <TextareaWithVars
              rows={2}
              value={objective.description}
              onChange={(v) => onChange({ ...objective, description: v })}
              placeholder="Ex: o melhor dia e horário pra uma reunião"
              className="input w-full resize-none"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">Validação</label>
              <select
                value={objective.validation}
                onChange={(e) => onChange({ ...objective, validation: e.target.value as AgentObjective["validation"] })}
                className="input w-full"
              >
                {VALIDATION_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">Salvar no campo</label>
              {isCustom ? (
                <input
                  value={objective.saveField}
                  onChange={(e) => onChange({ ...objective, saveField: e.target.value })}
                  placeholder="nome_do_campo"
                  className="input w-full"
                />
              ) : (
                <select
                  value={objective.saveField}
                  onChange={(e) => {
                    if (e.target.value === CUSTOM_VALUE) { setForceCustom(true); onChange({ ...objective, saveField: "" }); return; }
                    onChange({ ...objective, saveField: e.target.value });
                  }}
                  className="input w-full"
                >
                  <option value="">Selecione...</option>
                  <optgroup label="Campos do lead">
                    <option value="name">Nome</option>
                    <option value="email">E-mail</option>
                    <option value="notes">Observações</option>
                  </optgroup>
                  <optgroup label="Dados coletados">
                    <option value="cnpj">CNPJ</option>
                    <option value="cep">CEP</option>
                    <option value="company">Empresa</option>
                    <option value="city">Cidade</option>
                    <option value="state">Estado (UF)</option>
                    <option value="meetingPreference">Preferência de reunião</option>
                  </optgroup>
                  <option value={CUSTOM_VALUE}>Campo personalizado...</option>
                </select>
              )}
            </div>
          </div>
        </div>
        <button
          onClick={onRemove}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[var(--text-muted)] hover:bg-[var(--danger-soft)] hover:text-[var(--danger)] transition-colors"
          title="Remover objetivo"
        >
          <X size={15} />
        </button>
      </div>
    </div>
  );
}
