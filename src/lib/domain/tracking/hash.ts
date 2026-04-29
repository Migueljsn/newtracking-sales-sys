import { createHash } from "crypto";

function hash(value: string): string {
  return createHash("sha256")
    .update(value.trim().toLowerCase())
    .digest("hex");
}

export function hashPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  const normalized = digits.startsWith("55") ? digits : `55${digits}`;
  return hash(normalized);
}

export function hashEmail(email: string): string {
  return hash(email);
}

export function hashName(fullName: string): { fn: string; ln: string } {
  const parts = fullName.trim().split(/\s+/);
  const fn = hash(parts[0]);
  const ln = parts.length > 1 ? hash(parts.slice(1).join(" ")) : hash(parts[0]);
  return { fn, ln };
}

export function hashZipCode(zip: string): string {
  return hash(zip.replace(/\D/g, ""));
}

export function hashCity(city: string): string {
  return hash(city);
}

export function hashState(state: string): string {
  return hash(state.toLowerCase());
}

export function hashBirthDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return hash(`${y}${m}${d}`);
}

export function hashId(id: string): string {
  return hash(id);
}
