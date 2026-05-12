import type { Customer, Lead, Sale } from "@prisma/client";
import {
  hashPhone, hashEmail, hashName, hashZipCode,
  hashCity, hashState, hashId,
} from "./hash";

type UserData = Record<string, string | number>;

function buildUserData(customer: Customer, lead: Lead): UserData {
  const { fn, ln } = hashName(customer.name);
  const data: UserData = {
    ph: hashPhone(customer.phone),
    fn,
    ln,
    external_id: hashId(customer.id),
  };

  if (customer.email)     data.em  = hashEmail(customer.email);
  if (customer.zipCode)   data.zp  = hashZipCode(customer.zipCode);
  if (customer.city)      data.ct  = hashCity(customer.city);
  if (customer.state)     data.st  = hashState(customer.state);
  if (lead.fbc)           data.fbc = lead.fbc;
  if (lead.fbp)           data.fbp = lead.fbp;

  return data;
}

export function buildLeadPayload(
  customer: Customer,
  lead: Lead,
  eventId: string
) {
  return {
    event_name: "Lead",
    event_time: Math.floor(lead.capturedAt.getTime() / 1000),
    event_id: eventId,
    event_source_url: lead.eventSourceUrl ?? "",
    user_data: {
      ...buildUserData(customer, lead),
      external_id: hashId(lead.id), // Lead usa leadId
    },
    custom_data: {
      lead_source: lead.source,
      ...(lead.utmSource   && { utm_source:   lead.utmSource }),
      ...(lead.utmMedium   && { utm_medium:   lead.utmMedium }),
      ...(lead.utmCampaign && { utm_campaign: lead.utmCampaign }),
      ...(lead.utmContent  && { utm_content:  lead.utmContent }),
      ...(lead.utmTerm     && { utm_term:     lead.utmTerm }),
    },
  };
}

export function buildPurchasePayload(
  customer: Customer,
  lead: Lead,
  sale: Sale,
  eventId: string
) {
  return {
    event_name: "Purchase",
    event_time: Math.floor(sale.soldAt.getTime() / 1000),
    event_id: eventId,
    event_source_url: lead.eventSourceUrl ?? "",
    user_data: buildUserData(customer, lead), // Purchase usa customerId (já no buildUserData)
    custom_data: {
      value: Number(sale.value),
      currency: "BRL",
      order_id: sale.id,
      is_repeat_purchase: sale.isRepeatPurchase,
      ...(lead.utmSource   && { utm_source:   lead.utmSource }),
      ...(lead.utmMedium   && { utm_medium:   lead.utmMedium }),
      ...(lead.utmCampaign && { utm_campaign: lead.utmCampaign }),
      ...(lead.utmContent  && { utm_content:  lead.utmContent }),
      ...(lead.utmTerm     && { utm_term:     lead.utmTerm }),
    },
  };
}
