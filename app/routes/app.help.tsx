import {
  Page,
  Layout,
  Card,
  Text,
  BlockStack,
  InlineStack,
  Badge,
  List,
  Divider,
  Banner,
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";

export default function HelpAndDocs() {
  return (
    <Page>
      <TitleBar title="Help & Documentation" />
      <BlockStack gap="500">
        <Banner title="App Store Review & Testing Guide" tone="info">
          <p>
            Welcome! This guide outlines the 3-step setup to test ProBooker on any Shopify store.
            Need immediate developer support? Reach us 24/7 at{" "}
            <strong>b2apps.dev@gmail.com</strong>.
          </p>
        </Banner>

        <Layout>
          <Layout.Section>
            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingLg">
                  Quick Start: 3-Step Setup
                </Text>
                <Divider />

                <BlockStack gap="300">
                  <InlineStack gap="200" align="start">
                    <Badge tone="info">Step 1</Badge>
                    <Text as="h3" variant="headingSm">
                      Create a Staff Member
                    </Text>
                  </InlineStack>
                  <Text as="p">
                    Go to <strong>Staff</strong> → Click <strong>Add staff</strong>. Enter the staff member's
                    name, title, bio, and weekly working hours (e.g., Monday–Friday 09:00–17:00). You can also
                    add specific blackout / time-off dates.
                  </Text>
                </BlockStack>

                <Divider />

                <BlockStack gap="300">
                  <InlineStack gap="200" align="start">
                    <Badge tone="info">Step 2</Badge>
                    <Text as="h3" variant="headingSm">
                      Turn a Product into a Bookable Service
                    </Text>
                  </InlineStack>
                  <Text as="p">
                    Go to <strong>Services</strong>. Select any existing Shopify product from your catalog.
                    Configure the appointment duration (e.g. 45 minutes) and optional buffer time between
                    appointments (e.g. 15 minutes). Assign which staff members can perform this service.
                  </Text>
                </BlockStack>

                <Divider />

                <BlockStack gap="300">
                  <InlineStack gap="200" align="start">
                    <Badge tone="info">Step 3</Badge>
                    <Text as="h3" variant="headingSm">
                      Add the Booking Widget to Your Online Store
                    </Text>
                  </InlineStack>
                  <Text as="p">
                    From your Shopify Admin, navigate to <strong>Online Store</strong> → <strong>Themes</strong> →
                    click <strong>Customize</strong> on your active theme:
                  </Text>
                  <List type="bullet">
                    <List.Item>
                      Open the <strong>Default product</strong> template (or whichever template applies to your bookable products).
                    </List.Item>
                    <List.Item>
                      In the Product Information section, click <strong>Add block</strong> and choose{" "}
                      <strong>Choose your staff (ProBooker)</strong> under Apps.
                    </List.Item>
                    <List.Item>
                      Click <strong>Save</strong> in the top right.
                    </List.Item>
                  </List>
                </BlockStack>
              </BlockStack>
            </Card>

            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingLg">
                  How ProBooker Works
                </Text>
                <Divider />

                <BlockStack gap="300">
                  <Text as="h3" variant="headingSm">
                    1. Choosing the Person, Not Just a Time
                  </Text>
                  <Text as="p">
                    Unlike traditional booking apps where staff is an afterthought or randomly assigned,
                    ProBooker presents the customer with your team members first. Customers see their
                    photo, bio, and specialty, then select their preferred specialist.
                  </Text>
                </BlockStack>

                <BlockStack gap="300">
                  <Text as="h3" variant="headingSm">
                    2. High-Performance Concurrency & Zero Double-Bookings
                  </Text>
                  <Text as="p">
                    The availability engine uses PostgreSQL advisory locks to guarantee atomic slot reservation.
                    Even if multiple clients attempt to book the exact same slot at the exact same millisecond,
                    only one booking is confirmed, completely eliminating double bookings.
                  </Text>
                </BlockStack>

                <BlockStack gap="300">
                  <Text as="h3" variant="headingSm">
                    3. Secure App Proxy Architecture
                  </Text>
                  <Text as="p">
                    All storefront requests are securely routed via Shopify's App Proxy (<code>/apps/booking/*</code>).
                    This maintains same-origin security, eliminates cross-origin cookie issues, and verifies Shopify HMAC
                    signatures on every request.
                  </Text>
                </BlockStack>

                <BlockStack gap="300">
                  <Text as="h3" variant="headingSm">
                    4. Self-Service Reschedule & Cancellation
                  </Text>
                  <Text as="p">
                    Upon completing a booking, the customer receives an on-screen confirmation with a unique,
                    tamper-proof secret link (e.g. <code>/booking/&lt;token&gt;</code>) allowing them to view, reschedule,
                    or cancel their appointment anytime without needing an account.
                  </Text>
                </BlockStack>
              </BlockStack>
            </Card>
          </Layout.Section>

          <Layout.Section variant="oneThird">
            <BlockStack gap="400">
              <Card>
                <BlockStack gap="300">
                  <Text as="h2" variant="headingMd">
                    Plan Overview
                  </Text>
                  <Text as="p" tone="subdued">
                    Bookings are always unlimited on every plan.
                  </Text>
                  <Divider />
                  <BlockStack gap="200">
                    <Text as="p">
                      <strong>Starter:</strong> $9.99 / month (14-day trial)
                      <br />
                      <span style={{ color: "#616161" }}>1 staff seat, unlimited bookings & revenue</span>
                    </Text>
                    <Text as="p">
                      <strong>Growth:</strong> $19.99 / month (14-day trial)
                      <br />
                      <span style={{ color: "#616161" }}>Up to 5 staff seats, custom intake, analytics</span>
                    </Text>
                    <Text as="p">
                      <strong>Scale:</strong> $39.99 / month (14-day trial)
                      <br />
                      <span style={{ color: "#616161" }}>Unlimited staff seats, No-Shield, priority support</span>
                    </Text>
                  </BlockStack>
                </BlockStack>
              </Card>

              <Card>
                <BlockStack gap="300">
                  <Text as="h2" variant="headingMd">
                    Developer & Support Contact
                  </Text>
                  <Text as="p">
                    Developed by <strong>B2</strong>
                  </Text>
                  <Text as="p">
                    Email:{" "}
                    <a href="mailto:b2apps.dev@gmail.com" style={{ color: "#2c6ecb" }}>
                      b2apps.dev@gmail.com
                    </a>
                  </Text>
                  <Text as="p" tone="subdued">
                    Response time: within 24 hours (usually under 2 hours).
                  </Text>
                </BlockStack>
              </Card>

              <Card>
                <BlockStack gap="200">
                  <Text as="h2" variant="headingMd">
                    Legal & Compliance
                  </Text>
                  <p>
                    <a href="/privacy" target="_blank" rel="noopener noreferrer" style={{ color: "#2c6ecb" }}>
                      Privacy Policy ↗
                    </a>
                  </p>
                  <p>
                    <a href="/terms" target="_blank" rel="noopener noreferrer" style={{ color: "#2c6ecb" }}>
                      Terms of Service ↗
                    </a>
                  </p>
                </BlockStack>
              </Card>
            </BlockStack>
          </Layout.Section>
        </Layout>
      </BlockStack>
    </Page>
  );
}
