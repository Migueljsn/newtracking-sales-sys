import { prisma } from "@/lib/db/prisma";
import { LeadSource, TrackingEventStatus } from "@prisma/client";
import { createId } from "@paralleldrive/cuid2";
import { findOrCreateCustomer } from "@/lib/domain/customer/find-or-create";
import { buildLeadPayload } from "@/lib/domain/tracking/build-payload";
import { toGoogleAdsDateTime } from "@/lib/domain/tracking/google-ads";

interface CreateLeadInput {
  clientId: string;
  name: string;
  phone: string;
  email?: string;
  document?: string;
  zipCode?: string;
  city?: string;
  state?: string;
  notes?: string;
  source?: LeadSource;
  consultant?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmContent?: string;
  utmTerm?: string;
  fbc?: string;
  fbp?: string;
  gclid?: string;
  eventSourceUrl?: string;
  eventId?: string;
  capturedAt?: Date;
  metaCampaignId?: string;
  metaAdsetId?: string;
  metaAdId?: string;
}

export async function createLead(input: CreateLeadInput) {
  const customer = await findOrCreateCustomer({
    clientId: input.clientId,
    name: input.name,
    phone: input.phone,
    email: input.email,
    document: input.document,
    zipCode: input.zipCode,
    city: input.city,
    state: input.state,
  });

  // Verifica duplicata ativa (NEW ou REGISTERED)
  const duplicate = await prisma.lead.findFirst({
    where: {
      clientId:   input.clientId,
      customerId: customer.id,
      status:     { in: ["NEW", "REGISTERED"] },
    },
  });

  if (duplicate) {
    // Cria evento SKIPPED para manter rastreabilidade
    await prisma.trackingEvent.create({
      data: {
        clientId: input.clientId,
        eventName: "Lead",
        eventId: input.eventId ?? createId(),
        status: TrackingEventStatus.SKIPPED,
        payload: {},
        leadId: duplicate.id,
      },
    });

    return { lead: duplicate, duplicate: true };
  }

  const capturedAt = input.capturedAt ?? new Date();
  const eventId = input.eventId ?? createId();

  const lead = await prisma.lead.create({
    data: {
      clientId:      input.clientId,
      customerId:    customer.id,
      source:        input.source ?? LeadSource.FORM,
      notes:         input.notes || null,
      consultant:    input.consultant || null,
      utmSource:     input.utmSource,
      utmMedium:     input.utmMedium,
      utmCampaign:   input.utmCampaign,
      utmContent:    input.utmContent,
      utmTerm:       input.utmTerm,
      fbc:            input.fbc,
      fbp:            input.fbp,
      gclid:          input.gclid,
      eventSourceUrl: input.eventSourceUrl,
      metaCampaignId: input.metaCampaignId,
      metaAdsetId:    input.metaAdsetId,
      metaAdId:       input.metaAdId,
      capturedAt,
      statusHistory: { create: { to: "NEW", changedBy: "Sistema" } },
    },
  });

  const leadCustomer = await prisma.customer.findUniqueOrThrow({
    where: { id: lead.customerId },
  });

  const { buildLeadPayload } = await import("@/lib/domain/tracking/build-payload");

  await prisma.trackingEvent.create({
    data: {
      clientId:  input.clientId,
      eventName: "Lead",
      eventId,
      status:    TrackingEventStatus.PENDING,
      payload:   buildLeadPayload(leadCustomer, lead, eventId) as object,
      leadId:    lead.id,
    },
  });

  if (input.gclid) {
    await prisma.trackingEvent.create({
      data: {
        clientId:  input.clientId,
        eventName: "GoogleLead",
        eventId:   createId(),
        status:    TrackingEventStatus.PENDING,
        payload:   {},
        leadId:    lead.id,
      },
    });
  }

  return { lead, duplicate: false };
}
