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

function col(row: Record<string, unknown>, key: string): string {
  return String(row[key] ?? "").trim();
}

export async function processXlsxImport(
  buffer: ArrayBuffer,
  clientId: string
): Promise<ImportResult> {
  const workbook = XLSX.read(buffer, { type: "array", cellDates: true });
  const sheet    = workbook.Sheets[workbook.SheetNames[0]];
  const rows     = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });

  const result: ImportResult = { total: rows.length, created: 0, sold: 0, lost: 0, skipped: 0, errors: [] };

  for (let i = 0; i < rows.length; i++) {
    const row    = rows[i];
    const rowNum = i + 2;

    try {
      const name  = col(row, "Nome");
      const phone = col(row, "Telefone");

      if (!name)  { result.errors.push({ row: rowNum, message: "Campo obrigatório em branco: Nome" });     continue; }
      if (!phone) { result.errors.push({ row: rowNum, message: "Campo obrigatório em branco: Telefone" }); continue; }

      const rawStatus = col(row, "Status").toUpperCase() || "NOVA";
      const value     = parseValue(row["Valor da Venda (R$)"]);
      const soldAt    = parseDate(row["Data da Venda"]);

      if (rawStatus === "VENDA" && (!value || value <= 0)) {
        result.errors.push({ row: rowNum, message: "Status VENDA requer 'Valor da Venda (R$)' preenchido" });
        continue;
      }

      const { lead, duplicate } = await createLead({
        clientId,
        name,
        phone,
        email:       col(row, "Email")            || undefined,
        document:    col(row, "CPF/CNPJ")         || undefined,
        zipCode:     col(row, "CEP")              || undefined,
        city:        col(row, "Cidade")           || undefined,
        state:       col(row, "Estado")           || undefined,
        birthDate:   parseDate(row["Data de Nascimento"]),
        consultant:  col(row, "Consultor")        || undefined,
        utmSource:   col(row, "UTM Source")       || undefined,
        utmMedium:   col(row, "UTM Medium")       || undefined,
        utmCampaign: col(row, "UTM Campaign")     || undefined,
        utmContent:  col(row, "UTM Content")      || undefined,
        utmTerm:     col(row, "UTM Term")         || undefined,
        source:      "IMPORT",
        capturedAt:  parseDate(row["Data de Captura"]),
      });

      if (duplicate) { result.skipped++; continue; }

      result.created++;

      if (rawStatus === "CADASTRADA" || rawStatus === "VENDA") {
        await prisma.lead.update({
          where: { id: lead.id },
          data:  {
            status:        "REGISTERED",
            statusHistory: { create: { from: "NEW", to: "REGISTERED" } },
          },
        });
      }

      if (rawStatus === "VENDA" && value) {
        await createSale({ clientId, leadId: lead.id, value, soldAt });
        result.sold++;
      } else if (rawStatus === "PERDIDA") {
        await prisma.lead.update({
          where: { id: lead.id },
          data:  {
            status:        "LOST",
            statusHistory: { create: { from: "NEW", to: "LOST" } },
          },
        });
        result.lost++;
      }
    } catch (err: unknown) {
      result.errors.push({
        row:     rowNum,
        message: err instanceof Error ? err.message : "Erro desconhecido",
      });
    }
  }

  await prisma.notification.create({
    data: {
      clientId,
      type:  "IMPORT_COMPLETE",
      title: "Importação concluída",
      body:  `${result.created} leads criadas, ${result.sold} vendas, ${result.skipped} duplicatas, ${result.errors.length} erros.`,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      metadata: result as any,
    },
  });

  return result;
}
