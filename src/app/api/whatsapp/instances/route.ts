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

  // Criar na EvoAPI (ignora se já existe)
  const evoRes = await fetch(`${EVO_URL}/instance/create`, {
    method:  "POST",
    headers: { "Content-Type": "application/json", apikey: EVO_KEY },
    body:    JSON.stringify({ instanceName: name, integration: "WHATSAPP-BAILEYS" }),
  });

  if (!evoRes.ok) {
    // Verifica se a instância já existe na EvoAPI — se sim, apenas registra no banco
    const checkRes = await fetch(`${EVO_URL}/instance/fetchInstances?instanceName=${name}`, {
      headers: { apikey: EVO_KEY },
    });
    if (!checkRes.ok) {
      const err = await evoRes.text();
      return NextResponse.json({ error: `EvoAPI: ${err}` }, { status: 502 });
    }
  }

  // Configurar webhook de incoming automaticamente
  const webhookUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? "https://newtracking-sales-sys.vercel.app"}/api/webhooks/whatsapp/incoming`;
  await fetch(`${EVO_URL}/webhook/set/${name}`, {
    method:  "POST",
    headers: { "Content-Type": "application/json", apikey: EVO_KEY },
    body:    JSON.stringify({
      webhook: {
        enabled:         true,
        url:             webhookUrl,
        webhookByEvents: false,
        webhookBase64:   false,
        events:          ["MESSAGES_UPSERT"],
      },
    }),
  }).catch(() => {}); // silencia falha — pode configurar manualmente depois

  // Salvar no banco
  const instance = await prisma.whatsAppInstance.create({
    data: { clientId, instanceName: name, priority: 0 },
  });

  return NextResponse.json({ id: instance.id, instanceName: name });
}

export async function PATCH(req: NextRequest) {
  const session  = await getSession();
  const clientId = session.clientId!;

  const { instanceName } = await req.json();
  if (!instanceName) return NextResponse.json({ error: "Nome obrigatório" }, { status: 400 });

  // Define a selecionada como prioridade 0, demais como 1
  await prisma.$transaction([
    prisma.whatsAppInstance.updateMany({
      where: { clientId },
      data:  { priority: 1 },
    }),
    prisma.whatsAppInstance.updateMany({
      where: { clientId, instanceName },
      data:  { priority: 0 },
    }),
  ]);

  return NextResponse.json({ ok: true });
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
