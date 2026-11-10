import type { ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import prisma from "../db.server";
import { computeDaySlots, localDateString } from "../lib/availability.server";
import { resolveStorefrontShop, storefrontHeaders } from "../lib/public.server";

/**
 * Create a booking from the storefront widget (through the app proxy).
 *
 * The slot is re-validated server-side and the write is serialized per staff
 * member with a Postgres advisory lock, so two customers can never grab the
 * same slot in a race.
 */

export const headers = () => storefrontHeaders;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function asTrimmedString(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, { status: 405 });
  }

  const shop = await resolveStorefrontShop(request);

  const raw = await request.text();
  let body: Record<string, unknown>;
  try {
    body = JSON.parse(raw);
  } catch {
    return json({ error: "Invalid JSON" }, { status: 400 });
  }

  const serviceId = asTrimmedString(body.serviceId, 64);
  const staffId = asTrimmedString(body.staffId, 64);
  const start = asTrimmedString(body.start, 64);
  const customerName = asTrimmedString(body.customerName, 100);
  const customerEmail = asTrimmedString(body.customerEmail, 254).toLowerCase();
  const consent = body.consent === true;

  if (!serviceId || !staffId || !start || !customerEmail) {
    return json({ error: "Missing required fields" }, { status: 400 });
  }
  if (!EMAIL_RE.test(customerEmail)) {
    return json({ error: "Please enter a valid email address." }, { status: 400 });
  }

  const merchant = await prisma.merchant.findUnique({ where: { shopDomain: shop } });
  if (!merchant) return json({ error: "Shop not found" }, { status: 404 });

  const service = await prisma.service.findFirst({
    where: { id: serviceId, merchantId: merchant.id, active: true },
    include: { staff: true },
  });
  if (!service) return json({ error: "Service not found" }, { status: 404 });

  const offeredByStaff = service.staff.some((staffService) => staffService.staffId === staffId);
  if (!offeredByStaff) {
    return json({ error: "This staff member does not offer that service." }, { status: 400 });
  }

  const startDate = new Date(start);
  if (isNaN(startDate.getTime())) {
    return json({ error: "Invalid start time" }, { status: 400 });
  }
  if (startDate.getTime() < Date.now() - 60_000) {
    return json({ error: "That time has already passed." }, { status: 400 });
  }

  const endDate = new Date(startDate.getTime() + service.durationMin * 60_000);
  const now = new Date();

  const booking = await prisma.$transaction(async (tx) => {
    // Serialize bookings for this staff member. Released when the tx commits.
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${staffId}))`;

    const dateStr = localDateString(startDate, merchant.timezone);
    const day = new Date(`${dateStr}T12:00:00Z`);

    const [windows, blackouts, bookings] = await Promise.all([
      tx.availability.findMany({ where: { staffId } }),
      tx.blackout.findMany({ where: { staffId } }),
      tx.booking.findMany({
        where: { staffId, status: { in: ["PENDING", "CONFIRMED"] } },
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
      granularityMin: 15,
      now,
    });

    const valid = slots.some(
      (slot) => slot.start.getTime() === startDate.getTime(),
    );
    if (!valid) return null;

    const customer = await tx.bookingCustomer.upsert({
      where: { merchantId_email: { merchantId: merchant.id, email: customerEmail } },
      update: {
        name: customerName || undefined,
        consentMarketing: consent ? true : undefined,
      },
      create: {
        merchantId: merchant.id,
        email: customerEmail,
        name: customerName || null,
        consentMarketing: consent,
      },
    });

    const created = await tx.booking.create({
      data: {
        merchantId: merchant.id,
        staffId,
        serviceId,
        customerId: customer.id,
        startsAt: startDate,
        endsAt: endDate,
        status: "PENDING",
        consentMarketing: consent,
      },
    });

    await tx.reminder.create({
      data: { bookingId: created.id, type: "CONFIRMATION", scheduledFor: now },
    });

    return created;
  });

  if (!booking) {
    return json({ error: "This slot is no longer available." }, { status: 409 });
  }

  const origin = (process.env.SHOPIFY_APP_URL || new URL(request.url).origin).replace(
    /\/$/,
    "",
  );

  return json({
    ok: true,
    bookingId: booking.id,
    manageToken: booking.rescheduleToken,
    // Absolute app URL so the link works from the storefront (the proxy path
    // itself only serves the API).
    manageUrl: `${origin}/booking/${booking.rescheduleToken}`,
  });
}
