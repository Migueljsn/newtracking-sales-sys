import { prisma } from "@/lib/db/prisma";
import { TrackingEventStatus } from "@prisma/client";
import { processGooglePendingEvents } from "./google-ads";

const MAX_ATTEMPTS = 3;
const META_API_VERSION = "v19.0";

export async function processPendingEvents() {
  await Promise.all([processMetaPendingEvents(), processGooglePendingEvents()]);
}

async function processMetaPendingEvents() {
  const events = await prisma.trackingEvent.findMany({
    where:   { status: "PENDING", eventName: { in: ["Lead", "Purchase"] } },
    include: { client: { include: { settings: true } } },
    orderBy: { createdAt: "asc" },
    take:    50,
  });

  for (const event of events) {
    const settings = event.client.settings;

    if (!settings?.trackingEnabled || !settings.metaAccessToken || !settings.metaPixelId) {
      continue;
    }

    try {
      const res = await fetch(
        `https://graph.facebook.com/${META_API_VERSION}/${settings.metaPixelId}/events`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            data: [event.payload],
            access_token: settings.metaAccessToken,
            ...(settings.metaTestEventCode && {
              test_event_code: settings.metaTestEventCode,
            }),
          }),
        }
      );

      const response = await res.json();

      if (res.ok) {
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
        await handleFailure(event, response, settings.clientId);
      }
    } catch (err) {
      await handleFailure(event, { error: String(err) }, event.clientId);
    }
  }
}

async function handleFailure(
  event: { id: string; attempts: number; clientId: string; eventId: string; leadId: string | null },
  errorData: unknown,
  clientId: string
) {
  const newAttempts = event.attempts + 1;
  const failed = newAttempts >= MAX_ATTEMPTS;

  const errorMessage = JSON.stringify(errorData);

  await prisma.trackingEvent.update({
    where: { id: event.id },
    data: {
      status: failed ? TrackingEventStatus.FAILED : TrackingEventStatus.PENDING,
      errorMessage,
      lastAttemptAt: new Date(),
      attempts: newAttempts,
    },
  });

  if (failed) {
    const errorObj  = typeof errorData === "object" && errorData !== null ? errorData : {};
    const apiMessage = (errorObj as Record<string, unknown>)?.error?.toString() ?? errorMessage;

    await prisma.notification.create({
      data: {
        clientId,
        type:  "TRACKING_ERROR",
        title: "Falha no envio de evento para o Meta",
        body:  apiMessage.slice(0, 280),
        metadata: {
          eventId: event.eventId,
          leadId:  event.leadId ?? undefined,
          error:   errorMessage,
        },
      },
    });
  }
}
