export const dynamic = "force-dynamic";

import { dehydrate, HydrationBoundary, QueryClient } from "@tanstack/react-query";
import { getSession } from "@/lib/auth/session";
import { fetchSalesForClient } from "@/lib/queries/sales";
import { SalesTable } from "@/components/sales/sales-table";

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

<HydrationBoundary state={dehydrate(queryClient)}>
        <SalesTable />
      </HydrationBoundary>
    </div>
  );
}
