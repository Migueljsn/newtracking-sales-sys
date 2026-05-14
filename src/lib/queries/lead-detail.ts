import { prisma } from "@/lib/db/prisma";
import { getOrSet } from "@/lib/cache/get-or-set";
import { cacheKeys } from "@/lib/cache/invalidate";

export async function fetchLeadDetail(leadId: string, clientId: string) {
  return getOrSet(cacheKeys.leadDetail(leadId), 300, () =>
    prisma.lead.findUnique({
      where:   { id: leadId, clientId },
      include: {
        customer: {
          include: {
            sales: { orderBy: { soldAt: "desc" } },
            leads: {
              orderBy: { capturedAt: "desc" },
              include: { sales: { orderBy: { soldAt: "desc" }, take: 1 } },
            },
          },
        },
        sales:          { include: { items: true }, orderBy: { soldAt: "desc" } },
        trackingEvents: { orderBy: { createdAt: "asc" } },
        statusHistory:  { orderBy: { createdAt: "asc" } },
      },
    })
  );
}
