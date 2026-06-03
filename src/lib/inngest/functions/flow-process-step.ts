import { inngest }            from "@/lib/inngest/client";
import { flowStepEvent, flowEnrollEvent, whatsappReplyEvent } from "@/lib/inngest/events";
import { prisma }             from "@/lib/db/prisma";
import { evaluateGroup }      from "@/lib/audiences/evaluate";
import type { RuleGroup }     from "@/lib/audiences/types";
import type { Node, Edge }    from "@xyflow/react";
import type {
  FlowMessageData, FlowQuestionData, FlowConditionData,
  FlowChangeStatusData, FlowAssignData, FlowAddToAudienceData,
  FlowStartFlowData,
} from "@/lib/flows/types";

// ─── Validadores ──────────────────────────────────────────────────────────────

function validateField(value: string, type: string): boolean {
  const v = value.trim();
  switch (type) {
    case "cnpj": {
      const d = v.replace(/\D/g, "");
      if (d.length !== 14 || /^(\d)\1+$/.test(d)) return false;
      const calc = (weights: number[]) =>
        weights.reduce((sum, w, i) => sum + Number(d[i]) * w, 0) % 11;
      const r1 = calc([5,4,3,2,9,8,7,6,5,4,3,2]);
      if (Number(d[12]) !== (r1 < 2 ? 0 : 11 - r1)) return false;
      const r2 = calc([6,5,4,3,2,9,8,7,6,5,4,3,2]);
      return Number(d[13]) === (r2 < 2 ? 0 : 11 - r2);
    }
    case "cep":
      return /^\d{8}$/.test(v.replace(/\D/g, ""));
    case "email":
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
    case "phone":
      return /^\d{10,11}$/.test(v.replace(/\D/g, ""));
    case "number":
      return !isNaN(Number(v)) && v !== "";
    default:
      return true;
  }
}

// ─── Graph helpers ────────────────────────────────────────────────────────────

function getNextNodeId(edges: Edge[], currentId: string, branch?: string): string | null {
  const out = edges.filter((e) => {
    if (e.source !== currentId) return false;
    if (branch !== undefined) return e.sourceHandle === branch;
    return true;
  });
  return out[0]?.target ?? null;
}

// ─── WhatsApp helpers (reusa a lógica do journey-process-step) ───────────────

async function resolveWaInstances(clientId: string) {
  const baseUrl = process.env.EVO_API_URL;
  const apiKey  = process.env.EVO_API_KEY;
  if (!baseUrl || !apiKey) throw new Error("[Flow] EVO_API_URL ou EVO_API_KEY ausentes");

  const dbInstances = await prisma.whatsAppInstance.findMany({
    where:   { clientId },
    orderBy: { priority: "asc" },
    select:  { instanceName: true },
  });
  if (!dbInstances.length) throw new Error(`[Flow] Nenhuma instância WhatsApp configurada para cliente ${clientId}`);

  // Verifica status real-time na Evolution API — pula instâncias não conectadas
  const instances: { instanceName: string }[] = [];
  for (const inst of dbInstances) {
    try {
      const res = await fetchWithTimeout(
        `${baseUrl}/instance/fetchInstances?instanceName=${inst.instanceName}`,
        { headers: { apikey: apiKey } },
        5_000
      );
      if (res.ok) {
        const data = await res.json();
        const info = Array.isArray(data) ? data[0] : data;
        const state = info?.connectionStatus ?? "close";
        if (state === "open") {
          instances.push(inst);
        } else {
          console.warn(`[Flow:resolveWaInstances] ${inst.instanceName} status=${state} — ignorando`);
        }
      }
    } catch {
      console.warn(`[Flow:resolveWaInstances] Falha ao checar ${inst.instanceName} — ignorando`);
    }
  }

  if (!instances.length) throw new Error(`[Flow] Nenhuma instância WhatsApp com connectionStatus=open para cliente ${clientId}`);
  return { baseUrl, apiKey, instances };
}

function fmtNumber(phone: string) {
  const d = phone.replace(/\D/g, "");
  return d.startsWith("55") ? d : `55${d}`;
}

