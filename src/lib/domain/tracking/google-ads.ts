import { prisma } from "@/lib/db/prisma";
import { TrackingEventStatus } from "@prisma/client";

const MAX_ATTEMPTS = 3;
const GOOGLE_ADS_API_VERSION = "v18";

export function toGoogleAdsDateTime(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  const y  = date.getUTCFullYear();
  const mo = pad(date.getUTCMonth() + 1);
  const d  = pad(date.getUTCDate());
  const h  = pad(date.getUTCHours());
  const mi = pad(date.getUTCMinutes());
  const s  = pad(date.getUTCSeconds());
  return `${y}-${mo}-${d} ${h}:${mi}:${s}+00:00`;
}

function normalizeCustomerId(id: string): string {
  return id.replace(/-/g, "");
}

async function getAccessToken(refreshToken: string): Promise<string> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id:     process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      refresh_token: refreshToken,
      grant_type:    "refresh_token",
    }),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(`OAuth token error: ${JSON.stringify(data)}`);
  return data.access_token as string;
}

export async function processGooglePendingEvents() {
  const events = await prisma.trackingEvent.findMany({
    where: {
      status: "PENDING",
      eventName: { in: ["GoogleLead", "GooglePurchase"] },
    },
    include: { client: { include: { settings: true } } },
    orderBy: { createdAt: "asc" },
    take: 50,
  });

  for (const event of events) {
    const settings = event.client.settings;

    if (
      !settings?.googleAdsEnabled ||
      !settings.googleRefreshToken ||
      !settings.googleAdsCustomerId
    ) {
      await prisma.trackingEvent.update({
        where: { id: event.id },
        data: { status: TrackingEventStatus.SKIPPED },
      });
      continue;
    }

    const payload = event.payload as {
      gclid?: string;
      conversionDateTime: string;
      value?: number;
      currencyCode?: string;
    };

    if (!payload.gclid) {
      await prisma.trackingEvent.update({
        where: { id: event.id },
        data: { status: TrackingEventStatus.SKIPPED },
      });
      continue;
    }

    const conversionActionId =
      event.eventName === "GoogleLead"
        ? settings.googleAdsConversionActionLead
        : settings.googleAdsConversionActionPurchase;

    if (!conversionActionId) {
      await prisma.trackingEvent.update({
        where: { id: event.id },
        data: { status: TrackingEventStatus.SKIPPED },
      });
      continue;
    }

    try {
      const accessToken = await getAccessToken(settings.googleRefreshToken);
      const customerId  = normalizeCustomerId(settings.googleAdsCustomerId);

      const conversion: Record<string, unknown> = {
        gclid:              payload.gclid,
        conversionAction:   `customers/${customerId}/conversionActions/${conversionActionId}`,
        conversionDateTime: payload.conversionDateTime,
      };

      if (event.eventName === "GooglePurchase" && payload.value != null) {
        conversion.conversionValue = payload.value;
        conversion.currencyCode    = payload.currencyCode ?? "BRL";
      }

      const res = await fetch(
        `https://googleads.googleapis.com/${GOOGLE_ADS_API_VERSION}/customers/${customerId}:uploadClickConversions`,
        {
          method: "POST",
          headers: {
            "Content-Type":   "application/json",
            "Authorization":  `Bearer ${accessToken}`,
            "developer-token": process.env.GOOGLE_DEVELOPER_TOKEN!,
          },
          body: JSON.stringify({ conversions: [conversion], partialFailure: true }),
        }
      );

      const response = await res.json();
      const hasPartialError = !!response.partialFailureError;

      if (res.ok && !hasPartialError) {
        await prisma.trackingEvent.update({
          where: { id: event.id },
          data: {
            status: TrackingEventStatus.SUCCESS,
            response,
            lastAttemptAt: new Date(),
            attempts: { increment: 1 },
          },
        });
      } else {
        await handleFailure(event, response, event.clientId);
      }
    } catch (err) {
      await handleFailure(event, { error: String(err) }, event.clientId);
    }
  }
}

async function handleFailure(
  event: { id: string; attempts: number; clientId: string; eventId: string },
  errorData: unknown,
  clientId: string
) {
  const newAttempts = event.attempts + 1;
  const failed      = newAttempts >= MAX_ATTEMPTS;

  await prisma.trackingEvent.update({
    where: { id: event.id },
    data: {
      status:        failed ? TrackingEventStatus.FAILED : TrackingEventStatus.PENDING,
      errorMessage:  JSON.stringify(errorData),
      lastAttemptAt: new Date(),
      attempts:      newAttempts,
    },
  });

  if (failed) {
    await prisma.notification.create({
      data: {
        clientId,
        type:     "TRACKING_ERROR",
        title:    "Falha no envio de evento para o Google Ads",
        body:     `Evento ${event.eventId} falhou após ${MAX_ATTEMPTS} tentativas.`,
        metadata: { eventId: event.eventId, error: JSON.stringify(errorData) },
      },
    });
  }
}
