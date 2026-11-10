import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { useLoaderData, useActionData, useNavigation, Form } from "@remix-run/react";
import {
  Page,
  Layout,
  Card,
  Text,
  BlockStack,
  InlineStack,
  Button,
  Divider,
  Banner,
  Badge,
  EmptyState,
  Box,
} from "@shopify/polaris";
import { useState } from "react";
import { TitleBar } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { getOrCreateMerchant } from "../lib/merchant.server";
import { PLAN_LABEL, STAFF_SEATS, staffSeatLabel } from "../lib/plan";
import { UncontrolledTextField } from "../components/FormFields";

export async function loader({ request }: LoaderFunctionArgs) {
  const { session } = await authenticate.admin(request);
  const merchant = await getOrCreateMerchant(session.shop);

  const [staff, staffUsed] = await Promise.all([
    prisma.staff.findMany({
      where: { merchantId: merchant.id },
      orderBy: [{ active: "desc" }, { sortOrder: "asc" }],
      include: {
        availability: true,
        _count: { select: { services: true, bookings: true } },
      },
    }),
    prisma.staff.count({ where: { merchantId: merchant.id } }),
  ]);

  return json({
    plan: merchant.plan,
    seatLimit: staffSeatLabel(merchant.plan),
    staffUsed,
    atLimit: staffUsed >= STAFF_SEATS[merchant.plan],
    staff: staff.map((member) => ({
      id: member.id,
      name: member.name,
      email: member.email,
      active: member.active,
      serviceCount: member._count.services,
      bookingCount: member._count.bookings,
      windows: member.availability.length,
    })),
  });
}

export async function action({ request }: ActionFunctionArgs) {
  const { session } = await authenticate.admin(request);
  const merchant = await getOrCreateMerchant(session.shop);
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "create") {
    const name = String(formData.get("name") || "").trim();
    const email = String(formData.get("email") || "").trim() || null;
    if (!name) {
      return json({ error: "Name is required." }, { status: 400 });
    }

    const limit = STAFF_SEATS[merchant.plan];
    const used = await prisma.staff.count({ where: { merchantId: merchant.id } });
    if (used >= limit) {
      return json(
        {
          error: `Your ${PLAN_LABEL[merchant.plan]} plan includes ${limit} staff seat${
            limit === 1 ? "" : "s"
          }. Upgrade your plan to add more.`,
          upgrade: true,
        },
        { status: 403 },
      );
    }

    const staff = await prisma.staff.create({
      data: { merchantId: merchant.id, name, email },
    });
    // Default Mon-Fri 9-17 availability
    await prisma.availability.createMany({
      data: [1, 2, 3, 4, 5].map((weekday) => ({
        staffId: staff.id,
        weekday,
        startMin: 9 * 60,
        endMin: 17 * 60,
      })),
    });
    return redirect("/app/staff/" + staff.id);
  }

  if (intent === "toggle") {
    const id = String(formData.get("id"));
    const current = await prisma.staff.findFirst({
      where: { id, merchantId: merchant.id },
    });
    if (current) {
      await prisma.staff.update({
        where: { id },
        data: { active: !current.active },
      });
    }
    return json({ ok: true });
  }

  return json({ error: "Unknown action" }, { status: 400 });
}

export default function StaffIndex() {
  const { staff, plan, seatLimit, staffUsed, atLimit } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const nav = useNavigation();
  const [showForm, setShowForm] = useState(false);

  const saving = nav.state === "submitting";
  const error = actionData && "error" in actionData ? actionData.error : null;
  const upgrade = actionData && "upgrade" in actionData ? actionData.upgrade === true : false;

  return (
    <Page>
      <TitleBar title="Staff" />
      <BlockStack gap="500">
        {error && (
          <Banner tone="critical" title={error}>
            {upgrade && (
              <InlineStack>
                <Button url="/app/billing">View plans</Button>
              </InlineStack>
            )}
          </Banner>
        )}

        {atLimit && (
          <Banner tone="info" title={`You've reached your ${plan} plan's staff limit`}>
            <p>
              {staffUsed} of {seatLimit} seats used. Only staff seats are limited — bookings and
              revenue are never capped.
            </p>
          </Banner>
        )}

        <Layout>
          <Layout.Section>
            <Card>
              <BlockStack gap="400">
                <InlineStack align="space-between">
                  <Text as="h2" variant="headingMd">
                    Team
                  </Text>
                  <Button
                    variant="primary"
                    onClick={() => setShowForm((value) => !value)}
                    disabled={atLimit && !showForm}
                  >
                    {showForm ? "Cancel" : "Add staff"}
                  </Button>
                </InlineStack>

                {showForm && (
                  <Form method="post">
                    <input type="hidden" name="intent" value="create" />
                    <BlockStack gap="300">
                      <UncontrolledTextField
                        name="name"
                        label="Name"
                        autoComplete="name"
                        requiredIndicator
                      />
                      <UncontrolledTextField
                        name="email"
                        label="Email (optional)"
                        type="email"
                        autoComplete="email"
                      />
                      <InlineStack>
                        <Button submit variant="primary" loading={saving}>
                          Create
                        </Button>
                      </InlineStack>
                    </BlockStack>
                  </Form>
                )}

                <Divider />

                {staff.length === 0 ? (
                  <EmptyState
                    heading="No staff yet"
                    image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
                  >
                    <p>Add your first team member to start taking staff-first bookings.</p>
                  </EmptyState>
                ) : (
                  <BlockStack gap="300">
                    {staff.map((member) => (
                      <Box
                        key={member.id}
                        padding="300"
                        borderColor="border"
                        borderWidth="025"
                        borderRadius="200"
                      >
                        <InlineStack align="space-between" blockAlign="center">
                          <BlockStack gap="100">
                            <InlineStack gap="200" blockAlign="center">
                              <Text as="span" variant="bodyMd" fontWeight="semibold">
                                {member.name}
                              </Text>
                              <Badge tone={member.active ? "success" : "critical"}>
                                {member.active ? "Active" : "Inactive"}
                              </Badge>
                            </InlineStack>
                            <Text as="span" variant="bodySm" tone="subdued">
                              {member.serviceCount} services · {member.bookingCount} bookings ·{" "}
                              {member.windows} availability windows
                            </Text>
                          </BlockStack>
                          <InlineStack gap="200">
                            <Button url={`/app/staff/${member.id}`}>Manage</Button>
                            <Form method="post">
                              <input type="hidden" name="intent" value="toggle" />
                              <input type="hidden" name="id" value={member.id} />
                              <Button submit variant="tertiary">
                                {member.active ? "Deactivate" : "Activate"}
                              </Button>
                            </Form>
                          </InlineStack>
                        </InlineStack>
                      </Box>
                    ))}
                  </BlockStack>
                )}
              </BlockStack>
            </Card>
          </Layout.Section>
        </Layout>
      </BlockStack>
    </Page>
  );
}
