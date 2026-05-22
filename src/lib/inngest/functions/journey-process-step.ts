import { Resend }        from "resend";
import { inngest }        from "@/lib/inngest/client";
import { stepEvent }      from "@/lib/inngest/events";
import { prisma }         from "@/lib/db/prisma";
import { evaluateGroup }  from "@/lib/audiences/evaluate";
import type { RuleGroup } from "@/lib/audiences/types";
import type { Node, Edge } from "@xyflow/react";
import type {
  WaitData, ConditionData, EmailData,
  WhatsAppData, ChangeStatusData, AssignData,
} from "@/lib/journeys/types";

const resend = new Resend(process.env.RESEND_API_KEY);

// ─── Graph helpers ─────────────────────────────────────────────────────────────

function getNextNodeId(
  edges: Edge[],
  currentNodeId: string,
  branch?: "true" | "false"
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
  return template.replace(/\{(\w+)\}/g, (match, key) => vars[key] ?? match);
}

function buildLeadVars(
  lead: { consultant: string | null },
  customer: { name: string; phone: string; email: string | null },
  clientName: string
): Record<string, string> {
  return {
    nome:          customer.name.split(" ")[0],
    nome_completo: customer.name,
    telefone:      customer.phone,
    email:         customer.email ?? "",
    consultor:     lead.consultant ?? "",
    empresa:       clientName,
  };
}

// ─── WhatsApp via EvoAPI ───────────────────────────────────────────────────────

async function sendWhatsApp(phone: string, message: string): Promise<boolean> {
  const baseUrl  = process.env.EVO_API_URL;
  const apiKey   = process.env.EVO_API_KEY;
  const instance = process.env.EVO_API_INSTANCE;

  if (!baseUrl || !apiKey || !instance) {
    console.warn("[Journey] WhatsApp não configurado — defina EVO_API_URL, EVO_API_KEY e EVO_API_INSTANCE");
    return false;
  }

  const digits = phone.replace(/\D/g, "");
  const number = digits.startsWith("55") ? digits : `55${digits}`;

  const res = await fetch(`${baseUrl}/message/sendText/${instance}`, {
    method:  "POST",
    headers: { "Content-Type": "application/json", apikey: apiKey },
    body:    JSON.stringify({ number, text: message }),
  });

  return res.ok;
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
            customer: { select: { name: true, phone: true, email: true, state: true, city: true } },
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

    switch (node.type) {

      case "trigger": {
        nextNodeId = getNextNodeId(edges, nodeId);
        break;
      }

      case "wait": {
        const d = node.data as unknown as WaitData;
        await step.sleep("wait-step", `${d.days}d`);
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
        nextNodeId = getNextNodeId(edges, nodeId, passed ? "true" : "false");
        break;
      }

      case "email": {
        const d = node.data as unknown as EmailData;

        if (d.templateId && lead.customer?.email) {
          await step.run("send-email", async () => {
            const template = await prisma.emailTemplate.findUnique({ where: { id: d.templateId! } });
            if (!template || !lead.customer) return;

            const vars    = buildLeadVars(lead, lead.customer, client.name);
            const subject = renderTemplate(template.subject, vars);
            const html    = renderTemplate(template.body,    vars);

            const { data, error } = await resend.emails.send({
              from:    `${client.name} via Portal CRM <noreply@fonilcompany.com.br>`,
              to:      [lead.customer.email!],
              subject,
              html,
            });

            if (error) {
              console.error("[Journey] Resend error:", error);
              throw new Error(`Resend: ${error.message}`);
            }

            return { messageId: data?.id };
          });
        }

        nextNodeId = getNextNodeId(edges, nodeId);
        break;
      }

      case "whatsapp": {
        const d = node.data as unknown as WhatsAppData;

        if (d.message && lead.customer?.phone) {
          await step.run("send-whatsapp", async () => {
            if (!lead.customer) return;
            const vars    = buildLeadVars(lead, lead.customer, client.name);
            const message = renderTemplate(d.message, vars);
            await sendWhatsApp(lead.customer.phone, message);
          });
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
        return { result: "completed" };
      }
    }

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
