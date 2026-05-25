export interface SendWindowConfig {
  enabled:   boolean;
  weekdays:  number[];   // 0=Dom, 1=Seg … 6=Sáb
  startHour: number;     // 0-23
  endHour:   number;     // 0-23 (exclusive)
  timezone:  string;     // ex: "America/Sao_Paulo"
}

export const DEFAULT_SEND_WINDOW: SendWindowConfig = {
  enabled:   false,
  weekdays:  [1, 2, 3, 4, 5],
  startHour: 9,
  endHour:   18,
  timezone:  "America/Sao_Paulo",
};

function getTzInfo(date: Date, tz: string): { day: number; hour: number } {
  const weekdayStr = new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday: "long" }).format(date);
  const hourStr    = new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "numeric", hour12: false }).formatToParts(date).find(p => p.type === "hour")?.value ?? "0";

  const map: Record<string, number> = {
    Sunday: 0, Monday: 1, Tuesday: 2, Wednesday: 3,
    Thursday: 4, Friday: 5, Saturday: 6,
  };

  return { day: map[weekdayStr] ?? 0, hour: parseInt(hourStr) };
}

export function isInSendWindow(config: SendWindowConfig, now = new Date()): boolean {
  if (!config.enabled) return true;
  const { day, hour } = getTzInfo(now, config.timezone);
  return config.weekdays.includes(day) && hour >= config.startHour && hour < config.endHour;
}

// Returns the Date when the next valid send window opens (never returns past)
export function nextWindowStart(config: SendWindowConfig, now = new Date()): Date {
  // Already in window — shouldn't be called, but handle gracefully
  if (isInSendWindow(config, now)) return now;

  const tz = config.timezone;

  // Check each upcoming hour slot (max 7 days)
  for (let h = 1; h <= 7 * 24; h++) {
    const candidate = new Date(now.getTime() + h * 3_600_000);
    const { day, hour } = getTzInfo(candidate, tz);

    if (config.weekdays.includes(day) && hour === config.startHour) {
      // Return the exact start of this hour (zero out minutes/seconds)
      return new Date(Math.floor(candidate.getTime() / 3_600_000) * 3_600_000);
    }
  }

  // Fallback: next day at startHour (shouldn't happen with a valid config)
  return new Date(now.getTime() + 24 * 3_600_000);
}
