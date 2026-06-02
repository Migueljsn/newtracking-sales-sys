import { inngest }                              from "@/lib/inngest/client";
import { audienceMemberEnteredEvent, flowEnrollEvent } from "@/lib/inngest/events";
import { prisma }                              from "@/lib/db/prisma";

export const flowCheckEnrollment = inngest.createFunction(
  {
    id:       "flow-check-enrollment",
    name:     "Enrolar lead em fluxo ao entrar em público",
    triggers: [{ event: audienceMemberEnteredEvent }],
  },
  async ({ event, step }) => {
    const { audienceId, leadId, clientId } = event.data;

    const triggers = await step.run("load-audience-triggers", () =>
      prisma.flowTrigger.findMany({
        where: { clientId, type: "AUDIENCE", audienceId, flow: { status: "ACTIVE" } },
        select: { flowId: true },
      })
    );

    if (triggers.length === 0) return { enrolled: 0 };

    const toEnroll = await step.run("deduplicate", async () => {
      const flowIds: string[] = [];
      for (const t of triggers) {
        const existing = await prisma.flowEnrollment.findFirst({
          where: { flowId: t.flowId, leadId, status: "ACTIVE" },
          select: { id: true },
        });
        if (!existing) flowIds.push(t.flowId);
      }
      return flowIds;
    });

    if (toEnroll.length > 0) {
      await step.sendEvent(
        "fire-flow-enrollments",
        toEnroll.map((flowId) => flowEnrollEvent.create({ flowId, leadId, clientId }))
      );
    }

    return { enrolled: toEnroll.length };
  }
);
