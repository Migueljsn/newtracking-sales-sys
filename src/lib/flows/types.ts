// ─── Tipos dos nós do canvas de Fluxos ───────────────────────────────────────

export type FlowNodeType =
  | "trigger"
  | "message"
  | "question"
  | "condition"
  | "changeStatus"
  | "assign"
  | "addToAudience"
  | "startFlow"
  | "wait"

// ── Trigger ──────────────────────────────────────────────────────────────────

export type FlowTriggerData = {
  triggerType:     "audience" | "keyword" | "first_message"
  audienceId:      string | null
  audienceName:    string | null
  keyword:         string | null
  keywordMatch:    "exact" | "contains" | "starts_with"
}

// ── Message ───────────────────────────────────────────────────────────────────

export type MessageType = "text" | "media" | "document"

export type FlowSeqMessage = {
  kind:        "message"
  messageType: MessageType
  text:        string
  mediaUrl:    string | null
  fileName:    string | null
  // Mensagem IA — quando ativo, o texto (já com variáveis substituídas) é
  // reformulado pela IA antes de enviar, pra nunca repetir a mesma frase
  // literal em disparos em massa.
  aiRephrase?: { enabled: boolean; agentId: string | null }
}

export type FlowSeqDelay = {
  kind:    "delay"
  seconds: number   // 1–10
  typing:  boolean  // exibe "digitando..." durante o atraso
}

export type FlowSequenceItem = FlowSeqMessage | FlowSeqDelay

export type FlowMessageData = {
  sequence:     FlowSequenceItem[]
  // legacy — mantido para compatibilidade com fluxos antigos
  messages?:    { messageType: MessageType; text: string; mediaUrl: string | null; fileName: string | null; delaySeconds: number }[]
  messageType?: MessageType
  text?:        string
  mediaUrl?:    string | null
  fileName?:    string | null
}

// ── Question ──────────────────────────────────────────────────────────────────

export type QuestionMode = "text" | "choice" | "ai"
export type ValidationType = "none" | "cnpj" | "cep" | "email" | "phone" | "number"
export type TimeoutUnit = "minutes" | "hours"

export type FlowButton = {
  id:   string  // "1" | "2" | "3"
  text: string
}

export type FlowQuestionData = {
  mode:              QuestionMode
  questionText:      string
  // modo text
  saveField:         string          // campo onde salva a resposta
  validation:        ValidationType
  retries:           1 | 2 | 3      // tentativas em caso de dado inválido
  retryMessage:      string          // mensagem enviada ao retentar
  // modo choice
  buttons:           FlowButton[]    // máx 3
  // timeout (ambos os modos)
  timeoutValue:      number
  timeoutUnit:       TimeoutUnit
  timeoutMessage:    string          // mensagem de recuperação ("ainda está aí?")
  timeoutWaitValue:  number          // tempo extra após enviar mensagem de timeout
  timeoutWaitUnit:   TimeoutUnit
  // modo ai (Pergunta IA) — pergunta gerada e resposta extraída pela IA;
  // saveField/validation/retries/timeout acima são reaproveitados
  aiAgentId?:             string | null
  aiCaptureDescription?:  string  // ex: "se o lead já é cliente (sim/não)"
}

// ── Condition ─────────────────────────────────────────────────────────────────

export type FlowConditionData = {
  field:    string
  operator: string
  value:    string
}

// ── Change Status ─────────────────────────────────────────────────────────────

export type FlowChangeStatusData = {
  action:    "stage" | "lost"
  stageId:   string | null
  stageName: string | null
}

// ── Assign ────────────────────────────────────────────────────────────────────

export type FlowAssignData = {
  consultant: string
}

// ── Add to Audience ───────────────────────────────────────────────────────────

export type FlowAddToAudienceData = {
  audienceId:   string | null
  audienceName: string | null
}

// ── Start Flow ────────────────────────────────────────────────────────────────

export type FlowStartFlowData = {
  targetFlowId:   string | null
  targetFlowName: string | null
}

// ── Wait (Atraso Inteligente) ─────────────────────────────────────────────────

export type WaitMode = "duration" | "datetime"
export type WaitUnit = "minutes" | "hours" | "days"

export type FlowWaitData = {
  mode:     WaitMode
  value:    number        // duração (modo duration)
  unit:     WaitUnit      // unidade (modo duration)
  datetime: string | null // ISO local: "2026-06-18T21:00" (modo datetime)
}

// ── Union ─────────────────────────────────────────────────────────────────────

export type FlowNodeData =
  | FlowTriggerData
  | FlowMessageData
  | FlowQuestionData
  | FlowConditionData
  | FlowChangeStatusData
  | FlowAssignData
  | FlowAddToAudienceData
  | FlowStartFlowData
  | FlowWaitData

// ── Palette ───────────────────────────────────────────────────────────────────

export type FlowNodeDef = {
  type:        FlowNodeType
  label:       string
  description: string
  color:       string
  defaultData: FlowNodeData
}

export const FLOW_NODE_DEFS: FlowNodeDef[] = [
  {
    type:        "message",
    label:       "Mensagem",
    description: "Envia texto, imagem ou documento",
    color:       "#10b981",
    defaultData: {
      sequence: [{ kind: "message", messageType: "text", text: "", mediaUrl: null, fileName: null }],
    },
  },
  {
    type:        "question",
    label:       "Pergunta",
    description: "Aguarda resposta do lead (texto ou botões)",
    color:       "#0ea5e9",
    defaultData: {
      mode: "text", questionText: "", saveField: "notes",
      validation: "none", retries: 1, retryMessage: "Resposta inválida, tente novamente:",
      buttons: [],
      timeoutValue: 30, timeoutUnit: "minutes",
      timeoutMessage: "Ainda está aí? Aguardamos sua resposta 😊",
      timeoutWaitValue: 10, timeoutWaitUnit: "minutes",
    },
  },
  {
    type:        "condition",
    label:       "Condição",
    description: "Bifurcar com base em um campo do lead",
    color:       "#8b5cf6",
    defaultData: { field: "status", operator: "eq", value: "NEW" },
  },
  {
    type:        "changeStatus",
    label:       "Mover etapa",
    description: "Muda etapa do pipeline",
    color:       "#f97316",
    defaultData: { action: "stage", stageId: null, stageName: null },
  },
  {
    type:        "assign",
    label:       "Atribuir",
    description: "Atribui consultor ao lead",
    color:       "#06b6d4",
    defaultData: { consultant: "" },
  },
  {
    type:        "addToAudience",
    label:       "Adicionar ao público",
    description: "Adiciona o lead a um público existente",
    color:       "#a855f7",
    defaultData: { audienceId: null, audienceName: null },
  },
  {
    type:        "startFlow",
    label:       "Iniciar outro fluxo",
    description: "Encerra este fluxo e inicia outro",
    color:       "#ec4899",
    defaultData: { targetFlowId: null, targetFlowName: null },
  },
  {
    type:        "wait",
    label:       "Atraso inteligente",
    description: "Pausa o fluxo por uma duração ou até uma data/hora",
    color:       "#f59e0b",
    defaultData: { mode: "duration", value: 1, unit: "hours", datetime: null },
  },
]
