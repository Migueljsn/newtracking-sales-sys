import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createSupabaseServer } from "./supabase-server";
import { prisma } from "@/lib/db/prisma";

export const IMPERSONATION_COOKIE = "admin_impersonating_client_id";

export async function getSession() {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const dbUser = await prisma.user.findUnique({
    where: { authUserId: user.id },
    include: { client: { include: { settings: true } } },
  });

  if (!dbUser || !dbUser.isActive) redirect("/login");

  if (dbUser.role === "ADMIN") {
    const cookieStore = await cookies();
    const impersonatingId = cookieStore.get(IMPERSONATION_COOKIE)?.value;

    if (impersonatingId) {
      const impersonatedClient = await prisma.client.findUnique({
        where: { id: impersonatingId },
        include: { settings: true },
      });

      if (impersonatedClient) {
        return {
          ...dbUser,
          clientId: impersonatedClient.id,
          client: impersonatedClient,
          isAdmin: true as const,
          isImpersonating: true as const,
        };
      }
    }

    redirect("/admin");
  }

  return {
    ...dbUser,
    clientId: dbUser.clientId!,
    client: dbUser.client!,
    isAdmin: false as const,
    isImpersonating: false as const,
  };
}

export async function getAdminSession() {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const dbUser = await prisma.user.findUnique({ where: { authUserId: user.id } });
  if (!dbUser || !dbUser.isActive) redirect("/login");
  if (dbUser.role !== "ADMIN") redirect("/");

  return dbUser;
}
