export const dynamic = "force-dynamic";

import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { SettingsForm } from "@/components/settings/settings-form";
import { AuthorizedDomains } from "@/components/settings/authorized-domains";
import { WhatsappTemplateForm } from "@/components/settings/whatsapp-template-form";
import { GuideCard } from "@/components/ui/guide-card";
import { PipelineStages } from "@/components/settings/pipeline-stages";
import { ConsultantAccess } from "@/components/settings/consultant-access";
import { WebhookConfig } from "@/components/settings/webhook-config";
import { WhatsAppInstances } from "@/components/settings/whatsapp-instances";

const TABS = [
  { key: "geral",     label: "Geral"      },
  { key: "pipeline",  label: "Pipeline"   },
  { key: "acessos",   label: "Acessos"    },
  { key: "whatsapp",  label: "WhatsApp"   },
  { key: "webhooks",  label: "Webhooks"   },
] as const;

type TabKey = typeof TABS[number]["key"];

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{
    tab?:              string;
    google_connected?: string;
    google_error?:     string;
  }>;
}) {
  const session  = await getSession();
  const clientId = session.clientId!;
  const params   = await searchParams;

  const activeTab: TabKey = (params.tab as TabKey) ?? "geral";

  const googleStatus = params.google_connected === "1"
    ? "connected"
    : params.google_error
    ? "error"
    : null;

  const [client, settings, authorizedDomains, pipelineStages, consultantUsers, webhookToken, webhookLogs, whatsappInstances] = await Promise.all([
    prisma.client.findUniqueOrThrow({ where: { id: clientId } }),
    prisma.clientSettings.findUnique({ where: { clientId } }),
    prisma.authorizedDomain.findMany({ where: { clientId }, orderBy: { createdAt: "asc" } }),
    prisma.pipelineStage.findMany({
      where:   { clientId },
      orderBy: { position: "asc" },
      include: { requirements: { orderBy: { position: "asc" } } },
    }),
    prisma.consultantUser.findMany({ where: { clientId }, orderBy: { createdAt: "asc" } }),
    prisma.webhookToken.findUnique({ where: { clientId }, select: { id: true, token: true, flowToken: true, enabled: true } }),
    prisma.webhookInboundLog.findMany({
      where:   { clientId },
      orderBy: { createdAt: "desc" },
      take:    20,
      select:  { id: true, phone: true, action: true, error: true, createdAt: true },
    }),
    prisma.whatsAppInstance.findMany({
      where:   { clientId },
      orderBy: { priority: "asc" },
      select:  { id: true, instanceName: true, status: true, phone: true, profileName: true, priority: true },
    }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-[var(--text)]">Configurações</h1>
        <p className="text-sm text-[var(--text-muted)] mt-0.5">{client.name}</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] p-1 w-fit">
        {TABS.map((tab) => (
          <a
            key={tab.key}
            href={`/settings?tab=${tab.key}`}
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

      {activeTab === "geral" && (
        <>
          <GuideCard
            title="Ordem correta de configuração"
            description="O cliente aprende melhor quando a tela deixa claro o próximo passo. Aqui vale guiar explicitamente."
            items={[
              "1. Confirme a chave de captura usada pelos formulários do cliente.",
              "2. Cadastre Pixel ID e Access Token para liberar envios reais ao Meta.",
              "3. Use Test Event Code só durante validação; em produção, deixe em branco.",
            ]}
            tone="tip"
          />

          <SettingsForm
            settings={{
              metaPixelId:          settings?.metaPixelId          ?? null,
              metaAccessToken:      settings?.metaAccessToken       ?? null,
              metaTestEventCode:    settings?.metaTestEventCode     ?? null,
              trackingEnabled:      settings?.trackingEnabled       ?? false,
              metaLeadEnabled:      settings?.metaLeadEnabled       ?? true,
              metaPurchaseEnabled:  settings?.metaPurchaseEnabled   ?? true,
              googleAdsEnabled:                  settings?.googleAdsEnabled                  ?? false,
              googleLeadEnabled:                 settings?.googleLeadEnabled                 ?? true,
              googleAdsCustomerId:               settings?.googleAdsCustomerId               ?? null,
              googleAdsConversionActionLead:     settings?.googleAdsConversionActionLead     ?? null,
              googleAdsConversionActionPurchase: settings?.googleAdsConversionActionPurchase ?? null,
              hasGoogleRefreshToken:             !!settings?.googleRefreshToken,
            }}
            googleStatus={googleStatus}
            leadCaptureKey={client.leadCaptureKey}
          />

          <WhatsappTemplateForm currentTemplate={settings?.whatsappTemplate ?? null} />

          <AuthorizedDomains domains={authorizedDomains} />
        </>
      )}

      {activeTab === "pipeline" && (
        <div className="card p-5">
          <PipelineStages stages={pipelineStages} />
        </div>
      )}

      {activeTab === "acessos" && (
        <div className="card p-5">
          <ConsultantAccess consultants={consultantUsers} />
        </div>
      )}

      {activeTab === "whatsapp" && (
        <div className="space-y-4">
          <div className="card p-5">
            <WhatsAppInstances initialInstances={whatsappInstances} />
          </div>
          <div className="rounded-xl border border-dashed border-[var(--border)] px-5 py-4 flex items-center gap-3 opacity-50">
            <span className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide">Integração Botconversa — em standby</span>
          </div>
        </div>
      )}

      {activeTab === "webhooks" && (
        <div className="card p-5">
          <WebhookConfig
            token={webhookToken}
            recentLogs={webhookLogs}
            appUrl={process.env.NEXT_PUBLIC_APP_URL ?? ""}
          />
        </div>
      )}
    </div>
  );
}
