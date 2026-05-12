import { prisma } from "@/lib/db/prisma";
import { getOrSet } from "@/lib/cache/get-or-set";
import { cacheKeys } from "@/lib/cache/invalidate";

export async function fetchLeadsForClient(clientId: string) {
  return getOrSet(cacheKeys.leads(clientId), 60, () =>
    prisma.lead.findMany({
      where:   { clientId },
      include: {
        customer: { select: { name: true, phone: true, email: true, document: true, state: true, city: true } },
        sale:     { select: { soldAt: true } },
      },
      orderBy: { capturedAt: "desc" },
    })
  );
}
