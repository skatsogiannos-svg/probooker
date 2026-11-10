import { authenticate } from "../shopify.server";

/**
 * Resolves the shop for a storefront request.
 *
 * Storefront calls must arrive through the Shopify App Proxy
 * (`/apps/booking/*`), which signs the query string. We verify that signature
 * with `authenticate.public.appProxy` and take the shop from the verified
 * offline session.
 *
 * In local development (NODE_ENV !== "production") we also allow a direct
 * `?shop=` call so the endpoint can be tested without a tunnel + proxy.
 */
export async function resolveStorefrontShop(request: Request): Promise<string> {
  const url = new URL(request.url);

  try {
    const { session } = await authenticate.public.appProxy(request);
    const shop = session?.shop ?? url.searchParams.get("shop");
    if (!shop) {
      throw new Response("Missing shop", { status: 400 });
    }
    return shop;
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      const shop = url.searchParams.get("shop");
      if (shop) return shop;
    }
    throw error;
  }
}

export const storefrontHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Cache-Control": "no-store",
};
