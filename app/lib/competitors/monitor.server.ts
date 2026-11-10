// Competitor-monitoring primitives: fetch → normalize → extract → diff.
// Pure functions (no DB) so they are unit-testable without a network.

export interface ExtractedListing {
  normalizedText: string;
  features: string[];
  pricing: string | null;
  rating: string | null;
  reviewCount: number | null;
  contentHash: string;
}

// Known feature vocabulary (kept in sync with our feature catalogue).
// Detecting these tags lets us diff "feature added/removed" rather than raw text.
export const FEATURE_VOCAB: Array<{ tag: string; patterns: RegExp[] }> = [
  { tag: "deposits", patterns: [/deposit/i, /prepay/i, /pre-?payment/i] },
  { tag: "group-booking", patterns: [/group booking/i, /group appointment/i, /group event/i] },
  { tag: "classes", patterns: [/class schedul/i, /classes\b/i, /class booking/i] },
  { tag: "memberships", patterns: [/membership/i] },
  { tag: "packages", patterns: [/package/i, /bundle/i, /prepaid series/i] },
  { tag: "gift-certificates", patterns: [/gift cert/i, /gift card/i] },
  { tag: "waitlist", patterns: [/waitlist/i, /wait list/i] },
  { tag: "sms-notifications", patterns: [/sms/i, /text message/i, /whatsapp/i] },
  { tag: "email-reminders", patterns: [/email reminder/i, /reminder email/i, /automatic reminder/i] },
  { tag: "calendar-sync", patterns: [/google calendar/i, /outlook/i, /ical/i, /calendar sync/i] },
  { tag: "zoom-meet", patterns: [/zoom/i, /google meet/i, /teams/i] },
  { tag: "staff-management", patterns: [/staff management/i, /team member/i, /staff account/i, /multi-?staff/i] },
  { tag: "multi-location", patterns: [/multi-?location/i, /multiple location/i] },
  { tag: "resources", patterns: [/resource management/i, /\broom\b/i, /\bchair\b/i, /equipment/i] },
  { tag: "pos", patterns: [/\bpos\b/i, /point of sale/i] },
  { tag: "custom-questions", patterns: [/custom question/i, /intake form/i, /booking form/i] },
  { tag: "no-show-fees", patterns: [/no-?show fee/i, /cancellation fee/i, /cancellation policy/i] },
  { tag: "loyalty", patterns: [/loyalty/i, /rewards program/i] },
  { tag: "marketing-automation", patterns: [/marketing automation/i, /campaign/i, /win-?back/i, /reactivat/i] },
  { tag: "reviews", patterns: [/review/i, /reputation/i] },
  { tag: "ai-assistant", patterns: [/\bai\b/i, /ai concierge/i, /assistant/i, /chatbot/i] },
  { tag: "api-webhooks", patterns: [/\bapi\b/i, /webhook/i, /zapier/i] },
  { tag: "routing", patterns: [/round robin/i, /routing/i, /collective/i] },
  { tag: "recurring", patterns: [/recurring/i, /subscription booking/i] },
  { tag: "virtual-meetings", patterns: [/virtual/i, /online meeting/i, /digital location/i] },
  { tag: "multi-language", patterns: [/multi-?language/i, /translation/i] },
  { tag: "custom-css", patterns: [/custom css/i, /branding/i] },
  { tag: "deposits-refunds", patterns: [/refund/i] },
  { tag: "invoicing", patterns: [/invoice/i] },
  { tag: "tips", patterns: [/\btip\b/i, /gratuity/i] },
];

/** Strip HTML to readable text (robust, dependency-free). */
export function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, "/")
    .replace(/\s+/g, " ")
    .trim();
}

/** Detect which catalogue features appear in a block of text. */
export function detectFeatures(text: string): string[] {
  const found: string[] = [];
  for (const f of FEATURE_VOCAB) {
    if (f.patterns.some((p) => p.test(text))) found.push(f.tag);
  }
  return found.sort();
}

