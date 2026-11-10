import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { useActionData, useLoaderData, useNavigation, Form } from "@remix-run/react";
import {
  Page,
  Layout,
  Card,
  Text,
  BlockStack,
  InlineStack,
  Button,
  TextField,
  Checkbox,
  Divider,
  Banner,
  Badge,
  Box,
} from "@shopify/polaris";
import { useEffect, useState } from "react";
import { TitleBar } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { getOrCreateMerchant } from "../lib/merchant.server";
import { UncontrolledCheckbox, UncontrolledTextField } from "../components/FormFields";

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function minutesToTime(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
}

function parseTime(value: FormDataEntryValue | null): number | null {
  if (typeof value !== "string" || !/^\d{2}:\d{2}$/.test(value)) return null;
  const [hours, minutes] = value.split(":").map(Number);
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
}

function parseDate(value: FormDataEntryValue | null): Date | null {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  return isNaN(date.getTime()) ? null : date;
}

export async function loader({ request, params }: LoaderFunctionArgs) {
  const { session } = await authenticate.admin(request);
  const merchant = await getOrCreateMerchant(session.shop);

  const id = params.id;
  if (!id) throw new Response("Not found", { status: 404 });

  const [staff, services] = await Promise.all([
    prisma.staff.findFirst({
      where: { id, merchantId: merchant.id },
      include: {
        availability: true,
        blackouts: { orderBy: { date: "asc" } },
        services: { select: { serviceId: true } },
      },
    }),
    prisma.service.findMany({
      where: { merchantId: merchant.id },
      orderBy: { title: "asc" },
      select: { id: true, title: true, active: true },
    }),
  ]);

  if (!staff) throw new Response("Staff member not found", { status: 404 });

  const availability = WEEKDAYS.map((_, weekday) => {
    const window = staff.availability.find((item) => item.weekday === weekday);
    return {
      weekday,
      enabled: Boolean(window),
      startMin: window?.startMin ?? 9 * 60,
      endMin: window?.endMin ?? 17 * 60,
    };
  });

  const assignedServiceIds = staff.services.map((item) => item.serviceId);

  return json({
    staff: {
      id: staff.id,
      name: staff.name,
      email: staff.email,
      phone: staff.phone,
      photoUrl: staff.photoUrl,
      bio: staff.bio,
      specialties: staff.specialties.join(", "),
      active: staff.active,
    },
    availability,
    availabilityVersion: JSON.stringify(availability),
    services,
    assignedServiceIds,
    servicesVersion: assignedServiceIds.join(","),
    blackouts: staff.blackouts.map((blackout) => ({
      id: blackout.id,
      date: blackout.date.toISOString().slice(0, 10),
      reason: blackout.reason,
    })),
  });
}