function renderTemplate(text: string, vars: Record<string, string>) {
  return text.replace(/\{(\w+)\}/g, (m, k) => vars[k] ?? m);
}

async function fetchWithTimeout(url: string, options: RequestInit, timeoutMs = 10_000): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function sendText(phone: string, text: string, clientId: string) {
  const { baseUrl, apiKey, instances } = await resolveWaInstances(clientId);
  const number = fmtNumber(phone);
  console.log(`[Flow:sendText] number=${number} instances=${instances.map(i => i.instanceName).join(",")}`);
  for (const inst of instances) {
    try {
      const res = await fetchWithTimeout(`${baseUrl}/message/sendText/${inst.instanceName}`, {
        method: "POST", headers: { "Content-Type": "application/json", apikey: apiKey },
        body: JSON.stringify({ number, text }),
      });
      if (res.ok) {
        console.log(`[Flow:sendText] OK via ${inst.instanceName}`);
        return;
      }
      const body = await res.text().catch(() => "");
      console.error(`[Flow:sendText] FAIL ${inst.instanceName}: ${res.status} ${body}`);
    } catch (err) {
      console.error(`[Flow:sendText] ERROR ${inst.instanceName}:`, err);
    }
  }
  throw new Error(`[Flow] Falha ao enviar texto para ${number} — todas instâncias falharam`);
}

async function sendDocument(phone: string, url: string, fileName: string, caption: string, clientId: string) {
  const { baseUrl, apiKey, instances } = await resolveWaInstances(clientId);
  const number = fmtNumber(phone);
  for (const inst of instances) {
    const res = await fetchWithTimeout(`${baseUrl}/message/sendMedia/${inst.instanceName}`, {
      method: "POST", headers: { "Content-Type": "application/json", apikey: apiKey },
      body: JSON.stringify({ number, media: url, caption, mediatype: "document", fileName }),
    });
    if (res.ok) return;
  }
  throw new Error(`[Flow] Falha ao enviar documento para ${phone}`);
}

async function sendMedia(phone: string, url: string, caption: string, clientId: string) {
  const { baseUrl, apiKey, instances } = await resolveWaInstances(clientId);
  const number = fmtNumber(phone);
  for (const inst of instances) {
    const res = await fetchWithTimeout(`${baseUrl}/message/sendMedia/${inst.instanceName}`, {
      method: "POST", headers: { "Content-Type": "application/json", apikey: apiKey },
      body: JSON.stringify({ number, media: url, caption, mediatype: "image" }),
    });
    if (res.ok) return;
  }
  throw new Error(`[Flow] Falha ao enviar mídia para ${phone}`);
}

const EMOJI_NUMS = ["1️⃣","2️⃣","3️⃣","4️⃣","5️⃣","6️⃣","7️⃣","8️⃣","9️⃣"];

async function sendButtons(phone: string, message: string, buttons: { id: string; text: string }[], clientId: string) {
  const lines = buttons.map((b, i) => `${EMOJI_NUMS[i] ?? `${i + 1}.`} ${b.text}`);
  const text  = `${message}\n\n${lines.join("\n")}`;
  await sendText(phone, text, clientId);
}

// Aceita: número ("1"), número com pontuação ("1.", "1)"),
// texto exato, resposta que contém o texto da opção, ou texto que contém a resposta curta
function matchButton(
  reply: string,
  buttons: { id: string; text: string }[]
): { id: string; text: string } | undefined {
  const r = reply.trim().toLowerCase();

  // 1. Começa com o número da opção
  for (let i = 0; i < buttons.length; i++) {
    const n = String(i + 1);
    if (r === n || r.startsWith(`${n} `) || r.startsWith(`${n}.`) || r.startsWith(`${n})`)) {
      return buttons[i];
    }
  }

  // 2. Texto exato
  const exact = buttons.find(b => b.text.toLowerCase() === r);
  if (exact) return exact;

  // 3. Resposta contém o texto da opção
  const contains = buttons.find(b => r.includes(b.text.toLowerCase()));
  if (contains) return contains;

  // 4. Texto da opção contém a resposta (respostas curtas, mín 2 chars)
  if (r.length >= 2) {
    const reverse = buttons.find(b => b.text.toLowerCase().includes(r));
    if (reverse) return reverse;
  }

  return undefined;
}

