import { inngest }        from "@/lib/inngest/client";
import { enrollAllEvent, stepEvent, leadChangedEvent } from "@/lib/inngest/events";
import { prisma }         from "@/lib/db/prisma";
import { evaluateAudience } from "@/lib/audiences/evaluate";
import { parseAudienceRules } from "@/lib/audiences/types";
import type { AudienceDefinition, Rule, RuleGroup } from "@/lib/audiences/types";
import type { Node }      from "@xyflow/react";

// Extrai o maior threshold de tempo das audiências para achar leads próximos de qualificar
function maxTimeThreshold(defs: AudienceDefinition[]): { daysSinceLastSale: number; daysSinceCapture: number } {
  const result = { daysSinceLastSale: 0, daysSinceCapture: 0 };

  function scan(group: RuleGroup) {
    for (const r of group.rules) {
      if ("rules" in r) { scan(r as RuleGroup); continue; }
      const rule = r as Rule;
      if ((rule.field === "daysSinceLastSale" || rule.field === "daysSinceCapture") &&
          (rule.operator === "gte" || rule.operator === "gt")) {
        const days = parseFloat(rule.value);
        if (!isNaN(days)) result[rule.field as keyof typeof result] = Math.max(result[rule.field as keyof typeof result], Math.ceil(days));
      }
    }
  }

  for (const def of defs) {
    scan(def.include);
    if (def.exclude) scan(def.exclude);
  }
  return result;
}

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

        // Gravar membership de público (upsert para evitar duplicatas)
        for (const audienceId of audienceIds) {
          await prisma.audienceMembership.upsert({
            where:  { audienceId_leadId: { audienceId, leadId: lead.id } },
            create: { audienceId, leadId: lead.id, clientId },
            update: {},
          });
        }

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

    // Agendar checks futuros para leads próximos do threshold (ainda não qualificam, mas vão qualificar)
    const thresholds = maxTimeThreshold(audienceDefs);
    const nearThresholdIds = await step.run("find-near-threshold-leads", async () => {
      const ids: string[] = [];
      const enrolledIds = new Set(newEnrollments.map(e => e.leadId));
      const now = new Date();

      if (thresholds.daysSinceLastSale > 0) {
        const cutoff = new Date(now.getTime() - thresholds.daysSinceLastSale * 86_400_000);
        const rows = await prisma.$queryRaw<Array<{ id: string }>>`
          SELECT DISTINCT l.id
          FROM "Lead" l
          WHERE l."clientId" = ${clientId}
            AND NOT EXISTS (
              SELECT 1 FROM "AudienceMembership" am
              WHERE am."leadId" = l.id AND am."audienceId" = ANY(${audienceIds}::text[])
            )
            AND EXISTS (
              SELECT 1 FROM "Sale" s
              WHERE s."leadId" = l.id
              GROUP BY s."leadId"
              HAVING MAX(s."soldAt") > ${cutoff}
            )
        `;
        rows.forEach(r => { if (!enrolledIds.has(r.id)) ids.push(r.id); });
      }

      if (thresholds.daysSinceCapture > 0) {
        const cutoff = new Date(now.getTime() - thresholds.daysSinceCapture * 86_400_000);
        const rows = await prisma.$queryRaw<Array<{ id: string }>>`
          SELECT l.id
          FROM "Lead" l
          WHERE l."clientId" = ${clientId}
            AND l."capturedAt" > ${cutoff}
            AND NOT EXISTS (
              SELECT 1 FROM "AudienceMembership" am
              WHERE am."leadId" = l.id AND am."audienceId" = ANY(${audienceIds}::text[])
            )
        `;
        rows.forEach(r => { if (!enrolledIds.has(r.id)) ids.push(r.id); });
      }

      return [...new Set(ids)];
    });

    if (nearThresholdIds.length > 0) {
      await step.sendEvent(
        "schedule-future-checks",
        nearThresholdIds.map(leadId => leadChangedEvent.create({ leadId, clientId }))
      );
    }

    return { enrolled: newEnrollments.length, scheduled: nearThresholdIds.length };
  }
);
