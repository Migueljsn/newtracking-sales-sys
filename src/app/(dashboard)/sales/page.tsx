export const dynamic = "force-dynamic";

import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { SalesTable } from "@/components/sales/sales-table";
import { GuideCard } from "@/components/ui/guide-card";

export default async function SalesPage() {
  const session = await getSession();
  const clientId = session.clientId!;

  const sales = await prisma.sale.findMany({
    where: { clientId },
    include: {
      customer: { select: { name: true, phone: true, document: true } },
      lead: { select: { utmCampaign: true, utmSource: true } },
      trackingEvents: {
        where: { eventName: "Purchase" },
        select: { status: true },
        take: 1,
      },
    },
    orderBy: { soldAt: "desc" },
  });

  const serializedSales = sales.map((sale) => ({
    ...sale,
    value: Number(sale.value),
  }));

  const totalRevenue = serializedSales.reduce((acc, s) => acc + s.value, 0);
  const totalSales   = sales.length;
  const repeatCount  = serializedSales.filter((s) => s.isRepeatPurchase).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-[var(--text)]">Vendas</h1>
        <p className="text-sm text-[var(--text-muted)] mt-0.5">{totalSales} vendas registradas</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="card p-5">
          <p className="text-xs text-[var(--text-muted)] uppercase tracking-wider mb-1">Receita total</p>
          <p className="text-2xl font-bold text-[var(--success)]">
            {totalRevenue.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
          </p>
        </div>
        <div className="card p-5">
          <p className="text-xs text-[var(--text-muted)] uppercase tracking-wider mb-1">Total de vendas</p>
          <p className="text-2xl font-bold text-[var(--text)]">{totalSales}</p>
        </div>
        <div className="card p-5">
          <p className="text-xs text-[var(--text-muted)] uppercase tracking-wider mb-1">Recompras</p>
          <p className="text-2xl font-bold text-[var(--text)]">
            {repeatCount}
            <span className="text-sm font-normal text-[var(--text-muted)] ml-1">
              ({totalSales > 0 ? Math.round((repeatCount / totalSales) * 100) : 0}%)
            </span>
          </p>
        </div>
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

      <SalesTable sales={serializedSales} />
    </div>
  );
}
