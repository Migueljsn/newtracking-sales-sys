import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createHash, randomBytes, scryptSync, timingSafeEqual } from "crypto";

const COOKIE_NAME = "consultant_token";
const secret = () => {
  const key = process.env.CONSULTANT_JWT_SECRET ?? process.env.NEXTAUTH_SECRET ?? "fallback-dev-secret-change-in-prod";
  return new TextEncoder().encode(key);
};

// ─── JWT ──────────────────────────────────────────────────────────────────────

export interface ConsultantPayload {
  id:       string;
  clientId: string;
  name:     string;
}

export async function signConsultantToken(payload: ConsultantPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("7d")
    .sign(secret());
}

export async function getConsultantSession(): Promise<ConsultantPayload> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) redirect("/consultor/login");

  try {
    const { payload } = await jwtVerify(token, secret());
    return payload as unknown as ConsultantPayload;
  } catch {
    redirect("/consultor/login");
  }
}

export async function setConsultantCookie(token: string) {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure:   process.env.NODE_ENV === "production",
    sameSite: "lax",
    path:     "/",
    maxAge:   60 * 60 * 24 * 7,
  });
}

export async function clearConsultantCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

// ─── Password hashing (scrypt) ────────────────────────────────────────────────

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const derived = scryptSync(password, salt, 64);
  const stored_buf = Buffer.from(hash, "hex");
  return derived.length === stored_buf.length && timingSafeEqual(derived, stored_buf);
}
