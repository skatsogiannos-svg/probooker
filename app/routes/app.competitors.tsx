import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData, Form, useNavigation } from "@remix-run/react";
import {
  Page,
  Layout,
  Card,
  Text,
  BlockStack,
  InlineStack,
  Button,
  Badge,
  Divider,
  Banner,
  EmptyState,
  Box,
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { seedCompetitors, crawlCompetitor } from "../lib/competitors/crawl.server";

export async function loader({ request }: LoaderFunctionArgs) {
  await authenticate.admin(request);

  const [competitors, changes] = await Promise.all([
    prisma.competitor.findMany({
      orderBy: [{ category: "asc" }, { name: "asc" }],
      include: {
        snapshots: { orderBy: { capturedAt: "desc" }, take: 1 },
        _count: { select: { changes: true } },
      },
    }),
    prisma.competitorChange.findMany({
      orderBy: { detectedAt: "desc" },
      take: 40,
      include: { competitor: { select: { name: true } } },
    }),
  ]);

  return json({
    competitors: competitors.map((c) => {
      const last = c.snapshots[0];
      return {
        id: c.id,
        name: c.name,
        category: c.category,
        url: c.url,
        lastCrawledAt: c.lastCrawledAt?.toISOString() ?? null,
        features: last?.features ?? [],
        pricing: last?.pricing ?? null,
        rating: last?.rating ?? null,
        reviewCount: last?.reviewCount ?? null,
        changeCount: c._count.changes,
      };
    }),
    changes: changes.map((ch) => ({
      id: ch.id,
      competitor: ch.competitor.name,
      summary: ch.summary,
      severity: ch.severity,
      detectedAt: ch.detectedAt.toISOString(),
    })),
  });
}

export async function action({ request }: ActionFunctionArgs) {
  await authenticate.admin(request);
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "seed") {
    const res = await seedCompetitors();
    return json({ ok: true, message: `Seeded ${res.created} new competitors.` });
  }

  if (intent === "crawl-one") {
    const id = String(formData.get("id"));
    try {
      const r = await crawlCompetitor(id);
      return json({
        ok: true,
        message: `Crawled ${r.name}: ${r.features} features, ${r.changes} changes.`,
      });
    } catch (err) {
      return json({ ok: false, message: (err as Error).message }, { status: 400 });
    }
  }

  return json({ ok: false, message: "Unknown action" }, { status: 400 });
}

const SEV_TONE: Record<string, "info" | "attention" | "critical"> = {
  info: "info",
  notable: "attention",
  important: "critical",
};

export default function Competitors() {
  const { competitors, changes } = useLoaderData<typeof loader>();
  const nav = useNavigation();
  const busy = nav.state === "submitting";

  return (
    <Page>
      <TitleBar title="Competitor Watch" />
      <BlockStack gap="500">
        <Banner tone="info" title="Markets move — you'll know first">
          <p>
            We crawl your competitors&apos; App Store listings and pricing pages and
            alert you when they add features, change prices, or shift ratings.
            Schedule <code>/api/competitors/crawl</code> with a secret to run daily.
          </p>
        </Banner>

        <Layout>
          <Layout.Section>
            <Card>
              <BlockStack gap="300">
                <InlineStack align="space-between">
                  <Text as="h2" variant="headingMd">Tracked competitors</Text>
                  <Form method="post">
                    <input type="hidden" name="intent" value="seed" />
                    <Button submit loading={busy} variant="primary">
                      Seed default list
                    </Button>
                  </Form>
                </InlineStack>

                {competitors.length === 0 ? (
                  <EmptyState
                    heading="No competitors tracked yet"
                    image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
                  >
                    <p>Click “Seed default list” to start watching the incumbents.</p>
                  </EmptyState>
                ) : (
                  <BlockStack gap="300">
                    {competitors.map((c) => (
                      <Box
                        key={c.id}
                        padding="300"
                        borderColor="border"
                        borderWidth="025"
                        borderRadius="200"
                      >
                        <InlineStack align="space-between" blockAlign="start" wrap={false}>
                          <BlockStack gap="100">
                            <InlineStack gap="200" blockAlign="center">
                              <Text as="span" variant="bodyMd" fontWeight="semibold">
                                {c.name}
                              </Text>
                              <Badge tone={c.category === "shopify" ? "info" : "new"}>
                                {c.category}
                              </Badge>
                              {c.changeCount > 0 && (
                                <Badge tone="attention">{`${c.changeCount} changes`}</Badge>
                              )}
                            </InlineStack>
                            <Text as="span" variant="bodySm" tone="subdued">
                              {c.rating ? `★ ${c.rating}` : "—"}
                              {c.reviewCount ? ` · ${c.reviewCount} reviews` : ""}
                              {c.pricing ? ` · ${c.pricing}` : ""}
                            </Text>
                            <Text as="span" variant="bodySm" tone="subdued">
                              {c.features.length} features tracked
                              {c.lastCrawledAt
                                ? ` · last crawled ${new Date(c.lastCrawledAt).toLocaleString()}`
                                : " · never crawled"}
                            </Text>
                          </BlockStack>
                          <Form method="post">
                            <input type="hidden" name="intent" value="crawl-one" />
                            <input type="hidden" name="id" value={c.id} />
                            <Button submit loading={busy} size="slim">
                              Crawl now
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
                <Text as="h2" variant="headingMd">Change feed</Text>
                <Text as="p" tone="subdued">
                  Detected differences between crawls — newest first.
                </Text>
                <Divider />
                {changes.length === 0 ? (
                  <Text as="p" tone="subdued">
                    No changes detected yet. Run a crawl to establish a baseline.
                  </Text>
                ) : (
                  <BlockStack gap="200">
                    {changes.map((ch) => (
                      <InlineStack key={ch.id} align="space-between" blockAlign="center">
                        <InlineStack gap="200" blockAlign="center">
                          <Badge tone={SEV_TONE[ch.severity] ?? "info"}>
                            {ch.severity}
                          </Badge>
                          <Text as="span" variant="bodySm">
                            <strong>{ch.competitor}:</strong> {ch.summary}
                          </Text>
                        </InlineStack>
                        <Text as="span" variant="bodySm" tone="subdued">
                          {new Date(ch.detectedAt).toLocaleDateString()}
                        </Text>
                      </InlineStack>
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
