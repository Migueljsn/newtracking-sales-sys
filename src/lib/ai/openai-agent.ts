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

type PersonaConfig = Pick<AgentTurnConfig, "systemPrompt" | "negativePrompt" | "model" | "temperature">;

/**
 * Gera a frase de uma "Pergunta IA" (nó question, modo ai) a partir de uma
 * descrição do que precisa ser capturado — nunca usa menus numerados/botões,
 * e na retentativa pede uma frase diferente da anterior.
 */
export async function generateAiQuestion(
  config: PersonaConfig,
  captureDescription: string,
  isRetry: boolean,
  history: AgentHistoryMessage[] = []
): Promise<string> {
  const openai = getClient();
  const instruction = isRetry
    ? "Você já perguntou isso antes mas não conseguiu uma resposta clara. Pergunte de novo, com outras palavras — nunca repita a mesma frase."
    : "Pergunte isso de forma natural, como uma pessoa perguntaria no WhatsApp.";

  const response = await openai.chat.completions.create({
    model: config.model,
    temperature: config.temperature,
    messages: [
      {
        role: "system",
        content: `${buildPersonaPrompt(config)}\n\nVocê está no meio de uma conversa com o lead pelo WhatsApp (histórico abaixo, se houver). Agora você precisa descobrir: "${captureDescription}".\n\n${instruction} Não repita cumprimentos, perguntas ou frases que você já usou nesta conversa. Nunca use menus numerados (ex: "responda 1 para sim") nem se refira a botões.\n\nREGRA OBRIGATÓRIA: sua mensagem PRECISA conter, de forma clara, o pedido por essa informação — mesmo que você também responda brevemente a algo que o lead disse antes (uma saudação, uma pergunta de volta, etc). Nunca envie uma mensagem que só converse e deixe de fazer o pedido. Responda APENAS com a mensagem a ser enviada agora, sem aspas, sem comentário.`,
      },
      ...history,
    ],
  });

  return response.choices[0].message.content?.trim() || captureDescription;
}

export type AiAnswerStatus = "captured" | "waiting" | "unclear";

const CAPTURE_ANSWER_TOOL = {
  type: "function" as const,
  function: {
    name: "registrar_resposta",
    description: "Registra o resultado da resposta do lead à pergunta feita.",
    parameters: {
      type: "object",
      properties: {
        status: {
          type: "string",
          enum: ["captured", "waiting", "unclear"],
          description:
            "'captured' se o lead já passou um valor utilizável. " +
            "'waiting' se o lead NÃO respondeu ainda mas deu sinal de que vai responder em breve (ex: 'só um momento', 'vou buscar aqui', 'posso sim, espera') — NÃO conte isso como recusa. " +
            "'unclear' se o lead recusou, ignorou a pergunta, mudou de assunto, ou não há nenhum sinal de que vai responder.",
        },
        valor: { type: "string", description: "O valor extraído da resposta. Só preencher quando status='captured'." },
      },
      required: ["status"],
    },
  },
};

/**
 * Extrai, via tool calling, o resultado da resposta do lead a uma "Pergunta
 * IA". Distingue "ainda não respondeu mas vai responder" (não deve gerar
 * insistência) de "não ficou claro" (aí sim vale reformular e perguntar de
 * novo) — sem essa distinção a IA insiste mesmo quando o lead já avisou que
 * ia mandar o dado, o que é o maior sinal de "isso é um robô".
 * Não decide validade de formato — isso é responsabilidade do validador
 * determinístico (validateField) aplicado sobre o valor extraído.
 */
export async function extractAiAnswer(
  config: PersonaConfig,
  captureDescription: string,
  leadReply: string
): Promise<{ status: AiAnswerStatus; value: string | null }> {
  const openai = getClient();
  const response = await openai.chat.completions.create({
    model: config.model,
    temperature: 0,
    messages: [
      { role: "system", content: buildPersonaPrompt(config) },
      {
        role: "user",
        content: `Você perguntou ao lead: "${captureDescription}". A resposta dele foi: "${leadReply}". Registre o resultado.`,
      },
    ],
    tools: [CAPTURE_ANSWER_TOOL],
    tool_choice: { type: "function", function: { name: "registrar_resposta" } },
  });

  const toolCall = response.choices[0].message.tool_calls?.[0];
  if (toolCall?.type === "function") {
    const args = JSON.parse(toolCall.function.arguments || "{}");
    const status: AiAnswerStatus = args.status === "captured" || args.status === "waiting" ? args.status : "unclear";
    return { status, value: args.valor || null };
  }
  return { status: "unclear", value: null };
}
