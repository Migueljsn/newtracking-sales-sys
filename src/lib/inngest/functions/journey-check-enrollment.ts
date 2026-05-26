import { inngest }           from "@/lib/inngest/client";
import { leadChangedEvent, stepEvent } from "@/lib/inngest/events";
import { prisma }            from "@/lib/db/prisma";
import { evaluateAudience }  from "@/lib/audiences/evaluate";
import { parseAudienceRules } from "@/lib/audiences/types";
import type { Node }         from "@xyflow/react";

export const journeyCheckEnrollment = inngest.createFunction(
  {
    id:       "journey-check-enrollment",
    name:     "Verificar enrolamento em jornadas ao atualizar lead",
    triggers: [{ event: leadChangedEvent }],
  },
  async ({ event, step }) => {
    const { leadId, clientId } = event.data;

    // ── Carregar lead com dados completos ──────────────────────────────────────
    const lead = await step.run("load-lead", () =>
      prisma.lead.findUnique({
        where:   { id: leadId, clientId },
        include: {
          customer: { select: { state: true, city: true, email: true } },
          sales:    { select: { value: true, soldAt: true } },
        },
      })
    );

    if (!lead) return { skipped: "lead not found" };

    // ── Carregar jornadas ativas com audiência configurada ─────────────────────
    const journeys = await step.run("load-journeys", () =>
      prisma.journey.findMany({
        where: { clientId, status: "ACTIVE" },
      })
    );

    if (journeys.length === 0) return { checked: 0, enrolled: 0 };

    // ── Verificar cada jornada ─────────────────────────────────────────────────
    const leadRow = {
      status:          lead.status,
      pipelineStageId: lead.pipelineStageId,
      capturedAt:      new Date(lead.capturedAt as unknown as string),
      utmSource:       lead.utmSource,
      utmMedium:       lead.utmMedium,
      utmCampaign:     lead.utmCampaign,
      consultant:      lead.consultant,
      customer:        lead.customer,
      sales:           lead.sales.map((s) => ({
        value:  Number(s.value),
        soldAt: new Date(s.soldAt as unknown as string),
      })),
    };

    const newEnrollments = await step.run("check-and-enroll", async () => {
      const created: Array<{ enrollmentId: string; journeyId: string; nodeId: string }> = [];

      for (const journey of journeys) {
        const nodes   = journey.nodes as unknown as Node[];
        const trigger = nodes.find((n) => n.type === "trigger");
        if (!trigger) continue;

        const audienceId = (trigger.data as { audienceId?: string | null }).audienceId;
        if (!audienceId) continue;

        const audience = await prisma.audience.findUnique({
          where: { id: audienceId, clientId },
        });
        if (!audience) continue;

        const def     = parseAudienceRules(audience.rules);
        const matches = evaluateAudience(leadRow, def);
        if (!matches) continue;

        // Só enrola se ainda não tem enrollment nessa jornada
        const existing = await prisma.journeyEnrollment.findUnique({
          where: { journeyId_leadId: { journeyId: journey.id, leadId } },
        });
        if (existing) continue;

        const enrollment = await prisma.journeyEnrollment.create({
          data: { journeyId: journey.id, leadId, currentNode: trigger.id },
        });
        created.push({ enrollmentId: enrollment.id, journeyId: journey.id, nodeId: trigger.id });
      }

      return created;
    });

    if (newEnrollments.length > 0) {
      await step.sendEvent(
        "fire-steps",
        newEnrollments.map(({ enrollmentId, journeyId, nodeId }) =>
          stepEvent.create({ enrollmentId, journeyId, leadId, nodeId, clientId })
        )
      );
    }

    return { checked: journeys.length, enrolled: newEnrollments.length };
  }
);
