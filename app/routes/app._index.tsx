import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import {
  Page,
  Layout,
  Card,
  Text,
  BlockStack,
  InlineStack,
  Badge,
  EmptyState,
  DataTable,
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { startOfDayInTimezone, startOfNextDayInTimezone } from "../lib/time.server";

export async function loader({ request }: LoaderFunctionArgs) {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;

  const merchant = await prisma.merchant.upsert({
    where: { shopDomain: shop },
    update: {},
    create: { shopDomain: shop },
  });

  const now = new Date();
  const startOfDay = startOfDayInTimezone(now, merchant.timezone);
  const startOfNextDay = startOfNextDayInTimezone(now, merchant.timezone);

  const [staffCount, serviceCount, todayBookings, upcoming] = await Promise.all([
    prisma.staff.count({ where: { merchantId: merchant.id, active: true } }),
    prisma.service.count({ where: { merchantId: merchant.id, active: true } }),
    prisma.booking.count({
      where: {
        merchantId: merchant.id,
        startsAt: { gte: startOfDay, lt: startOfNextDay },
        status: { in: ["PENDING", "CONFIRMED"] },
      },
    }),
    prisma.booking.findMany({
      where: {
        merchantId: merchant.id,
        startsAt: { gte: now },
        status: { in: ["PENDING", "CONFIRMED"] },
      },
      orderBy: { startsAt: "asc" },
      take: 5,
      include: { staff: true, service: true },
    }),
  ]);

  return json({
    merchant: { plan: merchant.plan, timezone: merchant.timezone },
    staffCount,
    serviceCount,
    todayBookings,
    upcoming: upcoming.map((b) => ({
      id: b.id,
      startsAt: b.startsAt.toISOString(),
      staffName: b.staff.name,
      serviceTitle: b.service.title,
      status: b.status,
    })),
  });
}

export default function Dashboard() {
  const { merchant, staffCount, serviceCount, todayBookings, upcoming } =
    useLoaderData<typeof loader>();

  const setupDone = staffCount > 0 && serviceCount > 0;

  return (
    <Page>
      <TitleBar title="ProBooker" />
      <BlockStack gap="500">
        <Layout>
          <Layout.Section>
            <Card>
              <BlockStack gap="300">
                <InlineStack align="space-between">
                  <Text as="h1" variant="headingLg">
                    Welcome
                  </Text>
                  <Badge tone={merchant.plan === "FREE" ? "attention" : "success"}>
                    {`${merchant.plan} plan`}
                  </Badge>
                </InlineStack>
                <Text as="p" tone="subdued">
                  Let customers book the person, not just a slot.
                </Text>
                {!setupDone && (
                  <EmptyState
                    heading="Set up your first staff + service"
                    image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
                    action={{
                      content: "Add staff",
                      url: "/app/staff",
                    }}
                  >
                    <p>
                      Add at least one staff member and turn a product into a
                      bookable service. Then embed the widget on your product page.
                    </p>
                  </EmptyState>
                )}
              </BlockStack>
            </Card>
          </Layout.Section>

          <Layout.Section>
            <InlineStack gap="400" wrap={false}>
              <Card>
                <BlockStack gap="200">
                  <Text as="p" variant="headingSm" tone="subdued">Today&apos;s bookings</Text>
                  <Text as="p" variant="heading2xl">{todayBookings}</Text>
                </BlockStack>
              </Card>
              <Card>
                <BlockStack gap="200">
                  <Text as="p" variant="headingSm" tone="subdued">Active staff</Text>
                  <Text as="p" variant="heading2xl">{staffCount}</Text>
                </BlockStack>
              </Card>
              <Card>
                <BlockStack gap="200">
                  <Text as="p" variant="headingSm" tone="subdued">Services</Text>
                  <Text as="p" variant="heading2xl">{serviceCount}</Text>
                </BlockStack>
              </Card>
            </InlineStack>
          </Layout.Section>

          <Layout.Section>
            <Card>
              <BlockStack gap="300">
                <Text as="h2" variant="headingMd">Upcoming bookings</Text>
                {upcoming.length === 0 ? (
                  <Text as="p" tone="subdued">No upcoming bookings yet.</Text>
                ) : (
                  <DataTable
                    columnContentTypes={["text", "text", "text", "text"]}
                    headings={["When", "Staff", "Service", "Status"]}
                    rows={upcoming.map((b) => [
                      new Intl.DateTimeFormat("en-US", {
                        timeZone: merchant.timezone,
                        dateStyle: "medium",
                        timeStyle: "short",
                      }).format(new Date(b.startsAt)),
                      b.staffName,
                      b.serviceTitle,
                      b.status,
                    ])}
                  />
                )}
              </BlockStack>
            </Card>
          </Layout.Section>
        </Layout>
      </BlockStack>
    </Page>
  );
}
