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
  Banner,
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import { authenticate, STARTER_PLAN, GROWTH_PLAN, SCALE_PLAN } from "../shopify.server";
import prisma from "../db.server";
import { getOrCreateMerchant } from "../lib/merchant.server";
import { staffSeatLabel, STAFF_SEATS, type Plan } from "../lib/plan";
import { billingIsTest } from "../lib/billing.server";

export async function loader({ request }: LoaderFunctionArgs) {
  const { session, billing } = await authenticate.admin(request);
  const merchant = await getOrCreateMerchant(session.shop);

  let plan = merchant.plan;
  try {
    const { hasActivePayment, appSubscriptions } = await billing.check({
      plans: [STARTER_PLAN, GROWTH_PLAN, SCALE_PLAN],
      isTest: billingIsTest(),
    });

    const activeName = hasActivePayment ? appSubscriptions[0]?.name : undefined;
    const detected: Plan =
      activeName === SCALE_PLAN
        ? "SCALE"
        : activeName === GROWTH_PLAN
          ? "GROWTH"
          : activeName === STARTER_PLAN
            ? "STARTER"
            : "FREE";

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

  if (plan !== STARTER_PLAN && plan !== GROWTH_PLAN && plan !== SCALE_PLAN) {
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
    key: "STARTER",
    name: "Starter",
    price: "$9.99 / mo",
    description: "Ideal for solo practitioners & individual specialists.",
    popular: false,
    features: [
      "1 Staff seat",
      "Unlimited bookings & revenue",
      "Staff-first storefront widget",
      "Customer self-service links",
      "14-day free trial",
    ],
  },
  {
    key: "GROWTH",
    name: "Growth",
    price: "$19.99 / mo",
    description: "Best for growing studios, salons, and practices.",
    popular: true,
    features: [
      "Everything in Starter",
      "Up to 5 Staff seats",
      "Custom intake questions",
      "Staff performance analytics",
      "Priority email reminders",
      "14-day free trial",
    ],
  },
  {
    key: "SCALE",
    name: "Scale",
    price: "$39.99 / mo",
    description: "For busy clinics, barbershops, and multi-staff teams.",
    popular: false,
    features: [
      "Everything in Growth",
      "Unlimited Staff seats",
      "No-Shield (no-show & waitlist auto-fill)",
      "Resource & chair collision detection",
      "24/7 Priority developer support",
      "14-day free trial",
    ],
  },
];

export default function Billing() {
  const { plan, staffUsed, hasActivePayment } = useLoaderData<typeof loader>();
  const nav = useNavigation();
  const saving = nav.state === "submitting";

  return (
    <Page>
      <TitleBar title="Plans & Pricing" />
      <BlockStack gap="500">
        {!hasActivePayment && (
          <Banner tone="info" title="Start your 14-day free trial">
            <p>
              Choose any plan below to unlock full booking automations. You will not be charged
              during your 14-day trial and you can cancel anytime from Shopify Admin.
            </p>
          </Banner>
        )}

        <BlockStack gap="200">
          <Text as="h1" variant="headingLg">
            Choose a plan for ProBooker
          </Text>
          <Text as="p" tone="subdued">
            Fair, transparent pricing with no revenue or booking caps. Only staff seats are tiered.
          </Text>
          <Text as="p" tone="subdued">
            You are currently using <strong>{staffUsed}</strong> of{" "}
            <strong>{staffSeatLabel(plan as Plan)}</strong> staff seats.
          </Text>
        </BlockStack>

        <Layout>
          {PLANS.map((p) => {
            const current = plan === p.key;
            return (
              <Layout.Section variant="oneThird" key={p.key}>
                <Card>
                  <BlockStack gap="300">
                    <InlineStack align="space-between">
                      <InlineStack gap="200" align="center">
                        <Text as="h2" variant="headingMd">
                          {p.name}
                        </Text>
                        {p.popular && <Badge tone="attention">Most Popular</Badge>}
                      </InlineStack>
                      {current && <Badge tone="success">Active Plan</Badge>}
                    </InlineStack>

                    <Text as="p" tone="subdued" variant="bodySm">
                      {p.description}
                    </Text>

                    <Text as="p" variant="headingXl">
                      {p.price}
                    </Text>

                    <Divider />

                    <BlockStack gap="150">
                      {p.features.map((feature) => (
                        <Text as="span" variant="bodySm" key={feature}>
                          ✓ {feature}
                        </Text>
                      ))}
                    </BlockStack>

                    <div style={{ marginTop: "1rem" }}>
                      {!current ? (
                        <Form method="post">
                          <input type="hidden" name="plan" value={p.name} />
                          <Button
                            submit
                            variant={p.popular ? "primary" : "secondary"}
                            loading={saving}
                            fullWidth
                          >
                            {hasActivePayment ? `Switch to ${p.name}` : `Start 14-day Free Trial`}
                          </Button>
                        </Form>
                      ) : (
                        <Button disabled fullWidth>
                          Current Active Plan
                        </Button>
                      )}
                    </div>
                  </BlockStack>
                </Card>
              </Layout.Section>
            );
          })}
        </Layout>

        <Text as="p" tone="subdued" variant="bodySm">
          All subscriptions are billed every 30 days securely through Shopify Billing. You can upgrade,
          downgrade, or cancel at any time directly in your Shopify Admin Settings.
        </Text>
      </BlockStack>
    </Page>
  );
}
