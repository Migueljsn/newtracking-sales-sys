export const dynamic = "force-dynamic";

import { NextResponse }      from "next/server";
import { prisma }            from "@/lib/db/prisma";
import { inngest }           from "@/lib/inngest/client";
import { whatsappReplyEvent, flowEnrollEvent } from "@/lib/inngest/events";

// EVO API payload (messages.upsert)
interface EvoPayload {
  event:    string;
  instance: string;
  data: {
    key: {
      remoteJid: string;
      fromMe:    boolean;
      id:        string;
    };
    message?: {
      conversation?:        string;
      extendedTextMessage?: { text: string };
      // resposta a botões interativos
      buttonsResponseMessage?: {
        selectedButtonId:   string;
        selectedDisplayText: string;
      };
      // resposta a lista interativa (fallback)
      listResponseMessage?: {
        singleSelectReply?: { selectedRowId: string };
        title?:             string;
      };
    };
    messageType:      string;
    messageTimestamp: number;
    pushName?:        string;
  };
}

function extractPhone(remoteJid: string): string {
  const raw = remoteJid.replace(/@.+$/, "").replace(/\D/g, "");
  return raw.startsWith("55") ? raw.slice(2) : raw;
}

function extractText(data: EvoPayload["data"]): string | null {
  return (
    data.message?.conversation ??
    data.message?.extendedTextMessage?.text ??
    data.message?.buttonsResponseMessage?.selectedDisplayText ??
    data.message?.listResponseMessage?.title ??
    null
  );
}

export async function POST(req: Request) {
  let body: EvoPayload;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  // Só processa mensagens recebidas de texto
  if (body.event !== "messages.upsert" || body.data?.key?.fromMe) {
    return NextResponse.json({ ok: true, skipped: true });
  }

  const text = extractText(body.data);
  if (!text?.trim()) return NextResponse.json({ ok: true, skipped: true });

  const phone = extractPhone(body.data.key.remoteJid);
  if (!phone) return NextResponse.json({ ok: true, skipped: true });

  // Acha o cliente pelo instanceName
  const instance = await prisma.whatsAppInstance.findUnique({
    where:  { instanceName: body.instance },
    select: { clientId: true },
  });
  if (!instance) return NextResponse.json({ ok: true, skipped: true });

  const { clientId } = instance;

  // Acha o customer pelo telefone (com fallback para número sem o 9 mobile)
  let customer = await prisma.customer.findFirst({
    where:  { clientId, phone },
    select: { id: true },
  });
  if (!customer && phone.length === 10) {
    const withNine = phone.slice(0, 2) + "9" + phone.slice(2);
    customer = await prisma.customer.findFirst({
      where:  { clientId, phone: withNine },
      select: { id: true },
    });
  }
  if (!customer) return NextResponse.json({ ok: true, skipped: true });

  // Acha o lead ativo mais recente desse customer
  const lead = await prisma.lead.findFirst({
    where:   { clientId, customerId: customer.id, status: { in: ["NEW", "REGISTERED"] } },
    orderBy: { createdAt: "desc" },
    select:  { id: true },
  });
  if (!lead) return NextResponse.json({ ok: true, skipped: true });

  // Salva a mensagem como interação
  await prisma.leadInteraction.create({
    data: {
      leadId:   lead.id,
      clientId,
      type:     "WHATSAPP_INBOUND",
      content:  text.trim(),
    },
  });

  const message = text.trim();

  // Dispara evento Inngest para o waitForEvent das jornadas e fluxos
  await inngest.send(
    whatsappReplyEvent.create({ leadId: lead.id, clientId, message, phone })
  );

  // Verifica gatilhos de palavra-chave em fluxos ativos
  const keywordTriggers = await prisma.flowTrigger.findMany({
    where: { clientId, type: "KEYWORD", flow: { status: "ACTIVE" } },
    select: { flowId: true, keyword: true, keywordMatchType: true },
  });

  const lower = message.toLowerCase();
  const matchedFlowIds = new Set<string>();

  for (const t of keywordTriggers) {
    if (!t.keyword || matchedFlowIds.has(t.flowId)) continue;
    const kw = t.keyword.toLowerCase();
    const matches =
      t.keywordMatchType === "EXACT"       ? lower === kw :
      t.keywordMatchType === "STARTS_WITH" ? lower.startsWith(kw) :
      lower.includes(kw); // CONTAINS (default)
    if (matches) matchedFlowIds.add(t.flowId);
  }

  if (matchedFlowIds.size > 0) {
    await inngest.send(
      [...matchedFlowIds].map((flowId) =>
        flowEnrollEvent.create({ flowId, leadId: lead.id, clientId })
      )
    );
  }

  return NextResponse.json({ ok: true });
}
