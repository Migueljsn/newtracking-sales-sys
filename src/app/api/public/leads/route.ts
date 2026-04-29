import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { createLead } from "@/lib/domain/lead/create";

export async function POST(req: NextRequest) {
  try {
    const leadCaptureKey = req.headers.get("x-lead-capture-key");
    if (!leadCaptureKey) {
      return NextResponse.json({ error: "Missing lead capture key" }, { status: 401 });
    }

    const clientSettings = await prisma.clientSettings.findFirst({
      where: { client: { leadCaptureKey } },
      include: { client: true },
    });

    if (!clientSettings) {
      return NextResponse.json({ error: "Invalid lead capture key" }, { status: 401 });
    }

    const body = await req.json();
    const { name, phone } = body;

    if (!name || !phone) {
      return NextResponse.json({ error: "name and phone are required" }, { status: 400 });
    }

    const result = await createLead({
      clientId: clientSettings.clientId,
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

    return NextResponse.json({ ok: true, duplicate: result.duplicate });
  } catch (err) {
    console.error("[public/leads]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
