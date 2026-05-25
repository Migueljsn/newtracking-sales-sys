import type { Node, Edge } from "@xyflow/react";

export interface JourneyTemplate {
  id:          string;
  name:        string;
  description: string;
  category:    "captacao" | "nutricao" | "reativacao" | "pos-venda";
  steps:       string[];   // descrição legível dos passos para o preview
  nodes:       Node[];
  edges:       Edge[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function n(id: string, type: string, x: number, y: number, data: object): Node {
  return { id, type, position: { x, y }, data } as Node;
}

function e(id: string, source: string, target: string, handle?: "true" | "false"): Edge {
  return {
    id,
    source,
    target,
    ...(handle ? { sourceHandle: handle } : {}),
  } as Edge;
}

// ─── Templates ────────────────────────────────────────────────────────────────

export const JOURNEY_TEMPLATES: JourneyTemplate[] = [

  // 1 ─ Boas-vindas
  {
    id:          "boas-vindas",
    name:        "Boas-vindas para nova lead",
    description: "Apresenta a empresa logo após a captura e envia uma oferta no segundo dia.",
    category:    "captacao",
    steps: [
      "Gatilho — lead entra no público",
      "E-mail de boas-vindas imediato",
      "Aguardar 2 dias",
      "E-mail com oferta especial",
      "Fim",
    ],
    nodes: [
      n("t1", "trigger",  300,  50, { audienceId: null, audienceName: null }),
      n("e1", "email",    300, 200, { templateId: null, templateName: "E-mail de boas-vindas" }),
      n("w1", "wait",     300, 350, { days: 2 }),
      n("e2", "email",    300, 500, { templateId: null, templateName: "Oferta especial" }),
      n("f1", "end",      300, 650, {}),
    ],
    edges: [
      e("te1", "t1", "e1"),
      e("e1w1", "e1", "w1"),
      e("w1e2", "w1", "e2"),
      e("e2f1", "e2", "f1"),
    ],
  },

  // 2 ─ Speed to Lead
  {
    id:          "speed-to-lead",
    name:        "Speed to Lead — contato rápido",
    description: "Envia WhatsApp após 1 dia se a lead ainda não foi atendida. Ideal para captura paga.",
    category:    "captacao",
    steps: [
      "Gatilho — lead entra no público",
      "Aguardar 1 dia",
      "Condição: ainda é lead nova (NEW)?",
      "Sim → WhatsApp de contato",
      "Fim",
    ],
    nodes: [
      n("t1", "trigger",   300,  50, { audienceId: null, audienceName: null }),
      n("w1", "wait",      300, 200, { days: 1 }),
      n("c1", "condition", 300, 350, { field: "status", operator: "eq", value: "NEW" }),
      n("wa", "whatsapp",  150, 510, { message: "Oi, {nome}! Vi que você demonstrou interesse. Posso te ajudar? 😊" }),
      n("f1", "end",       450, 510, {}),
      n("f2", "end",       150, 660, {}),
    ],
    edges: [
      e("tw1",  "t1", "w1"),
      e("w1c1", "w1", "c1"),
      e("c1wa", "c1", "wa",  "true"),
      e("c1f1", "c1", "f1",  "false"),
      e("waf2", "wa", "f2"),
    ],
  },

  // 3 ─ Nutrição 5 dias
  {
    id:          "nutricao-5-dias",
    name:        "Nutrição em 5 dias",
    description: "Sequência de 3 e-mails ao longo de 5 dias para engajar leads que ainda não compraram.",
    category:    "nutricao",
    steps: [
      "Gatilho — lead entra no público",
      "E-mail dia 1",
      "Aguardar 2 dias",
      "E-mail dia 3",
      "Aguardar 2 dias",
      "E-mail dia 5 (urgência)",
      "Fim",
    ],
    nodes: [
      n("t1", "trigger", 300,   50, { audienceId: null, audienceName: null }),
      n("e1", "email",   300,  200, { templateId: null, templateName: "E-mail dia 1" }),
      n("w1", "wait",    300,  350, { days: 2 }),
      n("e2", "email",   300,  500, { templateId: null, templateName: "E-mail dia 3" }),
      n("w2", "wait",    300,  650, { days: 2 }),
      n("e3", "email",   300,  800, { templateId: null, templateName: "E-mail dia 5 — urgência" }),
      n("f1", "end",     300,  950, {}),
    ],
    edges: [
      e("te1",  "t1", "e1"),
      e("e1w1", "e1", "w1"),
      e("w1e2", "w1", "e2"),
      e("e2w2", "e2", "w2"),
      e("w2e3", "w2", "e3"),
      e("e3f1", "e3", "f1"),
    ],
  },

  // 4 ─ Reativação de perdidas
  {
    id:          "reativacao-perdidas",
    name:        "Reativação de leads perdidas",
    description: "Tenta reengajar leads marcadas como perdidas com e-mail seguido de WhatsApp.",
    category:    "reativacao",
    steps: [
      "Gatilho — leads perdidas no público",
      "E-mail de reativação",
      "Aguardar 3 dias",
      "WhatsApp de acompanhamento",
      "Fim",
    ],
    nodes: [
      n("t1", "trigger",  300,  50, { audienceId: null, audienceName: null }),
      n("e1", "email",    300, 200, { templateId: null, templateName: "Ainda posso te ajudar?" }),
      n("w1", "wait",     300, 350, { days: 3 }),
      n("wa", "whatsapp", 300, 500, { message: "Oi, {nome}! Você sumiu! Ainda tem interesse? Tenho uma condição especial pra você 🎯" }),
      n("f1", "end",      300, 650, {}),
    ],
    edges: [
      e("te1",  "t1", "e1"),
      e("e1w1", "e1", "w1"),
      e("w1wa", "w1", "wa"),
      e("waf1", "wa", "f1"),
    ],
  },

  // 5 ─ Pós-venda / Upsell
  {
    id:          "pos-venda-upsell",
    name:        "Pós-venda e upsell",
    description: "Agradece a compra e retorna com uma oferta exclusiva 7 dias depois.",
    category:    "pos-venda",
    steps: [
      "Gatilho — leads vendidas",
      "Aguardar 3 dias",
      "E-mail de agradecimento",
      "Aguardar 7 dias",
      "E-mail com oferta exclusiva",
      "Fim",
    ],
    nodes: [
      n("t1", "trigger", 300,  50, { audienceId: null, audienceName: null }),
      n("w1", "wait",    300, 200, { days: 3 }),
      n("e1", "email",   300, 350, { templateId: null, templateName: "Obrigado pela sua compra!" }),
      n("w2", "wait",    300, 500, { days: 7 }),
      n("e2", "email",   300, 650, { templateId: null, templateName: "Oferta exclusiva para você" }),
      n("f1", "end",     300, 800, {}),
    ],
    edges: [
      e("tw1",  "t1", "w1"),
      e("w1e1", "w1", "e1"),
      e("e1w2", "e1", "w2"),
      e("w2e2", "w2", "e2"),
      e("e2f1", "e2", "f1"),
    ],
  },

];

export const CATEGORY_LABEL: Record<string, string> = {
  captacao:   "Captação",
  nutricao:   "Nutrição",
  reativacao: "Reativação",
  "pos-venda":"Pós-venda",
};

export const CATEGORY_COLOR: Record<string, string> = {
  captacao:   "var(--accent)",
  nutricao:   "#10b981",
  reativacao: "var(--warning)",
  "pos-venda":"#8b5cf6",
};
