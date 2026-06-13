import * as XLSX from "xlsx";
import { prisma } from "@/lib/db/prisma";

function statusLabel(status: string, pipelineStageName?: string | null) {
  if (pipelineStageName) return pipelineStageName.toUpperCase();
  if (status === "NEW")        return "NOVA";
  if (status === "REGISTERED") return "CADASTRADA";
  if (status === "SOLD")       return "VENDA";
  return "PERDIDA";
}

export async function generateLeadsXlsx(clientId: string): Promise<Buffer> {
  const leads = await prisma.lead.findMany({
    where: { clientId },
    include: {
      customer: true,
      sales: { orderBy: { soldAt: "desc" as const }, take: 1 },
      trackingEvents: {
        where: { eventName: "Lead" },
        select: { status: true },
        take: 1,
      },
      pipelineStage: { select: { name: true } },
    },
    orderBy: { capturedAt: "desc" },
  });

  const purchaseEvents = await prisma.trackingEvent.findMany({
    where: { clientId, eventName: "Purchase" },
    select: { saleId: true, status: true },
  });
  const purchaseMap = new Map(purchaseEvents.map((e) => [e.saleId, e.status]));

  const rows = leads.map((lead) => ({
    "Nome":                  lead.customer.name,
    "Telefone":              lead.customer.phone,
    "Email":                 lead.customer.email ?? "",
    "CPF/CNPJ":              lead.customer.document ?? "",
    "CEP":                   lead.customer.zipCode ?? "",
    "Cidade":                lead.customer.city ?? "",
    "Estado":                lead.customer.state ?? "",
    "Consultor":             lead.consultant ?? "",
    "Status":                statusLabel(lead.status, lead.pipelineStage?.name),
    "Valor da Venda (R$)":   lead.sales[0] ? Number(lead.sales[0].value) : "",
    "Data da Venda":         lead.sales[0] ? lead.sales[0].soldAt.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" }) : "",
    "Data de Captura":       lead.capturedAt.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" }),
    "UTM Source":            lead.utmSource ?? "",
    "UTM Medium":            lead.utmMedium ?? "",
    "UTM Campaign":          lead.utmCampaign ?? "",
    "UTM Content":           lead.utmContent ?? "",
    "UTM Term":              lead.utmTerm ?? "",
    "ID da Lead":            lead.id,
    "Evento Lead (Meta)":    lead.trackingEvents[0]?.status ?? "—",
    "Evento Purchase (Meta)":lead.sales[0] ? (purchaseMap.get(lead.sales[0].id) ?? "—") : "—",
  }));

  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Leads");

  ws["!cols"] = [
    { wch: 25 }, { wch: 16 }, { wch: 25 }, { wch: 16 },
    { wch: 12 }, { wch: 16 }, { wch: 8  }, { wch: 16 },
    { wch: 14 }, { wch: 12 }, { wch: 16 }, { wch: 14 },
    { wch: 16 }, { wch: 14 }, { wch: 14 }, { wch: 20 },
    { wch: 16 }, { wch: 14 }, { wch: 30 }, { wch: 16 },
    { wch: 18 },
  ];

  return Buffer.from(XLSX.write(wb, { type: "buffer", bookType: "xlsx" }));
}
