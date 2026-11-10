import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { Form, useActionData, useLoaderData } from "@remix-run/react";
import { AppProvider, Page, Card, Text, BlockStack, TextField, Button, Banner } from "@shopify/polaris";
import en from "@shopify/polaris/locales/en.json";
import { useState } from "react";
import { login } from "../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);
  if (url.searchParams.get("shop")) {
    await login(request);
    return null;
  }
  return json({ showForm: Boolean(login) });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const errors = await login(request);
  return json({ errors });
};

export default function AuthLogin() {
  const loaderData = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const [shop, setShop] = useState("");

  return (
    <AppProvider i18n={en}>
      <Page narrowWidth title="Log in to ProBooker">
        <BlockStack gap="400">
          {actionData?.errors && (
            <Banner tone="critical">
              <p>Please enter a valid .myshopify.com store domain.</p>
            </Banner>
          )}
          <Card>
            <BlockStack gap="400">
              <Text as="p" tone="subdued">
                Enter your store domain to open or install the app.
              </Text>
              <Form method="post">
                <BlockStack gap="300">
                  <TextField
                    label="Store domain"
                    name="shop"
                    value={shop}
                    onChange={setShop}
                    autoComplete="off"
                    placeholder="my-store.myshopify.com"
                    helpText="Example: example.myshopify.com"
                  />
                  <Button submit variant="primary">
                    Log in / Install
                  </Button>
                </BlockStack>
              </Form>
            </BlockStack>
          </Card>
        </BlockStack>
      </Page>
    </AppProvider>
  );
}
