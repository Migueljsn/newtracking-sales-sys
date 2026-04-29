import { prisma } from "@/lib/db/prisma";
import { CustomerLifecycle } from "@prisma/client";

export async function updateCustomerLifecycle(customerId: string) {
  const sales = await prisma.sale.findMany({
    where: { customerId },
    orderBy: { soldAt: "desc" },
  });

  const total = sales.length;
  const lastSale = sales[0];
  const daysSinceLastSale = lastSale
    ? (Date.now() - lastSale.soldAt.getTime()) / (1000 * 60 * 60 * 24)
    : Infinity;

  let lifecycle: CustomerLifecycle;

  if (daysSinceLastSale > 120) {
    lifecycle = CustomerLifecycle.INACTIVE;
  } else if (daysSinceLastSale > 60) {
    lifecycle = CustomerLifecycle.AT_RISK;
  } else if (total >= 4) {
    lifecycle = CustomerLifecycle.CHAMPION;
  } else if (total >= 2) {
    lifecycle = CustomerLifecycle.LOYAL;
  } else {
    lifecycle = CustomerLifecycle.NEW_BUYER;
  }

  await prisma.customer.update({
    where: { id: customerId },
    data: { lifecycle },
  });
}
