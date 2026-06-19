export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getConsultantSession } from "@/lib/auth/consultant-session";
import { fetchLeadsForClient } from "@/lib/queries/leads";
import { prisma } from "@/lib/db/prisma";

// Último requisito marcado (checklist) da etapa atual de cada lead.
// Feito num passo separado (em vez de alterar fetchLeadsForClient, que é
// cacheada e compartilhada com o admin) para não inflar o payload do admin.
async function attachLastCheckedRequirement<
  T extends { id: string; pipelineStageId: string | null }
>(leads: T[]) {
  const leadsWithStage = leads.filter((l) => l.pipelineStageId);
  if (leadsWithStage.length === 0) {
    return leads.map((l) => ({ ...l, lastCheckedRequirement: null }));
  }

  const stageByLead = new Map(leadsWithStage.map((l) => [l.id, l.pipelineStageId]));
  const checklists = await prisma.leadChecklist.findMany({
    where:   { leadId: { in: leadsWithStage.map((l) => l.id) }, checked: true },
    orderBy: { checkedAt: "desc" },
    select:  {
      leadId:    true,
      checkedAt: true,
      checkedBy: true,
      requirement: { select: { text: true, stageId: true } },
    },
  });

  const lastByLead = new Map<string, { text: string; checkedAt: Date | null; checkedBy: string | null }>();
  for (const c of checklists) {
    if (lastByLead.has(c.leadId)) continue;
    if (c.requirement.stageId !== stageByLead.get(c.leadId)) continue;
    lastByLead.set(c.leadId, { text: c.requirement.text, checkedAt: c.checkedAt, checkedBy: c.checkedBy });
  }

  return leads.map((l) => ({ ...l, lastCheckedRequirement: lastByLead.get(l.id) ?? null }));
}

export async function GET() {
  const session = await getConsultantSession();
  const leads = await fetchLeadsForClient(session.clientId);
  const withRequirement = await attachLastCheckedRequirement(leads);
  return NextResponse.json(withRequirement);
}
