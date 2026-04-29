import { NextRequest, NextResponse } from "next/server";
import { after } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { createLead } from "@/lib/domain/lead/create";
import { processPendingEvents } from "@/lib/domain/tracking/send-event";

export async function POST(req: NextRequest) {
  try {
    const leadCaptureKey = req.headers.get("x-lead-capture-key");
    if (!leadCaptureKey) {
      return NextResponse.json({ error: "Missing lead capture key" }, { status: 401 });
    }

    const client = await prisma.client.findUnique({
      where: { leadCaptureKey },
      include: { authorizedDomains: true },
    });

    if (!client) {
      return NextResponse.json({ error: "Invalid lead capture key" }, { status: 401 });
    }

    // Valida origem se houver domínios configurados
    if (client.authorizedDomains.length > 0) {
      const origin = req.headers.get("origin") ?? "";
      const allowed = client.authorizedDomains.some((d) => {
        try { return new URL(d.url).origin === new URL(origin).origin; } catch { return false; }
      });
      if (!allowed) {
        return NextResponse.json({ error: "Origin not authorized" }, { status: 403 });
      }
    }

    const clientId = client.id;

    const body = await req.json();
    const { name, phone } = body;

    if (!name || !phone) {
      return NextResponse.json({ error: "name and phone are required" }, { status: 400 });
    }

    const result = await createLead({
      clientId,
      name,
      phone,
      email:          body.email,
      document:       body.document,
      zipCode:        body.zip_code,
      city:           body.city,
      state:          body.state,
      birthDate:      body.birth_date ? new Date(body.birth_date) : undefined,
      utmSource:      body.utm_source,
      utmMedium:      body.utm_medium,
      utmCampaign:    body.utm_campaign,
      utmContent:     body.utm_content,
      utmTerm:        body.utm_term,
      fbc:            body.fbc,
      fbp:            body.fbp,
      eventId:        body.event_id,
      eventSourceUrl: body.event_source_url,
    });

    after(() => processPendingEvents());

    return NextResponse.json({ ok: true, duplicate: result.duplicate });
  } catch (err) {
    console.error("[public/leads]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
