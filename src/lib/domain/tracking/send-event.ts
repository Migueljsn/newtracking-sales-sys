import { prisma } from "@/lib/db/prisma";
import { TrackingEventStatus } from "@prisma/client";

const MAX_ATTEMPTS = 3;
const META_API_VERSION = "v19.0";

export async function processPendingEvents() {
  const events = await prisma.trackingEvent.findMany({
    where: { status: "PENDING" },
    include: { client: { include: { settings: true } } },
    orderBy: { createdAt: "asc" },
    take: 50,
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
  event: { id: string; attempts: number; clientId: string; eventId: string },
  errorData: unknown,
  clientId: string
) {
  const newAttempts = event.attempts + 1;
  const failed = newAttempts >= MAX_ATTEMPTS;

  await prisma.trackingEvent.update({
    where: { id: event.id },
    data: {
      status: failed ? TrackingEventStatus.FAILED : TrackingEventStatus.PENDING,
      errorMessage: JSON.stringify(errorData),
      lastAttemptAt: new Date(),
      attempts: newAttempts,
    },
  });

  if (failed) {
    await prisma.notification.create({
      data: {
        clientId,
        type: "TRACKING_ERROR",
        title: "Falha no envio de evento para o Meta",
        body: `Evento ${event.eventId} falhou após ${MAX_ATTEMPTS} tentativas.`,
        metadata: { eventId: event.eventId, error: JSON.stringify(errorData) },
      },
    });
  }
}
