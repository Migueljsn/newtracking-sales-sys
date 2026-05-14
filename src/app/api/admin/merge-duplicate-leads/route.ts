import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { invalidate, cacheKeys } from "@/lib/cache/invalidate";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const results = {
    customersProcessed: 0,
    leadsDeleted: 0,
    salesMoved: 0,
    eventsUpdated: 0,
    errors: [] as { customerId: string; error: string }[],
  };

  // Busca todos os clientes com mais de uma lead
  const customers = await prisma.customer.findMany({
    where: { leads: { some: {} } },
    include: {
      leads: {
        where: { status: { not: "LOST" } },
        orderBy: { capturedAt: "asc" },
        include: {
          sales:  { select: { id: true } },
          trackingEvents: { select: { id: true } },
        },
      },
    },
  });

  for (const customer of customers) {
    const activeLeads = customer.leads;
    if (activeLeads.length <= 1) continue;

    try {
      // Lead mais antiga = master; todas as outras são duplicatas do fluxo antigo
      const [masterLead, ...duplicates] = activeLeads;

      for (const dup of duplicates) {
        // Move todas as vendas da duplicata para a master
        if (dup.sales.length > 0) {
          const saleIds = dup.sales.map((s) => s.id);
          await prisma.sale.updateMany({
            where: { id: { in: saleIds } },
            data:  { leadId: masterLead.id },
          });
          results.salesMoved += saleIds.length;
        }

        // Move todos os tracking events da duplicata para a master
        const updated = await prisma.trackingEvent.updateMany({
          where: { leadId: dup.id },
          data:  { leadId: masterLead.id },
        });
        results.eventsUpdated += updated.count;

        // Deleta a lead duplicata (cascade deleta statusHistory)
        await prisma.lead.delete({ where: { id: dup.id } });
        results.leadsDeleted++;
      }

      // Garante que a master está SOLD se tem vendas
      const masterSalesCount = await prisma.sale.count({ where: { leadId: masterLead.id } });
      if (masterSalesCount > 0 && masterLead.status !== "SOLD") {
        await prisma.lead.update({
          where: { id: masterLead.id },
          data: {
            status:        "SOLD",
            statusHistory: { create: { from: masterLead.status, to: "SOLD" } },
          },
        });
      }

      // Invalida cache da master e da lista de leads do client
      await invalidate(
        cacheKeys.leadDetail(masterLead.id),
        cacheKeys.leads(masterLead.clientId),
        cacheKeys.metrics(masterLead.clientId),
      );

      results.customersProcessed++;
    } catch (err) {
      results.errors.push({
        customerId: customer.id,
        error: err instanceof Error ? err.message : "Erro desconhecido",
      });
    }
  }

  return NextResponse.json({ ok: true, results });
}
