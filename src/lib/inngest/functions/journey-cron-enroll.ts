import { inngest }          from "@/lib/inngest/client";
import { leadChangedEvent } from "@/lib/inngest/events";
import { prisma }           from "@/lib/db/prisma";
import { parseAudienceRules } from "@/lib/audiences/types";
import type { Rule, RuleGroup } from "@/lib/audiences/types";

// Extrai todos os valores de condições daysSinceLastSale/daysSinceCapture de um grupo de regras
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
    triggers: [{ cron: "0 */6 * * *" }], // 4x por dia
  },
  async ({ step }) => {
    // 1. Carregar públicos de jornadas ativas
    const journeys = await step.run("load-active-journeys", () =>
      prisma.journey.findMany({
        where:  { status: "ACTIVE" },
        select: { clientId: true, nodes: true },
      })
    );

    if (journeys.length === 0) return { fired: 0 };

    // 2. Coletar audienceIds únicos e extrair thresholds de tempo
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

    // 3. Extrair thresholds únicos de dias
    const thresholds = new Set<number>();
    for (const audience of audiences) {
      const def = parseAudienceRules(audience.rules);
      extractTimeDays(def.include).forEach(d => thresholds.add(d));
      if (def.exclude) extractTimeDays(def.exclude).forEach(d => thresholds.add(d));
    }

    if (thresholds.size === 0) return { fired: 0, reason: "no time-based conditions" };

    // 4. Para cada threshold, buscar leads que cruzaram o limite nas últimas 6 horas
    const INTERVAL_HOURS = 6;
    const candidateLeadIds = new Set<string>();
    const leadClientMap: Record<string, string> = {};

    await step.run("find-threshold-crossings", async () => {
      for (const days of thresholds) {
        const upperBound = new Date(Date.now() - days * 86_400_000);
        const lowerBound = new Date(upperBound.getTime() - INTERVAL_HOURS * 3_600_000);

        // Leads cuja ÚLTIMA venda cruzou o threshold nas últimas 6 horas
        const rows = await prisma.$queryRaw<Array<{ id: string; clientId: string }>>`
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

        for (const row of rows) {
          candidateLeadIds.add(row.id);
          leadClientMap[row.id] = row.clientId;
        }

        // Leads cuja data de captura cruzou o threshold (daysSinceCapture)
        const captureRows = await prisma.$queryRaw<Array<{ id: string; clientId: string }>>`
          SELECT l.id, l."clientId"
          FROM "Lead" l
          WHERE l.status IN ('NEW', 'REGISTERED')
            AND l."capturedAt" BETWEEN ${lowerBound} AND ${upperBound}
        `;

        for (const row of captureRows) {
          candidateLeadIds.add(row.id);
          leadClientMap[row.id] = row.clientId;
        }
      }
    });

    if (candidateLeadIds.size === 0) return { fired: 0 };

    // 5. Disparar leadChangedEvent para cada candidato — sync-audience-membership cuida do resto
    await step.sendEvent(
      "fire-lead-changed",
      [...candidateLeadIds].map(leadId =>
        leadChangedEvent.create({ leadId, clientId: leadClientMap[leadId] })
      )
    );

    return { fired: candidateLeadIds.size };
  }
);
