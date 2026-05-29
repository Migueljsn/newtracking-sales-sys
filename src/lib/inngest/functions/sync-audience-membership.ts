import { inngest }                  from "@/lib/inngest/client";
import { leadChangedEvent, audienceMemberEnteredEvent } from "@/lib/inngest/events";
import { prisma }                  from "@/lib/db/prisma";
import { evaluateAudience }        from "@/lib/audiences/evaluate";
import { parseAudienceRules }      from "@/lib/audiences/types";

export const syncAudienceMembership = inngest.createFunction(
  {
    id:       "sync-audience-membership",
    name:     "Sincronizar memberships de público ao atualizar lead",
    triggers: [{ event: leadChangedEvent }],
  },
  async ({ event, step }) => {
    const { leadId, clientId } = event.data;

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

    // Carregar só públicos vinculados a jornadas ativas deste cliente
    const activeAudienceIds = await step.run("load-active-audience-ids", async () => {
      const journeys = await prisma.journey.findMany({
        where:  { clientId, status: "ACTIVE" },
        select: { nodes: true },
      });

      const ids = new Set<string>();
      for (const j of journeys) {
        const nodes = j.nodes as Array<{ type?: string; data?: { audienceIds?: string[]; audienceId?: string } }>;
        const trigger = nodes.find(n => n.type === "trigger");
        if (!trigger?.data) continue;
        if (trigger.data.audienceIds?.length) trigger.data.audienceIds.forEach(id => ids.add(id));
        if (trigger.data.audienceId)          ids.add(trigger.data.audienceId);
      }

      return [...ids];
    });

    if (activeAudienceIds.length === 0) return { checked: 0, entered: 0 };

    const audiences = await step.run("load-audiences", () =>
      prisma.audience.findMany({
        where: { id: { in: activeAudienceIds }, clientId },
      })
    );

    const leadRow = {
      status:          lead.status,
      pipelineStageId: lead.pipelineStageId,
      capturedAt:      new Date(lead.capturedAt as unknown as string),
      utmSource:       lead.utmSource,
      utmMedium:       lead.utmMedium,
      utmCampaign:     lead.utmCampaign,
      consultant:      lead.consultant,
      customer:        lead.customer,
      sales:           lead.sales.map(s => ({
        value:  Number(s.value),
        soldAt: new Date(s.soldAt as unknown as string),
      })),
    };

    // Memberships actuais do lead (só para os públicos activos)
    const existingMemberships = await step.run("load-existing-memberships", () =>
      prisma.audienceMembership.findMany({
        where: { leadId, audienceId: { in: activeAudienceIds } },
        select: { audienceId: true },
      })
    );
    const memberOf = new Set(existingMemberships.map(m => m.audienceId));

    // Detectar entradas em novos públicos
    const newEntries = await step.run("detect-and-sync", async () => {
      const entered: Array<{ audienceId: string }> = [];

      for (const audience of audiences) {
        const qualifies = evaluateAudience(leadRow, parseAudienceRules(audience.rules));

        if (qualifies && !memberOf.has(audience.id)) {
          await prisma.audienceMembership.upsert({
            where:  { audienceId_leadId: { audienceId: audience.id, leadId } },
            create: { audienceId: audience.id, leadId, clientId },
            update: {},
          });
          entered.push({ audienceId: audience.id });
        }
      }

      return entered;
    });

    if (newEntries.length > 0) {
      await step.sendEvent(
        "fire-member-entered",
        newEntries.map(({ audienceId }) =>
          audienceMemberEnteredEvent.create({ audienceId, leadId, clientId })
        )
      );
    }

    return { checked: audiences.length, entered: newEntries.length };
  }
);
