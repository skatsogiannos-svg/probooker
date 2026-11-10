import { describe, it, expect } from "vitest";
import { computeDaySlots, mergeSlotsByStart } from "./availability.server";

const TZ = "Europe/Athens";

// Helper: build a local day at noon UTC
function noon(iso: string) {
  return new Date(iso + "T12:00:00Z");
}

describe("computeDaySlots", () => {
  it("returns slots within a single availability window", () => {
    // Monday 2026-11-09, open 09:00-12:00, 60min service no buffer, 60min step
    const slots = computeDaySlots({
      day: noon("2026-11-09"),
      timezone: TZ,
      durationMin: 60,
      bufferMin: 0,
      granularityMin: 60,
      windows: [{ weekday: 1, startMin: 9 * 60, endMin: 12 * 60 }],
      bookings: [],
      now: new Date("2026-11-01T00:00:00Z"),
    });
    expect(slots).toHaveLength(3); // 09:00, 10:00, 11:00 local
    // 09:00 Athens (UTC+2 in Nov, since DST ends late Oct) => 07:00 UTC
    expect(slots[0].start.toISOString()).toBe("2026-11-09T07:00:00.000Z");
    expect(slots[0].end.toISOString()).toBe("2026-11-09T08:00:00.000Z");
  });

  it("excludes slots that overlap existing bookings", () => {
    const slots = computeDaySlots({
      day: noon("2026-11-09"),
      timezone: TZ,
      durationMin: 60,
      bufferMin: 0,
      granularityMin: 60,
      windows: [{ weekday: 1, startMin: 9 * 60, endMin: 12 * 60 }],
      bookings: [
        // book 10:00-11:00 Athens => 08:00-09:00 UTC
        {
          startsAt: new Date("2026-11-09T08:00:00Z"),
          endsAt: new Date("2026-11-09T09:00:00Z"),
        },
      ],
      now: new Date("2026-11-01T00:00:00Z"),
    });
    const starts = slots.map((s) => s.start.toISOString());
    expect(starts).not.toContain("2026-11-09T08:00:00.000Z");
    expect(starts).toContain("2026-11-09T07:00:00.000Z");
    expect(starts).toContain("2026-11-09T09:00:00.000Z");
  });

  it("respects buffer time between bookings", () => {
    // 120min service + 30min buffer = 150min block, window 09:00-13:00 (4h)
    const slots = computeDaySlots({
      day: noon("2026-11-09"),
      timezone: TZ,
      durationMin: 120,
      bufferMin: 30,
      granularityMin: 30,
      windows: [{ weekday: 1, startMin: 9 * 60, endMin: 13 * 60 }],
      bookings: [],
      now: new Date("2026-11-01T00:00:00Z"),
    });
    // Blocks that fit: 09:00 (ends 11:30 local) - next candidate 09:30 ends 12:00
    expect(slots.length).toBeGreaterThan(0);
    // All slots must end (start+duration) within window
    for (const s of slots) {
      const localEnd = s.start.getTime() + 120 * 60_000;
      expect(localEnd).toBeLessThanOrEqual(
        new Date("2026-11-09T11:00:00Z").getTime(), // 13:00 Athens = 11:00 UTC
      );
    }
  });

  it("returns empty on blackout days", () => {
    const slots = computeDaySlots({
      day: noon("2026-11-09"),
      timezone: TZ,
      durationMin: 60,
      bufferMin: 0,
      windows: [{ weekday: 1, startMin: 9 * 60, endMin: 12 * 60 }],
      bookings: [],
      blackout: true,
      now: new Date("2026-11-01T00:00:00Z"),
    });
    expect(slots).toHaveLength(0);
  });

  it("returns empty when the day has no availability window", () => {
    const slots = computeDaySlots({
      day: noon("2026-11-09"), // Monday
      timezone: TZ,
      durationMin: 60,
      bufferMin: 0,
      windows: [{ weekday: 2, startMin: 9 * 60, endMin: 12 * 60 }], // Tuesday only
      bookings: [],
      now: new Date("2026-11-01T00:00:00Z"),
    });
    expect(slots).toHaveLength(0);
  });

  it("honors minimum lead time", () => {
    // now is 08:00 Athens on the booking day (06:00 UTC). Slots start 09:00.
    // With a 120-min lead requirement, the 09:00 and 10:00 slots are too soon
    // and must be filtered out; only 11:00 local (09:00 UTC) survives.
    const slots = computeDaySlots({
      day: noon("2026-11-09"),
      timezone: TZ,
      durationMin: 60,
      bufferMin: 0,
      granularityMin: 60,
      windows: [{ weekday: 1, startMin: 9 * 60, endMin: 12 * 60 }],
      bookings: [],
      now: new Date("2026-11-09T06:00:00Z"), // 08:00 Athens
      minLeadMinutes: 120,
    });
    const starts = slots.map((s) => s.start.toISOString());
    expect(starts).not.toContain("2026-11-09T07:00:00.000Z"); // 09:00 local, only 1h out
    expect(starts).toContain("2026-11-09T09:00:00.000Z"); // 11:00 local, 3h out
  });

  it("is DST-safe: Athens spring forward 2026-03-29", () => {
    // Athens switches CET(UTC+1) -> EEST(UTC+2) on last Sunday of March at 03:00.
    // A 09:00 slot that day should be 06:00 UTC (EEST).
    const slots = computeDaySlots({
      day: noon("2026-03-29"), // Sunday
      timezone: TZ,
      durationMin: 60,
      bufferMin: 0,
      granularityMin: 60,
      windows: [{ weekday: 0, startMin: 9 * 60, endMin: 10 * 60 }],
      bookings: [],
      now: new Date("2026-03-01T00:00:00Z"),
    });
    expect(slots).toHaveLength(1);
    expect(slots[0].start.toISOString()).toBe("2026-03-29T06:00:00.000Z");
  });
});

describe("mergeSlotsByStart", () => {
  it("merges per-staff slots and lists which staff can serve each start", () => {
    const s1 = { start: new Date("2026-11-09T08:00:00Z"), end: new Date("2026-11-09T09:00:00Z") };
    const s2 = { start: new Date("2026-11-09T09:00:00Z"), end: new Date("2026-11-09T10:00:00Z") };
    const merged = mergeSlotsByStart([
      { staffId: "A", slots: [s1] },
      { staffId: "B", slots: [s1, s2] },
    ]);
    expect(merged).toHaveLength(2);
    const at8 = merged.find((m) => m.start.toISOString() === "2026-11-09T08:00:00.000Z");
    expect(at8?.staffIds.sort()).toEqual(["A", "B"]);
    const at9 = merged.find((m) => m.start.toISOString() === "2026-11-09T09:00:00.000Z");
    expect(at9?.staffIds).toEqual(["B"]);
  });
});
