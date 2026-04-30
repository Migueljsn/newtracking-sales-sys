"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";
import { prisma } from "@/lib/db/prisma";
import { getAdminSession } from "@/lib/auth/session";
import { IMPERSONATION_COOKIE } from "@/lib/auth/session";

function slugify(text: string) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function createClientAction(formData: FormData) {
  await getAdminSession();

  const name     = formData.get("name") as string;
  const email    = formData.get("email") as string;
  const password = formData.get("password") as string;
  const userName = formData.get("userName") as string;

  if (!name || !email || !password || !userName) {
    throw new Error("Todos os campos são obrigatórios.");
  }

  const supabaseAdmin = getSupabaseAdmin();

  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (authError || !authData.user) {
    throw new Error(authError?.message ?? "Erro ao criar usuário no Supabase.");
  }

  const slug = slugify(name);

  await prisma.client.create({
    data: {
      name,
      slug,
      settings: { create: { trackingEnabled: false } },
      user: {
        create: {
          authUserId: authData.user.id,
          email,
          name: userName,
          role: "CLIENT",
        },
      },
    },
  });

  revalidatePath("/admin");
}

export async function updateClientAction(clientId: string, formData: FormData) {
  await getAdminSession();

  const name     = formData.get("name") as string;
  const slug     = formData.get("slug") as string;
  const isActive = formData.get("isActive") === "true";
  const userName = formData.get("userName") as string;
  const email    = formData.get("email") as string;

  if (!name || !slug || !userName || !email) {
    throw new Error("Todos os campos são obrigatórios.");
  }

  const slugConflict = await prisma.client.findFirst({
    where: { slug, NOT: { id: clientId } },
  });
  if (slugConflict) throw new Error("Esse slug já está em uso por outro cliente.");

  const emailConflict = await prisma.user.findFirst({
    where: { email, NOT: { clientId } },
  });
  if (emailConflict) throw new Error("Esse email já está em uso.");

  const dbUser = await prisma.user.findUnique({ where: { clientId } });

  await prisma.$transaction([
    prisma.client.update({
      where: { id: clientId },
      data: { name, slug, isActive },
    }),
    prisma.user.update({
      where: { clientId },
      data: { name: userName, email },
    }),
  ]);

  if (dbUser?.authUserId && email !== dbUser.email) {
    const supabaseAdmin = getSupabaseAdmin();
    await supabaseAdmin.auth.admin.updateUserById(dbUser.authUserId, { email });
  }

  revalidatePath("/admin");
}

export async function deleteClientAction(clientId: string) {
  await getAdminSession();

  const user = await prisma.user.findUnique({ where: { clientId } });

  if (user?.authUserId) {
    const supabaseAdmin = getSupabaseAdmin();
    await supabaseAdmin.auth.admin.deleteUser(user.authUserId);
  }

  await prisma.client.delete({ where: { id: clientId } });

  revalidatePath("/admin");
}

export async function impersonateClientAction(clientId: string) {
  await getAdminSession();

  const client = await prisma.client.findUnique({ where: { id: clientId } });
  if (!client) throw new Error("Cliente não encontrado.");

  const cookieStore = await cookies();
  cookieStore.set(IMPERSONATION_COOKIE, clientId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 8,
  });

  redirect("/");
}

export async function stopImpersonatingAction() {
  const cookieStore = await cookies();
  cookieStore.delete(IMPERSONATION_COOKIE);
  redirect("/admin");
}
