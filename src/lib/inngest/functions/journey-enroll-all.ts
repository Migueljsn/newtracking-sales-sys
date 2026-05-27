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

    // Achar todos os nós trigger
    const nodes    = journey.nodes as unknown as Node[];
    const triggers = nodes.filter((n) => n.type === "trigger");
    if (triggers.length === 0) return { skipped: "no trigger node" };

    // Buscar leads uma única vez para todos os triggers
    const leads = await step.run("load-leads", () =>
      prisma.lead.findMany({
        where:   { clientId },
        include: {
          customer: { select: { state: true, city: true, email: true } },
          sales:    { select: { value: true, soldAt: true } },
        },
      })
    );

    const newEnrollments = await step.run("create-enrollments", async () => {
      const created: Array<{ enrollmentId: string; leadId: string; nodeId: string }> = [];

      for (const trigger of triggers) {
        const audienceId = (trigger.data as { audienceId?: string | null }).audienceId;
        if (!audienceId) continue;

        const audience = await prisma.audience.findUnique({ where: { id: audienceId, clientId } });
        if (!audience) continue;

        const def      = parseAudienceRules(audience.rules);
        const matching = leads.filter((lead) =>
          evaluateAudience(
            {
              status:          lead.status,
              pipelineStageId: lead.pipelineStageId,
              capturedAt:      new Date(lead.capturedAt as unknown as string),
              utmSource:       lead.utmSource,
              utmMedium:       lead.utmMedium,
              utmCampaign:     lead.utmCampaign,
              consultant:      lead.consultant,
              customer:        lead.customer,
              sales:           lead.sales.map((s) => ({ value: Number(s.value), soldAt: new Date(s.soldAt as unknown as string) })),
            },
            def,
          )
        );

        for (const lead of matching) {
          // Deduplicação: um lead entra na jornada apenas uma vez
          const existing = await prisma.journeyEnrollment.findUnique({
            where: { journeyId_leadId: { journeyId, leadId: lead.id } },
          });
          if (existing) continue;

          const enrollment = await prisma.journeyEnrollment.create({
            data: { journeyId, leadId: lead.id, currentNode: trigger.id },
          });
          created.push({ enrollmentId: enrollment.id, leadId: lead.id, nodeId: trigger.id });
        }
      }

      return created;
    });

    if (newEnrollments.length > 0) {
      await step.sendEvent(
        "fire-steps",
        newEnrollments.map(({ enrollmentId, leadId, nodeId }) =>
          stepEvent.create({ enrollmentId, journeyId, leadId, nodeId, clientId })
        )
      );
    }

    return { enrolled: newEnrollments.length };
  }
);
