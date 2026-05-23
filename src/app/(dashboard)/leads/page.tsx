export const dynamic = "force-dynamic";

import { dehydrate, HydrationBoundary, QueryClient } from "@tanstack/react-query";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { fetchLeadsForClient } from "@/lib/queries/leads";
import Link from "next/link";
import { Upload } from "lucide-react";
import { LeadsTable } from "@/components/leads/leads-table";
import { CreateLeadModal } from "@/components/leads/create-lead-modal";
import { RuleGroup } from "@/lib/audiences/types";
import { evaluateGroup } from "@/lib/audiences/evaluate";

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Promise<{ audienceId?: string }>;
}) {
  const session    = await getSession();
  const clientId   = session.clientId!;
  const params     = await searchParams;
  const audienceId = params.audienceId;

  const [queryClient, clientSettings, pipelineStages] = await Promise.all([
    (async () => {
      const qc = new QueryClient();
      await qc.prefetchQuery({ queryKey: ["leads"], queryFn: () => fetchLeadsForClient(clientId) });
      return qc;
    })(),
    prisma.clientSettings.findUnique({
      where:  { clientId },
      select: { whatsappTemplate: true },
    }),
    prisma.pipelineStage.findMany({
      where:   { clientId },
      orderBy: { position: "asc" },
      select:  { id: true, name: true, color: true },
    }),
  ]);

  // Audience filter
  let audienceFilter: { ids: string[]; name: string } | null = null;

  if (audienceId) {
    const audience = await prisma.audience.findUnique({ where: { id: audienceId, clientId } });
    if (audience) {
      const rules = audience.rules as RuleGroup;
      const leads = await prisma.lead.findMany({
        where:  { clientId },
        select: {
          id:              true,
          status:          true,
          pipelineStageId: true,
          capturedAt:      true,
          utmSource:       true,
          utmMedium:       true,
          utmCampaign:     true,
          consultant:      true,
          customer:        { select: { state: true, city: true, email: true } },
          sales:           { select: { value: true, soldAt: true } },
        },
      });

      const matchedIds = leads
        .filter((l) =>
          evaluateGroup(
            {
              status:          l.status,
              pipelineStageId: l.pipelineStageId,
              capturedAt:      l.capturedAt,
              utmSource:       l.utmSource,
              utmMedium:       l.utmMedium,
              utmCampaign:     l.utmCampaign,
              consultant:      l.consultant,
              customer:        l.customer,
              sales:           l.sales.map((s) => ({ value: s.value.toString(), soldAt: s.soldAt })),
            },
            rules
          )
        )
        .map((l) => l.id);

      audienceFilter = { ids: matchedIds, name: audience.name };
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--text)]">Leads</h1>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/import"
            className="flex items-center gap-1.5 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-xs font-medium text-[var(--text-muted)] hover:text-[var(--text)] hover:border-[var(--border-strong)] transition-colors"
          >
            <Upload size={13} /> Importar
          </Link>
          <CreateLeadModal />
        </div>
      </div>

      <HydrationBoundary state={dehydrate(queryClient)}>
        <LeadsTable
          whatsappTemplate={clientSettings?.whatsappTemplate ?? null}
          pipelineStages={pipelineStages}
          audienceFilter={audienceFilter}
        />
      </HydrationBoundary>
    </div>
  );
}
