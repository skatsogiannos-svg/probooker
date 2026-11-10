import type { MetaFunction } from "@remix-run/node";
import { AppProvider, Page, Card, Text, BlockStack, List } from "@shopify/polaris";
import en from "@shopify/polaris/locales/en.json";

export const meta: MetaFunction = () => [
  { title: "Privacy Policy — ProBooker" },
  { name: "robots", content: "index,follow" },
];

const SUPPORT_EMAIL = "b2apps.dev@gmail.com";

/**
 * Public privacy policy. App Store review requires a reachable privacy policy
 * URL; host this route at https://<your-app-domain>/privacy and paste that URL
 * into the Partner Dashboard listing.
 */
export default function PrivacyPolicy() {
  return (
    <AppProvider i18n={en}>
      <Page title="Privacy Policy" narrowWidth>
        <BlockStack gap="400">
          <Card>
            <BlockStack gap="300">
              <Text as="p" tone="subdued">
                Last updated: 10 November 2026
              </Text>
              <Text as="p">
                ProBooker (“the app”, “we”), developed by B2, is a
                Shopify app that lets merchants publish bookable services and
                lets their customers choose a staff member and an appointment
                time. This policy explains what the app stores and why.
              </Text>
            </BlockStack>
          </Card>

          <Card>
            <BlockStack gap="300">
              <Text as="h2" variant="headingMd">
                Data we process
              </Text>
              <List type="bullet">
                <List.Item>
                  <strong>Merchant data:</strong> shop domain, Shopify session
                  tokens (needed to call the Admin API on the merchant&apos;s
                  behalf), timezone, currency, plan and billing status.
                </List.Item>
                <List.Item>
                  <strong>Configuration data:</strong> staff profiles, weekly
                  availability, time off, and the services (products) a merchant
                  makes bookable.
                </List.Item>
                <List.Item>
                  <strong>Booking data:</strong> customer name, email address,
                  optional phone number, the chosen service, staff member and
                  time.
                </List.Item>
                <List.Item>
                  <strong>Product data:</strong> product ID, title and price of
                  products the merchant converts into bookable services.
                </List.Item>
              </List>
              <Text as="p">
                We do not receive or store payment card details. If the merchant
                charges for an appointment, payment is arranged directly with the
                merchant outside this app.
              </Text>
            </BlockStack>
          </Card>

          <Card>
            <BlockStack gap="300">
              <Text as="h2" variant="headingMd">
                Why we process it
              </Text>
              <List type="bullet">
                <List.Item>To display availability and create bookings.</List.Item>
                <List.Item>
                  To let customers cancel or reschedule through a private link.
                </List.Item>
                <List.Item>
                  To show the merchant their bookings, staff and basic analytics.
                </List.Item>
                <List.Item>
                  To let the merchant view bookings and contact the customer
                  about the appointment they requested.
                </List.Item>
                <List.Item>
                  To enforce plan seat limits and keep billing status in sync.
                </List.Item>
              </List>
              <Text as="p">
                The app does not send marketing email or SMS. It also does not
                send automated booking confirmation or reminder messages in the
                current version: the customer sees the booking details and a
                private manage link on screen after booking.
              </Text>
            </BlockStack>
          </Card>

          <Card>
            <BlockStack gap="300">
              <Text as="h2" variant="headingMd">
                Sharing and retention
              </Text>
              <Text as="p">
                We do not sell personal data. Data is shared only with the
                infrastructure providers needed to run the app (hosting and a
                managed PostgreSQL database) and with Shopify as required to
                operate the app.
              </Text>
              <Text as="p">
                Booking and customer records are kept while the merchant uses the
                app. When the app is uninstalled, sessions are deleted
                immediately. Forty-eight hours later Shopify sends a
                <code> shop/redact </code>
                webhook and we delete all remaining merchant data, including
                bookings and customers.
              </Text>
            </BlockStack>
          </Card>

          <Card>
            <BlockStack gap="300">
              <Text as="h2" variant="headingMd">
                Your rights
              </Text>
              <Text as="p">
                Customers may request access to, correction of, or deletion of
                their personal data through the merchant they booked with. We
                support Shopify’s mandatory GDPR webhooks
                (<code>customers/data_request</code>, <code>customers/redact</code>,
                <code> shop/redact</code>) so those requests can be fulfilled.
              </Text>
              <Text as="p">
                Questions about this policy or a data request can be sent to{" "}
                <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.
              </Text>
            </BlockStack>
          </Card>

          <Card>
            <BlockStack gap="300">
              <Text as="h2" variant="headingMd">
                Changes
              </Text>
              <Text as="p">
                We may update this policy as the app changes. Material changes
                will be announced in the app.
              </Text>
            </BlockStack>
          </Card>
        </BlockStack>
      </Page>
    </AppProvider>
  );
}
