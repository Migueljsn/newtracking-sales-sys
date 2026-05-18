/**
 * Script de importação em massa de leads e vendas históricas.
 *
 * Uso:
 *   npm run import-leads               → dry-run (nada gravado)
 *   npm run import-leads -- --import   → importação real
 *   npm run import-leads -- --import --client-id=<id>
 */

import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(process.cwd(), ".env.local") });

import { PrismaClient } from "@prisma/client";
import { createId } from "@paralleldrive/cuid2";
import * as XLSX from "xlsx";
import * as path from "path";

const prisma = new PrismaClient();

// ── Args ──────────────────────────────────────────────────────────────────────
const isDryRun  = !process.argv.includes("--import");
const clientIdArg = process.argv.find(a => a.startsWith("--client-id="))?.split("=")[1];

// ── Types ─────────────────────────────────────────────────────────────────────
interface ImportRow {
  cnpj:        string;
  nomeRazao:   string;
  nomeContato: string;
  email:       string;
  telefone:    string;
  estado:      string;
  dataVenda:   string;   // YYYY-MM-DD
  valorVenda:  number;
  utmSource:   string;
  utmMedium:   string;
  utmCampaign: string;
  utmContent:  string;
  utmTerm:     string;
}

type ResultStatus = "CRIADO" | "VENDA_ADICIONADA" | "DUPLICATA_PULADA" | "ERRO";

