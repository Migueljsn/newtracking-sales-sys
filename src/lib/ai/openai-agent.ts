import OpenAI from "openai";

let client: OpenAI | null = null;

function getClient(): OpenAI {
  if (!client) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error("[AiAgent] OPENAI_API_KEY ausente");
    client = new OpenAI({ apiKey });
  }
  return client;
}

export interface AgentTurnConfig {
  systemPrompt: string;
  negativePrompt: string | null;
  model: string;
  temperature: number;
}

export interface AgentHistoryMessage {
  role: "user" | "assistant";
  content: string;
}

export type AgentTurnResult =
  | { type: "reply"; text: string }
  | { type: "end"; reason: string; finalMessage: string | null };

const END_CONVERSATION_TOOL = {
  type: "function" as const,
  function: {
    name: "encerrar_conversa",
    description: "Encerra a conversa com o lead porque o objetivo do atendimento foi cumprido (ou não há mais o que fazer).",
    parameters: {
      type: "object",
      properties: {
        motivo: { type: "string", description: "Motivo curto do encerramento." },
        mensagem_final: { type: "string", description: "Mensagem opcional de despedida a enviar ao lead antes de encerrar." },
      },
      required: ["motivo"],
    },
  },
};

function buildPersonaPrompt(config: Pick<AgentTurnConfig, "systemPrompt" | "negativePrompt">): string {
  let prompt = config.systemPrompt;
  if (config.negativePrompt?.trim()) {
    prompt += `\n\nRegras que você NUNCA deve seguir ou mencionar:\n${config.negativePrompt}`;
  }
  return prompt;
}

function buildSystemPrompt(config: AgentTurnConfig): string {
  let prompt = buildPersonaPrompt(config);
  prompt += `\n\nQuando o objetivo da conversa estiver cumprido (ou não houver mais o que fazer), chame a ferramenta "encerrar_conversa".`;
  return prompt;
}

export async function runAgentTurn(
  config: AgentTurnConfig,
  history: AgentHistoryMessage[]
): Promise<AgentTurnResult> {
  const openai = getClient();

  const response = await openai.chat.completions.create({
    model: config.model,
    temperature: config.temperature,
    messages: [
      { role: "system", content: buildSystemPrompt(config) },
      ...history,
    ],
    tools: [END_CONVERSATION_TOOL],
    tool_choice: "auto",
  });

  const choice = response.choices[0];
  const toolCall = choice.message.tool_calls?.[0];

  if (toolCall?.type === "function" && toolCall.function.name === "encerrar_conversa") {
    const args = JSON.parse(toolCall.function.arguments || "{}");
    return {
      type: "end",
      reason: args.motivo || "concluído",
      finalMessage: args.mensagem_final || null,
    };
  }

  return { type: "reply", text: choice.message.content?.trim() || "..." };
}

/**
 * Reformula uma mensagem já escrita preservando 100% do conteúdo factual —
 * usada pra evitar enviar a mesma frase literal em disparos em massa (padrão
 * que o WhatsApp associa a spam). Nunca gera conteúdo novo a partir do zero.
 */
export async function rephraseMessage(
  config: Pick<AgentTurnConfig, "systemPrompt" | "negativePrompt" | "model" | "temperature">,
  baseText: string
): Promise<string> {
  if (!baseText.trim()) return baseText;

  const openai = getClient();
  const response = await openai.chat.completions.create({
    model: config.model,
    temperature: config.temperature,
    messages: [
      {
        role: "system",
        content: `${buildPersonaPrompt(config)}\n\nVocê vai reformular uma mensagem que já foi escrita. Regras estritas:\n- Preserve 100% do significado e de todos os fatos (números, datas, valores, links, nomes próprios) — não pode mudar nem inventar nenhum deles.\n- Varie apenas a forma de escrever: estrutura da frase, sinônimos, tom — pra nunca parecer um texto repetido ou robótico.\n- Nunca use menus numerados (ex: "responda 1 para sim") nem se refira a botões — escreva como uma pessoa escreveria no WhatsApp.\n- Responda APENAS com a mensagem reformulada, sem aspas, sem comentários, sem explicações.`,
      },
      { role: "user", content: baseText },
    ],
  });

  return response.choices[0].message.content?.trim() || baseText;
}
