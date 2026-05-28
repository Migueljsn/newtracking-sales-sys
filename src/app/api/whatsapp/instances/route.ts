import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";

const EVO_URL = process.env.EVO_API_URL!;
const EVO_KEY = process.env.EVO_API_KEY!;

export async function POST(req: NextRequest) {
  const session  = await getSession();
  const clientId = session.clientId!;

  const { instanceName } = await req.json();
  if (!instanceName?.trim()) {
    return NextResponse.json({ error: "Nome obrigatório" }, { status: 400 });
  }

  const name = instanceName.trim();

  // Criar na EvoAPI
  const evoRes = await fetch(`${EVO_URL}/instance/create`, {
    method:  "POST",
    headers: { "Content-Type": "application/json", apikey: EVO_KEY },
    body:    JSON.stringify({ instanceName: name, integration: "BAILEYS" }),
  });

  if (!evoRes.ok) {
    const err = await evoRes.text();
    return NextResponse.json({ error: `EvoAPI: ${err}` }, { status: 502 });
  }

  // Salvar no banco
  const instance = await prisma.whatsAppInstance.create({
    data: { clientId, instanceName: name, priority: 0 },
  });

  return NextResponse.json({ id: instance.id, instanceName: name });
}

export async function DELETE(req: NextRequest) {
  const session  = await getSession();
  const clientId = session.clientId!;

  const { instanceName } = await req.json();

  // Deletar da EvoAPI
  await fetch(`${EVO_URL}/instance/delete/${instanceName}`, {
    method:  "DELETE",
    headers: { apikey: EVO_KEY },
  });

  // Remover do banco (só do cliente certo)
  await prisma.whatsAppInstance.deleteMany({
    where: { instanceName, clientId },
  });

  return NextResponse.json({ ok: true });
}
