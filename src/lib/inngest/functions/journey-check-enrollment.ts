import { inngest }                    from "@/lib/inngest/client";
import { audienceMemberEnteredEvent, stepEvent } from "@/lib/inngest/events";
import { prisma }                    from "@/lib/db/prisma";
import type { Node }                 from "@xyflow/react";

export const journeyCheckEnrollment = inngest.createFunction(
  {
    id:       "journey-check-enrollment",
    name:     "Enrolar lead ao entrar em público",
    triggers: [{ event: audienceMemberEnteredEvent }],
  },
  async ({ event, step }) => {
    const { audienceId, leadId, clientId } = event.data;

    // Jornadas ativas que usam esse público (lookup direto por audienceId)
    const journeys = await step.run("load-journeys-for-audience", () =>
      prisma.journey.findMany({
        where: { clientId, status: "ACTIVE" },
      })
    );

    // Filtrar jornadas que referenciam esse audienceId no trigger
    const matching = journeys.filter(j => {
      const nodes  = j.nodes as unknown as Node[];
      const trigger = nodes.find(n => n.type === "trigger");
      if (!trigger) return false;
      const d = trigger.data as { audienceIds?: string[]; audienceId?: string | null };
      return d.audienceIds?.includes(audienceId) || d.audienceId === audienceId;
    });

    if (matching.length === 0) return { enrolled: 0 };

    const newEnrollments = await step.run("create-enrollments", async () => {
      const created: Array<{ enrollmentId: string; journeyId: string; nodeId: string }> = [];

      for (const journey of matching) {
        const existing = await prisma.journeyEnrollment.findUnique({
          where: { journeyId_leadId: { journeyId: journey.id, leadId } },
        });
        if (existing) continue;

        const nodes   = journey.nodes as unknown as Node[];
        const trigger = nodes.find(n => n.type === "trigger");
        if (!trigger) continue;

        const enrollment = await prisma.journeyEnrollment.create({
          data: { journeyId: journey.id, leadId, currentNode: trigger.id },
        });
        created.push({ enrollmentId: enrollment.id, journeyId: journey.id, nodeId: trigger.id });
      }

      return created;
    });

    if (newEnrollments.length > 0) {
      await step.sendEvent(
        "fire-steps",
        newEnrollments.map(({ enrollmentId, journeyId, nodeId }) =>
          stepEvent.create({ enrollmentId, journeyId, leadId, nodeId, clientId })
        )
      );
    }

    return { enrolled: newEnrollments.length };
  }
);
