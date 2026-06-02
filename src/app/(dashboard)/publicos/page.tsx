export const dynamic = "force-dynamic";

import { getSession }    from "@/lib/auth/session";
import { prisma }        from "@/lib/db/prisma";
import { AudiencesTab }  from "@/components/ltv/audiences-tab";
import type { RuleGroup } from "@/lib/audiences/types";

export default async function PublicosPage() {
  const session  = await getSession();
  const clientId = session.clientId!;

  const [rawAudiences, rawStages] = await Promise.all([
    prisma.audience.findMany({ where: { clientId }, orderBy: { createdAt: "desc" } }),
    prisma.pipelineStage.findMany({ where: { clientId }, orderBy: { position: "asc" }, select: { id: true, name: true } }),
  ]);

  const audiences     = rawAudiences.map((a) => ({ id: a.id, name: a.name, description: a.description, rules: a.rules as RuleGroup, createdAt: a.createdAt }));
  const pipelineStages = rawStages;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-[var(--text)]">Públicos</h1>
        <p className="text-sm text-[var(--text-muted)] mt-0.5">
          Segmentações dinâmicas de leads — usadas em Jornadas e Fluxos
        </p>
      </div>
      <AudiencesTab audiences={audiences} pipelineStages={pipelineStages} />
    </div>
  );
}
