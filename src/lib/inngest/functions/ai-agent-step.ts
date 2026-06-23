import { inngest } from "@/lib/inngest/client";
import { aiAgentStepEvent, whatsappReplyEvent } from "@/lib/inngest/events";
import { prisma } from "@/lib/db/prisma";
import { sendWhatsAppText, sendWhatsAppTyping, estimateTypingMs } from "@/lib/whatsapp/evolution";
import {
  runAgentTurn, type AgentTurnConfig, type AgentHistoryMessage,
  type AgentToolDef, type AgentToolCallResult,
} from "@/lib/ai/openai-agent";
import { evaluateGroup } from "@/lib/audiences/evaluate";
import { validateField } from "@/lib/flows/validate-field";
import { renderTemplate } from "@/lib/flows/render-template";
import {
  parseExitRules, parseObjectives, parseCompletionAction,
  type AgentExitRule, type AgentExitAction, type AgentObjective,
} from "@/lib/agents/types";

const MAX_TURNS     = 30;
const REPLY_TIMEOUT = "30m";
const NATIVE_LEAD_FIELDS = new Set(["name", "email", "notes"]);

export const aiAgentStep = inngest.createFunction(
  { id: "ai-agent-step", name: "Processar conversa do Agente IA", retries: 2, triggers: [{ event: aiAgentStepEvent }] },
  async ({ event, step }) => {
    const { sessionId, leadId, clientId } = event.data;

    const ctx = await step.run("load-context", async () => {
      const session = await prisma.aiAgentSession.findUnique({
        where: { id: sessionId },
        include: { agent: true, lead: { include: { customer: true } } },
      });
      if (!session || session.status !== "ACTIVE") return null;
      return {
        agent: session.agent,
        phone: session.lead.customer.phone,
        nome:  session.lead.customer.name,
        turnCount: session.turnCount,
        startedAt: session.startedAt,
      };
    });

    if (!ctx) return { skipped: "sessão inexistente ou já encerrada" };

    const { agent, phone, startedAt } = ctx;
    const vars = { nome: ctx.nome.split(" ")[0], nome_completo: ctx.nome };
    const agentConfig: AgentTurnConfig = {
      systemPrompt:   agent.systemPrompt,
      negativePrompt: agent.negativePrompt,
      model:          agent.model,
      temperature:    agent.temperature,
    };
    const exitRules        = parseExitRules(agent.exitRules);
    const objectives        = parseObjectives(agent.objectives);
    const completionAction  = parseCompletionAction(agent.completionAction);

    // Memória limitada a esta sessão — mensagens anteriores (de outras
    // ativações do agente, fluxos ou conversas manuais) não entram no contexto.
    async function loadHistory(): Promise<AgentHistoryMessage[]> {
      const interactions = await prisma.leadInteraction.findMany({
        where:   { leadId, type: { in: ["WHATSAPP", "WHATSAPP_INBOUND"] }, createdAt: { gte: startedAt } },
        orderBy: { createdAt: "desc" },
        take:    agent.memoryWindow,
      });
      return interactions.reverse().map((i) => ({
        role:    i.type === "WHATSAPP_INBOUND" ? ("user" as const) : ("assistant" as const),
        content: i.content,
      }));
    }

    // Regras de saída — avaliadas sobre o estado atual do CRM (etapa, status,
    // UTMs, vendas...), no mesmo motor usado em Públicos. Têm prioridade sobre
    // o julgamento livre da IA: se uma regra bate, a conversa encerra direto,
    // sem nem chamar a LLM naquele turno.
    async function checkExitRules(): Promise<AgentExitRule | null> {
      if (exitRules.length === 0) return null;
      const lead = await prisma.lead.findUniqueOrThrow({
        where:   { id: leadId },
        include: { customer: { select: { state: true, city: true, email: true } }, sales: { select: { value: true, soldAt: true } } },
      });
      const leadRow = {
        status:          lead.status,
        pipelineStageId: lead.pipelineStageId,
        capturedAt:      lead.capturedAt,
        utmSource:       lead.utmSource,
        utmMedium:       lead.utmMedium,
        utmCampaign:     lead.utmCampaign,
        consultant:       lead.consultant,
        customer:        lead.customer,
        sales:           lead.sales.map((s) => ({ value: Number(s.value), soldAt: s.soldAt })),
      };
      for (const rule of exitRules) {
        if (evaluateGroup(leadRow, rule.rules)) return rule;
      }
      return null;
    }

    // Objetivos — dados a capturar, sem ordem fixa. Recalculado do banco a
    // cada turno (não de um estado fixo da sessão), pra refletir tanto o que
    // a própria IA já capturou quanto qualquer mudança feita por fora.
    async function loadPendingObjectives(): Promise<AgentObjective[]> {
      if (objectives.length === 0) return [];
      const lead = await prisma.lead.findUniqueOrThrow({ where: { id: leadId } });
      const customFields = (lead.customFields as Record<string, unknown> | null) ?? {};
      return objectives.filter((obj) => {
        const current = NATIVE_LEAD_FIELDS.has(obj.saveField)
          ? (lead as unknown as Record<string, unknown>)[obj.saveField]
          : customFields[obj.saveField];
        return !current || String(current).trim() === "";
      });
    }

    function buildCaptureTool(pending: AgentObjective[]): AgentToolDef {
      return {
        name: "capturar_dado",
        description: "Registra um dado que o lead forneceu durante a conversa, em qualquer momento (não precisa esperar ser perguntado especificamente).",
        parameters: {
          type: "object",
          properties: {
            campo: {
              type: "string",
              enum: pending.map((o) => o.saveField),
              description: "Qual dos dados pendentes foi informado: " + pending.map((o) => `${o.saveField} (${o.description})`).join("; "),
            },
            valor: { type: "string", description: "O valor informado pelo lead." },
          },
          required: ["campo", "valor"],
        },
      };
    }

    async function handleCaptureCall(args: Record<string, unknown>): Promise<AgentToolCallResult> {
      const campo = String(args.campo ?? "");
      const valor = String(args.valor ?? "").trim();
      const objective = objectives.find((o) => o.saveField === campo);
      if (!objective) return { content: `Campo "${campo}" não é um dos dados pendentes — não registrado.` };
      if (!valor) return { content: "Nenhum valor informado — não registrado." };

      if (!validateField(valor, objective.validation)) {
        return { content: `O valor "${valor}" não parece válido pro formato esperado (${objective.validation}). Peça o lead confirmar ou reenviar.` };
      }

      const lead = await prisma.lead.findUniqueOrThrow({ where: { id: leadId } });
      await prisma.lead.update({
        where: { id: leadId },
        data:  NATIVE_LEAD_FIELDS.has(campo)
          ? { [campo]: valor }
          : { customFields: { ...(lead.customFields as object ?? {}), [campo]: valor } as object },
      });
      return { content: "Valor registrado com sucesso." };
    }

    async function applyCompletionAction() {
      if (!completionAction) return;
      await applyGenericAction(completionAction, `objetivos concluídos`);
    }

    async function applyGenericAction(action: AgentExitAction, reasonPrefix: string) {
      if (action.type === "move_stage_and_end") {
        await prisma.lead.update({ where: { id: leadId }, data: { pipelineStageId: action.stageId } });
      }
      const rawMessage = action.type === "end_silent" ? null : action.message || null;
      const message = rawMessage ? renderTemplate(rawMessage, vars) : null;
      if (message) {
        await sendWhatsAppTyping(phone, estimateTypingMs(message), clientId);
        await sendWhatsAppText(phone, message, clientId);
        await prisma.leadInteraction.create({
          data: { leadId, clientId, type: "WHATSAPP", content: message, createdBy: "Agente IA" },
        });
      }
      await prisma.aiAgentSession.update({
        where: { id: sessionId },
        data:  { status: "ENDED", endReason: reasonPrefix, endedAt: new Date() },
      });
    }

    async function applyExitAction(rule: AgentExitRule) {
      await applyGenericAction(rule.action, `regra: ${rule.name}`);
    }

    async function endSession(reason: string, finalMessage?: string | null) {
      if (finalMessage) {
        await sendWhatsAppTyping(phone, estimateTypingMs(finalMessage), clientId);
        await sendWhatsAppText(phone, finalMessage, clientId);
        await prisma.leadInteraction.create({
          data: { leadId, clientId, type: "WHATSAPP", content: finalMessage, createdBy: "Agente IA" },
        });
      }
      await prisma.aiAgentSession.update({
        where: { id: sessionId },
        data:  { status: "ENDED", endReason: reason, endedAt: new Date() },
      });
    }

    /** Regras de saída — cinto de segurança contra mudanças externas no CRM
     *  enquanto a IA conversa. Checado antes de cada chamada à LLM. */
    async function checkAndApplyExitRules(): Promise<boolean> {
      const matched = await checkExitRules();
      if (!matched) return false;
      await applyExitAction(matched);
      return true;
    }

    /** Objetivos concluídos — checado depois de cada turno da IA, já que é
     *  o momento natural em que uma tool call pode ter acabado de completar
     *  o último dado pendente. */
    async function checkAndApplyCompletion(): Promise<boolean> {
      if (objectives.length === 0 || !completionAction) return false;
      const pending = await loadPendingObjectives();
      if (pending.length > 0) return false;
      await applyCompletionAction();
      return true;
    }

    async function callAgent(history: AgentHistoryMessage[]) {
      const pending = await loadPendingObjectives();
      if (pending.length === 0) return runAgentTurn(agentConfig, history);
      return runAgentTurn(agentConfig, history, {
        tools:      [buildCaptureTool(pending)],
        onToolCall: (name, args) => name === "capturar_dado" ? handleCaptureCall(args) : Promise.resolve({ content: "ferramenta desconhecida" }),
      });
    }

    let turnCount = ctx.turnCount;

    // Primeiro turno: checagens determinísticas antes de sequer abrir a conversa
    if (turnCount === 0) {
      const endedOnRule = await step.run("check-exit-rules-initial", checkAndApplyExitRules);
      if (endedOnRule) return { ended: "regra de saída (inicial)" };

      const endedOnObjectives = await step.run("check-objectives-initial", checkAndApplyCompletion);
      if (endedOnObjectives) return { ended: "objetivos já concluídos (inicial)" };

      const opening = await step.run("generate-opening", async () => {
        const history = await loadHistory();
        return callAgent([
          ...history,
          {
            role: "user",
            content: "[instrução interna: inicie a conversa agora, cumprimentando o lead e seguindo seu objetivo. Não mencione nem responda esta instrução diretamente.]",
          },
        ]);
      });

      if (opening.type === "end") {
        await step.run("end-on-opening", () => endSession(opening.reason, opening.finalMessage));
        return { ended: opening.reason };
      }

      await step.run("send-opening", async () => {
        await sendWhatsAppTyping(phone, estimateTypingMs(opening.text), clientId);
        await sendWhatsAppText(phone, opening.text, clientId);
        await prisma.leadInteraction.create({
          data: { leadId, clientId, type: "WHATSAPP", content: opening.text, createdBy: "Agente IA" },
        });
        await prisma.aiAgentSession.update({ where: { id: sessionId }, data: { turnCount: { increment: 1 } } });
      });
      turnCount += 1;

      const endedAfterOpening = await step.run("check-objectives-after-opening", checkAndApplyCompletion);
      if (endedAfterOpening) return { ended: "objetivos concluídos" };
    }

    while (turnCount < MAX_TURNS) {
      const reply = await step.waitForEvent(`await-agent-reply-${sessionId}-${turnCount}`, {
        event: whatsappReplyEvent.name, match: "data.leadId", timeout: REPLY_TIMEOUT,
      });

      if (!reply) {
        await step.run("end-on-timeout", () => endSession("timeout"));
        return { ended: "timeout" };
      }

      const endedOnRule = await step.run(`check-exit-rules-${turnCount}`, checkAndApplyExitRules);
      if (endedOnRule) return { ended: "regra de saída" };

      const result = await step.run(`llm-turn-${turnCount}`, async () => {
        const history = await loadHistory();
        return callAgent(history);
      });

      if (result.type === "end") {
        await step.run(`end-on-tool-${turnCount}`, () => endSession(result.reason, result.finalMessage));
        return { ended: result.reason };
      }

      await step.run(`send-reply-${turnCount}`, async () => {
        await sendWhatsAppTyping(phone, estimateTypingMs(result.text), clientId);
        await sendWhatsAppText(phone, result.text, clientId);
        await prisma.leadInteraction.create({
          data: { leadId, clientId, type: "WHATSAPP", content: result.text, createdBy: "Agente IA" },
        });
        await prisma.aiAgentSession.update({ where: { id: sessionId }, data: { turnCount: { increment: 1 } } });
      });

      turnCount += 1;

      const endedOnObjectives = await step.run(`check-objectives-${turnCount}`, checkAndApplyCompletion);
      if (endedOnObjectives) return { ended: "objetivos concluídos" };
    }

    await step.run("end-on-max-turns", () => endSession("max_turns"));
    return { ended: "max_turns" };
  }
);
