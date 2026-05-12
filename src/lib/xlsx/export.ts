import * as XLSX from "xlsx";
import { prisma } from "@/lib/db/prisma";

function statusLabel(status: string) {
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
      sale: true,
      trackingEvents: {
        where: { eventName: "Lead" },
        select: { status: true },
        take: 1,
      },
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
    "Data de Nascimento":    lead.customer.birthDate
                               ? lead.customer.birthDate.toLocaleDateString("pt-BR")
                               : "",
    "Consultor":             lead.consultant ?? "",
    "Status":                statusLabel(lead.status),
    "Valor da Venda (R$)":   lead.sale ? Number(lead.sale.value) : "",
    "Data da Venda":         lead.sale ? lead.sale.soldAt.toLocaleDateString("pt-BR") : "",
    "Data de Captura":       lead.capturedAt.toLocaleDateString("pt-BR"),
    "UTM Source":            lead.utmSource ?? "",
    "UTM Medium":            lead.utmMedium ?? "",
    "UTM Campaign":          lead.utmCampaign ?? "",
    "UTM Content":           lead.utmContent ?? "",
    "UTM Term":              lead.utmTerm ?? "",
    "ID da Lead":            lead.id,
    "Evento Lead (Meta)":    lead.trackingEvents[0]?.status ?? "—",
    "Evento Purchase (Meta)":lead.sale ? (purchaseMap.get(lead.sale.id) ?? "—") : "—",
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
