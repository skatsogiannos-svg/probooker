import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData, Form, useNavigation } from "@remix-run/react";
import {
  Page,
  Layout,
  Card,
  Text,
  BlockStack,
  InlineStack,
  DataTable,
  Badge,
  EmptyState,
  Button,
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { getOrCreateMerchant } from "../lib/merchant.server";
import { UncontrolledSelect } from "../components/FormFields";

const STATUSES = ["PENDING", "CONFIRMED", "COMPLETED", "NO_SHOW", "CANCELLED"] as const;
type BookingStatusValue = (typeof STATUSES)[number];

export async function loader({ request }: LoaderFunctionArgs) {
  const { session } = await authenticate.admin(request);
  const merchant = await getOrCreateMerchant(session.shop);

  const bookings = await prisma.booking.findMany({
    where: { merchantId: merchant.id },
    orderBy: { startsAt: "desc" },
    take: 200,
    include: { staff: true, service: true, customer: true },
  });

  return json({
    timezone: merchant.timezone,
    bookings: bookings.map((booking) => ({
      id: booking.id,
      startsAt: booking.startsAt.toISOString(),
      status: booking.status,
      staffName: booking.staff.name,
      serviceTitle: booking.service.title,
      customerName: booking.customer?.name ?? booking.customer?.email ?? "—",
      customerEmail: booking.customer?.email ?? null,
    })),
  });
}

export async function action({ request }: ActionFunctionArgs) {
  const { session } = await authenticate.admin(request);
  const merchant = await getOrCreateMerchant(session.shop);
  const formData = await request.formData();

  const id = String(formData.get("id") || "");
  const status = String(formData.get("status") || "");

  if (!id || !STATUSES.includes(status as BookingStatusValue)) {
    return json({ error: "Invalid booking or status." }, { status: 400 });
  }

  const booking = await prisma.booking.findFirst({
    where: { id, merchantId: merchant.id },
    select: { id: true },
  });
  if (!booking) {
    return json({ error: "Booking not found." }, { status: 404 });
  }

  await prisma.booking.update({
    where: { id },
    data: { status: status as BookingStatusValue },
  });

  return json({ ok: true });
}

const TONE: Record<string, "success" | "attention" | "critical" | "info"> = {
  CONFIRMED: "success",
  PENDING: "attention",
  CANCELLED: "critical",
  NO_SHOW: "critical",
  COMPLETED: "info",
  RESCHEDULED: "info",
};

export default function Bookings() {
  const { bookings, timezone } = useLoaderData<typeof loader>();
  const nav = useNavigation();
  const saving = nav.state === "submitting";

  return (
    <Page>
      <TitleBar title="Bookings" />
      <Layout>
        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <InlineStack align="space-between">
                <Text as="h2" variant="headingMd">
                  All bookings
                </Text>
                <Text as="span" variant="bodySm" tone="subdued">
                  Times shown in {timezone}
                </Text>
              </InlineStack>
              {bookings.length === 0 ? (
                <EmptyState
                  heading="No bookings yet"
                  image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
                >
                  <p>
                    Bookings will appear here once customers start booking through your widget.
                  </p>
                </EmptyState>
              ) : (
                <DataTable
                  columnContentTypes={["text", "text", "text", "text", "text", "text"]}
                  headings={["When", "Staff", "Service", "Customer", "Status", "Update"]}
                  rows={bookings.map((booking) => [
                    new Intl.DateTimeFormat("en-US", {
                      timeZone: timezone,
                      dateStyle: "medium",
                      timeStyle: "short",
                    }).format(new Date(booking.startsAt)),
                    booking.staffName,
                    booking.serviceTitle,
                    booking.customerName,
                    <Badge key="status" tone={TONE[booking.status] ?? "info"}>
                      {booking.status}
                    </Badge>,
                    <Form method="post" key="update">
                      <input type="hidden" name="id" value={booking.id} />
                      <InlineStack gap="100" blockAlign="center">
                        <UncontrolledSelect
                          label=""
                          labelHidden
                          name="status"
                          options={STATUSES.map((status) => ({
                            label: status.replace("_", " "),
                            value: status,
                          }))}
                          defaultValue={booking.status}
                        />
                        <Button submit size="slim" loading={saving}>
                          Save
                        </Button>
                      </InlineStack>
                    </Form>,
                  ])}
                />
              )}
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
