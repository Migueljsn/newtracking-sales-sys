import { inngest } from "@/lib/inngest/client";
import { aiAgentStepEvent, whatsappReplyEvent } from "@/lib/inngest/events";
import { prisma } from "@/lib/db/prisma";
import { sendWhatsAppText, sendWhatsAppTyping, estimateTypingMs } from "@/lib/whatsapp/evolution";
import { runAgentTurn, type AgentTurnConfig, type AgentHistoryMessage } from "@/lib/ai/openai-agent";
import { evaluateGroup } from "@/lib/audiences/evaluate";
import { parseExitRules, type AgentExitRule } from "@/lib/agents/types";

const MAX_TURNS     = 30;
const REPLY_TIMEOUT = "30m";

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
        turnCount: session.turnCount,
        startedAt: session.startedAt,
      };
    });

    if (!ctx) return { skipped: "sessão inexistente ou já encerrada" };

    const { agent, phone, startedAt } = ctx;
    const agentConfig: AgentTurnConfig = {
      systemPrompt:   agent.systemPrompt,
      negativePrompt: agent.negativePrompt,
      model:          agent.model,
      temperature:    agent.temperature,
    };
    const exitRules = parseExitRules(agent.exitRules);

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

    async function applyExitAction(rule: AgentExitRule) {
      const { action } = rule;

      if (action.type === "move_stage_and_end") {
        await prisma.lead.update({ where: { id: leadId }, data: { pipelineStageId: action.stageId } });
      }

      const message = action.type === "end_silent" ? null : action.message || null;
      if (message) {
        await sendWhatsAppTyping(phone, estimateTypingMs(message), clientId);
        await sendWhatsAppText(phone, message, clientId);
        await prisma.leadInteraction.create({
          data: { leadId, clientId, type: "WHATSAPP", content: message, createdBy: "Agente IA" },
        });
      }

      await prisma.aiAgentSession.update({
        where: { id: sessionId },
        data:  { status: "ENDED", endReason: `regra: ${rule.name}`, endedAt: new Date() },
      });
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

    let turnCount = ctx.turnCount;

    // Primeiro turno: checa regras de saída antes de sequer abrir a conversa
    if (turnCount === 0) {
      const matchedInitial = await step.run("check-exit-rules-initial", checkExitRules);
      if (matchedInitial) {
        await step.run("apply-exit-initial", () => applyExitAction(matchedInitial));
        return { ended: `regra: ${matchedInitial.name}` };
      }

      const opening = await step.run("generate-opening", async () => {
        const history = await loadHistory();
        return runAgentTurn(agentConfig, [
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
    }

    while (turnCount < MAX_TURNS) {
      const reply = await step.waitForEvent(`await-agent-reply-${sessionId}-${turnCount}`, {
        event: whatsappReplyEvent.name, match: "data.leadId", timeout: REPLY_TIMEOUT,
      });

      if (!reply) {
        await step.run("end-on-timeout", () => endSession("timeout"));
        return { ended: "timeout" };
      }

      const matched = await step.run(`check-exit-rules-${turnCount}`, checkExitRules);
      if (matched) {
        await step.run(`apply-exit-${turnCount}`, () => applyExitAction(matched));
        return { ended: `regra: ${matched.name}` };
      }

      const result = await step.run(`llm-turn-${turnCount}`, async () => {
        const history = await loadHistory();
        return runAgentTurn(agentConfig, history);
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
    }

    await step.run("end-on-max-turns", () => endSession("max_turns"));
    return { ended: "max_turns" };
  }
);
