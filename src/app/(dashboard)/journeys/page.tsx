export const dynamic = "force-dynamic";

import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { JourneyList } from "@/components/journeys/journey-list";
import { EmailTemplates } from "@/components/settings/email-templates";
import { AudiencesTab } from "@/components/ltv/audiences-tab";
import type { RuleGroup } from "@/lib/audiences/types";

const TABS = [
  { key: "jornadas",  label: "Jornadas"  },
  { key: "templates", label: "Templates" },
  { key: "publicos",  label: "Públicos"  },
] as const;

type Tab = typeof TABS[number]["key"];

export default async function JourneysPage({
  searchParams,
}: {
  searchParams: Promise<{ aba?: string }>;
}) {
  const session  = await getSession();
  const clientId = session.clientId!;
  const params   = await searchParams;
  const activeTab: Tab = (params.aba as Tab) ?? "jornadas";

  // ── Jornadas ────────────────────────────────────────────────────────────────
  let rows: {
    id: string; name: string; description: string | null;
    status: string; audienceName: string | null;
    nodeCount: number; enrollCount: number; updatedAt: Date;
  }[] = [];

  if (activeTab === "jornadas") {
    const journeys = await prisma.journey.findMany({
      where:   { clientId, status: { not: "ARCHIVED" } },
      orderBy: { updatedAt: "desc" },
      include: {
        audience:    { select: { name: true } },
        enrollments: { select: { id: true } },
      },
    });
    rows = journeys.map((j) => ({
      id:           j.id,
      name:         j.name,
      description:  j.description,
      status:       j.status,
      audienceName: j.audience?.name ?? null,
      nodeCount:    (j.nodes as unknown[]).length,
      enrollCount:  j.enrollments.length,
      updatedAt:    j.updatedAt,
    }));
  }

  // ── Templates ───────────────────────────────────────────────────────────────
  let emailTemplates: { id: string; name: string; subject: string; body: string; isDefault: boolean; clientId: string | null }[] = [];

  if (activeTab === "templates") {
    emailTemplates = await prisma.emailTemplate.findMany({
      where:   { OR: [{ clientId }, { clientId: null, isDefault: true }] },
      orderBy: { createdAt: "asc" },
    });
  }

  // ── Públicos ─────────────────────────────────────────────────────────────────
  let audiences: { id: string; name: string; description: string | null; rules: RuleGroup; createdAt: Date }[] = [];
  let pipelineStages: { id: string; name: string }[] = [];

  if (activeTab === "publicos") {
    const [rawAudiences, rawStages] = await Promise.all([
      prisma.audience.findMany({ where: { clientId }, orderBy: { createdAt: "desc" } }),
      prisma.pipelineStage.findMany({ where: { clientId }, orderBy: { position: "asc" }, select: { id: true, name: true } }),
    ]);
    audiences     = rawAudiences.map((a) => ({ id: a.id, name: a.name, description: a.description, rules: a.rules as RuleGroup, createdAt: a.createdAt }));
    pipelineStages = rawStages;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-[var(--text)]">Jornadas</h1>
        <p className="text-sm text-[var(--text-muted)] mt-0.5">
          Automações, templates de e-mail e segmentação de públicos
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] p-1 w-fit">
        {TABS.map((tab) => (
          <a
            key={tab.key}
            href={`/journeys?aba=${tab.key}`}
            className={`rounded-xl px-4 py-2 text-sm font-medium transition-all ${
              activeTab === tab.key
                ? "bg-[var(--surface)] text-[var(--text)] shadow-sm"
                : "text-[var(--text-muted)] hover:text-[var(--text)]"
            }`}
          >
            {tab.label}
          </a>
        ))}
      </div>

      {activeTab === "jornadas" && <JourneyList journeys={rows} />}

      {activeTab === "templates" && (
        <div className="card p-5">
          <EmailTemplates templates={emailTemplates} />
        </div>
      )}

      {activeTab === "publicos" && (
        <AudiencesTab
          audiences={audiences}
          pipelineStages={pipelineStages}
        />
      )}
    </div>
  );
}