// ─── Enrolador de fluxo ───────────────────────────────────────────────────────

export const flowEnroll = inngest.createFunction(
  { id: "flow-enroll", name: "Enrolar lead em fluxo", retries: 2, triggers: [{ event: flowEnrollEvent }] },
  async ({ event, step }) => {
    const { flowId, leadId, clientId } = event.data;

    const existing = await step.run("check-existing", () =>
      prisma.flowEnrollment.findUnique({ where: { flowId_leadId: { flowId, leadId } } })
    );
    if (existing) return { skipped: "já enrolado" };

    const flow = await step.run("load-flow", () =>
      prisma.flow.findUniqueOrThrow({ where: { id: flowId, clientId } })
    );
    if (flow.status !== "ACTIVE") return { skipped: "fluxo inativo" };

    const nodes = flow.nodes as unknown as Node[];
    const startNode = nodes.find((n) => n.type === "trigger");
    if (!startNode) return { error: "sem nó trigger" };

    const firstEdge = (flow.edges as unknown as Edge[]).find((e) => e.source === startNode.id);
    const firstNode = firstEdge ? nodes.find((n) => n.id === firstEdge.target) : null;
    if (!firstNode) return { skipped: "fluxo sem nós após trigger" };

    const enrollment = await step.run("create-enrollment", () =>
      prisma.flowEnrollment.create({
        data: { flowId, leadId, clientId, currentNode: firstNode.id, context: {} },
      })
    );

    await step.sendEvent("start-step",
      flowStepEvent.create({ enrollmentId: enrollment.id, flowId, leadId, nodeId: firstNode.id, clientId })
    );

    return { enrollmentId: enrollment.id };
  }
);

// ─── Executor de passo ────────────────────────────────────────────────────────

