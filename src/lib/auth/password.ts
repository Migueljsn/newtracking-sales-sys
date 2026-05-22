import { randomBytes, scryptSync, timingSafeEqual } from "crypto";

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const derived    = scryptSync(password, salt, 64);
  const storedBuf  = Buffer.from(hash, "hex");
  return derived.length === storedBuf.length && timingSafeEqual(derived, storedBuf);
}
