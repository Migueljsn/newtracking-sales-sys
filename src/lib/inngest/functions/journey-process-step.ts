import { Resend }        from "resend";
import { inngest }        from "@/lib/inngest/client";
import { stepEvent }      from "@/lib/inngest/events";
import { prisma }         from "@/lib/db/prisma";
import { evaluateGroup }  from "@/lib/audiences/evaluate";
import { isInSendWindow, nextWindowStart } from "@/lib/journeys/send-window";
import { unsubscribeUrl } from "@/lib/email/unsubscribe";
import type { SendWindowConfig } from "@/lib/journeys/send-window";
import type { RuleGroup } from "@/lib/audiences/types";
import type { Node, Edge } from "@xyflow/react";
import type {
  WaitData, ConditionData, EmailData,
  WhatsAppData, ChangeStatusData, AssignData,
} from "@/lib/journeys/types";
function getResend() { return new Resend(process.env.RESEND_API_KEY); }

// ─── Graph helpers ─────────────────────────────────────────────────────────────

function getNextNodeId(
  edges: Edge[],
  currentNodeId: string,
  branch?: string
): string | null {
  const out = edges.filter((e) => {
    if (e.source !== currentNodeId) return false;
    if (branch !== undefined) return e.sourceHandle === branch;
    return true;
  });
  return out[0]?.target ?? null;
}

// ─── Template render ───────────────────────────────────────────────────────────

function renderTemplate(
  template: string,
  vars: Record<string, string>
): string {
  return template.replace(/\{(\w+)\}|\((\w+)\)/g, (match, key1, key2) => {
    const key = key1 ?? key2;
    return vars[key] ?? match;
  });
}

function buildLeadVars(
  lead: { consultant: string | null; sales: { value: unknown; soldAt: unknown }[] },
  customer: { name: string; phone: string; email: string | null },
  clientName: string
): Record<string, string> {
  const sorted  = [...lead.sales].sort((a, b) =>
    new Date(b.soldAt as string).getTime() - new Date(a.soldAt as string).getTime()
  );
  const last      = sorted[0];
  const daysSince = last
    ? Math.floor((Date.now() - new Date(last.soldAt as string).getTime()) / 86_400_000)
    : 0;
  const totalLtv  = lead.sales.reduce((sum, s) => sum + Number(s.value), 0);

  return {
    nome:               customer.name.split(" ")[0],
    nome_completo:      customer.name,
    telefone:           customer.phone,
    email:              customer.email ?? "",
    consultor:          lead.consultant ?? "",
    empresa:            clientName,
    dias:               String(daysSince),
    data_ultima_compra: last
      ? new Date(last.soldAt as string).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })
      : "",
    valor_ultima_compra: last
      ? Number(last.value).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
      : "",
    total_compras:      String(lead.sales.length),
    valor_total_ltv:    totalLtv.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }),
  };
}

// ─── WhatsApp via EvoAPI ───────────────────────────────────────────────────────

async function resolveWaInstances(clientId: string) {
  const baseUrl = process.env.EVO_API_URL;
  const apiKey  = process.env.EVO_API_KEY;

  if (!baseUrl || !apiKey) throw new Error("[Journey] EVO_API_URL ou EVO_API_KEY não configurados nas env vars");

  const dbInstances = await prisma.whatsAppInstance.findMany({
    where:   { clientId },
    orderBy: { priority: "asc" },
    select:  { instanceName: true },
  });

  if (dbInstances.length === 0) throw new Error(`[Journey] Nenhuma instância WhatsApp configurada para cliente ${clientId}`);

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
          console.warn(`[Journey:resolveWaInstances] ${inst.instanceName} status=${state} — ignorando`);
        }
      }
    } catch {
      console.warn(`[Journey:resolveWaInstances] Falha ao checar ${inst.instanceName} — ignorando`);
    }
  }

  if (instances.length === 0) throw new Error(`[Journey] Nenhuma instância WhatsApp com connectionStatus=open para cliente ${clientId}`);

  return { baseUrl, apiKey, instances };
}

