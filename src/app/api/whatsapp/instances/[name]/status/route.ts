import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";

const EVO_URL = process.env.EVO_API_URL!;
const EVO_KEY = process.env.EVO_API_KEY!;

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  const session  = await getSession();
  const clientId = session.clientId!;
  const { name } = await params;

  const res = await fetch(`${EVO_URL}/instance/fetchInstances?instanceName=${name}`, {
    headers: { apikey: EVO_KEY },
    cache:   "no-store",
  });

  if (!res.ok) return NextResponse.json({ state: "unknown" });

  const data = await res.json();
  const inst = Array.isArray(data) ? data[0] : data;

  const state: string = inst?.connectionStatus ?? "close";
  const connected     = state === "open";
  const phone         = inst?.ownerJid?.replace("@s.whatsapp.net", "") ?? null;
  const profileName   = inst?.profileName ?? null;
  const profilePicUrl = inst?.profilePicUrl ?? null;

  // Sincronizar status no banco se mudou
  if (connected) {
    await prisma.whatsAppInstance.updateMany({
      where: { instanceName: name, clientId },
      data:  { status: "connected", phone, profileName, profilePicUrl },
    });
  } else {
    await prisma.whatsAppInstance.updateMany({
      where: { instanceName: name, clientId },
      data:  { status: "disconnected" },
    });
  }

  return NextResponse.json({ state, connected, phone, profileName, profilePicUrl });
}