export async function action({ request, params }: ActionFunctionArgs) {
  const { session } = await authenticate.admin(request);
  const merchant = await getOrCreateMerchant(session.shop);

  const id = params.id;
  if (!id) throw new Response("Not found", { status: 404 });

  const staff = await prisma.staff.findFirst({
    where: { id, merchantId: merchant.id },
    select: { id: true },
  });
  if (!staff) throw new Response("Staff member not found", { status: 404 });

  const formData = await request.formData();
  const intent = String(formData.get("intent") || "");

  if (intent === "update") {
    const name = String(formData.get("name") || "").trim();
    if (!name) {
      return json({ error: "Name is required." }, { status: 400 });
    }
    const specialties = String(formData.get("specialties") || "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);

    await prisma.staff.update({
      where: { id },
      data: {
        name,
        email: String(formData.get("email") || "").trim() || null,
        phone: String(formData.get("phone") || "").trim() || null,
        photoUrl: String(formData.get("photoUrl") || "").trim() || null,
        bio: String(formData.get("bio") || "").trim() || null,
        specialties,
        active: formData.get("active") === "on",
      },
    });
    return redirect(`/app/staff/${id}`);
  }

  if (intent === "availability") {
    const windows: Array<{ staffId: string; weekday: number; startMin: number; endMin: number }> = [];

    for (let weekday = 0; weekday < 7; weekday += 1) {
      if (formData.get(`enabled-${weekday}`) !== "on") continue;

      const startMin = parseTime(formData.get(`start-${weekday}`));
      const endMin = parseTime(formData.get(`end-${weekday}`));
      if (startMin == null || endMin == null) {
        return json({ error: `${WEEKDAYS[weekday]}: enter valid start and end times.` }, { status: 400 });
      }
      if (startMin >= endMin) {
        return json({ error: `${WEEKDAYS[weekday]}: start time must be before end time.` }, { status: 400 });
      }
      windows.push({ staffId: id, weekday, startMin, endMin });
    }

    await prisma.$transaction([
      prisma.availability.deleteMany({ where: { staffId: id } }),
      ...(windows.length > 0
        ? [prisma.availability.createMany({ data: windows })]
        : []),
    ]);
    return redirect(`/app/staff/${id}`);
  }

  if (intent === "services") {
    const selected = formData.getAll("services").map(String);
    const owned = await prisma.service.findMany({
      where: { merchantId: merchant.id, id: { in: selected } },
      select: { id: true },
    });

    await prisma.$transaction([
      prisma.staffService.deleteMany({ where: { staffId: id } }),
      ...(owned.length > 0
        ? [
            prisma.staffService.createMany({
              data: owned.map((service) => ({ staffId: id, serviceId: service.id })),
            }),
          ]
        : []),
    ]);
    return redirect(`/app/staff/${id}`);
  }

  if (intent === "blackout-add") {
    const date = parseDate(formData.get("date"));
    if (!date) {
      return json({ error: "Choose a valid date." }, { status: 400 });
    }
    await prisma.blackout.create({
      data: {
        staffId: id,
        date,
        reason: String(formData.get("reason") || "").trim() || null,
      },
    });
    return redirect(`/app/staff/${id}`);
  }

  if (intent === "blackout-remove") {
    await prisma.blackout.deleteMany({
      where: { id: String(formData.get("blackoutId") || ""), staffId: id },
    });
    return redirect(`/app/staff/${id}`);
  }

  if (intent === "delete") {
    const bookings = await prisma.booking.count({ where: { staffId: id } });
    if (bookings > 0) {
      return json(
        {
          error:
            "This staff member has bookings and can't be deleted. Deactivate them instead to keep booking history.",
        },
        { status: 400 },
      );
    }
    await prisma.staff.delete({ where: { id } });
    return redirect("/app/staff");
  }

  return json({ error: "Unknown action" }, { status: 400 });
}

interface AvailabilityRow {
  weekday: number;
  enabled: boolean;
  startMin: number;
  endMin: number;
}

function AvailabilityEditor({
  initial,
  version,
}: {
  initial: AvailabilityRow[];
  version: string;
}) {
  const [rows, setRows] = useState(initial);

  useEffect(() => {
    setRows(initial);
    // Only reset when the persisted availability actually changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version]);

  function update(weekday: number, patch: Partial<AvailabilityRow>) {
    setRows((current) =>
      current.map((row) => (row.weekday === weekday ? { ...row, ...patch } : row)),
    );
  }

  return (
    <BlockStack gap="300">
      {rows.map((row) => (
        <InlineStack key={row.weekday} gap="300" blockAlign="center" wrap={false}>
          <div style={{ width: 130 }}>
            <Checkbox
              label={WEEKDAYS[row.weekday]}
              name={`enabled-${row.weekday}`}
              checked={row.enabled}
              onChange={(checked) => update(row.weekday, { enabled: checked })}
            />
          </div>
          <TextField
            label=""
            labelHidden
            name={`start-${row.weekday}`}
            type="time"
            value={minutesToTime(row.startMin)}
            disabled={!row.enabled}
            onChange={(value) => {
              const parsed = parseTime(value);
              if (parsed != null) update(row.weekday, { startMin: parsed });
            }}
            autoComplete="off"
          />
          <Text as="span" tone="subdued">
            to
          </Text>
          <TextField
            label=""
            labelHidden
            name={`end-${row.weekday}`}
            type="time"
            value={minutesToTime(row.endMin)}
            disabled={!row.enabled}
            onChange={(value) => {
              const parsed = parseTime(value);
              if (parsed != null) update(row.weekday, { endMin: parsed });
            }}
            autoComplete="off"
          />
        </InlineStack>
      ))}
    </BlockStack>
  );
}

function ServicesEditor({
  services,
  initial,
  version,
}: {
  services: Array<{ id: string; title: string; active: boolean }>;
  initial: string[];
  version: string;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set(initial));

  useEffect(() => {
    setSelected(new Set(initial));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version]);

  if (services.length === 0) {
    return (
      <Text as="p" tone="subdued">
        No services yet. Create one under Services, then assign it here.
      </Text>
    );
  }

  return (
    <BlockStack gap="200">
      {services.map((service) => (
        <Checkbox
          key={service.id}
          label={service.active ? service.title : `${service.title} (inactive)`}
          name="services"
          value={service.id}
          checked={selected.has(service.id)}
          onChange={(checked) => {
            setSelected((current) => {
              const next = new Set(current);
              if (checked) next.add(service.id);
              else next.delete(service.id);
              return next;
            });
          }}
        />
      ))}
    </BlockStack>
  );
}

export default function StaffDetail() {
  const {
    staff,
    availability,
    availabilityVersion,
    services,
    assignedServiceIds,
    servicesVersion,
    blackouts,
  } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const nav = useNavigation();
  const saving = nav.state === "submitting";
  const error = actionData && "error" in actionData ? actionData.error : null;

  return (
    <Page
      backAction={{ content: "Staff", url: "/app/staff" }}
      title={staff.name}
      titleMetadata={<Badge tone={staff.active ? "success" : "critical"}>{staff.active ? "Active" : "Inactive"}</Badge>}
    >
      <TitleBar title={staff.name} />
      <BlockStack gap="500">
        {error && <Banner tone="critical" title={error} />}

        <Layout>
          <Layout.Section>
            <Card>
              <BlockStack gap="300">
                <Text as="h2" variant="headingMd">
                  Profile
                </Text>
                <Form method="post">
                  <input type="hidden" name="intent" value="update" />
                  <BlockStack gap="300">
                    <UncontrolledTextField name="name" label="Name" defaultValue={staff.name} requiredIndicator autoComplete="name" />
                    <UncontrolledTextField name="email" label="Email" type="email" defaultValue={staff.email ?? ""} autoComplete="email" />
                    <UncontrolledTextField name="phone" label="Phone" type="tel" defaultValue={staff.phone ?? ""} autoComplete="tel" />
                    <UncontrolledTextField name="photoUrl" label="Photo URL" defaultValue={staff.photoUrl ?? ""} autoComplete="off" helpText="Square image, at least 200×200px." />
                    <UncontrolledTextField name="bio" label="Bio" multiline={4} defaultValue={staff.bio ?? ""} autoComplete="off" />
                    <UncontrolledTextField name="specialties" label="Specialties" defaultValue={staff.specialties} autoComplete="off" helpText="Comma-separated, e.g. Colour, Balayage, Cuts." />
                    <UncontrolledCheckbox name="active" label="Bookable (active)" defaultChecked={staff.active} />
                    <InlineStack>
                      <Button submit variant="primary" loading={saving}>
                        Save profile
                      </Button>
                    </InlineStack>
                  </BlockStack>
                </Form>
              </BlockStack>
            </Card>
          </Layout.Section>
        </Layout>

        <Layout>
          <Layout.Section variant="oneHalf">
            <Card>
              <BlockStack gap="300">
                <Text as="h2" variant="headingMd">
                  Weekly availability
                </Text>
                <Text as="p" tone="subdued" variant="bodySm">
                  Times are in your store timezone. Bookings can only start inside these windows.
                </Text>
                <Form method="post">
                  <input type="hidden" name="intent" value="availability" />
                  <BlockStack gap="300">
                    <AvailabilityEditor initial={availability} version={availabilityVersion} />
                    <InlineStack>
                      <Button submit variant="primary" loading={saving}>
                        Save availability
                      </Button>
                    </InlineStack>
                  </BlockStack>
                </Form>
              </BlockStack>
            </Card>
          </Layout.Section>

          <Layout.Section variant="oneHalf">
            <Card>
              <BlockStack gap="300">
                <Text as="h2" variant="headingMd">
                  Services
                </Text>
                <Text as="p" tone="subdued" variant="bodySm">
                  Customers can book this person only for the services you assign here.
                </Text>
                <Form method="post">
                  <input type="hidden" name="intent" value="services" />
                  <BlockStack gap="300">
                    <ServicesEditor
                      services={services}
                      initial={assignedServiceIds}
                      version={servicesVersion}
                    />
                    <InlineStack>
                      <Button submit variant="primary" loading={saving}>
                        Save services
                      </Button>
                    </InlineStack>
                  </BlockStack>
                </Form>
              </BlockStack>
            </Card>
          </Layout.Section>
        </Layout>

        <Layout>
          <Layout.Section>
            <Card>
              <BlockStack gap="300">
                <Text as="h2" variant="headingMd">
                  Time off
                </Text>
                <Text as="p" tone="subdued" variant="bodySm">
                  Block a full day so it never shows as available.
                </Text>
                <Form method="post">
                  <input type="hidden" name="intent" value="blackout-add" />
                  <InlineStack gap="300" blockAlign="end">
                    <UncontrolledTextField
                      name="date"
                      label="Date"
                      type="date"
                      autoComplete="off"
                    />
                    <UncontrolledTextField
                      name="reason"
                      label="Reason (optional)"
                      autoComplete="off"
                    />
                    <Button submit>Block date</Button>
                  </InlineStack>
                </Form>
                <Divider />
                {blackouts.length === 0 ? (
                  <Text as="p" tone="subdued">
                    No time off scheduled.
                  </Text>
                ) : (
                  <BlockStack gap="200">
                    {blackouts.map((blackout) => (
                      <Box key={blackout.id} padding="200" borderColor="border" borderWidth="025" borderRadius="100">
                        <InlineStack align="space-between" blockAlign="center">
                          <Text as="span">
                            {blackout.date}
                            {blackout.reason ? ` — ${blackout.reason}` : ""}
                          </Text>
                          <Form method="post">
                            <input type="hidden" name="intent" value="blackout-remove" />
                            <input type="hidden" name="blackoutId" value={blackout.id} />
                            <Button submit variant="tertiary" tone="critical" size="slim">
                              Remove
                            </Button>
                          </Form>
                        </InlineStack>
                      </Box>
                    ))}
                  </BlockStack>
                )}
              </BlockStack>
            </Card>
          </Layout.Section>
        </Layout>

        <Layout>
          <Layout.Section>
            <Card>
              <BlockStack gap="300">
                <Text as="h2" variant="headingMd">
                  Delete staff member
                </Text>
                <Text as="p" tone="subdued">
                  Deleting is only possible when there are no bookings. Otherwise, deactivate them
                  to keep your history intact.
                </Text>
                <Form method="post">
                  <input type="hidden" name="intent" value="delete" />
                  <Button submit tone="critical" variant="secondary">
                    Delete permanently
                  </Button>
                </Form>
              </BlockStack>
            </Card>
          </Layout.Section>
        </Layout>
      </BlockStack>
    </Page>
  );
}
