export const dynamic = "force-dynamic";

import { dehydrate, HydrationBoundary, QueryClient } from "@tanstack/react-query";
import { getSession } from "@/lib/auth/session";
import { fetchSalesForClient } from "@/lib/queries/sales";
import { SalesTable } from "@/components/sales/sales-table";
import { GuideCard } from "@/components/ui/guide-card";

export default async function SalesPage() {
  const session  = await getSession();
  const clientId = session.clientId!;

  const queryClient = new QueryClient();
  await queryClient.prefetchQuery({
    queryKey: ["sales"],
    queryFn:  () => fetchSalesForClient(clientId),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-[var(--text)]">Vendas</h1>
      </div>

      <GuideCard
        title="Leitura correta da área de vendas"
        description="Esta tela deve responder rápido o que já virou receita e como isso está refletindo no tracking."
        items={[
          "Use a coluna de tracking para identificar vendas que ainda não chegaram ao Meta ou falharam no envio.",
          "Abra a lead relacionada quando precisar revisar origem, recompra, itens vendidos ou dados do contato.",
          "Se a campanha estiver vazia com frequência, o problema normalmente está na captura ou na importação da lead, não na venda em si.",
        ]}
        tone="info"
      />

      <HydrationBoundary state={dehydrate(queryClient)}>
        <SalesTable />
      </HydrationBoundary>
    </div>
  );
}
