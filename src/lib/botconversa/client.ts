const BASE = "https://backend.botconversa.com.br/api/v1/webhook";

export interface BotconversaFlow {
  id:   number;
  name: string;
}

function headers(apiKey: string) {
  return { "API-KEY": apiKey, "Content-Type": "application/json" };
}

export async function listFlows(apiKey: string): Promise<BotconversaFlow[]> {
  const res = await fetch(`${BASE}/flows/`, { headers: headers(apiKey) });
  if (!res.ok) throw new Error(`Botconversa API error: ${res.status}`);
  return res.json();
}

export async function findSubscriberByPhone(apiKey: string, phone: string): Promise<number | null> {
  const res  = await fetch(`${BASE}/subscriber/get_by_phone/${encodeURIComponent(phone)}/`, { headers: headers(apiKey) });
  if (res.status === 404) return null;
  if (!res.ok) return null;
  const data = await res.json();
  return data?.id ?? null;
}

export async function createSubscriber(apiKey: string, phone: string, name: string): Promise<number> {
  const res  = await fetch(`${BASE}/subscriber/`, {
    method:  "POST",
    headers: headers(apiKey),
    body:    JSON.stringify({ phone, name }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Botconversa criar subscriber: ${err}`);
  }
  const data = await res.json();
  return data.id;
}

export async function sendFlow(apiKey: string, subscriberId: number, flowId: number): Promise<void> {
  const res = await fetch(`${BASE}/subscriber/${subscriberId}/send_flow/`, {
    method:  "POST",
    headers: headers(apiKey),
    body:    JSON.stringify({ flow_id: flowId }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Botconversa send_flow: ${err}`);
  }
}

// Garante que o subscriber existe e dispara o fluxo. Faz matching por telefone.
export async function triggerFlowForLead(opts: {
  apiKey:      string;
  flowId:      number;
  phone:       string;
  name:        string;
}): Promise<void> {
  const { apiKey, flowId, phone, name } = opts;

  let subscriberId = await findSubscriberByPhone(apiKey, phone);
  if (!subscriberId) {
    subscriberId = await createSubscriber(apiKey, phone, name);
  }

  await sendFlow(apiKey, subscriberId, flowId);
}