interface ImportResult {
  status:  ResultStatus;
  cnpj:    string;
  nome:    string;
  valor:   number;
  data:    string;
  detalhe?: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmt(n: number) {
  return "R$ " + n.toFixed(2).replace(".", ",");
}

// ── Core: processar uma linha ─────────────────────────────────────────────────
async function processRow(
  row: ImportRow,
  clientId: string,
  dryRun: boolean,
): Promise<ImportResult> {
  const base = { cnpj: row.cnpj, nome: row.nomeRazao, valor: row.valorVenda, data: row.dataVenda };

  if (!row.cnpj || !row.valorVenda) {
    return { ...base, status: "ERRO", detalhe: "CNPJ ou valor ausente" };
  }

  const soldAt    = row.dataVenda ? new Date(row.dataVenda + "T12:00:00.000Z") : new Date();
  const nomePessoa = row.nomeContato?.trim() || row.nomeRazao;

  // 1. Busca customer pelo CNPJ
  const existingCustomer = await prisma.customer.findFirst({
    where:   { clientId, document: row.cnpj },
    include: {
      leads: {
        where:   { clientId },
        orderBy: { capturedAt: "desc" },
        take:    1,
        include: { sales: { select: { value: true } } },
      },
    },
  });

  // 2. Verifica duplicata de venda (mesmo valor, qualquer data)
  if (existingCustomer) {
    const allSalesForCustomer = await prisma.sale.findMany({
      where:  { clientId, customerId: existingCustomer.id },
      select: { value: true },
    });
    const valoreExistentes = allSalesForCustomer.map(s => Number(s.value));
    if (valoreExistentes.some(v => Math.abs(v - row.valorVenda) < 0.01)) {
      return { ...base, status: "DUPLICATA_PULADA", detalhe: "venda com mesmo valor já existe" };
    }
  }

  if (dryRun) {
    if (!existingCustomer) {
      return { ...base, status: "CRIADO", detalhe: "lead + venda serão criados" };
    }
    const lead = existingCustomer.leads[0];
    if (lead) {
      return { ...base, status: "VENDA_ADICIONADA", detalhe: `lead existente (${lead.id.slice(-6)})` };
    }
    return { ...base, status: "CRIADO", detalhe: "customer existe, lead será criada" };
  }

  // ── Modo real ────────────────────────────────────────────────────────────────
  let customerId: string;
  let leadId: string;
  let isNew = false;

  if (existingCustomer) {
    customerId = existingCustomer.id;

    // Atualiza campos em branco no customer
    const upd: Record<string, string> = {};
    if (!existingCustomer.email && row.email)   upd.email = row.email;
    if (!existingCustomer.state && row.estado)  upd.state = row.estado;
    if (Object.keys(upd).length > 0) {
      await prisma.customer.update({ where: { id: customerId }, data: upd });
    }

    const lead = existingCustomer.leads[0];
    if (lead) {
      leadId = lead.id;
    } else {
      // Customer existe mas sem lead — cria lead
      const newLead = await prisma.lead.create({
        data: {
          clientId,
          customerId,
          source:     "MANUAL",
          utmSource:  row.utmSource  || null,
          utmMedium:  row.utmMedium  || null,
          utmCampaign: row.utmCampaign || null,
          utmContent: row.utmContent  || null,
          utmTerm:    row.utmTerm    || null,
          capturedAt: soldAt,
          statusHistory: { create: { to: "NEW" } },
        },
      });
      leadId = newLead.id;
      isNew  = true;
    }
  } else {
    // Cria customer + lead do zero
    const phone = row.telefone || "00000000000"; // fallback (não deve ocorrer)

    // Trata conflito de phone único (outro CNPJ com mesmo telefone)
    let customer = await prisma.customer.findFirst({
      where: { clientId, phone },
    });
    if (!customer) {
      try {
        customer = await prisma.customer.create({
          data: {
            clientId,
            name:     nomePessoa,
            phone,
            email:    row.email   || null,
            document: row.cnpj,
            state:    row.estado  || null,
          },
        });
      } catch (err: unknown) {
        if ((err as { code?: string }).code === "P2002") {
          // Race ou telefone duplicado — busca novamente
          customer = await prisma.customer.findFirst({ where: { clientId, phone } });
          if (!customer) throw err;
        } else {
          throw err;
        }
      }
    } else if (!customer.document) {
      // Mesmo telefone, sem CNPJ registrado — atualiza
      customer = await prisma.customer.update({
        where: { id: customer.id },
        data:  { document: row.cnpj, ...(row.email && !customer.email ? { email: row.email } : {}) },
      });
    }

    customerId = customer.id;

    const newLead = await prisma.lead.create({
      data: {
        clientId,
        customerId,
        source:     "MANUAL",
        utmSource:  row.utmSource   || null,
        utmMedium:  row.utmMedium   || null,
        utmCampaign: row.utmCampaign || null,
        utmContent: row.utmContent  || null,
        utmTerm:    row.utmTerm     || null,
        capturedAt: soldAt,
        statusHistory: { create: { to: "NEW" } },
      },
    });
    leadId = newLead.id;
    isNew  = true;
  }

  // 3. Cria venda
  const existingSalesCount = await prisma.sale.count({
    where: { clientId, customerId },
  });
  const isRepeatPurchase = existingSalesCount > 0;

  const sale = await prisma.sale.create({
    data: {
      clientId,
      customerId,
      leadId,
      value:           row.valorVenda,
      isRepeatPurchase,
      soldAt,
      notes:           "Importado via planilha VISAO",
    },
  });

  // Cria TrackingEvent como SKIPPED — histórico interno, não envia para Meta/Google
  await prisma.trackingEvent.create({
    data: {
      clientId,
      eventName: "Purchase",
      eventId:   createId(),
      status:    "SKIPPED",
      payload:   {},
      leadId,
      saleId:    sale.id,
    },
  });

  // 4. Atualiza status da lead para SOLD
  const currentLead = await prisma.lead.findUnique({
    where:  { id: leadId },
    select: { status: true },
  });
  if (currentLead && currentLead.status !== "SOLD") {
    await prisma.lead.update({
      where: { id: leadId },
      data:  {
        status: "SOLD",
        statusHistory: { create: { from: currentLead.status, to: "SOLD" } },
      },
    });
  }

  // 5. Atualiza lifecycle do customer
  await updateLifecycle(customerId);

  return {
    ...base,
    status:  isNew ? "CRIADO" : "VENDA_ADICIONADA",
    detalhe: isNew ? "lead + venda criados" : "venda adicionada à lead existente",
  };
}

// Versão simplificada de updateCustomerLifecycle (sem importar o módulo Next.js)
async function updateLifecycle(customerId: string) {
  const salesCount = await prisma.sale.count({ where: { customerId } });
  const lifecycle =
    salesCount === 0 ? "NEW_BUYER" :
    salesCount === 1 ? "NEW_BUYER" :
    salesCount  <= 3 ? "LOYAL"     :
                       "CHAMPION";
  await prisma.customer.update({ where: { id: customerId }, data: { lifecycle } });
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  // Resolve clientId
  let clientId = clientIdArg;
  if (!clientId) {
    const clients = await prisma.client.findMany({ select: { id: true, name: true } });
    if (clients.length === 1) {
      clientId = clients[0].id;
      console.log(`Cliente: ${clients[0].name} (${clientId})`);
    } else {
      console.error("\nMúltiplos clientes encontrados. Use --client-id=<id>");
      clients.forEach(c => console.log(`  ${c.id}  ${c.name}`));
      process.exit(1);
    }
  }

  // Lê planilha
  const xlsxPath = path.resolve(process.cwd(), "IMPORTACAO_MESCLADA.xlsx");
  const wb   = XLSX.readFile(xlsxPath);
  const rows = XLSX.utils.sheet_to_json<ImportRow>(wb.Sheets[wb.SheetNames[0]]);

  console.log(`\nPlanilha: IMPORTACAO_MESCLADA.xlsx — ${rows.length} linhas`);
  console.log(isDryRun
    ? "Modo: DRY-RUN — nada será gravado no banco\n"
    : "Modo: IMPORTAÇÃO REAL — gravando no banco\n"
  );

  const LINE = "─".repeat(110);
  console.log(LINE);
  console.log(
    "STATUS".padEnd(20) +
    "CNPJ".padEnd(17) +
    "NOME".padEnd(40) +
    "VALOR".padEnd(14) +
    "DATA".padEnd(13) +
    "DETALHE"
  );
  console.log(LINE);

  let criados = 0, adicionados = 0, pulados = 0, erros = 0;

  for (const row of rows) {
    try {
      const result = await processRow(row, clientId, isDryRun);

      if (result.status === "CRIADO")           criados++;
      else if (result.status === "VENDA_ADICIONADA") adicionados++;
      else if (result.status === "DUPLICATA_PULADA") pulados++;
      else                                           erros++;

      const icon = { CRIADO: "✓", VENDA_ADICIONADA: "+", DUPLICATA_PULADA: "~", ERRO: "✗" }[result.status];
      console.log(
        `[${result.status}]`.padEnd(20) +
        result.cnpj.padEnd(17) +
        result.nome.substring(0, 38).padEnd(40) +
        fmt(result.valor).padEnd(14) +
        (result.data || "?").padEnd(13) +
        (result.detalhe || "")
      );
    } catch (err) {
      erros++;
      console.log(
        "[ERRO]".padEnd(20) +
        row.cnpj.padEnd(17) +
        row.nomeRazao.substring(0, 38).padEnd(40) +
        fmt(row.valorVenda).padEnd(14) +
        (row.dataVenda || "?").padEnd(13) +
        String(err)
      );
    }
  }

  // Sumário
  const SEP = "═".repeat(110);
  console.log(`\n${SEP}`);
  console.log(`Total de linhas:                  ${rows.length}`);
  console.log(`[CRIADO]           leads + vendas novas:       ${criados}`);
  console.log(`[VENDA_ADICIONADA] vendas em leads existentes: ${adicionados}`);
  console.log(`[DUPLICATA_PULADA] vendas com valor duplicado: ${pulados}`);
  if (erros > 0)
    console.log(`[ERRO]             erros:                      ${erros}`);
  console.log(SEP);

  if (isDryRun) {
    console.log("\nDRY-RUN concluído — nada foi gravado.");
    console.log("Para importar de verdade:\n  npm run import-leads -- --import\n");
  } else {
    console.log("\nImportação concluída.\n");
  }

  await prisma.$disconnect();
}

main().catch(async err => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});
