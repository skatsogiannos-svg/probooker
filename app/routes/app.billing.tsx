import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData, Form, useNavigation } from "@remix-run/react";
import {
  Page,
  Layout,
  Card,
  Text,
  BlockStack,
  Button,
  InlineStack,
  Badge,
  Divider,
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import { authenticate, PRO_PLAN, GROWTH_PLAN } from "../shopify.server";
import prisma from "../db.server";
import { getOrCreateMerchant } from "../lib/merchant.server";
import { staffSeatLabel, STAFF_SEATS } from "../lib/plan";
import { billingIsTest } from "../lib/billing.server";

export async function loader({ request }: LoaderFunctionArgs) {
  const { session, billing } = await authenticate.admin(request);
  const merchant = await getOrCreateMerchant(session.shop);

  let plan = merchant.plan;
  try {
    const { hasActivePayment, appSubscriptions } = await billing.check({
      plans: [PRO_PLAN, GROWTH_PLAN],
      isTest: billingIsTest(),
    });

    const activeName = hasActivePayment ? appSubscriptions[0]?.name : undefined;
    const detected =
      activeName === GROWTH_PLAN ? "GROWTH" : activeName === PRO_PLAN ? "PRO" : "FREE";

    // Keep the database in sync with the source of truth (Shopify billing).
    if (detected !== plan) {
      plan = detected;
      await prisma.merchant.update({
        where: { id: merchant.id },
        data: { plan: detected },
      });
    }
  } catch (error) {
    console.error("[billing] Could not check subscriptions", error);
  }

  const staffUsed = await prisma.staff.count({ where: { merchantId: merchant.id } });

  return json({
    plan,
    staffUsed,
    hasActivePayment: plan !== "FREE",
    subscriptions: ([] as Array<{ name: string; id: string }>),
  });
}

export async function action({ request }: ActionFunctionArgs) {
  const { billing } = await authenticate.admin(request);
  const formData = await request.formData();
  const plan = String(formData.get("plan") || "");

  if (plan !== PRO_PLAN && plan !== GROWTH_PLAN) {
    return json({ error: "Unknown plan" }, { status: 400 });
  }

  // `billing.request` throws a redirect to the Shopify confirmation page
  // (top-level when embedded). Nothing after this line runs.
  await billing.request({
    plan,
    isTest: billingIsTest(),
    returnUrl: `${process.env.SHOPIFY_APP_URL || new URL(request.url).origin}/app/billing/confirm`,
  });

  return json({ ok: true });
}

const PLANS = [
  {
    key: "FREE",
    name: "Free",
    price: "$0",
    features: ["1 staff seat", "Unlimited bookings", "Staff-first storefront widget"],
  },
  {
    key: "PRO",
    name: "Pro",
    price: "$14.99 / mo",
    features: [
      "Everything in Free",
      "Up to 5 staff seats",
      "Unlimited bookings",
      "14-day free trial",
    ],
  },
  {
    key: "GROWTH",
    name: "Growth",
    price: "$29.99 / mo",
    features: [
      "Everything in Pro",
      "Unlimited staff seats",
      "Unlimited bookings",
      "14-day free trial",
    ],
  },
];

export default function Billing() {
  const { plan, staffUsed } = useLoaderData<typeof loader>();
  const nav = useNavigation();
  const saving = nav.state === "submitting";

  return (
    <Page>
      <TitleBar title="Plans" />
      <BlockStack gap="500">
        <Text as="h1" variant="headingLg">
          Choose a plan
        </Text>
        <Text as="p" tone="subdued">
          Fair pricing with no revenue or booking cliffs. Only staff seats are limited.
        </Text>
        <Text as="p" tone="subdued">
          You are using {staffUsed} of {staffSeatLabel(plan as "FREE" | "PRO" | "GROWTH")} staff
          seats on the {plan} plan.
        </Text>
        <Layout>
          {PLANS.map((p) => {
            const current = plan === p.key;
            return (
              <Layout.Section variant="oneThird" key={p.key}>
                <Card>
                  <BlockStack gap="300">
                    <InlineStack align="space-between">
                      <Text as="h2" variant="headingMd">
                        {p.name}
                      </Text>
                      {current && <Badge tone="success">Current</Badge>}
                    </InlineStack>
                    <Text as="p" variant="headingXl">
                      {p.price}
                    </Text>
                    <Divider />
                    <BlockStack gap="100">
                      {p.features.map((feature) => (
                        <Text as="span" variant="bodySm" key={feature}>
                          • {feature}
                        </Text>
                      ))}
                    </BlockStack>
                    {p.key !== "FREE" && !current && (
                      <Form method="post">
                        <input type="hidden" name="plan" value={p.name} />
                        <Button submit variant="primary" loading={saving}>
                          Choose {p.name}
                        </Button>
                      </Form>
                    )}
                    {p.key === "FREE" && !current && (
                      <Text as="p" tone="subdued" variant="bodySm">
                        Downgrade any time from the Shopify admin (App subscriptions).
                      </Text>
                    )}
                  </BlockStack>
                </Card>
              </Layout.Section>
            );
          })}
        </Layout>
        <Text as="p" tone="subdued" variant="bodySm">
          Seat limits: Free {STAFF_SEATS.FREE}, Pro {STAFF_SEATS.PRO}, Growth unlimited.
        </Text>
      </BlockStack>
    </Page>
  );
}
