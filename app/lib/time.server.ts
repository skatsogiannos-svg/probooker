/**
 * Timezone helpers that work without a date library.
 * Intl already knows every IANA zone and its DST rules.
 */

/** The YYYY-MM-DD calendar day for an instant in a given timezone. */
export function dateKeyInTimezone(instant: Date, timezone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(instant);
}

/**
 * The UTC instant that corresponds to local midnight at the start of the
 * merchant's current calendar day.
 */
export function startOfDayInTimezone(instant: Date, timezone: string): Date {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(instant);

  const pick = (type: string) =>
    Number(parts.find((part) => part.type === type)?.value ?? "0");

  const asUtc = Date.UTC(
    pick("year"),
    pick("month") - 1,
    pick("day"),
    pick("hour"),
    pick("minute"),
    pick("second"),
  );
  const offsetMs = asUtc - instant.getTime();
  return new Date(Date.UTC(pick("year"), pick("month") - 1, pick("day")) - offsetMs);
}

export function startOfNextDayInTimezone(instant: Date, timezone: string): Date {
  // 36 hours ahead is always the next local calendar day, even across DST.
  return startOfDayInTimezone(new Date(instant.getTime() + 36 * 3600_000), timezone);
}

export function formatInTimezone(
  instant: Date,
  timezone: string,
  options: Intl.DateTimeFormatOptions = { dateStyle: "medium", timeStyle: "short" },
): string {
  return new Intl.DateTimeFormat("en-US", { timeZone: timezone, ...options }).format(
    instant,
  );
}
