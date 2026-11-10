import prisma from "../../db.server";
import { extractListing, diffListings } from "./monitor.server";

/**
 * Crawl a single competitor: fetch its URL, extract the listing, store a
 * snapshot, diff against the previous snapshot, and persist any changes.
 * Returns a summary of what happened.
 *
 * NOTE: uses global fetch (Node 18+). Runs best in a job/cron worker; also
 * exposed via the /api/competitors/crawl route for manual/CRON triggering.
 */
export async function crawlCompetitor(competitorId: string) {
  const competitor = await prisma.competitor.findUnique({
    where: { id: competitorId },
  });
  if (!competitor) throw new Error(`Competitor ${competitorId} not found`);

  // Fetch listing HTML
  let html: string;
  try {
    const res = await fetch(competitor.url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; StaffFirstBookingMonitor/1.0; +https://example.com/bot)",
        Accept: "text/html",
      },
      redirect: "follow",
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    html = await res.text();
  } catch (err) {
    throw new Error(
      `Failed to fetch ${competitor.url}: ${(err as Error).message}`,
    );
  }

  const extracted = extractListing(html);

  // Previous snapshot (most recent)
  const prev = await prisma.competitorSnapshot.findFirst({
    where: { competitorId },
    orderBy: { capturedAt: "desc" },
  });

  // Store the new snapshot
  const snapshot = await prisma.competitorSnapshot.create({
    data: {
      competitorId,
      contentHash: extracted.contentHash,
      features: extracted.features,
      pricing: extracted.pricing,
      rating: extracted.rating,
      reviewCount: extracted.reviewCount,
      rawText: extracted.normalizedText.slice(0, 20000),
    },
  });

  // Diff against the previous snapshot
  let changeCount = 0;
  if (prev) {
    const changes = diffListings(
      {
        features: prev.features,
        pricing: prev.pricing,
        rating: prev.rating,
        reviewCount: prev.reviewCount,
      },
      {
        features: extracted.features,
        pricing: extracted.pricing,
        rating: extracted.rating,
        reviewCount: extracted.reviewCount,
      },
    );

    if (changes.length > 0) {
      await prisma.competitorChange.createMany({
        data: changes.map((c) => ({
          competitorId,
          field: c.field,
          oldValue: c.oldValue,
          newValue: c.newValue,
          summary: c.summary,
          severity: c.severity,
        })),
      });
      changeCount = changes.length;
    }
  }

  await prisma.competitor.update({
    where: { id: competitorId },
    data: { lastCrawledAt: new Date(), lastHash: extracted.contentHash },
  });

  return {
    competitorId,
    name: competitor.name,
    features: extracted.features.length,
    pricing: extracted.pricing,
    rating: extracted.rating,
    reviewCount: extracted.reviewCount,
    changes: changeCount,
    snapshotId: snapshot.id,
  };
}

/** Crawl every active competitor (sequentially, to be gentle). */
export async function crawlAll() {
  const competitors = await prisma.competitor.findMany({
    where: { active: true },
  });
  const results: Array<Record<string, unknown>> = [];
  for (const c of competitors) {
    try {
      results.push(await crawlCompetitor(c.id));
    } catch (err) {
      results.push({ competitorId: c.id, name: c.name, error: (err as Error).message });
    }
  }
  return results;
}

/**
 * Seed the competitor list from the research we did (the 5 Shopify incumbents
 *). Idempotent: skips ones that already exist by name+url.
 */
export async function seedCompetitors() {
  const seed = [
    {
      name: "Apntly",
      url: "https://apps.shopify.com/appointly",
      appStoreHandle: "appointly",
    },
    {
      name: "Cowlendar",
      url: "https://apps.shopify.com/cowlendar",
      appStoreHandle: "cowlendar",
    },
    {
      name: "Appointo",
      url: "https://apps.shopify.com/appointo",
      appStoreHandle: "appointo",
    },
    {
      name: "Easy Appointment Booking",
      url: "https://apps.shopify.com/appointments-and-bookings",
      appStoreHandle: "appointments-and-bookings",
    },
    {
      name: "Meety",
      url: "https://apps.shopify.com/meety-appointment-booking",
      appStoreHandle: "meety-appointment-booking",
    },
    {
      name: "BookThatApp",
      url: "https://apps.shopify.com/bookthatapp",
      appStoreHandle: "bookthatapp",
    },
    // External leaders, for cross-pollinating feature ideas
    { name: "Calendly", category: "external", url: "https://calendly.com/pricing" },
    { name: "Acuity Scheduling", category: "external", url: "https://www.acuityscheduling.com/pricing" },
    { name: "Square Appointments", category: "external", url: "https://squareup.com/us/en/appointments/pricing" },
    { name: "Fresha", category: "external", url: "https://www.fresha.com/for-business" },
  ];

  let created = 0;
  for (const s of seed) {
    const exists = await prisma.competitor.findFirst({ where: { url: s.url } });
    if (!exists) {
      await prisma.competitor.create({
        data: {
          name: s.name,
          url: s.url,
          category: (s as any).category ?? "shopify",
          appStoreHandle: (s as any).appStoreHandle ?? null,
        },
      });
      created++;
    }
  }
  return { created, total: seed.length };
}