function formatWaNumber(phone: string) {
  const digits = phone.replace(/\D/g, "");
  return digits.startsWith("55") ? digits : `55${digits}`;
}

const IMAGE_EXTS    = new Set(["jpg","jpeg","png","gif","webp","bmp","svg"]);
const VIDEO_EXTS    = new Set(["mp4","avi","mov","mkv","webm","3gp","m4v"]);
const MIME_MAP: Record<string, string> = {
  jpg:"image/jpeg", jpeg:"image/jpeg", png:"image/png", gif:"image/gif",
  webp:"image/webp", bmp:"image/bmp", svg:"image/svg+xml",
  mp4:"video/mp4",  mov:"video/quicktime", avi:"video/x-msvideo",
  mkv:"video/x-matroska", webm:"video/webm", "3gp":"video/3gpp",
  pdf:"application/pdf", doc:"application/msword",
  docx:"application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls:"application/vnd.ms-excel",
  xlsx:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};

function detectMediaType(url: string): { mediatype: "image" | "video" | "document"; mimetype: string; fileName?: string } {
  const clean = url.split("?")[0].toLowerCase();
  const ext   = clean.split(".").pop() ?? "";
  const mimetype = MIME_MAP[ext] ?? "application/octet-stream";
  if (IMAGE_EXTS.has(ext)) return { mediatype: "image", mimetype };
  if (VIDEO_EXTS.has(ext)) return { mediatype: "video", mimetype };
  const fileName = clean.split("/").pop() ?? "arquivo";
  return { mediatype: "document", mimetype, fileName };
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

async function sendWhatsApp(phone: string, message: string, clientId: string): Promise<void> {
  const { baseUrl, apiKey, instances } = await resolveWaInstances(clientId);
  const number = formatWaNumber(phone);

  for (const inst of instances) {
    const res = await fetchWithTimeout(`${baseUrl}/message/sendText/${inst.instanceName}`, {
      method:  "POST",
      headers: { "Content-Type": "application/json", apikey: apiKey },
      body:    JSON.stringify({ number, text: message }),
    });
    if (res.ok) return;
    const err = await res.text().catch(() => "(sem corpo)");
    console.warn(`[Journey] Falha na instância ${inst.instanceName} — status ${res.status}: ${err}`);
  }

  throw new Error(`[Journey] Todas as instâncias falharam ao enviar para ${phone}`);
}

async function sendWhatsAppMedia(phone: string, mediaUrl: string, caption: string, clientId: string): Promise<void> {
  const { baseUrl, apiKey, instances } = await resolveWaInstances(clientId);
  const number = formatWaNumber(phone);
  const { mediatype, mimetype, fileName } = detectMediaType(mediaUrl);

  for (const inst of instances) {
    const res = await fetchWithTimeout(`${baseUrl}/message/sendMedia/${inst.instanceName}`, {
      method:  "POST",
      headers: { "Content-Type": "application/json", apikey: apiKey },
      body:    JSON.stringify({ number, media: mediaUrl, caption, mediatype, mimetype, ...(fileName ? { fileName } : {}) }),
    });
    if (res.ok) return;
    const errBody = await res.text().catch(() => "(sem corpo)");
    console.warn(`[Journey] Falha de mídia na instância ${inst.instanceName} — status ${res.status} mediatype=${mediatype}: ${errBody}`);
  }

  throw new Error(`[Journey] Todas as instâncias falharam ao enviar mídia para ${phone}`);
}

async function sendWhatsAppAudio(phone: string, audioUrl: string, clientId: string): Promise<void> {
  const { baseUrl, apiKey, instances } = await resolveWaInstances(clientId);
  const number = formatWaNumber(phone);

  for (const inst of instances) {
    const res = await fetchWithTimeout(`${baseUrl}/message/sendWhatsAppAudio/${inst.instanceName}`, {
      method:  "POST",
      headers: { "Content-Type": "application/json", apikey: apiKey },
      body:    JSON.stringify({ number, audio: audioUrl }),
    });
    if (res.ok) return;
    const errBody = await res.text().catch(() => "(sem corpo)");
    console.warn(`[Journey] Falha de áudio na instância ${inst.instanceName} — status ${res.status}: ${errBody}`);
  }

  throw new Error(`[Journey] Todas as instâncias falharam ao enviar áudio para ${phone}`);
}


// ─── Main function ─────────────────────────────────────────────────────────────

export const journeyProcessStep = inngest.createFunction(
  {
    id:       "journey-process-step",
    name:     "Executar passo da jornada",
    retries:  3,
    triggers: [{ event: stepEvent }],
  },
  async ({ event, step }) => {
    const { enrollmentId, journeyId, leadId, nodeId, clientId } = event.data;

    // ── Carregar dados ──────────────────────────────────────────────────────────
    const [enrollment, journey, lead, client] = await step.run("load-data", () =>
      Promise.all([
        prisma.journeyEnrollment.findUniqueOrThrow({ where: { id: enrollmentId } }),
        prisma.journey.findUniqueOrThrow({ where: { id: journeyId, clientId } }),
        prisma.lead.findUniqueOrThrow({
          where:   { id: leadId },
          include: {
            customer: { select: { name: true, phone: true, email: true, state: true, city: true, emailOptOut: true } },
            sales:    { select: { value: true, soldAt: true } },
          },
        }),
        prisma.client.findUniqueOrThrow({ where: { id: clientId }, select: { name: true } }),
      ])
    );

    // Parar se enrollment não está mais ativo
    if (enrollment.status !== "ACTIVE") return { skipped: "enrollment not active" };

    // Parar se jornada foi pausada/arquivada
    if (journey.status !== "ACTIVE") {
      await step.run("exit-enrollment", () =>
        prisma.journeyEnrollment.update({
          where: { id: enrollmentId },
          data:  { status: "EXITED" },
        })
      );
      return { skipped: "journey paused — enrollment exited" };
    }

    const nodes = journey.nodes as unknown as Node[];
    const edges = journey.edges as unknown as Edge[];
    const node  = nodes.find((n) => n.id === nodeId);

    if (!node) {
      await step.run("fail-enrollment", () =>
        prisma.journeyEnrollment.update({
          where: { id: enrollmentId },
          data:  { status: "FAILED" },
        })
      );
      return { error: `Node ${nodeId} not found` };
    }

    const leadRow = {
      status:          lead.status,
      pipelineStageId: lead.pipelineStageId,
      capturedAt:      new Date(lead.capturedAt as unknown as string),
      utmSource:       lead.utmSource,
      utmMedium:       lead.utmMedium,
      utmCampaign:     lead.utmCampaign,
      consultant:      lead.consultant,
      customer:        lead.customer,
      sales:           lead.sales.map((s) => ({ value: Number(s.value), soldAt: new Date(s.soldAt as unknown as string) })),
    };

    // ── Executar nó ──────────────────────────────────────────────────────────────
    let nextNodeId: string | null = null;
    let nodeResult = "advanced";

    switch (node.type) {

      case "trigger": {
        nextNodeId = getNextNodeId(edges, nodeId);
        break;
      }

      case "wait": {
        const d = node.data as unknown as WaitData;
        if (d.mode === "datetime" && d.datetime) {
          await step.sleepUntil("wait-step", new Date(d.datetime));
        } else {
          const amount = d.amount ?? d.days ?? 1;
          const unit   = d.unit ?? "days";
          const unitMap: Record<string, string> = { minutes: "m", hours: "h", days: "d" };
          await step.sleep("wait-step", `${amount}${unitMap[unit] ?? "d"}`);
        }
        nextNodeId = getNextNodeId(edges, nodeId);
        break;
      }

      case "condition": {
        const d      = node.data as unknown as ConditionData;
        const passed = evaluateGroup(leadRow, {
          id:       "cond",
          operator: "AND",
          rules:    [{ id: "r", field: d.field, operator: d.operator, value: d.value }],
        } as RuleGroup);
        nodeResult = passed ? "condition_true" : "condition_false";
        nextNodeId = getNextNodeId(edges, nodeId, passed ? "true" : "false");
        break;
      }

      case "email": {
        const d          = node.data as unknown as EmailData;
        const sendWindow = journey.sendWindow as SendWindowConfig | null;

        if (sendWindow?.enabled && !isInSendWindow(sendWindow)) {
          const resumeAt = nextWindowStart(sendWindow);
          await step.sleepUntil("wait-for-send-window", resumeAt);
        }

        if (d.templateId && lead.customer?.email && !lead.customer?.emailOptOut) {
          await step.run("send-email", async () => {
            const template = await prisma.emailTemplate.findUnique({ where: { id: d.templateId! } });
            if (!template || !lead.customer) return;

            const unsubLink = unsubscribeUrl(lead.customerId, clientId);
            const vars      = { ...buildLeadVars(lead, lead.customer, client.name), unsub_url: unsubLink };
            const subject   = renderTemplate(template.subject, vars);
            const html      = renderTemplate(template.body,    vars);

            const { data, error } = await getResend().emails.send({
              from:    `${client.name} via Portal CRM <noreply@fonilcompany.com.br>`,
              to:      [lead.customer.email!],
              subject,
              html,
              headers: {
                "List-Unsubscribe":      `<${unsubLink}>`,
                "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
              },
            });

            if (error) {
              console.error("[Journey] Resend error:", error);
              throw new Error(`Resend: ${error.message}`);
            }

            await prisma.leadInteraction.create({
              data: {
                leadId,
                clientId,
                type:      "NOTE",
                content:   `[Jornada] E-mail enviado: "${subject}"`,
                createdBy: `Jornada: ${journey.name}`,
              },
            }).catch(() => {});

            return { messageId: data?.id };
          });
          nodeResult = "email_sent";
        } else if (lead.customer?.emailOptOut) {
          nodeResult = "email_skipped_optout";
        } else {
          nodeResult = "email_skipped";
        }

        nextNodeId = getNextNodeId(edges, nodeId);
        break;
      }

      case "whatsapp": {
        const d          = node.data as unknown as WhatsAppData;
        const sendWindow = journey.sendWindow as SendWindowConfig | null;

        if (sendWindow?.enabled && !isInSendWindow(sendWindow)) {
          const resumeAt = nextWindowStart(sendWindow);
          await step.sleepUntil("wait-for-send-window", resumeAt);
        }

        const isDirectMode = d.messageMode === "direct";
        const canSend = lead.customer?.phone && (isDirectMode ? !!d.directText : !!d.templateId);

        if (canSend) {
          const unitSec: Record<string, number> = { seconds: 1, minutes: 60, hours: 3600 };
          const factor   = unitSec[d.delayUnit ?? "seconds"] ?? 1;
          const minSec   = (d.delayMin ?? 5)  * factor;
          const maxSec   = (d.delayMax ?? 30) * factor;
          const delaySec = Math.floor(Math.random() * (maxSec - minSec + 1)) + minSec;

          if (delaySec > 0) {
            await step.sleep("whatsapp-delay", `${delaySec}s`);
          }

          await step.run("send-whatsapp", async () => {
            if (!lead.customer) throw new Error("lead.customer ausente");

            const vars = buildLeadVars(lead, lead.customer, client.name);

            if (isDirectMode) {
              const message = renderTemplate(d.directText!, vars);
              await sendWhatsApp(lead.customer.phone, message, clientId);
              await prisma.leadInteraction.create({
                data: {
                  leadId,
                  clientId,
                  type:      "WHATSAPP",
                  content:   `[Jornada] WhatsApp enviado: "${message.slice(0, 120)}${message.length > 120 ? "…" : ""}"`,
                  createdBy: `Jornada: ${journey.name}`,
                },
              }).catch(() => {});
            } else {
              const template = await prisma.emailTemplate.findUnique({ where: { id: d.templateId! } });
              if (!template) throw new Error(`Template ${d.templateId} não encontrado`);

              const message = template.waType === "MEDIA"
                ? renderTemplate(template.mediaCaption ?? "", vars)
                : renderTemplate(template.body, vars);

              if (template.waType === "MEDIA" && template.mediaUrl) {
                await sendWhatsAppMedia(lead.customer.phone, template.mediaUrl, message, clientId);
              } else if (template.waType === "AUDIO" && template.mediaUrl) {
                await sendWhatsAppAudio(lead.customer.phone, template.mediaUrl, clientId);
              } else {
                await sendWhatsApp(lead.customer.phone, message, clientId);
              }

              await prisma.leadInteraction.create({
                data: {
                  leadId,
                  clientId,
                  type:      "WHATSAPP",
                  content:   `[Jornada] WhatsApp enviado: "${message.slice(0, 120)}${message.length > 120 ? "…" : ""}"`,
                  createdBy: `Jornada: ${journey.name}`,
                },
              }).catch(() => {});
            }
          });
          nodeResult = "whatsapp_sent";
        } else {
          nodeResult = "whatsapp_skipped";
        }

        nextNodeId = getNextNodeId(edges, nodeId);
        break;
      }

      case "changeStatus": {
        const d = node.data as unknown as ChangeStatusData;

        await step.run("change-status", () => {
          if (d.action === "lost") {
            return prisma.lead.update({
              where: { id: leadId },
              data:  { status: "LOST", pipelineStageId: null, statusHistory: { create: { from: leadRow.status, to: "LOST", changedBy: "Jornada" } } },
            });
          }
          if (d.stageId) {
            return prisma.lead.update({
              where: { id: leadId },
              data:  { pipelineStageId: d.stageId, statusHistory: { create: { to: d.stageId, changedBy: "Jornada" } } },
            });
          }
          return Promise.resolve();
        });

        nextNodeId = getNextNodeId(edges, nodeId);
        break;
      }

      case "assign": {
        const d = node.data as unknown as AssignData;

        if (d.consultant) {
          await step.run("assign-consultant", () =>
            prisma.lead.update({
              where: { id: leadId },
              data:  { consultant: d.consultant },
            })
          );
        }

        nextNodeId = getNextNodeId(edges, nodeId);
        break;
      }

      case "end": {
        await step.run("complete-enrollment", () =>
          prisma.journeyEnrollment.update({
            where: { id: enrollmentId },
            data:  { status: "COMPLETED", completedAt: new Date() },
          })
        );
        await step.run("log-end-node", () =>
          prisma.journeyNodeLog.create({
            data: { enrollmentId, journeyId, leadId, clientId, nodeId, nodeType: node.type!, result: "completed" },
          })
        );
        return { result: "completed" };
      }
    }

    // ── Gravar log do nó executado ───────────────────────────────────────────────
    await step.run("log-node", () =>
      prisma.journeyNodeLog.create({
        data: { enrollmentId, journeyId, leadId, clientId, nodeId, nodeType: node.type!, result: nodeResult },
      })
    );

    // ── Avançar para o próximo nó ────────────────────────────────────────────────
    if (!nextNodeId) {
      await step.run("complete-no-next", () =>
        prisma.journeyEnrollment.update({
          where: { id: enrollmentId },
          data:  { status: "COMPLETED", completedAt: new Date() },
        })
      );
      return { result: "completed (no next node)" };
    }

    await step.run("update-current-node", () =>
      prisma.journeyEnrollment.update({
        where: { id: enrollmentId },
        data:  { currentNode: nextNodeId! },
      })
    );

    await step.sendEvent("next-step",
      stepEvent.create({ enrollmentId, journeyId, leadId, nodeId: nextNodeId, clientId })
    );

    return { result: "advanced", nextNodeId };
  }
);
