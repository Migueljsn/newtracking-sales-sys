import { inngest }             from "@/lib/inngest/client";
import { flowEnrollAllEvent, flowEnrollEvent } from "@/lib/inngest/events";
import { prisma }             from "@/lib/db/prisma";
import { evaluateAudience }   from "@/lib/audiences/evaluate";
import { parseAudienceRules } from "@/lib/audiences/types";

export const flowEnrollAll = inngest.createFunction(
  {
    id:       "flow-enroll-all",
    name:     "Enrolar leads existentes ao ativar fluxo",
    triggers: [{ event: flowEnrollAllEvent }],
  },
  async ({ event, step }) => {
    const { flowId, clientId } = event.data;

    const trigger = await step.run("load-trigger", () =>
      prisma.flowTrigger.findFirst({
        where:  { flowId, clientId, type: "AUDIENCE" },
        select: { audienceId: true },
      })
    );

    if (!trigger?.audienceId) return { skipped: "sem gatilho de público" };

    const audience = await step.run("load-audience", () =>
      prisma.audience.findUnique({ where: { id: trigger.audienceId! } })
    );

    if (!audience) return { skipped: "público não encontrado" };

    const leads = await step.run("load-leads", () =>
      prisma.lead.findMany({
        where:   { clientId },
        include: {
          customer: { select: { state: true, city: true, email: true } },
          sales:    { select: { value: true, soldAt: true } },
        },
      })
    );

    const rules = parseAudienceRules(audience.rules);

    const qualifying = leads.filter((lead) =>
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
          sales:           lead.sales.map((s) => ({
            value:  Number(s.value),
            soldAt: new Date(s.soldAt as unknown as string),
          })),
        },
        rules
      )
    );

    if (qualifying.length === 0) return { enrolled: 0 };

    // Upsert memberships e coletar leads sem enrollment existente
    const toEnroll = await step.run("filter-and-upsert-memberships", async () => {
      const ids: string[] = [];
      for (const lead of qualifying) {
        await prisma.audienceMembership.upsert({
          where:  { audienceId_leadId: { audienceId: trigger.audienceId!, leadId: lead.id } },
          create: { audienceId: trigger.audienceId!, leadId: lead.id, clientId },
          update: {},
        });

        const existing = await prisma.flowEnrollment.findUnique({
          where:  { flowId_leadId: { flowId, leadId: lead.id } },
          select: { id: true },
        });
        if (!existing) ids.push(lead.id);
      }
      return ids;
    });

    if (toEnroll.length > 0) {
      await step.sendEvent(
        "fire-enrollments",
        toEnroll.map((leadId) => flowEnrollEvent.create({ flowId, leadId, clientId }))
      );
    }

    return { qualifying: qualifying.length, enrolled: toEnroll.length };
  }
);
