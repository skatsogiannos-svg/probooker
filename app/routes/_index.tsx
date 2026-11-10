import type { LoaderFunctionArgs } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { Form, useLoaderData } from "@remix-run/react";
import {
  AppProvider,
  Page,
  Card,
  Text,
  BlockStack,
  InlineStack,
  Button,
  List,
  Divider,
} from "@shopify/polaris";
import en from "@shopify/polaris/locales/en.json";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);
  const shop = url.searchParams.get("shop");

  if (shop) {
    throw redirect(`/app?${url.searchParams.toString()}`);
  }

  return json({ ok: true });
};

export default function IndexLanding() {
  useLoaderData<typeof loader>();

  return (
    <AppProvider i18n={en}>
      <Page narrowWidth>
        <BlockStack gap="500">
          <Card>
            <BlockStack gap="400">
              <InlineStack align="space-between">
                <Text as="h1" variant="headingXl">
                  ProBooker
                </Text>
              </InlineStack>
              <Text as="p" variant="bodyLg" tone="subdued">
                Let your customers book the person, not just a slot.
              </Text>
              <Text as="p">
                A modern Shopify appointment-booking platform built around choosing a staff member first.
                Unlimited bookings and appointments on all plans — only staff seats are tiered.
              </Text>
              <Divider />
              <Form method="get" action="/auth/login">
                <BlockStack gap="300">
                  <Text as="h2" variant="headingMd">
                    Install or Log In to Your Store
                  </Text>
                  <Text as="p" tone="subdued">
                    Enter your Shopify store domain to get started or manage your appointments:
                  </Text>
                  <InlineStack gap="300">
                    <input
                      type="text"
                      name="shop"
                      placeholder="your-store.myshopify.com"
                      required
                      style={{
                        padding: "8px 12px",
                        border: "1px solid #d4d4d4",
                        borderRadius: "6px",
                        fontSize: "14px",
                        flex: 1,
                        minWidth: "260px",
                      }}
                    />
                    <Button submit variant="primary">
                      Open App
                    </Button>
                  </InlineStack>
                </BlockStack>
              </Form>
            </BlockStack>
          </Card>

          <Card>
            <BlockStack gap="300">
              <Text as="h2" variant="headingMd">
                Key Capabilities
              </Text>
              <List type="bullet">
                <List.Item>
                  <strong>Staff-First Experience:</strong> Let customers choose their favorite stylist, coach, consultant, or specialist.
                </List.Item>
                <List.Item>
                  <strong>Product to Service Conversion:</strong> Turn any existing Shopify product into a bookable appointment with custom duration and buffer time.
                </List.Item>
                <List.Item>
                  <strong>Storefront Theme Extension:</strong> Zero-code widget seamlessly embedded into your Online Store 2.0 theme.
                </List.Item>
                <List.Item>
                  <strong>Private Customer Self-Service:</strong> Instant reschedule or cancel via secure private links without requiring customer login.
                </List.Item>
                <List.Item>
                  <strong>Double-Booking Prevention:</strong> High-performance server concurrency locking guarantees no two clients can take the same slot.
                </List.Item>
              </List>
            </BlockStack>
          </Card>

          <Card>
            <InlineStack align="space-between">
              <Text as="p" tone="subdued">
                Developed by <strong>B2</strong> · Support:{" "}
                <a href="mailto:b2apps.dev@gmail.com">b2apps.dev@gmail.com</a>
              </Text>
              <InlineStack gap="300">
                <a href="/privacy" style={{ color: "#2c6ecb" }}>
                  Privacy Policy
                </a>
                <span>·</span>
                <a href="/terms" style={{ color: "#2c6ecb" }}>
                  Terms of Service
                </a>
              </InlineStack>
            </InlineStack>
          </Card>
        </BlockStack>
      </Page>
    </AppProvider>
  );
}
