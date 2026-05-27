export const dynamic = "force-dynamic";

import Link from "next/link";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { LtvEmailConfig } from "@/components/settings/ltv-email-config";
import { EmailTemplates } from "@/components/settings/email-templates";
import { AtRiskCustomers } from "@/components/ltv/at-risk-customers";
import { EmailHistory } from "@/components/ltv/email-history";
import { AudiencesTab } from "@/components/ltv/audiences-tab";
import { RuleGroup } from "@/lib/audiences/types";

const TABS = [
  { key: "config",    label: "Configuração"    },
  { key: "templates", label: "Templates"       },
  { key: "historico", label: "Histórico"       },
  { key: "risco",     label: "Clientes em risco" },
  { key: "publicos",  label: "Públicos"        },
] as const;

type Tab = (typeof TABS)[number]["key"];

type Threshold = { days: number; templateId: string | null; enabled: boolean };

export default async function LtvPage({
  searchParams,
}: {
  searchParams: Promise<{ aba?: string }>;
}) {
  const session = await getSession();
  const clientId = session.clientId!;
  const params = await searchParams;

  const activeTab: Tab =
    params.aba === "templates"
      ? "templates"
      : params.aba === "historico"
        ? "historico"
        : params.aba === "risco"
          ? "risco"
          : params.aba === "publicos"
            ? "publicos"
            : "config";

  // Fetch LTV config upfront (needed by multiple tabs)
  const ltvEmailConfig = await prisma.ltvEmailConfig.findUnique({
    where: { clientId },
  });
  const thresholds = (ltvEmailConfig?.thresholds ?? []) as Threshold[];
  const minDays = thresholds
    .filter((t) => t.enabled)
    .reduce((min, t) => Math.min(min, t.days), 15);

  // Per-tab data
  let emailTemplates: Awaited<
    ReturnType<typeof prisma.emailTemplate.findMany>
  > = [];
  let emailLogs: Array<{
    id: string;
    type: "CUSTOMER" | "TEAM";
    threshold: number | null;
    sentAt: Date;
    openedAt: Date | null;
    clickedAt: Date | null;
    bouncedAt: Date | null;
    customer: { id: string; name: string; leadId: string | null } | null;
    template: { name: string } | null;
  }> = [];
  let atRiskRows: Array<{
    id: string;
    leadId: string | null;
    name: string;
    phone: string;
    email: string | null;
    lastSaleAt: Date;
    daysSinceLast: number;
    sentThresholds: number[];
  }> = [];

  if (activeTab === "config" || activeTab === "templates") {
    emailTemplates = await prisma.emailTemplate.findMany({
      where: { OR: [{ clientId }, { clientId: null, isDefault: true }] },
      orderBy: { createdAt: "asc" },
    });
  }

  if (activeTab === "historico") {
    const rawLogs = await prisma.ltvEmailLog.findMany({
      where: { clientId },
      include: {
        customer: {
          select: {
            id: true,
            name: true,
            leads: {
              select: { id: true },
              orderBy: { capturedAt: "desc" },
              take: 1,
            },
          },
        },
        template: { select: { name: true } },
      },
      orderBy: { sentAt: "desc" },
      take: 200,
    });

    emailLogs = rawLogs.map((l) => ({
      id: l.id,
      type: l.type as "CUSTOMER" | "TEAM",
      threshold: l.threshold,
      sentAt: l.sentAt,
      openedAt: l.openedAt,
      clickedAt: l.clickedAt,
      bouncedAt: l.bouncedAt,
      customer: l.customer
        ? {
            id: l.customer.id,
            name: l.customer.name,
            leadId: l.customer.leads[0]?.id ?? null,
          }
        : null,
      template: l.template,
    }));
  }

  if (activeTab === "risco") {
    const now = new Date();
    const msPerDay = 1000 * 60 * 60 * 24;

    const customers = await prisma.customer.findMany({
      where: { clientId, sales: { some: {} } },
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
        leads: {
          select: { id: true },
          orderBy: { capturedAt: "desc" },
          take: 1,
        },
        sales: {
          orderBy: { soldAt: "desc" },
          take: 1,
          select: { soldAt: true },
        },
      },
    });

    const eligibleCustomerIds = customers
      .filter((c) => {
        const last = c.sales[0];
        if (!last) return false;
        return (
          Math.floor(
            (now.getTime() - new Date(last.soldAt).getTime()) / msPerDay,
          ) >= minDays
        );
      })
      .map((c) => c.id);

    const sentLogs = await prisma.ltvEmailLog.findMany({
      where: {
        clientId,
        type: "CUSTOMER",
        customerId: { in: eligibleCustomerIds },
      },
      select: { customerId: true, threshold: true, sentAt: true },
    });

    const sentByCustomer = new Map<
      string,
      { threshold: number; sentAt: Date }[]
    >();
    for (const log of sentLogs) {
      if (!log.customerId) continue;
      const arr = sentByCustomer.get(log.customerId) ?? [];
      arr.push({ threshold: log.threshold ?? 0, sentAt: log.sentAt });
      sentByCustomer.set(log.customerId, arr);
    }

    atRiskRows = customers
      .map((c) => {
        const last = c.sales[0];
        if (!last) return null;
        const daysSinceLast = Math.floor(
          (now.getTime() - new Date(last.soldAt).getTime()) / msPerDay,
        );
        if (daysSinceLast < minDays) return null;

        const logsForCustomer = sentByCustomer.get(c.id) ?? [];
        // Only show thresholds sent after the last sale (to avoid showing old campaigns)
        const sentThresholds = logsForCustomer
          .filter((l) => new Date(l.sentAt) >= new Date(last.soldAt))
          .map((l) => l.threshold);

        return {
          id: c.id,
          leadId: c.leads[0]?.id ?? null,
          name: c.name,
          phone: c.phone,
          email: c.email,
          lastSaleAt: last.soldAt,
          daysSinceLast,
          sentThresholds,
        };
      })
      .filter((c): c is NonNullable<typeof c> => c !== null)
      .sort((a, b) => b.daysSinceLast - a.daysSinceLast);
  }

  // Públicos
  let audiences: Array<{
    id: string;
    name: string;
    description: string | null;
    rules: RuleGroup;
    createdAt: Date;
  }> = [];
  let audiencePipelineStages: Array<{ id: string; name: string }> = [];

  if (activeTab === "publicos") {
    const [rawAudiences, rawStages] = await Promise.all([
      prisma.audience.findMany({
        where: { clientId },
        orderBy: { createdAt: "desc" },
      }),
      prisma.pipelineStage.findMany({
        where: { clientId },
        orderBy: { position: "asc" },
        select: { id: true, name: true },
      }),
    ]);
    audiences = rawAudiences.map((a) => ({
      id:          a.id,
      name:        a.name,
      description: a.description,
      rules:       a.rules as RuleGroup,
      createdAt:   a.createdAt,
    }));
    audiencePipelineStages = rawStages;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-[var(--text)]">
          LTV & Jornada
        </h1>
        <p className="text-sm text-[var(--text-muted)] mt-0.5">
          Campanhas de email para reativar clientes inativos e monitorar risco
          de churn
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-[var(--border)]">
        {TABS.map((tab) => {
          const active = activeTab === tab.key;
          return (
            <Link
              key={tab.key}
              href={`/ltv?aba=${tab.key}`}
              className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
                active
                  ? "border-[var(--accent)] text-[var(--accent)]"
                  : "border-transparent text-[var(--text-muted)] hover:text-[var(--text)]"
              }`}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>

      {/* Configuração */}
      {activeTab === "config" && (
        <LtvEmailConfig
          config={
            ltvEmailConfig
              ? {
                  enabled: ltvEmailConfig.enabled,
                  teamEmails: ltvEmailConfig.teamEmails,
                  thresholds: thresholds,
                }
              : null
          }
          templates={emailTemplates.map((t) => ({ id: t.id, name: t.name }))}
        />
      )}

      {/* Templates */}
      {activeTab === "templates" && (
        <EmailTemplates
          templates={emailTemplates}
          userEmail={session.email}
          clientName={session.client!.name}
        />
      )}

      {/* Histórico */}
      {activeTab === "historico" && <EmailHistory logs={emailLogs} />}

      {/* Clientes em risco */}
      {activeTab === "risco" && (
        <AtRiskCustomers customers={atRiskRows} thresholds={thresholds} />
      )}

      {/* Públicos */}
      {activeTab === "publicos" && (
        <AudiencesTab
          audiences={audiences}
          pipelineStages={audiencePipelineStages}
        />
      )}
    </div>
  );
}
