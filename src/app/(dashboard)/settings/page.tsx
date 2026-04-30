export const dynamic = "force-dynamic";

import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { SettingsForm } from "@/components/settings/settings-form";
import { AuthorizedDomains } from "@/components/settings/authorized-domains";
import { GuideCard } from "@/components/ui/guide-card";

export default async function SettingsPage() {
  const session  = await getSession();
  const clientId = session.clientId!;

  const [client, settings, authorizedDomains] = await Promise.all([
    prisma.client.findUniqueOrThrow({ where: { id: clientId } }),
    prisma.clientSettings.findUnique({ where: { clientId } }),
    prisma.authorizedDomain.findMany({ where: { clientId }, orderBy: { createdAt: "asc" } }),
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
          googleAdsEnabled:                  settings?.googleAdsEnabled                  ?? false,
          googleAdsCustomerId:               settings?.googleAdsCustomerId               ?? null,
          googleAdsConversionActionLead:     settings?.googleAdsConversionActionLead     ?? null,
          googleAdsConversionActionPurchase: settings?.googleAdsConversionActionPurchase ?? null,
          googleRefreshToken:                settings?.googleRefreshToken                ?? null,
        }}
        leadCaptureKey={client.leadCaptureKey}
      />

      <AuthorizedDomains domains={authorizedDomains} />
    </div>
  );
}
