/**
 * Normaliza telefones e documentos dos Customers existentes no banco.
 *
 * Dry-run por padrão — apenas mostra o que seria alterado.
 * Para aplicar: npx tsx scripts/normalize-phones.ts --apply
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if ((digits.length === 12 || digits.length === 13) && digits.startsWith("55")) {
    return digits.slice(2);
  }
  return digits;
}

function normalizeDocument(raw: string): string {
  return raw.replace(/\D/g, "");
}

async function run() {
  const apply = process.argv.includes("--apply");
  console.log(`\nModo: ${apply ? "✏️  APPLY" : "👁  DRY-RUN (use --apply para executar)"}\n`);

  const customers = await prisma.customer.findMany({
    select: {
      id: true, clientId: true, name: true, phone: true, document: true,
      _count: { select: { leads: true, sales: true } },
    },
    orderBy: [{ clientId: "asc" }, { id: "asc" }],
  });

  // Agrupa por clientId para detectar conflitos
  const byClient = new Map<string, typeof customers>();
  for (const c of customers) {
    const arr = byClient.get(c.clientId) ?? [];
    arr.push(c);
    byClient.set(c.clientId, arr);
  }

  let simpleUpdates  = 0;
  let conflictGroups = 0;
  let merged         = 0;
  let docUpdates     = 0;

  for (const [clientId, group] of byClient) {
    // Detecta duplicatas de telefone normalizado
    const phoneMap = new Map<string, typeof group>();
    for (const c of group) {
      const norm = normalizePhone(c.phone);
      const arr  = phoneMap.get(norm) ?? [];
      arr.push(c);
      phoneMap.set(norm, arr);
    }

    for (const [normPhone, dups] of phoneMap) {
      if (dups.length > 1) {
        // ── CONFLITO: duas ou mais customers mapeiam para o mesmo telefone ───────
        conflictGroups++;
        console.log(`⚠️  CONFLITO [cliente ${clientId}] → ${normPhone}`);
        for (const d of dups) {
          console.log(`   ID: ${d.id} | ${d.name} | atual: "${d.phone}" | leads: ${d._count.leads} | vendas: ${d._count.sales}`);
        }

        if (apply) {
          // Vencedor = mais leads; empate → mais vendas; empate → primeiro da lista
          const winner = dups.reduce((a, b) => {
            if (a._count.leads  !== b._count.leads)  return a._count.leads  > b._count.leads  ? a : b;
            if (a._count.sales  !== b._count.sales)  return a._count.sales  > b._count.sales  ? a : b;
            return a;
          });
          const losers = dups.filter(d => d.id !== winner.id);

          for (const loser of losers) {
            await prisma.$transaction(async (tx) => {
              await tx.lead.updateMany({        where: { customerId: loser.id }, data: { customerId: winner.id } });
              await tx.sale.updateMany({        where: { customerId: loser.id }, data: { customerId: winner.id } });
              await tx.ltvEmailLog.updateMany({ where: { customerId: loser.id }, data: { customerId: winner.id } });
              await tx.customer.delete({ where: { id: loser.id } });
            });
            console.log(`   ✅ Mesclado ${loser.id} (${loser.name}) → vencedor ${winner.id} (${winner.name})`);
            merged++;
          }

          // Atualiza phone do vencedor para formato normalizado
          if (winner.phone !== normPhone) {
            await prisma.customer.update({ where: { id: winner.id }, data: { phone: normPhone } });
            console.log(`   📱 ${winner.id} phone: "${winner.phone}" → "${normPhone}"`);
          }
        }

      } else {
        // ── SIMPLES: apenas atualiza o formato ───────────────────────────────────
        const c = dups[0];
        if (c.phone !== normPhone) {
          simpleUpdates++;
          console.log(`📱 ${c.id} | ${c.name}: "${c.phone}" → "${normPhone}"`);
          if (apply) {
            await prisma.customer.update({ where: { id: c.id }, data: { phone: normPhone } });
          }
        }
      }
    }

    // Normaliza documentos (CNPJ/CPF)
    for (const c of group) {
      if (!c.document) continue;
      const normDoc = normalizeDocument(c.document);
      if (c.document !== normDoc) {
        docUpdates++;
        console.log(`📄 ${c.id} | ${c.name}: document "${c.document}" → "${normDoc}"`);
        if (apply) {
          await prisma.customer.update({ where: { id: c.id }, data: { document: normDoc } });
        }
      }
    }
  }

  console.log("\n─────────────────────────────────────────────────────");
  console.log(`Total customers analisados : ${customers.length}`);
  console.log(`Telefones a normalizar     : ${simpleUpdates}`);
  console.log(`Documentos a normalizar    : ${docUpdates}`);
  console.log(`Grupos com conflito        : ${conflictGroups}`);
  if (apply) console.log(`Customers mesclados        : ${merged}`);
  if (!apply && (simpleUpdates + docUpdates + conflictGroups) === 0) {
    console.log("✅ Tudo já normalizado — nada a fazer.");
  }
  if (!apply && (simpleUpdates + docUpdates + conflictGroups) > 0) {
    console.log("\nRevise os itens acima e rode com --apply para executar.");
  }
}

run()
  .then(() => prisma.$disconnect())
  .catch((e) => { console.error(e); prisma.$disconnect(); process.exit(1); });
