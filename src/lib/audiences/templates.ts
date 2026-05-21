import { RuleGroup } from "./types"

export type AudienceTemplate = {
  label:       string
  description: string
  rules:       RuleGroup
}

function tpl(operator: "AND" | "OR", rules: Array<{ field: string; operator: string; value: string }>): RuleGroup {
  return {
    id:       "tpl-root",
    operator,
    rules:    rules.map((r, i) => ({ ...r, id: `tpl-${i}` })),
  }
}

export const AUDIENCE_TEMPLATES: AudienceTemplate[] = [
  {
    label:       "Leads novas há mais de 7 dias",
    description: "Novas sem ação há pelo menos uma semana",
    rules: tpl("AND", [
      { field: "status",           operator: "eq",  value: "NEW" },
      { field: "daysSinceCapture", operator: "gt",  value: "7"   },
    ]),
  },
  {
    label:       "Leads sem contato há 30+ dias",
    description: "Novas paradas há mais de um mês",
    rules: tpl("AND", [
      { field: "status",           operator: "eq",  value: "NEW" },
      { field: "daysSinceCapture", operator: "gt",  value: "30"  },
    ]),
  },
  {
    label:       "Clientes inativos (60+ dias)",
    description: "Com vendas, mas sem comprar há dois meses",
    rules: tpl("AND", [
      { field: "hasSales",          operator: "true", value: "true" },
      { field: "daysSinceLastSale", operator: "gt",   value: "60"  },
    ]),
  },
  {
    label:       "Leads perdidas recentemente",
    description: "Perdidas nos últimos 30 dias",
    rules: tpl("AND", [
      { field: "status",           operator: "eq",  value: "LOST" },
      { field: "daysSinceCapture", operator: "lte", value: "30"   },
    ]),
  },
  {
    label:       "Leads sem e-mail",
    description: "Sem e-mail cadastrado para campanhas",
    rules: tpl("AND", [
      { field: "hasEmail", operator: "false", value: "false" },
    ]),
  },
  {
    label:       "Alto valor (R$ 500+)",
    description: "Leads com receita total acima de R$ 500",
    rules: tpl("AND", [
      { field: "totalRevenue", operator: "gte", value: "500" },
    ]),
  },
  {
    label:       "Leads vendidas",
    description: "Todas as leads com pelo menos uma venda",
    rules: tpl("AND", [
      { field: "status", operator: "eq", value: "SOLD" },
    ]),
  },
]
