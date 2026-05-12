import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { createSupabaseServer } from "@/lib/auth/supabase-server";

export async function GET() {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const headers = [
    "Nome", "Telefone", "Email", "CPF/CNPJ", "CEP", "Cidade", "Estado",
    "Consultor", "Status",
    "Valor da Venda (R$)", "Data da Venda", "Data de Captura",
    "UTM Source", "UTM Medium", "UTM Campaign", "UTM Content", "UTM Term",
  ];

  const example: Record<string, string | number> = {
    "Nome":                 "João Silva",
    "Telefone":             "11999999999",
    "Email":                "joao@email.com",
    "CPF/CNPJ":             "123.456.789-00",
    "CEP":                  "01310-100",
    "Cidade":               "São Paulo",
    "Estado":               "SP",
    "Consultor":            "Maria",
    "Status":               "NOVA",
    "Valor da Venda (R$)":  "",
    "Data da Venda":        "",
    "Data de Captura":      new Date().toLocaleDateString("pt-BR"),
    "UTM Source":           "",
    "UTM Medium":           "",
    "UTM Campaign":         "",
    "UTM Content":          "",
    "UTM Term":             "",
  };

  const ws = XLSX.utils.json_to_sheet([example], { header: headers });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Leads");

  ws["!cols"] = [
    { wch: 25 }, { wch: 16 }, { wch: 25 }, { wch: 16 },
    { wch: 12 }, { wch: 16 }, { wch: 8  },
    { wch: 14 }, { wch: 12 }, { wch: 16 }, { wch: 14 },
    { wch: 16 }, { wch: 14 }, { wch: 14 }, { wch: 20 },
    { wch: 16 }, { wch: 14 },
  ];

  const buffer = Buffer.from(XLSX.write(wb, { type: "buffer", bookType: "xlsx" }));

  return new NextResponse(buffer as unknown as BodyInit, {
    headers: {
      "Content-Type":        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="modelo-importacao.xlsx"`,
    },
  });
}
