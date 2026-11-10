import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import prisma from "../db.server";
import { computeDaySlots, mergeSlotsByStart } from "../lib/availability.server";
import { resolveStorefrontShop, storefrontHeaders } from "../lib/public.server";

/**
 * Public availability API consumed by the storefront widget through the
 * Shopify App Proxy (`/apps/booking/api/availability`).
 *
 * Query params:
 *   product  — Shopify product id (numeric) or GID (required)
 *   date     — YYYY-MM-DD in the merchant timezone (required)
 *   staffId  — optional; omit for the merged "any available" timeline
 *
 * `shop` is added by Shopify when the request comes through the app proxy.
 */

export const headers = () => storefrontHeaders;

function parseProductId(input: string): string {
  // Accept gid://shopify/Product/123 or 123 → "123"
  const match = input.match(/(\d+)\s*$/);
  return match ? match[1] : input;
}

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const shop = await resolveStorefrontShop(request);
  const productRaw = url.searchParams.get("product");
  const dateStr = url.searchParams.get("date");
  const staffId = url.searchParams.get("staffId") || null;

  if (!productRaw || !dateStr) {
    return json({ error: "Missing product or date" }, { status: 400 });
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return json({ error: "Invalid date" }, { status: 400 });
  }

  const merchant = await prisma.merchant.findUnique({ where: { shopDomain: shop } });
  if (!merchant) {
    return json({ slots: [], staff: [] }, { status: 200 });
  }

  const productId = parseProductId(productRaw);
  const service = await prisma.service.findFirst({
    where: {
      merchantId: merchant.id,
      active: true,
      OR: [
        { shopifyProductId: productRaw },
        { shopifyProductId: productId },
        { shopifyProductId: { endsWith: `/${productId}` } },
      ],
    },
    include: { staff: { include: { staff: true } } },
  });

  if (!service) {
    return json({ slots: [], staff: [] }, { status: 200 });
  }

  // Noon UTC is a safe anchor for merchant-local date math.
  const day = new Date(`${dateStr}T12:00:00Z`);
  if (isNaN(day.getTime())) {
    return json({ error: "Invalid date" }, { status: 400 });
  }

  const eligibleStaff = service.staff
    .map((staffService) => staffService.staff)
    .filter((staff) => staff.active && (!staffId || staff.id === staffId));

  const perStaff: Array<{ staffId: string; slots: ReturnType<typeof computeDaySlots> }> = [];

  for (const staff of eligibleStaff) {
    const [windows, blackouts, bookings] = await Promise.all([
      prisma.availability.findMany({ where: { staffId: staff.id } }),
      prisma.blackout.findMany({ where: { staffId: staff.id } }),
      prisma.booking.findMany({
        where: {
          staffId: staff.id,
          status: { in: ["PENDING", "CONFIRMED"] },
          startsAt: {
            gte: new Date(day.getTime() - 36 * 3600_000),
            lte: new Date(day.getTime() + 36 * 3600_000),
          },
        },
        select: { startsAt: true, endsAt: true },
      }),
    ]);

    const isBlackout = blackouts.some(
      (blackout) => blackout.date.toISOString().slice(0, 10) === dateStr,
    );

    const slots = computeDaySlots({
      day,
      timezone: merchant.timezone,
      durationMin: service.durationMin,
      bufferMin: service.bufferMin,
      windows,
      bookings,
      blackout: isBlackout,
      minLeadMinutes: 0,
      granularityMin: 15,
    });

    perStaff.push({ staffId: staff.id, slots });
  }

  const merged = mergeSlotsByStart(perStaff);
  const staffProfiles = eligibleStaff.map((staff) => ({
    id: staff.id,
    name: staff.name,
    photoUrl: staff.photoUrl,
    bio: staff.bio,
    specialties: staff.specialties,
  }));

  return json({
    service: {
      id: service.id,
      title: service.title,
      durationMin: service.durationMin,
      priceCents: service.priceCents,
      currency: service.currency,
    },
    staff: staffProfiles,
    slots: merged.map((slot) => ({
      start: slot.start.toISOString(),
      end: slot.end.toISOString(),
      staffIds: slot.staffIds,
    })),
  });
}
