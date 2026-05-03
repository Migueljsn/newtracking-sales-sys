import { prisma } from "@/lib/db/prisma";
import { getOrSet } from "@/lib/cache/get-or-set";
import { cacheKeys } from "@/lib/cache/invalidate";

export async function fetchSalesForClient(clientId: string) {
  return getOrSet(cacheKeys.sales(clientId), 60, () =>
    prisma.sale.findMany({
      where:   { clientId },
      include: {
        customer: { select: { name: true, phone: true, document: true } },
        lead:     { select: { utmCampaign: true, utmSource: true } },
        trackingEvents: {
          where:  { eventName: "Purchase" },
          select: { status: true },
          take:   1,
        },
      },
      orderBy: { soldAt: "desc" },
    })
  );
}
