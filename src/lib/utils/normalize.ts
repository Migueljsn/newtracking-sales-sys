/**
 * Normalizes a Brazilian phone number to digits only, without country code.
 * Canonical format: DDNNNNNNNNN (10-11 digits)
 * Examples:
 *   "(11) 99999-9999"  → "11999999999"
 *   "5511999999999"    → "11999999999"
 *   "+55 11 99999-9999"→ "11999999999"
 *   "11999999999"      → "11999999999"
 */
export function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if ((digits.length === 12 || digits.length === 13) && digits.startsWith("55")) {
    return digits.slice(2);
  }
  return digits;
}

/** Strips formatting from CPF/CNPJ — stores as digits only. */
export function normalizeDocument(raw: string): string {
  return raw.replace(/\D/g, "");
}

/** Lowercases and trims email. */
export function normalizeEmail(raw: string): string {
  return raw.toLowerCase().trim();
}

/** Uppercases state abbreviation (SP, MA, PI…). */
export function normalizeState(raw: string): string {
  return raw.toUpperCase().trim();
}
