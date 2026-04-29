import { prisma } from "@/lib/db/prisma";
import { TrackingEventStatus } from "@prisma/client";
import { createId } from "@paralleldrive/cuid2";
import { buildPurchasePayload } from "@/lib/domain/tracking/build-payload";
import { updateCustomerLifecycle } from "@/lib/domain/customer/update-lifecycle";

interface SaleItem {
  name: string;
  quantity: number;
  price: number;
}

interface CreateSaleInput {
  clientId: string;
  leadId: string;
  value: number;
  soldAt?: Date;
  notes?: string;
  items?: SaleItem[];
}

export async function createSale(input: CreateSaleInput) {
  const lead = await prisma.lead.findUniqueOrThrow({
    where: { id: input.leadId, clientId: input.clientId },
    include: { customer: true },
  });

  if (lead.status !== "NEW") {
    throw new Error(
      lead.status === "SOLD"
        ? "Esta lead já tem uma venda registrada. Use o botão 'Nova venda' para registrar uma recompra."
        : "Leads perdidas não podem receber vendas diretamente."
    );
  }

  // Verifica recompra
  const previousSales = await prisma.sale.count({
    where: { customerId: lead.customerId },
  });
  const isRepeatPurchase = previousSales > 0;

  const soldAt = input.soldAt ?? new Date();
  const eventId = createId();

  const sale = await prisma.sale.create({
    data: {
      clientId: input.clientId,
      customerId: lead.customerId,
      leadId: input.leadId,
      value: input.value,
      isRepeatPurchase,
      notes: input.notes,
      soldAt,
      items: input.items
        ? { create: input.items }
        : undefined,
    },
  });

  // Atualiza status da lead
  await prisma.lead.update({
    where: { id: input.leadId },
    data: {
      status: "SOLD",
      statusHistory: { create: { from: "NEW", to: "SOLD" } },
    },
  });

  // Cria evento de Purchase
  const payload = buildPurchasePayload(lead.customer, lead, sale, eventId);

  await prisma.trackingEvent.create({
    data: {
      clientId: input.clientId,
      eventName: "Purchase",
      eventId,
      status: TrackingEventStatus.PENDING,
      payload,
      leadId: input.leadId,
      saleId: sale.id,
    },
  });

  // Atualiza lifecycle do customer
  await updateCustomerLifecycle(lead.customerId);

  return sale;
}
