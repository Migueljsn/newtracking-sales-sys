export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getConsultantSession } from "@/lib/auth/consultant-session";
import { fetchLeadsForClient } from "@/lib/queries/leads";
import { prisma } from "@/lib/db/prisma";

// Checklist completo da etapa atual de cada lead (progresso + último marcado).
// Feito num passo separado (em vez de alterar fetchLeadsForClient, que é
// cacheada e compartilhada com o admin) para não inflar o payload do admin.
interface ChecklistItem {
  id:        string;
  text:      string;
  checked:   boolean;
  checkedAt: Date | null;
  checkedBy: string | null;
}

async function attachStageChecklist<
  T extends { id: string; pipelineStageId: string | null }
>(leads: T[]) {
  const leadsWithStage = leads.filter((l) => l.pipelineStageId);
  if (leadsWithStage.length === 0) {
    return leads.map((l) => ({
      ...l, lastCheckedRequirement: null, stageChecklist: [] as ChecklistItem[],
      stageRequirementsTotal: 0, stageRequirementsChecked: 0,
    }));
  }

  const stageIds = [...new Set(leadsWithStage.map((l) => l.pipelineStageId!))];
  const [requirements, checklistEntries] = await Promise.all([
    prisma.pipelineStageRequirement.findMany({
      where:   { stageId: { in: stageIds } },
      orderBy: { position: "asc" },
      select:  { id: true, text: true, stageId: true },
    }),
    prisma.leadChecklist.findMany({
      where:  { leadId: { in: leadsWithStage.map((l) => l.id) } },
      select: { leadId: true, requirementId: true, checked: true, checkedAt: true, checkedBy: true },
    }),
  ]);

  const reqsByStage = new Map<string, typeof requirements>();
  for (const r of requirements) {
    if (!reqsByStage.has(r.stageId)) reqsByStage.set(r.stageId, []);
    reqsByStage.get(r.stageId)!.push(r);
  }

  const entryByLead = new Map<string, Map<string, (typeof checklistEntries)[number]>>();
  for (const c of checklistEntries) {
    if (!entryByLead.has(c.leadId)) entryByLead.set(c.leadId, new Map());
    entryByLead.get(c.leadId)!.set(c.requirementId, c);
  }

  return leads.map((l) => {
    if (!l.pipelineStageId) {
      return { ...l, lastCheckedRequirement: null, stageChecklist: [] as ChecklistItem[], stageRequirementsTotal: 0, stageRequirementsChecked: 0 };
    }
    const reqs      = reqsByStage.get(l.pipelineStageId) ?? [];
    const myEntries = entryByLead.get(l.id);
    const stageChecklist: ChecklistItem[] = reqs.map((r) => {
      const e = myEntries?.get(r.id);
      return { id: r.id, text: r.text, checked: e?.checked ?? false, checkedAt: e?.checkedAt ?? null, checkedBy: e?.checkedBy ?? null };
    });
    const checkedItems = stageChecklist.filter((c) => c.checked);
    const last = checkedItems.reduce<ChecklistItem | null>((max, c) => {
      if (!max) return c;
      if (c.checkedAt && (!max.checkedAt || c.checkedAt > max.checkedAt)) return c;
      return max;
    }, null);

    return {
      ...l,
      stageChecklist,
      stageRequirementsTotal:   reqs.length,
      stageRequirementsChecked: checkedItems.length,
      lastCheckedRequirement:   last ? { text: last.text, checkedAt: last.checkedAt, checkedBy: last.checkedBy } : null,
    };
  });
}

export async function GET() {
  const session = await getConsultantSession();
  const leads = await fetchLeadsForClient(session.clientId);
  const withChecklist = await attachStageChecklist(leads);
  return NextResponse.json(withChecklist);
}
