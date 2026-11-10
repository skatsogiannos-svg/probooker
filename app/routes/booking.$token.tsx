import type { ActionFunctionArgs, LoaderFunctionArgs, MetaFunction } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { useLoaderData, Form, useNavigation } from "@remix-run/react";
import {
  AppProvider,
  Page,
  Layout,
  Card,
  Text,
  BlockStack,
  InlineStack,
  Button,
  Badge,
  Banner,
  Divider,
} from "@shopify/polaris";
import en from "@shopify/polaris/locales/en.json";
import { computeDaySlots, localDateString } from "../lib/availability.server";
import prisma from "../db.server";
import { UncontrolledSelect } from "../components/FormFields";

/**
 * Public self-service page for a booking, addressed by its unguessable
 * `rescheduleToken`. Customers can cancel or move the appointment without an
 * account. No Shopify auth: the token is the capability.
 */

const ACTIVE_STATUSES = ["PENDING", "CONFIRMED"];

export const meta: MetaFunction = () => [
  { title: "Your booking" },
  { name: "robots", content: "noindex,nofollow" },
];

function dateKeyInTimezone(date: Date, timezone: string): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const pick = (type: string) => parts.find((part) => part.type === type)?.value ?? "00";
  return `${pick("year")}-${pick("month")}-${pick("day")}`;
}

function humanDate(date: Date, timezone: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    dateStyle: "full",
    timeStyle: "short",
  }).format(date);
}

export async function loader({ request, params }: LoaderFunctionArgs) {
  const token = params.token;
  if (!token) throw new Response("Not found", { status: 404 });

  const booking = await prisma.booking.findUnique({
    where: { rescheduleToken: token },
    include: { merchant: true, staff: true, service: true, customer: true },
  });

  if (!booking) {
    return json({ found: false as const });
  }

  const url = new URL(request.url);
  const done = url.searchParams.get("done");
  const now = new Date();

  const canModify =
    ACTIVE_STATUSES.includes(booking.status) && booking.startsAt.getTime() > now.getTime();

  // Build the next 21 selectable days in the merchant timezone.
  const days: Array<{ value: string; label: string }> = [];
  for (let offset = 0; offset < 21; offset += 1) {
    const date = new Date(now.getTime() + offset * 86_400_000);
    const key = dateKeyInTimezone(date, booking.merchant.timezone);
    days.push({
      value: key,
      label: new Intl.DateTimeFormat("en-US", {
        timeZone: booking.merchant.timezone,
        weekday: "short",
        month: "short",
        day: "numeric",
      }).format(date),
    });
  }

  const selectedDate =
    url.searchParams.get("date") ??
    dateKeyInTimezone(booking.startsAt, booking.merchant.timezone);

  let slots: Array<{ start: string }> = [];
  if (canModify && /^\d{4}-\d{2}-\d{2}$/.test(selectedDate)) {
    const day = new Date(`${selectedDate}T12:00:00Z`);
    const [windows, blackouts, existing] = await Promise.all([
      prisma.availability.findMany({ where: { staffId: booking.staffId } }),
      prisma.blackout.findMany({ where: { staffId: booking.staffId } }),
      prisma.booking.findMany({
        where: {
          staffId: booking.staffId,
          status: { in: ["PENDING", "CONFIRMED"] },
          startsAt: {
            gte: new Date(day.getTime() - 36 * 3600_000),
            lte: new Date(day.getTime() + 36 * 3600_000),
          },
        },
        select: { id: true, startsAt: true, endsAt: true },
      }),
    ]);

    const isBlackout = blackouts.some(
      (blackout) => blackout.date.toISOString().slice(0, 10) === selectedDate,
    );

    slots = computeDaySlots({
      day,
      timezone: booking.merchant.timezone,
      durationMin: booking.service.durationMin,
      bufferMin: booking.service.bufferMin,
      windows,
      bookings: existing.filter((item) => item.id !== booking.id),
      blackout: isBlackout,
      granularityMin: 15,
      now,
    }).map((slot) => ({ start: slot.start.toISOString() }));
  }

  return json({
    found: true as const,
    done,
    canModify,
    when: humanDate(booking.startsAt, booking.merchant.timezone),
    timezone: booking.merchant.timezone,
    status: booking.status,
    serviceTitle: booking.service.title,
    durationMin: booking.service.durationMin,
    priceCents: booking.service.priceCents,
    currency: booking.merchant.currency,
    staffName: booking.staff.name,
    customerEmail: booking.customer?.email ?? null,
    days,
    selectedDate,
    slots,
  });
}

