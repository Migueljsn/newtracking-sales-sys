import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

export const dynamic = "force-dynamic";

// POST /api/admin/test-whatsapp
// Header: Authorization: Bearer <CRON_SECRET>
// Body: { clientId: string, phone: string, message?: string }
export async function POST(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { clientId, phone, message = "Teste de envio via fluxo" } = await req.json();

  const baseUrl = process.env.EVO_API_URL;
  const apiKey  = process.env.EVO_API_KEY;

  if (!baseUrl || !apiKey) {
    return NextResponse.json({ error: "EVO_API_URL ou EVO_API_KEY ausentes" }, { status: 500 });
  }

  const instances = await prisma.whatsAppInstance.findMany({
    where:   { clientId },
    orderBy: { priority: "asc" },
    select:  { instanceName: true, status: true, phone: true, priority: true },
  });

  if (!instances.length) {
    return NextResponse.json({ error: "Nenhuma instância encontrada para este clientId" }, { status: 404 });
  }

  const digits = phone.replace(/\D/g, "");
  const number = digits.startsWith("55") ? digits : `55${digits}`;

  const results: Record<string, unknown>[] = [];

  for (const inst of instances) {
    const url = `${baseUrl}/message/sendText/${inst.instanceName}`;
    try {
      const ctrl  = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 10_000);
      const res = await fetch(url, {
        method:  "POST",
        headers: { "Content-Type": "application/json", apikey: apiKey },
        body:    JSON.stringify({ number, text: message }),
        signal:  ctrl.signal,
      });
      clearTimeout(timer);

      const body = await res.text().catch(() => "");
      results.push({
        instance:   inst.instanceName,
        dbStatus:   inst.status,
        dbPhone:    inst.phone,
        priority:   inst.priority,
        httpStatus: res.status,
        ok:         res.ok,
        body:       body.slice(0, 500),
      });

      if (res.ok) break; // parou no primeiro que funcionou
    } catch (err) {
      results.push({
        instance: inst.instanceName,
        dbStatus: inst.status,
        dbPhone:  inst.phone,
        priority: inst.priority,
        error:    String(err),
      });
    }
  }

  return NextResponse.json({ number, results });
}
