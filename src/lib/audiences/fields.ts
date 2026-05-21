export type FieldType = "select" | "number" | "text" | "boolean" | "pipeline_stage"

export type FieldDef = {
  value: string
  label: string
  type: FieldType
  category: "lead" | "cliente" | "vendas"
  options?: { value: string; label: string }[]
}

export const FIELD_DEFS: FieldDef[] = [
  // Lead
  { value: "status",           label: "Status",              type: "select",         category: "lead",
    options: [
      { value: "NEW",  label: "Nova"    },
      { value: "SOLD", label: "Vendida" },
      { value: "LOST", label: "Perdida" },
    ]},
  { value: "pipelineStageId",  label: "Etapa do pipeline",   type: "pipeline_stage", category: "lead"    },
  { value: "daysSinceCapture", label: "Dias desde captura",  type: "number",         category: "lead"    },
  { value: "utmSource",        label: "UTM Source",          type: "text",           category: "lead"    },
  { value: "utmMedium",        label: "UTM Medium",          type: "text",           category: "lead"    },
  { value: "utmCampaign",      label: "UTM Campaign",        type: "text",           category: "lead"    },
  { value: "consultant",       label: "Consultor",           type: "text",           category: "lead"    },
  // Cliente
  { value: "state", label: "Estado (UF)", type: "select", category: "cliente",
    options: ["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"]
      .map((s) => ({ value: s, label: s })) },
  { value: "city",             label: "Cidade",              type: "text",           category: "cliente" },
  { value: "hasEmail",         label: "Tem e-mail",          type: "boolean",        category: "cliente" },
  // Vendas
  { value: "hasSales",         label: "Tem vendas",          type: "boolean",        category: "vendas"  },
  { value: "salesCount",       label: "Nº de vendas",        type: "number",         category: "vendas"  },
  { value: "daysSinceLastSale",label: "Dias desde últ. venda", type: "number",       category: "vendas"  },
  { value: "totalRevenue",     label: "Receita total (R$)",  type: "number",         category: "vendas"  },
]

export type OperatorDef = { value: string; label: string }

export const OPERATORS_BY_TYPE: Record<FieldType, OperatorDef[]> = {
  select: [
    { value: "eq",  label: "é"    },
    { value: "neq", label: "não é" },
  ],
  pipeline_stage: [
    { value: "eq",    label: "é"           },
    { value: "neq",   label: "não é"        },
    { value: "empty", label: "não definida" },
  ],
  boolean: [
    { value: "true",  label: "sim" },
    { value: "false", label: "não" },
  ],
  number: [
    { value: "eq",  label: "="  },
    { value: "gt",  label: ">"  },
    { value: "gte", label: ">=" },
    { value: "lt",  label: "<"  },
    { value: "lte", label: "<=" },
  ],
  text: [
    { value: "eq",          label: "é"          },
    { value: "neq",         label: "não é"       },
    { value: "contains",    label: "contém"      },
    { value: "not_contains",label: "não contém"  },
    { value: "empty",       label: "está vazio"  },
    { value: "not_empty",   label: "não está vazio" },
  ],
}

export function getFieldDef(field: string): FieldDef | undefined {
  return FIELD_DEFS.find((f) => f.value === field)
}

export function defaultOperator(type: FieldType): string {
  return OPERATORS_BY_TYPE[type][0].value
}

export function defaultValue(field: string): string {
  const def = getFieldDef(field)
  if (!def) return ""
  switch (def.type) {
    case "select": return def.options?.[0]?.value ?? ""
    case "boolean": return "true"
    case "number": return "0"
    default: return ""
  }
}
