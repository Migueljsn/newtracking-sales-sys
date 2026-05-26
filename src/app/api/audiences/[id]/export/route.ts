import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { parseAudienceRules } from "@/lib/audiences/types";
import { evaluateAudience } from "@/lib/audiences/evaluate";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session  = await getSession();
    const clientId = session.clientId!;
    const { id }   = await params;

    const audience = await prisma.audience.findUniqueOrThrow({ where: { id, clientId } });
    const def      = parseAudienceRules(audience.rules);

    const leads = await prisma.lead.findMany({
      where: { clientId },
      include: {
        customer:      true,
        sales:         { orderBy: { soldAt: "desc" }, take: 1 },
        pipelineStage: { select: { name: true } },
      },
      orderBy: { capturedAt: "desc" },
    });

    const matched = leads.filter((l) =>
      evaluateAudience(
        {
          status:          l.status,
          pipelineStageId: l.pipelineStageId,
          capturedAt:      l.capturedAt,
          utmSource:       l.utmSource,
          utmMedium:       l.utmMedium,
          utmCampaign:     l.utmCampaign,
          consultant:      l.consultant,
          customer:        l.customer
            ? { state: l.customer.state, city: l.customer.city, email: l.customer.email }
            : null,
          sales: l.sales.map((s) => ({ value: s.value.toString(), soldAt: s.soldAt })),
        },
        def
      )
    );

    const rows = matched.map((lead) => ({
      "Nome":              lead.customer.name,
      "Telefone":          lead.customer.phone,
      "Email":             lead.customer.email  ?? "",
      "CPF/CNPJ":          lead.customer.document ?? "",
      "Cidade":            lead.customer.city   ?? "",
      "Estado":            lead.customer.state  ?? "",
      "Consultor":         lead.consultant      ?? "",
      "Status":            lead.pipelineStage?.name ?? lead.status,
      "Valor da Venda":    lead.sales[0] ? Number(lead.sales[0].value) : "",
      "Data da Venda":     lead.sales[0] ? lead.sales[0].soldAt.toLocaleDateString("pt-BR") : "",
      "Data de Captura":   lead.capturedAt.toLocaleDateString("pt-BR"),
      "UTM Source":        lead.utmSource   ?? "",
      "UTM Medium":        lead.utmMedium   ?? "",
      "UTM Campaign":      lead.utmCampaign ?? "",
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Leads");

    ws["!cols"] = [
      { wch: 25 }, { wch: 16 }, { wch: 25 }, { wch: 16 },
      { wch: 16 }, { wch: 8  }, { wch: 16 }, { wch: 14 },
      { wch: 12 }, { wch: 14 }, { wch: 14 }, { wch: 16 },
      { wch: 14 }, { wch: 18 },
    ];

    const buffer = Buffer.from(XLSX.write(wb, { type: "buffer", bookType: "xlsx" }));
    const filename = `${audience.name.replace(/[^a-z0-9]/gi, "_")}.xlsx`;

    return new NextResponse(buffer, {
      headers: {
        "Content-Type":        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
