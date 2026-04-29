"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";

export async function markAllNotificationsReadAction() {
  const session  = await getSession();
  const clientId = session.clientId!;

  await prisma.notification.updateMany({
    where: { clientId, isRead: false },
    data:  { isRead: true },
  });

  revalidatePath("/notifications");
  revalidatePath("/");
}
