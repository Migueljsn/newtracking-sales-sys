import { inngest }          from "@/lib/inngest/client";
import { leadChangedEvent } from "@/lib/inngest/events";
import { prisma }           from "@/lib/db/prisma";
import { parseAudienceRules } from "@/lib/audiences/types";
import type { Rule, RuleGroup } from "@/lib/audiences/types";

function extractTimeDays(group: RuleGroup): number[] {
  const values: number[] = [];
  for (const r of group.rules) {
    if ("rules" in r) {
      values.push(...extractTimeDays(r as RuleGroup));
    } else {
      const rule = r as Rule;
      if (
        (rule.field === "daysSinceLastSale" || rule.field === "daysSinceCapture") &&
        (rule.operator === "gte" || rule.operator === "gt")
      ) {
        const v = parseFloat(rule.value);
        if (!isNaN(v)) values.push(Math.floor(v));
      }
    }
  }
  return values;
}

export const journeyCronEnroll = inngest.createFunction(
  {
    id:       "journey-cron-enroll",
    name:     "Verificar leads que cruzaram thresholds de tempo (cron)",
    triggers: [{ cron: "0 */6 * * *" }],
  },
  async ({ step }) => {
    const journeys = await step.run("load-active-journeys", () =>
      prisma.journey.findMany({
        where:  { status: "ACTIVE" },
        select: { clientId: true, nodes: true },
      })
    );

    if (journeys.length === 0) return { fired: 0 };

    const audienceIdSet = new Set<string>();
    for (const j of journeys) {
      const nodes = j.nodes as Array<{ type?: string; data?: { audienceIds?: string[]; audienceId?: string } }>;
      const trigger = nodes.find(n => n.type === "trigger");
      if (!trigger?.data) continue;
      if (trigger.data.audienceIds?.length) trigger.data.audienceIds.forEach(id => audienceIdSet.add(id));
      if (trigger.data.audienceId)          audienceIdSet.add(trigger.data.audienceId);
    }

    const audiences = await step.run("load-audiences", () =>
      prisma.audience.findMany({
        where:  { id: { in: [...audienceIdSet] } },
        select: { id: true, clientId: true, rules: true },
      })
    );

    const thresholds = new Set<number>();
    for (const audience of audiences) {
      const def = parseAudienceRules(audience.rules);
      extractTimeDays(def.include).forEach(d => thresholds.add(d));
      if (def.exclude) extractTimeDays(def.exclude).forEach(d => thresholds.add(d));
    }

    if (thresholds.size === 0) return { fired: 0, reason: "no time-based conditions" };

    // Wrap the query inside step.run so the result is CACHED and returned.
    // Mutating an outer Set inside step.run() does not persist on Inngest
    // re-execution (the body is skipped for cached steps), so the outer
    // variable would always be empty and sendEvent would never be reached.
    const candidates = await step.run("find-threshold-crossings", async () => {
      const INTERVAL_HOURS = 6;
      const found: { leadId: string; clientId: string }[] = [];
      const seen  = new Set<string>();

      for (const days of thresholds) {
        const upperBound = new Date(Date.now() - days * 86_400_000);
        const lowerBound = new Date(upperBound.getTime() - INTERVAL_HOURS * 3_600_000);

        const saleRows = await prisma.$queryRaw<Array<{ id: string; clientId: string }>>`
          SELECT l.id, l."clientId"
          FROM "Lead" l
          WHERE l.status IN ('NEW', 'REGISTERED')
            AND EXISTS (
              SELECT 1 FROM "Sale" s
              WHERE s."leadId" = l.id
              GROUP BY s."leadId"
              HAVING MAX(s."soldAt") BETWEEN ${lowerBound} AND ${upperBound}
            )
        `;

        for (const row of saleRows) {
          if (!seen.has(row.id)) { seen.add(row.id); found.push({ leadId: row.id, clientId: row.clientId }); }
        }

        const captureRows = await prisma.$queryRaw<Array<{ id: string; clientId: string }>>`
          SELECT l.id, l."clientId"
          FROM "Lead" l
          WHERE l.status IN ('NEW', 'REGISTERED')
            AND l."capturedAt" BETWEEN ${lowerBound} AND ${upperBound}
        `;

        for (const row of captureRows) {
          if (!seen.has(row.id)) { seen.add(row.id); found.push({ leadId: row.id, clientId: row.clientId }); }
        }
      }

      return found;
    });

    if (candidates.length === 0) return { fired: 0 };

    await step.sendEvent(
      "fire-lead-changed",
      candidates.map(({ leadId, clientId }) =>
        leadChangedEvent.create({ leadId, clientId })
      )
    );

    return { fired: candidates.length };
  }
);
