import { inngest }        from "@/lib/inngest/client";
import { enrollAllEvent, stepEvent } from "@/lib/inngest/events";
import { prisma }         from "@/lib/db/prisma";
import { evaluateAudience } from "@/lib/audiences/evaluate";
import { parseAudienceRules } from "@/lib/audiences/types";
import type { Node }      from "@xyflow/react";

export const journeyEnrollAll = inngest.createFunction(
  {
    id:       "journey-enroll-all",
    name:     "Enroll leads na jornada",
    triggers: [{ event: enrollAllEvent }],
  },
  async ({ event, step }) => {
    const { journeyId, clientId } = event.data;

    const journey = await step.run("load-journey", () =>
      prisma.journey.findUniqueOrThrow({ where: { id: journeyId, clientId } })
    );

    if (journey.status !== "ACTIVE") return { skipped: "journey not active" };

    // Achar o nó trigger (único por jornada)
    const nodes   = journey.nodes as unknown as Node[];
    const trigger = nodes.find((n) => n.type === "trigger");
    if (!trigger) return { skipped: "no trigger node" };

    // Suporte a múltiplos públicos (novo: audienceIds) e legado (audienceId)
    const triggerData  = trigger.data as { audienceIds?: string[]; audienceId?: string | null };
    const audienceIds  = triggerData.audienceIds?.length
      ? triggerData.audienceIds
      : triggerData.audienceId ? [triggerData.audienceId] : [];
    if (audienceIds.length === 0) return { skipped: "trigger has no audience" };

    const audiences = await step.run("load-audiences", () =>
      prisma.audience.findMany({ where: { id: { in: audienceIds }, clientId } })
    );

    const audienceDefs = audiences.map((a) => parseAudienceRules(a.rules));

    const leads = await step.run("load-leads", () =>
      prisma.lead.findMany({
        where:   { clientId },
        include: {
          customer: { select: { state: true, city: true, email: true } },
          sales:    { select: { value: true, soldAt: true } },
        },
      })
    );

    // Lead entra se pertencer a qualquer um dos públicos (OR)
    const matching = leads.filter((lead) => {
      const row = {
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
      return audienceDefs.some((def) => evaluateAudience(row, def));
    });

    if (matching.length === 0) return { enrolled: 0 };

    const newEnrollments = await step.run("create-enrollments", async () => {
      const created: Array<{ enrollmentId: string; leadId: string }> = [];

      for (const lead of matching) {
        const existing = await prisma.journeyEnrollment.findUnique({
          where: { journeyId_leadId: { journeyId, leadId: lead.id } },
        });
        if (existing) continue;

        const enrollment = await prisma.journeyEnrollment.create({
          data: { journeyId, leadId: lead.id, currentNode: trigger.id },
        });
        created.push({ enrollmentId: enrollment.id, leadId: lead.id });
      }

      return created;
    });

    if (newEnrollments.length > 0) {
      await step.sendEvent(
        "fire-steps",
        newEnrollments.map(({ enrollmentId, leadId }) =>
          stepEvent.create({ enrollmentId, journeyId, leadId, nodeId: trigger.id, clientId })
        )
      );
    }

    return { enrolled: newEnrollments.length };
  }
);
