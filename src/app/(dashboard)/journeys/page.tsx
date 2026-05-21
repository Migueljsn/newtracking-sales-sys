export const dynamic = "force-dynamic";

import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { JourneyList } from "@/components/journeys/journey-list";

export default async function JourneysPage() {
  const session  = await getSession();
  const clientId = session.clientId!;

  const journeys = await prisma.journey.findMany({
    where:   { clientId, status: { not: "ARCHIVED" } },
    orderBy: { updatedAt: "desc" },
    include: {
      audience:    { select: { name: true } },
      enrollments: { select: { id: true } },
    },
  });

  const rows = journeys.map((j) => ({
    id:           j.id,
    name:         j.name,
    description:  j.description,
    status:       j.status,
    audienceName: j.audience?.name ?? null,
    nodeCount:    (j.nodes as unknown[]).length,
    enrollCount:  j.enrollments.length,
    updatedAt:    j.updatedAt,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-[var(--text)]">Jornadas</h1>
        <p className="text-sm text-[var(--text-muted)] mt-0.5">
          Automações visuais para engajar e mover leads pelo funil
        </p>
      </div>
      <JourneyList journeys={rows} />
    </div>
  );
}
