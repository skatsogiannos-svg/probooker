import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData, useActionData, Form, useNavigation } from "@remix-run/react";
import {
  Page,
  Layout,
  Card,
  Text,
  BlockStack,
  Button,
  InlineStack,
  Banner,
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { getOrCreateMerchant } from "../lib/merchant.server";
import { UncontrolledSelect, UncontrolledTextField } from "../components/FormFields";

const FALLBACK_TIMEZONES = [
  "UTC", "Europe/Athens", "Europe/London", "Europe/Berlin", "Europe/Paris",
  "America/New_York", "America/Chicago", "America/Los_Angeles", "Asia/Dubai", "Australia/Sydney",
];

function supportedTimezones(): string[] {
  try {
    const zones = (
      Intl as unknown as { supportedValuesOf?: (key: string) => string[] }
    ).supportedValuesOf?.("timeZone");
    if (zones && zones.length > 0) {
      // `Intl.supportedValuesOf` omits the "UTC" alias, but UTC is a valid
      // timezone (and the default), so keep it selectable.
      return zones.includes("UTC") ? zones : ["UTC", ...zones];
    }
  } catch {
    // Older runtimes: fall back to the short list below.
  }
  return FALLBACK_TIMEZONES;
}

function isValidTimezone(timezone: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: timezone });
    return true;
  } catch {
    return false;
  }
}

export async function loader({ request }: LoaderFunctionArgs) {
  const { session } = await authenticate.admin(request);
  const merchant = await getOrCreateMerchant(session.shop);
  const timezones = supportedTimezones();
  if (!timezones.includes(merchant.timezone)) {
    timezones.unshift(merchant.timezone);
  }
  return json({
    timezone: merchant.timezone,
    currency: merchant.currency,
    plan: merchant.plan,
    shop: session.shop,
    timezones,
  });
}

export async function action({ request }: ActionFunctionArgs) {
  const { session } = await authenticate.admin(request);
  const merchant = await getOrCreateMerchant(session.shop);
  const formData = await request.formData();

  const timezone = String(formData.get("timezone") || merchant.timezone);
  const currency = String(formData.get("currency") || merchant.currency)
    .trim()
    .toUpperCase();

  if (!isValidTimezone(timezone)) {
    return json({ error: "Choose a supported timezone." }, { status: 400 });
  }
  if (!/^[A-Z]{3}$/.test(currency)) {
    return json({ error: "Currency must be a 3-letter ISO code, e.g. USD or EUR." }, { status: 400 });
  }

  await prisma.merchant.update({
    where: { id: merchant.id },
    data: { timezone, currency },
  });
  return json({ ok: true });
}

export default function Settings() {
  const { timezone, currency, plan, shop, timezones } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const nav = useNavigation();
  const error = actionData && "error" in actionData ? actionData.error : null;

  return (
    <Page>
      <TitleBar title="Settings" />
      <BlockStack gap="500">
        <Layout>
          <Layout.Section>
            <Card>
              <BlockStack gap="300">
                <Text as="h2" variant="headingMd">Store settings</Text>
                <Text as="p" tone="subdued">Shop: {shop} · Plan: {plan}</Text>
                {error && <Banner tone="critical" title={error} />}
                <Form method="post">
                  <BlockStack gap="300">
                    <UncontrolledSelect
                      label="Timezone"
                      name="timezone"
                      options={timezones.map((t) => ({ label: t, value: t }))}
                      defaultValue={timezone}
                    />
                    <UncontrolledTextField
                      label="Currency code"
                      name="currency"
                      defaultValue={currency}
                      helpText="Used to label service prices in the admin and storefront."
                      autoComplete="off"
                    />
                    <InlineStack>
                      <Button submit variant="primary" loading={nav.state === "submitting"}>
                        Save
                      </Button>
                    </InlineStack>
                  </BlockStack>
                </Form>
              </BlockStack>
            </Card>
          </Layout.Section>
        </Layout>
      </BlockStack>
    </Page>
  );
}
