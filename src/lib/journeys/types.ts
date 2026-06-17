// ─── Node data types ──────────────────────────────────────────────────────────

export type TriggerData = {
  audienceIds:   string[]
  audienceNames: string[]
}

export type WaitUnit = "minutes" | "hours" | "days"
export type WaitMode = "duration" | "datetime"

export type WaitData = {
  mode?:     WaitMode
  // modo duration
  amount?:   number
  unit?:     WaitUnit
  // modo datetime
  datetime?: string | null  // ISO local: "2026-06-18T21:00"
  // legado — mantido para jornadas já salvas
  days?: number
}

export type ConditionData = {
  field:    string
  operator: string
  value:    string
}

export type EmailData = {
  templateId:   string | null
  templateName: string | null
}

export type DelayUnit = "seconds" | "minutes" | "hours"

export type WhatsAppData = {
  // modo template (comportamento original)
  templateId:   string | null
  templateName: string | null
  waType:       string | null   // "TEXT" | "MEDIA" | "AUDIO"
  // modo mensagem direta (inline)
  messageMode:  "template" | "direct"
  directText:   string | null
  delayMin:     number
  delayMax:     number
  delayUnit:    DelayUnit       // "seconds" | "minutes" | "hours"
}

export type ChangeStatusData = {
  action:    "stage" | "lost"
  stageId:   string | null
  stageName: string | null
}

export type AssignData = {
  consultant: string
}

export type EndData = Record<string, never>

export type NodeData =
  | TriggerData
  | WaitData
  | ConditionData
  | EmailData
  | WhatsAppData
  | ChangeStatusData
  | AssignData
  | EndData

export type NodeType =
  | "trigger"
  | "wait"
  | "condition"
  | "email"
  | "whatsapp"
  | "changeStatus"
  | "assign"
  | "end"

// ─── Node palette definition ──────────────────────────────────────────────────

export type NodeDef = {
  type:        NodeType
  label:       string
  description: string
  color:       string
  defaultData: NodeData
}

export const NODE_DEFS: NodeDef[] = [
  {
    type:        "trigger",
    label:       "Gatilho",
    description: "Público de entrada da jornada",
    color:       "#6366f1",
    defaultData: { audienceIds: [], audienceNames: [] },
  },
  {
    type:        "wait",
    label:       "Aguardar",
    description: "Esperar antes de continuar (duração ou até uma data/hora)",
    color:       "#f59e0b",
    defaultData: { mode: "duration", amount: 1, unit: "days", datetime: null },
  },
  {
    type:        "condition",
    label:       "Condição",
    description: "Bifurcar com base em uma regra",
    color:       "#8b5cf6",
    defaultData: { field: "status", operator: "eq", value: "NEW" },
  },
  {
    type:        "email",
    label:       "E-mail",
    description: "Enviar e-mail pelo Resend",
    color:       "#3b82f6",
    defaultData: { templateId: null, templateName: null },
  },
  {
    type:        "whatsapp",
    label:       "WhatsApp",
    description: "Enviar mensagem via EvoAPI",
    color:       "#10b981",
    defaultData: { templateId: null, templateName: null, waType: null, messageMode: "template", directText: null, delayMin: 5, delayMax: 30, delayUnit: "seconds" },
  },
  {
    type:        "changeStatus",
    label:       "Mover etapa",
    description: "Mudar status ou etapa do pipeline",
    color:       "#f97316",
    defaultData: { action: "stage", stageId: null, stageName: null },
  },
  {
    type:        "assign",
    label:       "Atribuir",
    description: "Atribuir consultor ao lead",
    color:       "#06b6d4",
    defaultData: { consultant: "" },
  },
  {
    type:        "end",
    label:       "Fim",
    description: "Encerrar a jornada para este lead",
    color:       "#ef4444",
    defaultData: {},
  },
]
