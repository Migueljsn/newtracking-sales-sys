export const dynamic = "force-dynamic";

import Link from "next/link";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { SettingsForm } from "@/components/settings/settings-form";
import { AuthorizedDomains } from "@/components/settings/authorized-domains";
import { LtvEmailConfig } from "@/components/settings/ltv-email-config";
import { EmailTemplates } from "@/components/settings/email-templates";
import { WhatsappTemplateForm } from "@/components/settings/whatsapp-template-form";
import { GuideCard } from "@/components/ui/guide-card";

const TABS = [
  { key: "geral",  label: "Geral" },
  { key: "emails", label: "E-mails LTV" },
] as const;

type Tab = (typeof TABS)[number]["key"];

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{
    aba?: string;
    google_connected?: string;
    google_error?: string;
  }>;
}) {
  const session  = await getSession();
  const clientId = session.clientId!;
  const params   = await searchParams;

  const activeTab: Tab = params.aba === "emails" ? "emails" : "geral";

  const googleStatus = params.google_connected === "1"
    ? "connected"
    : params.google_error
    ? "error"
    : null;

  // Busca somente os dados da aba ativa
  const [client, settings, authorizedDomains, ltvEmailConfig, emailTemplates] = await Promise.all([
    prisma.client.findUniqueOrThrow({ where: { id: clientId } }),
    activeTab === "geral"
      ? prisma.clientSettings.findUnique({ where: { clientId } })
      : Promise.resolve(null),
    activeTab === "geral"
      ? prisma.authorizedDomain.findMany({ where: { clientId }, orderBy: { createdAt: "asc" } })
      : Promise.resolve([]),
    activeTab === "emails"
      ? prisma.ltvEmailConfig.findUnique({ where: { clientId } })
      : Promise.resolve(null),
    activeTab === "emails"
      ? prisma.emailTemplate.findMany({
          where:   { OR: [{ clientId }, { clientId: null, isDefault: true }] },
          orderBy: { createdAt: "asc" },
        })
      : Promise.resolve([]),
  ]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-[var(--text)]">Configurações</h1>
        <p className="text-sm text-[var(--text-muted)] mt-0.5">{client.name}</p>
      </div>

      {/* Abas */}
      <div className="flex gap-1 border-b border-[var(--border)]">
        {TABS.map((tab) => {
          const active = activeTab === tab.key;
          return (
            <Link
              key={tab.key}
              href={`/settings?aba=${tab.key}`}
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

      {/* Conteúdo da aba Geral */}
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
              metaPixelId:       settings?.metaPixelId       ?? null,
              metaAccessToken:   settings?.metaAccessToken   ?? null,
              metaTestEventCode: settings?.metaTestEventCode ?? null,
              trackingEnabled:   settings?.trackingEnabled   ?? false,
              googleAdsEnabled:                  settings?.googleAdsEnabled                  ?? false,
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

      {/* Conteúdo da aba E-mails LTV */}
      {activeTab === "emails" && (
        <>
          <LtvEmailConfig
            config={ltvEmailConfig ? {
              enabled:    ltvEmailConfig.enabled,
              teamEmails: ltvEmailConfig.teamEmails,
              thresholds: ltvEmailConfig.thresholds as { days: number; templateId: string | null; enabled: boolean }[],
            } : null}
            templates={emailTemplates.map(t => ({ id: t.id, name: t.name }))}
          />

          <EmailTemplates templates={emailTemplates} />
        </>
      )}
    </div>
  );
}
