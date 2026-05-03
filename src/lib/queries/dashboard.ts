import { prisma } from "@/lib/db/prisma";
import { getOrSet } from "@/lib/cache/get-or-set";
import { cacheKeys } from "@/lib/cache/invalidate";

export async function fetchDashboardMetrics(clientId: string) {
  return getOrSet(cacheKeys.metrics(clientId), 60, async () => {
    const [totalLeads, totalSales, pendingEvents, failedEvents] = await Promise.all([
      prisma.lead.count({ where: { clientId } }),
      prisma.sale.count({ where: { clientId } }),
      prisma.trackingEvent.count({ where: { clientId, status: "PENDING" } }),
      prisma.trackingEvent.count({ where: { clientId, status: "FAILED" } }),
    ]);
    return { totalLeads, totalSales, pendingEvents, failedEvents };
  });
}
