// Availability engine — the core of the staff-first product.
//
// Given a service (duration + buffer) and a specific staff member, compute the
// free slots for a given day by:
//   1. Taking the staff weekly Availability windows for that weekday
//   2. Removing Blackout dates
//   3. Subtracting existing Bookings (with their buffers)
//   4. Optionally respecting a "now" cutoff for same-day bookings
//
// Everything works in the MERCHANT timezone. Times in the DB are stored in UTC;
// we convert at the boundary so the logic is DST-safe.

export interface AvailabilityWindow {
  weekday: number; // 0=Sunday..6=Saturday
  startMin: number; // minutes from midnight (local)
  endMin: number;
}

export interface ExistingBooking {
  startsAt: Date; // UTC
  endsAt: Date; // UTC
}

export interface Slot {
  start: Date; // UTC
  end: Date; // UTC
}

export interface ComputeSlotsInput {
  day: Date; // the local day to compute (noon UTC is safe)
  timezone: string; // IANA tz, e.g. "Europe/Athens"
  durationMin: number;
  bufferMin: number;
  windows: AvailabilityWindow[];
  bookings: ExistingBooking[];
  blackout?: boolean;
  now?: Date;
  minLeadMinutes?: number; // minimum notice before a slot can be booked
  granularityMin?: number; // slot step, default 15
}

// ---- timezone helpers (no deps) ----

function getZonedParts(date: Date, timezone: string) {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    weekday: "short",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const parts = fmt.formatToParts(date);
  const pick = (t: string) => parts.find((p) => p.type === t)?.value ?? "0";
  const weekdayMap: Record<string, number> = {
    Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
  };
  return {
    year: Number(pick("year")),
    month: Number(pick("month")),
    day: Number(pick("day")),
    hour: pick("hour") === "24" ? 0 : Number(pick("hour")),
    minute: Number(pick("minute")),
    second: Number(pick("second")),
    weekday: weekdayMap[pick("weekday")] ?? 0,
  };
}

// Offset (ms) of `timezone` at a given instant: localWallClock - utcInstant.
function zoneOffsetMs(instant: Date, timezone: string): number {
  const p = getZonedParts(instant, timezone);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUtc - instant.getTime();
}

// Convert a local wall-clock time (date + minutes from midnight) in `timezone`
// into a real UTC Date. Two-pass offset probe keeps it correct across DST
// transitions: the offset at the naive guess may differ from the offset at the
// true instant, so we recompute once more after the first correction.
function zonedWallClockToUtc(
  year: number,
  month: number,
  day: number,
  minutes: number,
  timezone: string,
): Date {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  const naiveUtc = Date.UTC(year, month - 1, day, hours, mins, 0, 0);

  // First guess: apply the offset that the zone has at the naive instant.
  let offset = zoneOffsetMs(new Date(naiveUtc), timezone);
  let guess = naiveUtc - offset;

  // Second pass: recompute using the offset at the corrected instant.
  const offset2 = zoneOffsetMs(new Date(guess), timezone);
  if (offset2 !== offset) {
    guess = naiveUtc - offset2;
  }
  return new Date(guess);
}

export function computeDaySlots(input: ComputeSlotsInput): Slot[] {
  const {
    day,
    timezone,
    durationMin,
    bufferMin,
    windows,
    bookings,
    blackout = false,
    now = new Date(),
    minLeadMinutes = 0,
    granularityMin = 15,
  } = input;

  if (blackout) return [];

  const dparts = getZonedParts(day, timezone);
  const weekday = dparts.weekday;
  const dayWindows = windows
    .filter((w) => w.weekday === weekday)
    .sort((a, b) => a.startMin - b.startMin);

  if (dayWindows.length === 0) return [];

  const blockMin = durationMin + bufferMin;
  const cutoff = new Date(now.getTime() + minLeadMinutes * 60_000);

  const result: Slot[] = [];
  const seen = new Set<number>();

  for (const w of dayWindows) {
    for (let start = w.startMin; start + blockMin <= w.endMin; start += granularityMin) {
      const startUtc = zonedWallClockToUtc(
        dparts.year,
        dparts.month,
        dparts.day,
        start,
        timezone,
      );
      const endUtc = new Date(startUtc.getTime() + blockMin * 60_000);

      if (startUtc < cutoff) continue;
      if (seen.has(startUtc.getTime())) continue;

      // Overlap check: block [start, end] with buffer already baked into blockMin.
      const overlaps = bookings.some((b) => {
        return startUtc < b.endsAt && endUtc > b.startsAt;
      });
      if (overlaps) continue;

      seen.add(startUtc.getTime());
      result.push({
        start: startUtc,
        end: new Date(startUtc.getTime() + durationMin * 60_000),
      });
    }
  }

  return result.sort((a, b) => a.start.getTime() - b.start.getTime());
}

/**
 * Return the YYYY-MM-DD string for a UTC instant as seen in `timezone`.
 * Use this instead of toISOString().slice(0,10), which is UTC-based and can
 * land on the wrong calendar day for the merchant.
 */
export function localDateString(instant: Date, timezone: string): string {
  const p = getZonedParts(instant, timezone);
  const mm = String(p.month).padStart(2, "0");
  const dd = String(p.day).padStart(2, "0");
  return `${p.year}-${mm}-${dd}`;
}
/**
 * Round-robin / "any available": merge per-staff slots into a unified timeline.
 * Returns the earliest slot per start time, annotated with which staff can serve it.
 */
export function mergeSlotsByStart(
  perStaff: Array<{ staffId: string; slots: Slot[] }>,
): Array<{ start: Date; end: Date; staffIds: string[] }> {
  const map = new Map<number, { start: Date; end: Date; staffIds: string[] }>();
  for (const { staffId, slots } of perStaff) {
    for (const s of slots) {
      const key = s.start.getTime();
      const existing = map.get(key);
      if (existing) {
        if (!existing.staffIds.includes(staffId)) existing.staffIds.push(staffId);
      } else {
        map.set(key, { start: s.start, end: s.end, staffIds: [staffId] });
      }
    }
  }
  return Array.from(map.values()).sort(
    (a, b) => a.start.getTime() - b.start.getTime(),
  );
}
