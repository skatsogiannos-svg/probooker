import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { crawlAll, seedCompetitors } from "../lib/competitors/crawl.server";

/**
 * Competitor crawl endpoint — meant to be triggered by a scheduler
 * (Vercel Cron, GitHub Action, cron-job.org, Uptime Robot, etc.).
 *
 *   GET  /api/competitors/crawl?secret=CRON_SECRET          → status
 *   POST /api/competitors/crawl?secret=CRON_SECRET          → run crawl of all
 *   POST /api/competitors/crawl?secret=CRON_SECRET&seed=1   → seed + crawl
 *
 * Protect with COMPETITOR_CRON_SECRET env var. If unset, only allow GET status
 * in development (never expose an open crawler in production).
 */
function authorize(request: Request): Response | null {
  const url = new URL(request.url);
  const secret = process.env.COMPETITOR_CRON_SECRET;
  const provided = url.searchParams.get("secret");

  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      return json({ error: "Cron secret not configured" }, { status: 500 });
    }
    return null; // dev: allow
  }
  if (provided !== secret) {
    return json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}

export async function loader({ request }: LoaderFunctionArgs) {
  const deny = authorize(request);
  if (deny) return deny;
  return json({
    ok: true,
    hint: "POST to this URL (with ?secret=) to run a crawl.",
  });
}

export async function action({ request }: ActionFunctionArgs) {
  const deny = authorize(request);
  if (deny) return deny;
  if (request.method !== "POST") {
    return json({ error: "Use POST" }, { status: 405 });
  }

  const url = new URL(request.url);
  try {
    let seeded = null;
    if (url.searchParams.get("seed") === "1") {
      seeded = await seedCompetitors();
    }
    const results = await crawlAll();
    const totalChanges = results.reduce(
      (n, r) => n + (typeof (r as any).changes === "number" ? (r as any).changes : 0),
      0,
    );
    return json({ ok: true, seeded, crawled: results.length, totalChanges, results });
  } catch (err) {
    return json({ error: (err as Error).message }, { status: 500 });
  }
}
