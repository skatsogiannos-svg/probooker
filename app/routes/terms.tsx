import type { MetaFunction } from "@remix-run/node";
import { AppProvider, Page, Card, Text, BlockStack, List } from "@shopify/polaris";
import en from "@shopify/polaris/locales/en.json";

export const meta: MetaFunction = () => [
  { title: "Terms of Service — ProBooker" },
  { name: "robots", content: "index,follow" },
];

const SUPPORT_EMAIL = "b2apps.dev@gmail.com";

/**
 * Public terms of service, suitable for the Partner Dashboard listing URL.
 */
export default function TermsOfService() {
  return (
    <AppProvider i18n={en}>
      <Page title="Terms of Service" narrowWidth>
        <BlockStack gap="400">
          <Card>
            <BlockStack gap="300">
              <Text as="p" tone="subdued">
                Last updated: 10 November 2026
              </Text>
              <Text as="p">
                These terms govern your use of ProBooker (“the app”),
                developed by B2, a Shopify app that adds staff-first
                appointment booking to a Shopify store. By installing the app you
                agree to these terms.
              </Text>
            </BlockStack>
          </Card>

          <Card>
            <BlockStack gap="300">
              <Text as="h2" variant="headingMd">
                The service
              </Text>
              <Text as="p">
                The app lets you publish bookable services, manage staff and
                their availability, and accept booking requests from your
                storefront. The storefront widget is delivered through a Shopify
                theme app extension.
              </Text>
              <Text as="p">
                The app does not process payments. If you charge for a booking,
                you do so through your own Shopify store and Shopify Checkout
                under Shopify’s terms.
              </Text>
            </BlockStack>
          </Card>

          <Card>
            <BlockStack gap="300">
              <Text as="h2" variant="headingMd">
                Plans and billing
              </Text>
              <List type="bullet">
                <List.Item>
                  The Free plan includes one staff seat and unlimited bookings.
                </List.Item>
                <List.Item>
                  Pro and Growth are recurring subscriptions billed through
                  Shopify. Prices and the number of included staff seats are
                  shown on the Plans page in the app.
                </List.Item>
                <List.Item>
                  Paid plans may include a free trial. You can cancel at any time
                  from Shopify Admin → Settings → App subscriptions; access
                  continues until the end of the paid period.
                </List.Item>
                <List.Item>
                  Charges are handled by Shopify and appear on your Shopify
                  invoice. Refunds are governed by Shopify’s policies and
                  applicable law.
                </List.Item>
              </List>
            </BlockStack>
          </Card>

          <Card>
            <BlockStack gap="300">
              <Text as="h2" variant="headingMd">
                Your responsibilities
              </Text>
              <List type="bullet">
                <List.Item>
                  Keep staff, services and availability accurate so customers
                  are not shown times you cannot honour.
                </List.Item>
                <List.Item>
                  Only collect and use customer data for legitimate booking and
                  communication purposes, and honour opt-outs.
                </List.Item>
                <List.Item>
                  Publish your own privacy policy and, where required, obtain
                  consent for marketing messages.
                </List.Item>
                <List.Item>
                  Do not use the app to send spam or unlawful content.
                </List.Item>
              </List>
            </BlockStack>
          </Card>

          <Card>
            <BlockStack gap="300">
              <Text as="h2" variant="headingMd">
                Availability and support
              </Text>
              <Text as="p">
                We aim to keep the app available but do not guarantee
                uninterrupted service. Planned maintenance and third-party
                outages may affect availability. Support is available at{" "}
                <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.
              </Text>
            </BlockStack>
          </Card>

          <Card>
            <BlockStack gap="300">
              <Text as="h2" variant="headingMd">
                Liability and termination
              </Text>
              <Text as="p">
                To the maximum extent permitted by law, the app is provided “as
                is” without warranties, and our aggregate liability is limited
                to the amount you paid for the app in the twelve months before
                the claim. You may stop using the app at any time by
                uninstalling it; we may suspend access for breach of these terms
                or misuse of the service.
              </Text>
              <Text as="p">
                These terms are governed by the laws applicable to the app
                provider. If any provision is unenforceable, the remaining
                provisions stay in effect.
              </Text>
            </BlockStack>
          </Card>
        </BlockStack>
      </Page>
    </AppProvider>
  );
}
