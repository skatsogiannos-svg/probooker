import { describe, it, expect } from "vitest";
import {
  stripHtml,
  detectFeatures,
  extractPricing,
  extractRating,
  hashContent,
  extractListing,
  diffListings,
} from "./monitor.server";

describe("stripHtml", () => {
  it("removes tags, scripts and decodes entities", () => {
    const out = stripHtml(
      "<div>Hello &amp; <b>world</b><script>x()</script>&nbsp;!</div>",
    );
    expect(out).toBe("Hello & world !");
  });
});

describe("detectFeatures", () => {
  it("detects known feature tags from text", () => {
    const tags = detectFeatures(
      "Supports deposits, group booking, SMS reminders and Google Calendar sync.",
    );
    expect(tags).toContain("deposits");
    expect(tags).toContain("group-booking");
    expect(tags).toContain("sms-notifications");
    expect(tags).toContain("calendar-sync");
  });

  it("returns empty array when nothing matches", () => {
    expect(detectFeatures("just a plain sentence about nothing")).toEqual([]);
  });
});

describe("extractPricing", () => {
  it("pulls price-like tokens and de-duplicates", () => {
    const p = extractPricing("Free plan. Starter $5 / month. Pro $9 / month. $9 / month.");
    expect(p).toContain("$5 / month");
    expect(p).toContain("$9 / month");
    // de-duplicated: only one "$9 / month"
    expect((p!.match(/\$9 \/ month/g) || []).length).toBe(1);
  });

  it("returns null when no prices", () => {
    expect(extractPricing("no money here")).toBeNull();
  });
});

describe("extractRating", () => {
  it("reads rating and count from JSON-LD", () => {
    const html = `<script type="application/ld+json">${JSON.stringify({
      aggregateRating: { ratingValue: 4.9, ratingCount: 2262 },
    })}</script>`;
    const r = extractRating(html);
    expect(r.rating).toBe("4.9");
    expect(r.reviewCount).toBe(2262);
  });

  it("falls back to visible text", () => {
    const html = "<p>Rated 4.7 out of 5 · 422 total reviews</p>";
    const r = extractRating(html);
    expect(r.rating).toBe("4.7");
    expect(r.reviewCount).toBe(422);
  });
});

describe("hashContent", () => {
  it("is deterministic and differs for different input", () => {
    expect(hashContent("abc")).toBe(hashContent("abc"));
    expect(hashContent("abc")).not.toBe(hashContent("abd"));
  });
});

describe("extractListing", () => {
  it("produces a full record", () => {
    const html = `
      <script type="application/ld+json">${JSON.stringify({
        aggregateRating: { ratingValue: 5, ratingCount: 100 },
      })}</script>
      <p>Booking app with deposits and waitlist. Plans from $14 / month.</p>`;
    const rec = extractListing(html);
    expect(rec.features).toContain("deposits");
    expect(rec.features).toContain("waitlist");
    expect(rec.pricing).toContain("$14 / month");
    expect(rec.rating).toBe("5");
    expect(rec.reviewCount).toBe(100);
    expect(rec.contentHash).toMatch(/^[0-9a-f]{8}$/);
  });
});

describe("diffListings", () => {
  it("flags added features as notable", () => {
    const changes = diffListings(
      { features: ["deposits"], pricing: null, rating: null, reviewCount: null },
      { features: ["deposits", "waitlist"], pricing: null, rating: null, reviewCount: null },
    );
    const added = changes.find((c) => c.newValue === "waitlist");
    expect(added).toBeDefined();
    expect(added!.severity).toBe("notable");
    expect(added!.summary).toContain("waitlist");
  });

  it("flags pricing changes as important", () => {
    const changes = diffListings(
      { features: [], pricing: "$9 / month", rating: null, reviewCount: null },
      { features: [], pricing: "$14 / month", rating: null, reviewCount: null },
    );
    const p = changes.find((c) => c.field === "pricing");
    expect(p?.severity).toBe("important");
  });

  it("reports review count deltas", () => {
    const changes = diffListings(
      { features: [], pricing: null, rating: null, reviewCount: 100 },
      { features: [], pricing: null, rating: null, reviewCount: 120 },
    );
    expect(changes[0].summary).toContain("+20");
  });

  it("returns nothing when identical", () => {
    const snap = { features: ["a"], pricing: "$1", rating: "5", reviewCount: 1 };
    expect(diffListings(snap, snap)).toEqual([]);
  });
});
