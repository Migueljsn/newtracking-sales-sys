interface PushcutNotificationInput {
  webhookUrl: string;
  title: string;
  text: string;
}

export async function notifyPushcut(input: PushcutNotificationInput) {
  try {
    await fetch(input.webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: input.title, text: input.text }),
    });
  } catch (error) {
    console.error("[pushcut] falha ao enviar notificação:", error);
  }
}
