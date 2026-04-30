/**
 * Script para criar o primeiro Client + Usuário no sistema.
 * Uso: npx tsx scripts/create-client.ts
 */

import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(process.cwd(), ".env.local") });

import { createClient } from "@supabase/supabase-js";
import { PrismaClient } from "@prisma/client";
import * as readline from "readline";

const prisma = new PrismaClient();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function prompt(rl: readline.Interface, question: string): Promise<string> {
  return new Promise((resolve) => rl.question(question, resolve));
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

async function main() {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  console.log("\n🚀 Portal CRM — Criação de Cliente\n");

  const companyName = await prompt(rl, "Nome da empresa: ");
  const email       = await prompt(rl, "Email do usuário: ");
  const password    = await prompt(rl, "Senha: ");
  const userName    = await prompt(rl, "Nome do usuário: ");

  rl.close();

  console.log("\nCriando...");

  // 1. Cria usuário no Supabase Auth
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (authError || !authData.user) {
    console.error("❌ Erro ao criar usuário no Supabase:", authError?.message);
    process.exit(1);
  }

  // 2. Cria Client + ClientSettings + User no banco
  const slug = slugify(companyName);

  const client = await prisma.client.create({
    data: {
      name: companyName,
      slug,
      settings: {
        create: { trackingEnabled: false },
      },
      user: {
        create: {
          authUserId: authData.user.id,
          email,
          name: userName,
        },
      },
    },
  });

  console.log("\n✅ Cliente criado com sucesso!");
  console.log(`   Empresa:          ${client.name}`);
  console.log(`   Slug:             ${client.slug}`);
  console.log(`   Lead Capture Key: ${client.leadCaptureKey}`);
  console.log(`   Email:            ${email}`);
  console.log("\n👉 Acesse http://localhost:3000 e faça login.\n");

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error("❌ Erro:", e.message);
  await prisma.$disconnect();
  process.exit(1);
});
