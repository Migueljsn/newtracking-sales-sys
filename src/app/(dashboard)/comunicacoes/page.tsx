export const dynamic = "force-dynamic";

import { getSession }              from "@/lib/auth/session";
import { fetchComunicacoesStats }  from "@/lib/queries/comunicacoes";
import { ComunicacoesView }        from "@/components/comunicacoes/comunicacoes-view";

export default async function ComunicacoesPage({
  searchParams,
}: {
  searchParams: Promise<{ aba?: string }>;
}) {
  const session  = await getSession();
  const clientId = session.clientId!;
  const params   = await searchParams;
  const activeTab = (params.aba ?? "visao-geral") as "visao-geral" | "email" | "whatsapp";

  const stats = await fetchComunicacoesStats(clientId);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-[var(--text)]">Comunicações</h1>
        <p className="text-sm text-[var(--text-muted)] mt-0.5">
          Métricas de disparos por canal — e-mail e WhatsApp
        </p>
      </div>
      <ComunicacoesView stats={stats} activeTab={activeTab} />
    </div>
  );
}
