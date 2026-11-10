import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { useLoaderData, useActionData, Form, useNavigation } from "@remix-run/react";
import {
  Page,
  Layout,
  Card,
  Text,
  BlockStack,
  InlineStack,
  Button,
  Select,
  Banner,
  Divider,
  DataTable,
  EmptyState,
  Box,
} from "@shopify/polaris";
import { useState } from "react";
import { TitleBar } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { getOrCreateMerchant } from "../lib/merchant.server";
import { UncontrolledTextField } from "../components/FormFields";

export async function loader({ request }: LoaderFunctionArgs) {
  const { session, admin } = await authenticate.admin(request);
  const merchant = await getOrCreateMerchant(session.shop);

  const services = await prisma.service.findMany({
    where: { merchantId: merchant.id },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { staff: true, bookings: true } } },
  });

  // Fetch products from Shopify for the "convert product" flow
  const resp = await admin.graphql(
    `#graphql
    query Products($first: Int!) {
      products(first: $first, query: "status:active") {
        edges {
          node {
            id
            title
            variants(first: 1) {
              edges { node { id price } }
            }
          }
        }
      }
    }`,
    { variables: { first: 50 } },
  );
  const body = await resp.json();
  const edges: Array<{
    node: {
      id: string;
      title: string;
      variants: { edges: Array<{ node: { id: string; price: string } }> };
    };
  }> = body?.data?.products?.edges ?? [];

  const products = edges.map((edge) => ({
    id: edge.node.id,
    title: edge.node.title,
    price: edge.node.variants.edges[0]?.node.price ?? "0.00",
    variantId: edge.node.variants.edges[0]?.node.id ?? null,
  }));

  return json({
    currency: merchant.currency,
    services: services.map((s) => ({
      id: s.id,
      title: s.title,
      durationMin: s.durationMin,
      bufferMin: s.bufferMin,
      priceCents: s.priceCents,
      active: s.active,
      staffCount: s._count.staff,
      bookingCount: s._count.bookings,
    })),
    products,
  });
}

export async function action({ request }: ActionFunctionArgs) {
  const { session, admin } = await authenticate.admin(request);
  const merchant = await getOrCreateMerchant(session.shop);
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "create") {
    const shopifyProductId = String(formData.get("shopifyProductId") || "");
    const durationMin = Number(formData.get("durationMin") || 30);
    const bufferMin = Number(formData.get("bufferMin") || 0);

    if (!shopifyProductId.startsWith("gid://shopify/Product/")) {
      return json({ error: "Please choose a product." }, { status: 400 });
    }
    if (!Number.isFinite(durationMin) || durationMin < 5 || durationMin > 24 * 60) {
      return json({ error: "Duration must be between 5 and 1440 minutes." }, { status: 400 });
    }
    if (!Number.isFinite(bufferMin) || bufferMin < 0 || bufferMin > 24 * 60) {
      return json({ error: "Buffer must be between 0 and 1440 minutes." }, { status: 400 });
    }

    const existing = await prisma.service.findFirst({
      where: { merchantId: merchant.id, shopifyProductId },
    });
    if (existing) {
      return json({ error: "This product is already a bookable service." }, { status: 400 });
    }

    // Never trust the client for the title or price: read them back from
    // Shopify using the merchant's own admin session.
    const resp = await admin.graphql(
      `#graphql
      query ProductForService($id: ID!) {
        product(id: $id) {
          id
          title
          status
          variants(first: 1) {
            edges { node { id price } }
          }
        }
      }`,
      { variables: { id: shopifyProductId } },
    );
    const body = await resp.json();
    const product = body?.data?.product as
      | {
          id: string;
          title: string;
          status: string;
          variants: { edges: Array<{ node: { id: string; price: string } }> };
        }
      | null
      | undefined;

    if (!product) {
      return json({ error: "That product could not be found." }, { status: 400 });
    }

    const variant = product.variants.edges[0]?.node;

    await prisma.service.create({
      data: {
        merchantId: merchant.id,
        shopifyProductId: product.id,
        shopifyVariantId: variant?.id ?? null,
        title: product.title,
        durationMin,
        bufferMin,
        priceCents: Math.round(Number(variant?.price ?? 0) * 100),
        currency: merchant.currency,
      },
    });
    return redirect("/app/services");
  }

  if (intent === "toggle") {
    const id = String(formData.get("id"));
    const s = await prisma.service.findFirst({ where: { id, merchantId: merchant.id } });
    if (s) {
      await prisma.service.update({ where: { id }, data: { active: !s.active } });
    }
    return json({ ok: true });
  }

  return json({ error: "Unknown action" }, { status: 400 });
}

export default function Services() {
  const { services, products, currency } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const nav = useNavigation();
  const [showForm, setShowForm] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState("");

  const saving = nav.state === "submitting";
  const error = actionData && "error" in actionData ? actionData.error : null;

  return (
    <Page>
      <TitleBar title="Services" />
      <BlockStack gap="500">
        {error && <Banner tone="critical" title={error} />}
        <Layout>
          <Layout.Section>
            <Card>
              <BlockStack gap="400">
                <InlineStack align="space-between">
                  <Text as="h2" variant="headingMd">Bookable services</Text>
                  <Button variant="primary" onClick={() => setShowForm((v) => !v)}>
                    {showForm ? "Cancel" : "Add service"}
                  </Button>
                </InlineStack>

                {showForm && (
                  <Form method="post">
                    <input type="hidden" name="intent" value="create" />
                    <Box padding="400" borderColor="border" borderWidth="025" borderRadius="200">
                      <BlockStack gap="300">
                        <Select
                          label="Product"
                          name="shopifyProductId"
                          options={[
                            { label: "Select a product…", value: "" },
                            ...products.map((p) => ({ label: p.title, value: p.id })),
                          ]}
                          value={selectedProductId}
                          onChange={setSelectedProductId}
                        />
                        <InlineStack gap="300">
                          <UncontrolledTextField
                            name="durationMin"
                            label="Duration (min)"
                            type="number"
                            defaultValue="60"
                            autoComplete="off"
                          />
                          <UncontrolledTextField
                            name="bufferMin"
                            label="Buffer (min)"
                            type="number"
                            defaultValue="0"
                            helpText="Breathing room after each appointment."
                            autoComplete="off"
                          />
                        </InlineStack>
                        <InlineStack>
                          <Button submit variant="primary" loading={saving}>
                            Create service
                          </Button>
                        </InlineStack>
                      </BlockStack>
                    </Box>
                  </Form>
                )}

                <Divider />

                {services.length === 0 ? (
                  <EmptyState
                    heading="No services yet"
                    image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
                  >
                    <p>Convert one of your products into a bookable service.</p>
                  </EmptyState>
                ) : (
                  <DataTable
                    columnContentTypes={["text", "text", "text", "text", "text", "text"]}
                    headings={["Service", "Duration", "Buffer", "Price", "Staff", "Active"]}
                    rows={services.map((s) => [
                      s.title,
                      `${s.durationMin} min`,
                      `${s.bufferMin} min`,
                      `${currency} ${(s.priceCents / 100).toFixed(2)}`,
                      s.staffCount,
                      s.active ? "Yes" : "No",
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
