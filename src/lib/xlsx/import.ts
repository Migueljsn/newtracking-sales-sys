import * as XLSX from "xlsx";
import { createLead } from "@/lib/domain/lead/create";
import { createSale } from "@/lib/domain/sale/create";
import { prisma } from "@/lib/db/prisma";

interface ImportResult {
  total:    number;
  created:  number;
  sold:     number;
  lost:     number;
  skipped:  number;
  errors:   { row: number; message: string }[];
}

function parseDate(value: unknown): Date | undefined {
  if (!value) return undefined;
  if (value instanceof Date) return value;
  if (typeof value === "string") {
    const [d, m, y] = value.split("/");
    if (d && m && y) return new Date(`${y}-${m}-${d}`);
  }
  return undefined;
}

function parseValue(value: unknown): number | undefined {
  if (!value) return undefined;
  const n = parseFloat(String(value).replace(/[^\d,.-]/g, "").replace(",", "."));
  return isNaN(n) ? undefined : n;
}

export async function processXlsxImport(
  buffer: ArrayBuffer,
  clientId: string
): Promise<ImportResult> {
  const workbook  = XLSX.read(buffer, { type: "array", cellDates: true });
  const sheet     = workbook.Sheets[workbook.SheetNames[0]];
  const rows      = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });

  const result: ImportResult = { total: rows.length, created: 0, sold: 0, lost: 0, skipped: 0, errors: [] };

  for (let i = 0; i < rows.length; i++) {
    const row    = rows[i];
    const rowNum = i + 2; // +2 porque começa na linha 2 (linha 1 é header)

    try {
      const name  = String(row["Nome"]     || "").trim();
      const phone = String(row["Telefone"] || "").trim();

      if (!name || !phone) {
        result.errors.push({ row: rowNum, message: "Nome e telefone são obrigatórios" });
        continue;
      }

      const status    = String(row["Status"] || "NOVA").toUpperCase().trim();
      const capturedAt = parseDate(row["Data de Captura"]);
      const soldAt     = parseDate(row["Data da Venda"]);
      const value      = parseValue(row["Valor da Venda (R$)"]);

      if (status === "VENDA" && (!value || value <= 0)) {
        result.errors.push({ row: rowNum, message: "Valor da venda é obrigatório para status VENDA" });
        continue;
      }

      const { lead, duplicate } = await createLead({
        clientId,
        name,
        phone,
        email:      String(row["Email"]      || "") || undefined,
        document:   String(row["CPF/CNPJ"]   || "") || undefined,
        zipCode:    String(row["CEP"]         || "") || undefined,
        city:       String(row["Cidade"]      || "") || undefined,
        state:      String(row["Estado"]      || "") || undefined,
        birthDate:  parseDate(row["Data de Nascimento"]),
        utmSource:  String(row["UTM Source"]   || "") || undefined,
        utmMedium:  String(row["UTM Medium"]   || "") || undefined,
        utmCampaign:String(row["UTM Campaign"] || "") || undefined,
        utmContent: String(row["UTM Content"]  || "") || undefined,
        utmTerm:    String(row["UTM Term"]     || "") || undefined,
        source:     "IMPORT",
        capturedAt,
      });

      if (duplicate) {
        result.skipped++;
        continue;
      }

      result.created++;

      if (status === "VENDA" && value) {
        await createSale({ clientId, leadId: lead.id, value, soldAt });
        result.sold++;
      } else if (status === "PERDIDA") {
        await prisma.lead.update({
          where: { id: lead.id },
          data: {
            status: "LOST",
            statusHistory: { create: { from: "NEW", to: "LOST" } },
          },
        });
        result.lost++;
      }
    } catch (err: unknown) {
      result.errors.push({
        row: rowNum,
        message: err instanceof Error ? err.message : "Erro desconhecido",
      });
    }
  }

  // Cria notificação de conclusão
  await prisma.notification.create({
    data: {
      clientId,
      type: "IMPORT_COMPLETE",
      title: "Importação concluída",
      body: `${result.created} leads criadas, ${result.sold} vendas, ${result.skipped} duplicatas, ${result.errors.length} erros.`,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      metadata: result as any,
    },
  });

  return result;
}
