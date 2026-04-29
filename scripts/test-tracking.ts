/**
 * Testa o worker de tracking manualmente.
 * Uso: npx tsx scripts/test-tracking.ts
 *
 * Pré-requisito: ter pelo menos uma lead com TrackingEvent PENDING no banco.
 */

import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(process.cwd(), ".env.local") });

import { processPendingEvents } from "@/lib/domain/tracking/send-event";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("\n🔍 Verificando eventos pendentes...\n");

  const pending = await prisma.trackingEvent.findMany({
    where: { status: "PENDING" },
    include: { client: { include: { settings: true } } },
  });

  if (pending.length === 0) {
    console.log("Nenhum evento PENDING encontrado.");
    console.log("Crie uma lead ou registre uma venda primeiro.\n");
    await prisma.$disconnect();
    return;
  }

  console.log(`${pending.length} evento(s) PENDING encontrado(s):`);
  pending.forEach((e) => {
    const hasConfig = !!e.client.settings?.metaAccessToken && !!e.client.settings?.metaPixelId;
    console.log(`  - ${e.eventName} | ${e.status} | Pixel configurado: ${hasConfig ? "✅" : "❌"}`);
  });

  console.log("\n🚀 Processando eventos...\n");
  await processPendingEvents();

  const after = await prisma.trackingEvent.findMany({
    where: { id: { in: pending.map((e) => e.id) } },
    select: { id: true, eventName: true, status: true, errorMessage: true, attempts: true },
  });

  console.log("Resultado:");
  after.forEach((e) => {
    const icon = e.status === "SUCCESS" ? "✅" : e.status === "FAILED" ? "❌" : "⏳";
    console.log(`  ${icon} ${e.eventName} → ${e.status} (tentativas: ${e.attempts})`);
    if (e.errorMessage) {
      console.log(`     Erro: ${e.errorMessage.slice(0, 200)}`);
    }
  });

  console.log("");
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
