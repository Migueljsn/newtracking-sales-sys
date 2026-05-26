import { createHmac } from "crypto";

function secret(): string {
  return process.env.UNSUBSCRIBE_SECRET ?? process.env.TRACKING_WORKER_SECRET ?? "dev-fallback";
}

export function generateUnsubToken(customerId: string, clientId: string): string {
  const payload = `${customerId}.${clientId}`;
  const sig     = createHmac("sha256", secret()).update(payload).digest("hex").slice(0, 24);
  return Buffer.from(`${payload}.${sig}`).toString("base64url");
}

export function verifyUnsubToken(token: string): { customerId: string; clientId: string } | null {
  try {
    const decoded = Buffer.from(token, "base64url").toString();
    // format: customerId.clientId.sig (cuid values never contain ".")
    const lastDot   = decoded.lastIndexOf(".");
    const secondDot = decoded.lastIndexOf(".", lastDot - 1);
    if (secondDot === -1) return null;

    const customerId = decoded.slice(0, secondDot);
    const clientId   = decoded.slice(secondDot + 1, lastDot);
    const sig        = decoded.slice(lastDot + 1);

    const expected = createHmac("sha256", secret())
      .update(`${customerId}.${clientId}`)
      .digest("hex")
      .slice(0, 24);

    if (sig !== expected) return null;
    return { customerId, clientId };
  } catch {
    return null;
  }
}

export function unsubscribeUrl(customerId: string, clientId: string): string {
  const base  = process.env.NEXT_PUBLIC_APP_URL ?? "https://newtracking-sales-sys.vercel.app";
  const token = generateUnsubToken(customerId, clientId);
  return `${base}/api/unsubscribe?token=${token}`;
}
