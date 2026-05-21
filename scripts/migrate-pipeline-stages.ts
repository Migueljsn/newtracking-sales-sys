import { prisma } from "../src/lib/db/prisma";

async function main() {
  console.log("Creating 'Cadastrado' pipeline stage for Rio Piranhas...");

  await prisma.$executeRaw`
    INSERT INTO "PipelineStage" ("id", "clientId", "name", "color", "position", "isDefault", "createdAt", "updatedAt")
    VALUES ('pstg_cadastrado_rio', 'cmoagred30000mi0m6w9zi81k', 'Cadastrado', '#f59e0b', 1, true, NOW(), NOW())
    ON CONFLICT ("id") DO NOTHING
  `;

  const result = await prisma.$executeRaw`
    UPDATE "Lead"
    SET "status" = 'NEW', "pipelineStageId" = 'pstg_cadastrado_rio'
    WHERE "status" = 'REGISTERED' AND "clientId" = 'cmoagred30000mi0m6w9zi81k'
  `;

  console.log(`Migrated ${result} leads from REGISTERED → NEW + Cadastrado stage`);
  console.log("Done.");
}

main().catch(console.error).finally(() => prisma.$disconnect());
