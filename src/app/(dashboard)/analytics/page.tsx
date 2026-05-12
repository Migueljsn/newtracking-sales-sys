export const dynamic = "force-dynamic";

import { dehydrate, HydrationBoundary, QueryClient } from "@tanstack/react-query";
import { getSession } from "@/lib/auth/session";
import { fetchAnalytics } from "@/lib/queries/analytics";
import { AnalyticsOverview } from "@/components/dashboard/analytics-overview";

export default async function AnalyticsPage() {
  const session  = await getSession();
  const clientId = session.clientId!;

  const queryClient = new QueryClient();
  await queryClient.prefetchQuery({
    queryKey: ["analytics", 30],
    queryFn:  () => fetchAnalytics(clientId, 30),
  });

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="space-y-1 animate-slide-up">
        <p className="text-xs font-semibold uppercase tracking-[0.26em] text-[var(--text-muted)]">Relatório</p>
        <h1 className="text-2xl font-semibold text-[var(--text)] sm:text-3xl">Analytics</h1>
      </div>

      <HydrationBoundary state={dehydrate(queryClient)}>
        <AnalyticsOverview />
      </HydrationBoundary>
    </div>
  );
}
