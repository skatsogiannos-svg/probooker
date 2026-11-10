import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import {
  Page,
  Layout,
  Card,
  Text,
  BlockStack,
  DataTable,
  InlineStack,
  Badge,
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { getOrCreateMerchant } from "../lib/merchant.server";

export async function loader({ request }: LoaderFunctionArgs) {
  const { session } = await authenticate.admin(request);
  const merchant = await getOrCreateMerchant(session.shop);

  const since = new Date();
  since.setDate(since.getDate() - 30);

  const staff = await prisma.staff.findMany({
    where: { merchantId: merchant.id },
    include: {
      bookings: {
        where: { startsAt: { gte: since } },
        include: { service: true, customer: true },
      },
    },
  });

  const rows = staff.map((s) => {
    const active = s.bookings.filter((b) => ["CONFIRMED", "COMPLETED"].includes(b.status));
    const noShows = s.bookings.filter((b) => b.status === "NO_SHOW").length;
    const revenueCents = s.bookings
      .filter((b) => b.status === "COMPLETED")
      .reduce((sum, b) => sum + b.service.priceCents, 0);
    const uniqueCustomers = new Set(
      active.map((b) => b.customer?.id).filter(Boolean),
    ).size;
    const total = s.bookings.length || 1;
    return {
      id: s.id,
      name: s.name,
      bookings: active.length,
      noShowRate: Math.round((noShows / total) * 100),
      revenue: revenueCents / 100,
      uniqueCustomers,
    };
  });

  return json({ currency: merchant.currency, rows });
}

export default function Analytics() {
  const { currency, rows } = useLoaderData<typeof loader>();

  return (
    <Page>
      <TitleBar title="Staff Analytics" />
      <Layout>
        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <InlineStack align="space-between">
                <Text as="h2" variant="headingMd">Per-staff performance (last 30 days)</Text>
                <Badge tone="info">Last 30 days</Badge>
              </InlineStack>
              <Text as="p" tone="subdued">
                Bookings, no-show rate and repeat customers for each team member.
                Value is based on the price of completed services; the app does
                not process payments.
              </Text>
              <DataTable
                columnContentTypes={["text", "numeric", "numeric", "numeric", "numeric"]}
                headings={["Staff", "Bookings", "No-show rate", "Completed value", "Customers"]}
                rows={rows.map((r) => [
                  r.name,
                  r.bookings,
                  `${r.noShowRate}%`,
                  `${currency} ${r.revenue.toFixed(2)}`,
                  r.uniqueCustomers,
                ])}
              />
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
