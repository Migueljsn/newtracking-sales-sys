export const dynamic = "force-dynamic";

import { dehydrate, HydrationBoundary, QueryClient } from "@tanstack/react-query";
import { getSession } from "@/lib/auth/session";
import { fetchLeadsForClient } from "@/lib/queries/leads";
import { LeadsTable } from "@/components/leads/leads-table";
import { CreateLeadModal } from "@/components/leads/create-lead-modal";
import { GuideCard } from "@/components/ui/guide-card";

export default async function LeadsPage() {
  const session  = await getSession();
  const clientId = session.clientId!;

  const queryClient = new QueryClient();
  await queryClient.prefetchQuery({
    queryKey: ["leads"],
    queryFn:  () => fetchLeadsForClient(clientId),
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--text)]">Leads</h1>
        </div>
        <CreateLeadModal />
      </div>

      <GuideCard
        title="Como operar esta tela"
        description="A lista de leads é o ponto de partida diário do cliente. O ideal é reduzir dúvida operacional logo aqui."
        items={[
          "Use a busca para localizar por nome, telefone ou CPF/CNPJ sem precisar lembrar em qual canal a lead entrou.",
          "Abra a lead para ver origem da campanha, histórico e ações disponíveis como registrar venda ou marcar como perdida.",
          "Se a operação ainda não tem origem confiável da lead, prefira completar a captura ou importar corretamente antes de avançar no comercial.",
        ]}
        tone="tip"
      />

      <HydrationBoundary state={dehydrate(queryClient)}>
        <LeadsTable />
      </HydrationBoundary>
    </div>
  );
}
