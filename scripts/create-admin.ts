/**
 * Script para criar o usuário ADMIN do sistema.
 * Uso: npx tsx scripts/create-admin.ts
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

async function main() {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  console.log("\n🛡️  Portal CRM — Criação de Admin\n");

  const email    = await prompt(rl, "Email do admin: ");
  const password = await prompt(rl, "Senha: ");
  const name     = await prompt(rl, "Nome: ");

  rl.close();

  console.log("\nCriando...");

  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (authError || !authData.user) {
    console.error("❌ Erro ao criar usuário no Supabase:", authError?.message);
    process.exit(1);
  }

  await prisma.user.create({
    data: {
      authUserId: authData.user.id,
      email,
      name,
      role: "ADMIN",
    },
  });

  console.log("\n✅ Admin criado com sucesso!");
  console.log(`   Email: ${email}`);
  console.log(`   Nome:  ${name}`);
  console.log("\n👉 Acesse /admin após fazer login.\n");

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error("❌ Erro:", e.message);
  await prisma.$disconnect();
  process.exit(1);
});
