"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { invalidate, cacheKeys } from "@/lib/cache/invalidate";

export async function markAllNotificationsReadAction() {
  const session  = await getSession();
  const clientId = session.clientId!;

  await prisma.notification.updateMany({
    where: { clientId, isRead: false },
    data:  { isRead: true },
  });

  await invalidate(cacheKeys.unreadCount(clientId));
  revalidatePath("/notifications");
  revalidatePath("/");
}
