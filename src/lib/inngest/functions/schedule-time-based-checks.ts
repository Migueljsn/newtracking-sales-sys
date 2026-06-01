import { inngest }          from "@/lib/inngest/client";
import { leadChangedEvent } from "@/lib/inngest/events";
import { prisma }           from "@/lib/db/prisma";
import { parseAudienceRules } from "@/lib/audiences/types";
import type { Rule, RuleGroup } from "@/lib/audiences/types";

const TIME_FIELDS = ["daysSinceLastSale", "daysSinceCapture"] as const;
type TimeField = typeof TIME_FIELDS[number];

function extractTimeThresholds(group: RuleGroup): Array<{ field: TimeField; days: number }> {
  const results: Array<{ field: TimeField; days: number }> = [];
  for (const r of group.rules) {
    if ("rules" in r) {
      results.push(...extractTimeThresholds(r as RuleGroup));
    } else {
      const rule = r as Rule;
      if (
        TIME_FIELDS.includes(rule.field as TimeField) &&
        (rule.operator === "gte" || rule.operator === "gt")
      ) {
        const days = parseFloat(rule.value);
        if (!isNaN(days)) results.push({ field: rule.field as TimeField, days: Math.ceil(days) });
      }
    }
  }
  return results;
}

export const scheduleTimeBasedChecks = inngest.createFunction(
  {
    id:   "schedule-time-based-checks",
    name: "Agendar verificação de threshold temporal",
    triggers: [{ event: leadChangedEvent }],
  },
  async ({ event, step }) => {
    const { leadId, clientId } = event.data;

    const lead = await step.run("load-lead", () =>
      prisma.lead.findUnique({
        where:  { id: leadId, clientId },
        select: {
          capturedAt: true,
          sales: { select: { soldAt: true }, orderBy: { soldAt: "desc" }, take: 1 },
        },
      })
    );

    if (!lead) return { skipped: "lead not found" };

    const activeAudienceIds = await step.run("load-audience-ids", async () => {
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

    if (activeAudienceIds.length === 0) return { scheduled: 0 };

    const audiences = await step.run("load-audiences", () =>
      prisma.audience.findMany({
        where:  { id: { in: activeAudienceIds }, clientId },
        select: { rules: true },
      })
    );

    // Wrapping inside step.run ensures the computed crossing is CACHED by Inngest.
    // Without this, on re-execution after sleepUntil wakes up, Date.now() would
    // be past the crossing time → futureCrossings empty → early return fires before
    // step.sleepUntil replays → step.sendEvent never called → lead never re-evaluated.
    const nextCrossing = await step.run("find-next-crossing", () => {
      const now          = Date.now();
      const lastSaleDate = lead.sales[0]
        ? new Date(lead.sales[0].soldAt as unknown as string)
        : null;
      const capturedAt   = new Date(lead.capturedAt as unknown as string);

      let earliest: number | null = null;

      for (const audience of audiences) {
        const def        = parseAudienceRules(audience.rules);
        const thresholds = [
          ...extractTimeThresholds(def.include),
          ...(def.exclude ? extractTimeThresholds(def.exclude) : []),
        ];

        for (const { field, days } of thresholds) {
          const baseDate = field === "daysSinceLastSale" ? lastSaleDate : capturedAt;
          if (!baseDate) continue;

          const crossAt = baseDate.getTime() + days * 86_400_000;
          if (crossAt > now && (earliest === null || crossAt < earliest)) {
            earliest = crossAt;
          }
        }
      }

      return earliest;
    });

    if (nextCrossing === null) return { scheduled: 0 };

    await step.sleepUntil("wait-threshold", new Date(nextCrossing));

    await step.sendEvent("fire-after-threshold",
      leadChangedEvent.create({ leadId, clientId })
    );

    return { scheduled: 1, wakeAt: new Date(nextCrossing).toISOString() };
  }
);