/** Pull the most likely pricing snippet (e.g. "$14 / month", "Free plan"). */
export function extractPricing(text: string): string | null {
  const priceRe = /\$\s?\d+(?:[.,]\d+)?(?:\s?\/\s?(?:month|mo|year|yr))?/gi;
  const matches = text.match(priceRe);
  if (!matches) return null;
  return [...new Set(matches.map((m) => m.replace(/\s+/g, " ").trim()))]
    .slice(0, 12)
    .join(", ");
}

/** Extract rating + review count from raw HTML (JSON-LD or visible text). */
export function extractRating(html: string): { rating: string | null; reviewCount: number | null } {
  // JSON-LD first
  const ld = html.match(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/i);
  if (ld) {
    try {
      const j = JSON.parse(ld[1]);
      const r = j?.aggregateRating;
      if (r) {
        return {
          rating: r.ratingValue != null ? String(r.ratingValue) : null,
          reviewCount: r.ratingCount != null ? Number(r.ratingCount) : null,
        };
      }
    } catch {
      /* fall through to text */
    }
  }
  const text = stripHtml(html);
  const r = text.match(/(\d(?:\.\d)?)\s*(?:out of 5|\/\s*5)/i);
  const c = text.match(/([\d,]{2,})\s*(?:total\s*)?reviews/i);
  return {
    rating: r ? r[1] : null,
    reviewCount: c ? Number(c[1].replace(/,/g, "")) : null,
  };
}

/** Simple stable hash (FNV-1a) — deterministic, no crypto dependency needed. */
export function hashContent(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

/** Full extraction pipeline from raw HTML to a comparable listing record. */
export function extractListing(html: string): ExtractedListing {
  const text = stripHtml(html);
  const features = detectFeatures(text);
  const pricing = extractPricing(text);
  const { rating, reviewCount } = extractRating(html);
  return {
    normalizedText: text,
    features,
    pricing,
    rating,
    reviewCount,
    contentHash: hashContent(text),
  };
}

export interface DetectedChange {
  field: "feature" | "pricing" | "rating" | "reviewCount";
  oldValue: string | null;
  newValue: string | null;
  summary: string;
  severity: "info" | "notable" | "important";
}

/**
 * Compare two snapshots and produce human-readable change records.
 * Feature additions/removals are "notable"/"important"; numeric drift is "info".
 */
export function diffListings(
  prev: Pick<ExtractedListing, "features" | "pricing" | "rating" | "reviewCount">,
  next: Pick<ExtractedListing, "features" | "pricing" | "rating" | "reviewCount">,
): DetectedChange[] {
  const changes: DetectedChange[] = [];

  const added = next.features.filter((f) => !prev.features.includes(f));
  const removed = prev.features.filter((f) => !next.features.includes(f));

  for (const f of added) {
    changes.push({
      field: "feature",
      oldValue: null,
      newValue: f,
      summary: `Added feature: ${f}`,
      severity: "notable",
    });
  }
  for (const f of removed) {
    changes.push({
      field: "feature",
      oldValue: f,
      newValue: null,
      summary: `Removed feature: ${f}`,
      severity: "info",
    });
  }

  if (next.pricing && prev.pricing && next.pricing !== prev.pricing) {
    changes.push({
      field: "pricing",
      oldValue: prev.pricing,
      newValue: next.pricing,
      summary: `Pricing changed: ${prev.pricing} → ${next.pricing}`,
      severity: "important",
    });
  }

  if (next.rating && prev.rating && next.rating !== prev.rating) {
    changes.push({
      field: "rating",
      oldValue: prev.rating,
      newValue: next.rating,
      summary: `Rating: ${prev.rating} → ${next.rating}`,
      severity: "info",
    });
  }

  if (
    next.reviewCount != null &&
    prev.reviewCount != null &&
    next.reviewCount !== prev.reviewCount
  ) {
    const delta = next.reviewCount - prev.reviewCount;
    changes.push({
      field: "reviewCount",
      oldValue: String(prev.reviewCount),
      newValue: String(next.reviewCount),
      summary: `Reviews: ${prev.reviewCount} → ${next.reviewCount} (${delta > 0 ? "+" : ""}${delta})`,
      severity: "info",
    });
  }

  return changes;
}
