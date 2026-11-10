import type { LoaderFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";

/**
 * OAuth / token-exchange callback route. The Shopify Remix adapter expects a
 * splat route at the configured `authPathPrefix` ("/auth"). The library
 * performs the redirect and stores the session; we only need to trigger it.
 */
export async function loader({ request }: LoaderFunctionArgs) {
  await authenticate.admin(request);
  return null;
}
