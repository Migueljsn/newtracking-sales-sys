export const dynamic = "force-dynamic";

import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { SettingsForm } from "@/components/settings/settings-form";
import { AuthorizedDomains } from "@/components/settings/authorized-domains";
import { LtvEmailConfig } from "@/components/settings/ltv-email-config";
import { EmailTemplates } from "@/components/settings/email-templates";
import { GuideCard } from "@/components/ui/guide-card";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ google_connected?: string; google_error?: string }>;
}) {
  const session  = await getSession();
  const clientId = session.clientId!;
  const params   = await searchParams;

  const googleStatus = params.google_connected === "1"
    ? "connected"
    : params.google_error
    ? "error"
    : null;

  const [client, settings, authorizedDomains, ltvEmailConfig, emailTemplates] = await Promise.all([
    prisma.client.findUniqueOrThrow({ where: { id: clientId } }),
    prisma.clientSettings.findUnique({ where: { clientId } }),
    prisma.authorizedDomain.findMany({ where: { clientId }, orderBy: { createdAt: "asc" } }),
    prisma.ltvEmailConfig.findUnique({ where: { clientId } }),
    prisma.emailTemplate.findMany({
      where:   { OR: [{ clientId }, { clientId: null, isDefault: true }] },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-[var(--text)]">Configurações</h1>
        <p className="text-sm text-[var(--text-muted)] mt-0.5">{client.name}</p>
      </div>

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
          trackLeadEvents:   settings?.trackLeadEvents   ?? true,
          googleAdsEnabled:                  settings?.googleAdsEnabled                  ?? false,
          googleAdsCustomerId:               settings?.googleAdsCustomerId               ?? null,
          googleAdsConversionActionLead:     settings?.googleAdsConversionActionLead     ?? null,
          googleAdsConversionActionPurchase: settings?.googleAdsConversionActionPurchase ?? null,
          hasGoogleRefreshToken:             !!settings?.googleRefreshToken,
        }}
        googleStatus={googleStatus}
        leadCaptureKey={client.leadCaptureKey}
      />

      <AuthorizedDomains domains={authorizedDomains} />

      <LtvEmailConfig
        config={ltvEmailConfig ? {
          enabled:    ltvEmailConfig.enabled,
          teamEmails: ltvEmailConfig.teamEmails,
          thresholds: ltvEmailConfig.thresholds as { days: number; templateId: string | null; enabled: boolean }[],
        } : null}
        templates={emailTemplates.map(t => ({ id: t.id, name: t.name }))}
      />

      <EmailTemplates templates={emailTemplates} />
    </div>
  );
}
