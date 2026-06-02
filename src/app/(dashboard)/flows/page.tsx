export const dynamic = "force-dynamic";

import { getSession } from "@/lib/auth/session";
import { prisma }     from "@/lib/db/prisma";
import { FlowList }   from "@/components/flows/flow-list";

export default async function FlowsPage() {
  const session  = await getSession();
  const clientId = session.clientId!;

  const flows = await prisma.flow.findMany({
    where:   { clientId, status: { not: "ARCHIVED" } },
    orderBy: { updatedAt: "desc" },
    include: {
      triggers:    { select: { type: true, keyword: true, audience: { select: { name: true } } } },
      enrollments: { select: { id: true, status: true } },
    },
  });

  const rows = flows.map((f) => ({
    id:           f.id,
    name:         f.name,
    description:  f.description,
    status:       f.status,
    nodeCount:    (f.nodes as unknown[]).length,
    enrollCount:  f.enrollments.length,
    completedCount: f.enrollments.filter((e) => e.status === "COMPLETED").length,
    triggers:     f.triggers.map((t) => ({
      type:        t.type,
      keyword:     t.keyword,
      audienceName: t.audience?.name ?? null,
    })),
    updatedAt:    f.updatedAt,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-[var(--text)]">Fluxos de Atendimento</h1>
        <p className="text-sm text-[var(--text-muted)] mt-0.5">
          Conversas automatizadas via WhatsApp — SDR, qualificação e atendimento em tempo real
        </p>
      </div>
      <FlowList flows={rows} />
    </div>
  );
}
