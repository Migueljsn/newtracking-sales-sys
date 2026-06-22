import { prisma } from "@/lib/db/prisma";

async function fetchWithTimeout(url: string, options: RequestInit, timeoutMs = 10_000): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
}

function fmtNumber(phone: string) {
  const d = phone.replace(/\D/g, "");
  return d.startsWith("55") ? d : `55${d}`;
}

async function resolveWaInstances(clientId: string) {
  const baseUrl = process.env.EVO_API_URL;
  const apiKey  = process.env.EVO_API_KEY;
  if (!baseUrl || !apiKey) throw new Error("[WhatsApp] EVO_API_URL ou EVO_API_KEY ausentes");

  const dbInstances = await prisma.whatsAppInstance.findMany({
    where:   { clientId },
    orderBy: { priority: "asc" },
    select:  { instanceName: true },
  });
  if (!dbInstances.length) throw new Error(`[WhatsApp] Nenhuma instância configurada para cliente ${clientId}`);

  const instances: { instanceName: string }[] = [];
  for (const inst of dbInstances) {
    try {
      const res = await fetchWithTimeout(
        `${baseUrl}/instance/fetchInstances?instanceName=${inst.instanceName}`,
        { headers: { apikey: apiKey } },
        5_000
      );
      if (res.ok) {
        const data = await res.json();
        const info = Array.isArray(data) ? data[0] : data;
        const state = info?.connectionStatus ?? "close";
        if (state === "open") instances.push(inst);
      }
    } catch {
      console.warn(`[WhatsApp:resolveWaInstances] Falha ao checar ${inst.instanceName} — ignorando`);
    }
  }

  if (!instances.length) throw new Error(`[WhatsApp] Nenhuma instância com connectionStatus=open para cliente ${clientId}`);
  return { baseUrl, apiKey, instances };
}

/** Estima quanto tempo uma pessoa levaria pra digitar o texto — usado pra
 *  simular "digitando..." antes de mensagens geradas por IA, em vez de
 *  responder instantaneamente (o que é o sinal mais óbvio de bot). */
export function estimateTypingMs(text: string): number {
  return Math.min(6_000, Math.max(1_200, text.length * 45));
}

export async function sendWhatsAppTyping(phone: string, durationMs: number, clientId: string) {
  const { baseUrl, apiKey, instances } = await resolveWaInstances(clientId);
  const number = fmtNumber(phone);
  for (const inst of instances) {
    try {
      const res = await fetchWithTimeout(`${baseUrl}/chat/sendPresence/${inst.instanceName}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: apiKey },
        body: JSON.stringify({ number, presence: "composing", delay: durationMs }),
      });
      if (res.ok) return;
    } catch {
      // typing é best-effort — não interrompe o fluxo se falhar
    }
  }
}

export async function sendWhatsAppText(phone: string, text: string, clientId: string) {
  const { baseUrl, apiKey, instances } = await resolveWaInstances(clientId);
  const number = fmtNumber(phone);

  for (const inst of instances) {
    try {
      const res = await fetchWithTimeout(`${baseUrl}/message/sendText/${inst.instanceName}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: apiKey },
        body: JSON.stringify({ number, text }),
      });
      if (res.ok) return;
      const body = await res.text().catch(() => "");
      console.error(`[WhatsApp:sendText] FAIL ${inst.instanceName}: ${res.status} ${body}`);
    } catch (err) {
      console.error(`[WhatsApp:sendText] ERROR ${inst.instanceName}:`, err);
    }
  }
  throw new Error(`[WhatsApp] Falha ao enviar texto para ${number} — todas instâncias falharam`);
}