export async function action({ request, params }: ActionFunctionArgs) {
  const token = params.token;
  if (!token) throw new Response("Not found", { status: 404 });

  const booking = await prisma.booking.findUnique({
    where: { rescheduleToken: token },
    include: { merchant: true, service: true },
  });
  if (!booking) throw new Response("Not found", { status: 404 });

  const formData = await request.formData();
  const intent = String(formData.get("intent") || "");
  const now = new Date();

  const canModify =
    ACTIVE_STATUSES.includes(booking.status) && booking.startsAt.getTime() > now.getTime();
  if (!canModify) {
    return json({ error: "This booking can no longer be changed." }, { status: 400 });
  }

  if (intent === "cancel") {
    await prisma.booking.update({
      where: { id: booking.id },
      data: { status: "CANCELLED" },
    });
    return redirect(`/booking/${token}?done=cancelled`);
  }

  if (intent === "reschedule") {
    const start = String(formData.get("start") || "");
    const startDate = new Date(start);
    if (isNaN(startDate.getTime()) || startDate.getTime() < now.getTime()) {
      return json({ error: "Choose a valid time." }, { status: 400 });
    }

    const endDate = new Date(startDate.getTime() + booking.service.durationMin * 60_000);

    const moved = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${booking.staffId}))`;

      const [windows, blackouts, existing] = await Promise.all([
        tx.availability.findMany({ where: { staffId: booking.staffId } }),
        tx.blackout.findMany({ where: { staffId: booking.staffId } }),
        tx.booking.findMany({
          where: {
            staffId: booking.staffId,
            status: { in: ["PENDING", "CONFIRMED"] },
          },
          select: { id: true, startsAt: true, endsAt: true },
        }),
      ]);

      const dateStr = localDateString(startDate, booking.merchant.timezone);
      const day = new Date(`${dateStr}T12:00:00Z`);
      const isBlackout = blackouts.some(
        (blackout) => blackout.date.toISOString().slice(0, 10) === dateStr,
      );

      const slots = computeDaySlots({
        day,
        timezone: booking.merchant.timezone,
        durationMin: booking.service.durationMin,
        bufferMin: booking.service.bufferMin,
        windows,
        bookings: existing.filter((item) => item.id !== booking.id),
        blackout: isBlackout,
        granularityMin: 15,
        now,
      });

      const valid = slots.some((slot) => slot.start.getTime() === startDate.getTime());
      if (!valid) return false;

      await tx.booking.update({
        where: { id: booking.id },
        data: { startsAt: startDate, endsAt: endDate },
      });
      return true;
    });

    if (!moved) {
      return json({ error: "That time is no longer available." }, { status: 409 });
    }
    return redirect(`/booking/${token}?done=rescheduled`);
  }

  return json({ error: "Unknown action" }, { status: 400 });
}

function BookingPage() {
  const data = useLoaderData<typeof loader>();
  const nav = useNavigation();
  const saving = nav.state === "submitting";

  if (!data.found) {
    return (
      <Page title="Booking not found">
        <Card>
          <Text as="p">
            We couldn&apos;t find that booking. Double-check the link, or contact the store
            directly if you need help with your appointment.
          </Text>
        </Card>
      </Page>
    );
  }

  return (
    <Page title="Your booking">
      <Layout>
        <Layout.Section>
          <BlockStack gap="400">
            {data.done === "cancelled" && (
              <Banner tone="success" title="Your booking has been cancelled." />
            )}
            {data.done === "rescheduled" && (
              <Banner tone="success" title="Your booking has been moved." />
            )}

            <Card>
              <BlockStack gap="300">
                <InlineStack align="space-between">
                  <Text as="h2" variant="headingMd">
                    {data.serviceTitle}
                  </Text>
                  <Badge
                    tone={
                      data.status === "CANCELLED"
                        ? "critical"
                        : data.status === "COMPLETED"
                          ? "info"
                          : "success"
                    }
                  >
                    {data.status}
                  </Badge>
                </InlineStack>
                <Text as="p">
                  <strong>{data.when}</strong> ({data.timezone})
                </Text>
                <Text as="p" tone="subdued">
                  With {data.staffName} · {data.durationMin} minutes
                  {data.priceCents > 0
                    ? ` · ${data.currency} ${(data.priceCents / 100).toFixed(2)}`
                    : ""}
                </Text>
                {data.priceCents > 0 && (
                  <Text as="p" tone="subdued" variant="bodySm">
                    Payment for the service is arranged directly with the store.
                  </Text>
                )}
                {data.customerEmail && (
                  <Text as="p" tone="subdued">
                    Booked for {data.customerEmail}
                  </Text>
                )}
              </BlockStack>
            </Card>

            {!data.canModify && (
              <Banner tone="info" title="This booking can no longer be changed online.">
                <p>Contact the store if you need help with this appointment.</p>
              </Banner>
            )}

            {data.canModify && (
              <>
                <Card>
                  <BlockStack gap="300">
                    <Text as="h2" variant="headingMd">
                      Move to another time
                    </Text>
                    <Form method="get">
                      <InlineStack gap="300" blockAlign="end">
                        <UncontrolledSelect
                          label="Date"
                          name="date"
                          options={data.days}
                          defaultValue={data.selectedDate}
                        />
                        <Button submit>Show times</Button>
                      </InlineStack>
                    </Form>
                    <Divider />
                    {data.slots.length === 0 ? (
                      <Text as="p" tone="subdued">
                        No open times on that day. Try another date.
                      </Text>
                    ) : (
                      <div
                        style={{
                          display: "flex",
                          flexWrap: "wrap",
                          gap: 8,
                        }}
                      >
                        {data.slots.map((slot) => (
                          <Form method="post" key={slot.start}>
                            <input type="hidden" name="intent" value="reschedule" />
                            <input type="hidden" name="start" value={slot.start} />
                            <Button submit size="slim" loading={saving}>
                              {new Intl.DateTimeFormat("en-US", {
                                timeZone: data.timezone,
                                hour: "numeric",
                                minute: "2-digit",
                              }).format(new Date(slot.start))}
                            </Button>
                          </Form>
                        ))}
                      </div>
                    )}
                  </BlockStack>
                </Card>

                <Card>
                  <BlockStack gap="300">
                    <Text as="h2" variant="headingMd">
                      Cancel this booking
                    </Text>
                    <Text as="p" tone="subdued">
                      This frees the slot for someone else and can&apos;t be undone.
                    </Text>
                    <Form method="post">
                      <input type="hidden" name="intent" value="cancel" />
                      <Button submit tone="critical" loading={saving}>
                        Cancel booking
                      </Button>
                    </Form>
                  </BlockStack>
                </Card>
              </>
            )}
          </BlockStack>
        </Layout.Section>
      </Layout>
    </Page>
  );
}

export default function BookingRoute() {
  return (
    <AppProvider i18n={en}>
      <BookingPage />
    </AppProvider>
  );
}
