export const dynamic = "force-dynamic";

import { dehydrate, HydrationBoundary, QueryClient } from "@tanstack/react-query";
import { getSession } from "@/lib/auth/session";
import { fetchDashboardMetrics } from "@/lib/queries/dashboard";
import { MetricsCards } from "@/components/dashboard/metrics-cards";

export default async function DashboardPage() {
  const session  = await getSession();
  const clientId = session.clientId!;

  const queryClient = new QueryClient();
  await queryClient.prefetchQuery({
    queryKey: ["dashboard", "metrics"],
    queryFn:  () => fetchDashboardMetrics(clientId),
  });

  return (
    <div className="space-y-6 animate-fade-in">

      {/* Header */}
      <div className="space-y-1 animate-slide-up">
        <p className="text-xs font-semibold uppercase tracking-[0.26em] text-[var(--text-muted)]">Dashboard</p>
        <h1 className="text-2xl font-semibold text-[var(--text)] sm:text-3xl">Visão geral</h1>
      </div>

      {/* KPI cards */}
      <HydrationBoundary state={dehydrate(queryClient)}>
        <MetricsCards />
      </HydrationBoundary>
    </div>
  );
}
