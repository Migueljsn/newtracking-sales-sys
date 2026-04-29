"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";

export async function saveSettingsAction(formData: FormData) {
  const session  = await getSession();
  const clientId = session.clientId!;

  const metaPixelId       = (formData.get("metaPixelId")       as string).trim() || null;
  const metaAccessToken   = (formData.get("metaAccessToken")   as string).trim() || null;
  const metaTestEventCode = (formData.get("metaTestEventCode") as string).trim() || null;
  const trackingEnabled   = formData.get("trackingEnabled") === "on";

  await prisma.clientSettings.upsert({
    where:  { clientId },
    create: { clientId, metaPixelId, metaAccessToken, metaTestEventCode, trackingEnabled },
    update: { metaPixelId, metaAccessToken, metaTestEventCode, trackingEnabled },
  });

  revalidatePath("/settings");
}

export async function rotateLeadCaptureKeyAction() {
  const session  = await getSession();
  const clientId = session.clientId!;
  const { createId } = await import("@paralleldrive/cuid2");

  await prisma.client.update({
    where: { id: clientId },
    data:  { leadCaptureKey: createId() },
  });

  revalidatePath("/settings");
}
