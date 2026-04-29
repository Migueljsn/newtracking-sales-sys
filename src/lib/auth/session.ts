import { redirect } from "next/navigation";
import { createSupabaseServer } from "./supabase-server";
import { prisma } from "@/lib/db/prisma";

export async function getSession() {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const dbUser = await prisma.user.findUnique({
    where: { authUserId: user.id },
    include: {
      client: {
        include: { settings: true },
      },
    },
  });

  if (!dbUser || !dbUser.isActive) redirect("/login");

  return dbUser;
}