export const flowProcessStep = inngest.createFunction(
  { id: "flow-process-step", name: "Executar passo do fluxo", retries: 2, triggers: [{ event: flowStepEvent }] },
  async ({ event, step }) => {
    const { enrollmentId, flowId, leadId, nodeId, clientId } = event.data;

    const [enrollment, flow, lead] = await step.run("load-data", () =>
      Promise.all([
        prisma.flowEnrollment.findUniqueOrThrow({ where: { id: enrollmentId } }),
        prisma.flow.findUniqueOrThrow({ where: { id: flowId, clientId } }),
        prisma.lead.findUniqueOrThrow({
          where:   { id: leadId },
          include: {
            customer: { select: { name: true, phone: true, email: true, state: true, city: true } },
            sales:    { select: { value: true, soldAt: true } },
          },
        }),
      ])
    );

    if (enrollment.status !== "ACTIVE") return { skipped: "enrollment inativo" };
    if (flow.status !== "ACTIVE") {
      await step.run("exit", () =>
        prisma.flowEnrollment.update({ where: { id: enrollmentId }, data: { status: "EXITED" } })
      );
      return { skipped: "fluxo pausado" };
    }

    const nodes = flow.nodes as unknown as Node[];
    const edges = flow.edges as unknown as Edge[];
    const node  = nodes.find((n) => n.id === nodeId);
    if (!node) return { error: `Nó ${nodeId} não encontrado` };

    const phone = lead.customer.phone;
    const vars: Record<string, string> = {
      nome:          lead.customer.name.split(" ")[0],
      nome_completo: lead.customer.name,
      telefone:      phone,
      email:         lead.customer.email ?? "",
    };

    const ctx = enrollment.context as Record<string, unknown>;

    let nextNodeId: string | null = null;
    let nodeResult = "advanced";

    switch (node.type) {

      // ── trigger: nó visual, pula direto ──────────────────────────────────
      case "trigger": {
        nextNodeId = getNextNodeId(edges, nodeId);
        break;
      }

      // ── message ───────────────────────────────────────────────────────────
      case "message": {
        const d = node.data as unknown as FlowMessageData;

        // Suporta novo formato (messages[]) e legado (messageType/text direto)
        const msgs: import("@/lib/flows/types").FlowMessageItem[] =
          d.messages?.length
            ? d.messages
            : [{ messageType: d.messageType ?? "text", text: d.text ?? "", mediaUrl: d.mediaUrl ?? null, fileName: d.fileName ?? null, delaySeconds: 0 }];

        for (let i = 0; i < msgs.length; i++) {
          const msg = msgs[i];
          if (i > 0 && msg.delaySeconds > 0) {
            await step.sleep(`delay-msg-${nodeId}-${i}`, `${msg.delaySeconds}s`);
          }
          await step.run(`send-message-${nodeId}-${i}`, async () => {
            const text = renderTemplate(msg.text, vars);
            if (msg.messageType === "document" && msg.mediaUrl) {
              await sendDocument(phone, msg.mediaUrl, msg.fileName ?? "arquivo.pdf", text, clientId);
            } else if (msg.messageType === "media" && msg.mediaUrl) {
              await sendMedia(phone, msg.mediaUrl, text, clientId);
            } else {
              await sendText(phone, text, clientId);
            }
            await prisma.leadInteraction.create({
              data: { leadId, clientId, type: "WHATSAPP", content: `[Fluxo] ${text.slice(0, 120)}` },
            }).catch(() => {});
          });
        }

        nextNodeId = getNextNodeId(edges, nodeId);
        break;
      }

      // ── question ──────────────────────────────────────────────────────────
      case "question": {
        const d        = node.data as unknown as FlowQuestionData;
        const unitMap: Record<string, string> = { minutes: "m", hours: "h" };
        const attempts = (ctx[`${nodeId}_attempts`] as number | undefined) ?? 0;

        // ── modo choice (botões) ──────────────────────────────────────────
        if (d.mode === "choice") {
          if (attempts === 0) {
            await step.run("send-choice-question", async () => {
              const text = renderTemplate(d.questionText, vars);
              await sendButtons(phone, text, d.buttons, clientId);
            });
          }

          const timeout1 = `${d.timeoutValue}${unitMap[d.timeoutUnit] ?? "m"}`;
          const reply = await step.waitForEvent(`await-choice-${nodeId}`, {
            event: whatsappReplyEvent.name, match: "data.leadId", timeout: timeout1,
          });

          if (reply) {
            const pressed  = matchButton(reply.data.message, d.buttons);
            const outHandle = pressed ? `btn_${pressed.id}` : "btn_1";
            nodeResult  = `choice_${pressed?.id ?? "unknown"}`;
            nextNodeId  = getNextNodeId(edges, nodeId, outHandle);
          } else {
            // timeout → envia mensagem de recuperação e aguarda mais
            await step.run("send-timeout-msg", async () => {
              await sendText(phone, renderTemplate(d.timeoutMessage, vars), clientId);
            });
            const timeout2 = `${d.timeoutWaitValue}${unitMap[d.timeoutWaitUnit] ?? "m"}`;
            const reply2 = await step.waitForEvent(`await-choice-recovery-${nodeId}`, {
              event: whatsappReplyEvent.name, match: "data.leadId", timeout: timeout2,
            });
            if (reply2) {
              const pressed  = matchButton(reply2.data.message, d.buttons);
              const outHandle = pressed ? `btn_${pressed.id}` : "btn_1";
              nodeResult  = `choice_${pressed?.id ?? "unknown"}`;
              nextNodeId  = getNextNodeId(edges, nodeId, outHandle);
            } else {
              nodeResult = "timeout";
              nextNodeId = getNextNodeId(edges, nodeId, "timeout");
            }
          }
          break;
        }

        // ── modo text (coleta de dado) ────────────────────────────────────
        const maxAttempts = d.retries;

        if (attempts === 0) {
          await step.run("send-text-question", async () => {
            await sendText(phone, renderTemplate(d.questionText, vars), clientId);
          });
        }

        const timeout1 = `${d.timeoutValue}${unitMap[d.timeoutUnit] ?? "m"}`;
        const reply = await step.waitForEvent(`await-text-${nodeId}-${attempts}`, {
          event: whatsappReplyEvent.name, match: "data.leadId", timeout: timeout1,
        });

        if (!reply) {
          // timeout → mensagem de recuperação
          await step.run("send-timeout-msg", async () => {
            await sendText(phone, renderTemplate(d.timeoutMessage, vars), clientId);
          });
          const timeout2 = `${d.timeoutWaitValue}${unitMap[d.timeoutWaitUnit] ?? "m"}`;
          const reply2 = await step.waitForEvent(`await-text-recovery-${nodeId}`, {
            event: whatsappReplyEvent.name, match: "data.leadId", timeout: timeout2,
          });
          if (!reply2) {
            nodeResult = "timeout";
            nextNodeId = getNextNodeId(edges, nodeId, "timeout");
            break;
          }
          // processamento da resposta após recovery (cai no mesmo fluxo abaixo via goto)
          const answer = reply2.data.message.trim();
          const valid  = validateField(answer, d.validation);
          if (valid) {
            await step.run("save-field-recovery", () =>
              prisma.lead.update({
                where: { id: leadId },
                data:  { customFields: { ...(lead.customFields as object ?? {}), [d.saveField]: answer } },
              })
            );
            nodeResult = "valid";
            nextNodeId = getNextNodeId(edges, nodeId, "valid");
          } else {
            nodeResult = "invalid";
            nextNodeId = getNextNodeId(edges, nodeId, "invalid");
          }
          break;
        }

        const answer = reply.data.message.trim();
        const valid  = validateField(answer, d.validation);

        if (valid) {
          await step.run("save-field", () =>
            prisma.lead.update({
              where: { id: leadId },
              data:  { customFields: { ...(lead.customFields as Record<string, string> ?? {}), [d.saveField]: answer } as object },
            })
          );
          nodeResult = "valid";
          nextNodeId = getNextNodeId(edges, nodeId, "valid");
        } else if (attempts < maxAttempts) {
          // retentar: atualiza contexto e re-dispara o mesmo nó
          await step.run("save-attempt", () =>
            prisma.flowEnrollment.update({
              where: { id: enrollmentId },
              data:  { context: { ...ctx, [`${nodeId}_attempts`]: attempts + 1 } as object },
            })
          );
          await step.run("send-retry-msg", async () => {
            await sendText(phone, renderTemplate(d.retryMessage, vars), clientId);
          });
          // re-agenda o mesmo nó
          await step.run("log-retry", () =>
            prisma.flowNodeLog.create({
              data: { enrollmentId, flowId, leadId, clientId, nodeId, nodeType: node.type!, result: `retry_${attempts + 1}` },
            })
          );
          await step.sendEvent("retry-step",
            flowStepEvent.create({ enrollmentId, flowId, leadId, nodeId, clientId })
          );
          return { result: `retry_${attempts + 1}` };
        } else {
          nodeResult = "invalid";
          nextNodeId = getNextNodeId(edges, nodeId, "invalid");
        }
        break;
      }

      // ── condition ─────────────────────────────────────────────────────────
      case "condition": {
        const d      = node.data as unknown as FlowConditionData;
        const leadRow = {
          status: lead.status, pipelineStageId: lead.pipelineStageId,
          capturedAt: new Date(lead.capturedAt as unknown as string),
          utmSource: lead.utmSource, utmMedium: lead.utmMedium, utmCampaign: lead.utmCampaign,
          consultant: lead.consultant,
          customer: { ...lead.customer, state: lead.customer.state ?? null, city: lead.customer.city ?? null },
          sales: lead.sales.map(s => ({ value: Number(s.value), soldAt: new Date(s.soldAt as unknown as string) })),
        };
        const passed = evaluateGroup(leadRow, {
          id: "cond", operator: "AND",
          rules: [{ id: "r", field: d.field, operator: d.operator, value: d.value }],
        } as RuleGroup);
        nodeResult = passed ? "condition_true" : "condition_false";
        nextNodeId = getNextNodeId(edges, nodeId, passed ? "true" : "false");
        break;
      }

      // ── changeStatus ──────────────────────────────────────────────────────
      case "changeStatus": {
        const d = node.data as unknown as FlowChangeStatusData;
        await step.run("change-status", () => {
          if (d.action === "lost") {
            return prisma.lead.update({
              where: { id: leadId },
              data:  { status: "LOST", pipelineStageId: null },
            });
          }
          if (d.stageId) {
            return prisma.lead.update({
              where: { id: leadId },
              data:  { pipelineStageId: d.stageId },
            });
          }
          return Promise.resolve();
        });
        nextNodeId = getNextNodeId(edges, nodeId);
        break;
      }

      // ── assign ────────────────────────────────────────────────────────────
      case "assign": {
        const d = node.data as unknown as FlowAssignData;
        if (d.consultant) {
          await step.run("assign", () =>
            prisma.lead.update({ where: { id: leadId }, data: { consultant: d.consultant } })
          );
        }
        nextNodeId = getNextNodeId(edges, nodeId);
        break;
      }

      // ── addToAudience ─────────────────────────────────────────────────────
      case "addToAudience": {
        const d = node.data as unknown as FlowAddToAudienceData;
        if (d.audienceId) {
          await step.run("add-to-audience", () =>
            prisma.audienceMembership.upsert({
              where:  { audienceId_leadId: { audienceId: d.audienceId!, leadId } },
              create: { audienceId: d.audienceId!, leadId, clientId },
              update: {},
            })
          );
        }
        nextNodeId = getNextNodeId(edges, nodeId);
        break;
      }

      // ── startFlow ─────────────────────────────────────────────────────────
      case "startFlow": {
        const d = node.data as unknown as FlowStartFlowData;
        if (d.targetFlowId) {
          await step.run("complete-current", () =>
            prisma.flowEnrollment.update({
              where: { id: enrollmentId },
              data:  { status: "COMPLETED", completedAt: new Date() },
            })
          );
          await step.run("log-end", () =>
            prisma.flowNodeLog.create({
              data: { enrollmentId, flowId, leadId, clientId, nodeId, nodeType: node.type!, result: "started_next_flow" },
            })
          );
          await step.sendEvent("start-next-flow",
            flowEnrollEvent.create({ flowId: d.targetFlowId, leadId, clientId })
          );
          return { result: "started_next_flow", targetFlowId: d.targetFlowId };
        }
        nextNodeId = getNextNodeId(edges, nodeId);
        break;
      }

      // ── end ───────────────────────────────────────────────────────────────
      case "end": {
        await step.run("complete", () =>
          prisma.flowEnrollment.update({
            where: { id: enrollmentId },
            data:  { status: "COMPLETED", completedAt: new Date() },
          })
        );
        await step.run("log-end", () =>
          prisma.flowNodeLog.create({
            data: { enrollmentId, flowId, leadId, clientId, nodeId, nodeType: node.type!, result: "completed" },
          })
        );
        return { result: "completed" };
      }
    }

    // ── log + avançar ─────────────────────────────────────────────────────────
    await step.run("log-node", () =>
      prisma.flowNodeLog.create({
        data: { enrollmentId, flowId, leadId, clientId, nodeId, nodeType: node.type!, result: nodeResult },
      })
    );

    if (!nextNodeId) {
      await step.run("complete-no-next", () =>
        prisma.flowEnrollment.update({
          where: { id: enrollmentId },
          data:  { status: "COMPLETED", completedAt: new Date() },
        })
      );
      return { result: "completed (no next node)" };
    }

    await step.run("update-node", () =>
      prisma.flowEnrollment.update({
        where: { id: enrollmentId },
        data:  { currentNode: nextNodeId!, context: {} },
      })
    );

    await step.sendEvent("next-step",
      flowStepEvent.create({ enrollmentId, flowId, leadId, nodeId: nextNodeId, clientId })
    );

    return { result: "advanced", nextNodeId };
  }
);
