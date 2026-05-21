import { inngest }        from "@/lib/inngest/client";
import { enrollAllEvent, stepEvent } from "@/lib/inngest/events";
import { prisma }         from "@/lib/db/prisma";
import { evaluateGroup }  from "@/lib/audiences/evaluate";
import type { RuleGroup } from "@/lib/audiences/types";
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

    // Achar o nó trigger
    const nodes   = journey.nodes as unknown as Node[];
    const trigger = nodes.find((n) => n.type === "trigger");
    if (!trigger) return { skipped: "no trigger node" };

    const audienceId = (trigger.data as { audienceId?: string | null }).audienceId;
    if (!audienceId) return { skipped: "trigger has no audience" };

    const audience = await step.run("load-audience", () =>
      prisma.audience.findUniqueOrThrow({ where: { id: audienceId, clientId } })
    );

    const rules = audience.rules as unknown as RuleGroup;

    // Buscar leads com dados necessários para avaliar o público
    const leads = await step.run("load-leads", () =>
      prisma.lead.findMany({
        where:   { clientId },
        include: {
          customer: { select: { state: true, city: true, email: true } },
          sales:    { select: { value: true, soldAt: true } },
        },
      })
    );

    // Filtrar leads que passam nas regras do público
    const matching = leads.filter((lead) =>
      evaluateGroup(
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
        rules
      )
    );

    if (matching.length === 0) return { enrolled: 0 };

    // Criar enrollments (ignorar já existentes pelo @@unique)
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

    // Disparar journey/step para cada lead matriculado
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
