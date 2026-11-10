import type { ActionFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import db from "../db.server";

/**
 * Single webhook endpoint for every subscribed topic.
 *
 * Subscriptions live in shopify.app.toml:
 *   - app/uninstalled
 *   - app_subscriptions/update
 *   - customers/data_request, customers/redact, shop/redact (mandatory GDPR)
 *
 * `authenticate.webhook` verifies the HMAC signature, so any request that
 * reaches the switch below is guaranteed to come from Shopify.
 */
export async function action({ request }: ActionFunctionArgs) {
  const { topic, shop, payload } = await authenticate.webhook(request);

  switch (topic) {
    case "APP_UNINSTALLED": {
      // Drop sessions immediately. Merchant data is kept until shop/redact
      // (48h later) so a reinstall can restore the merchant's configuration.
      await db.session.deleteMany({ where: { shop } });
      break;
    }

    case "APP_SUBSCRIPTIONS_UPDATE": {
      // Keep the local plan in sync when a subscription is created, upgraded,
      // downgraded or cancelled in the Shopify admin.
      const subscription = payload.app_subscription as
        | { name?: string; status?: string }
        | undefined;
      const name = subscription?.name;
      const status = subscription?.status;

      let plan: "FREE" | "PRO" | "GROWTH" = "FREE";
      if (status === "ACTIVE") {
        if (name === "Pro") plan = "PRO";
        else if (name === "Growth") plan = "GROWTH";
      }

      await db.merchant.updateMany({
        where: { shopDomain: shop },
        data: { plan },
      });
      break;
    }

    case "CUSTOMERS_DATA_REQUEST": {
      // Mandatory GDPR webhook. Shopify expects a 200 within 5 seconds; the
      // merchant then has 30 days to deliver the data. We log a concise
      // record the merchant can act on and never block the response.
      const customer = (payload.customer ?? {}) as {
        id?: number | string;
        email?: string;
        phone?: string;
      };
      const customerEmail = customer.email;
      const customerId = customer.id != null ? `gid://shopify/Customer/${customer.id}` : null;

      const merchant = await db.merchant.findUnique({
        where: { shopDomain: shop },
        select: { id: true },
      });

      const bookings = merchant
        ? await db.booking.findMany({
            where: {
              merchantId: merchant.id,
              OR: [
                ...(customerEmail ? [{ customer: { email: customerEmail } }] : []),
                ...(customerId ? [{ customer: { shopifyCustomerId: customerId } }] : []),
              ],
            },
            select: { id: true, startsAt: true, status: true },
          })
        : [];

      console.log(
        "[GDPR] customers/data_request",
        JSON.stringify({
          shop,
          customerId: customer.id ?? null,
          customerEmail: customerEmail ?? null,
          bookings: bookings.length,
          payload: payload.data_request ?? null,
        }),
      );
      break;
    }

    case "CUSTOMERS_REDACT": {
      // Erase the customer's personal data for this shop. Bookings are kept
      // for the merchant's records but are anonymised (customerId is nulled).
      const customer = (payload.customer ?? {}) as {
        id?: number | string;
        email?: string;
      };
      const customerEmail = customer.email;
      const customerId = customer.id != null ? `gid://shopify/Customer/${customer.id}` : null;

      const merchant = await db.merchant.findUnique({
        where: { shopDomain: shop },
        select: { id: true },
      });

      if (merchant) {
        const identityOr = [
          ...(customerEmail ? [{ email: customerEmail }] : []),
          ...(customerId ? [{ shopifyCustomerId: customerId }] : []),
          ...(customerId ? [{ shopifyCustomerId: String(customer.id) }] : []),
        ];

        if (identityOr.length > 0) {
          await db.bookingCustomer.deleteMany({
            where: { merchantId: merchant.id, OR: identityOr },
          });
        }
        if (customerEmail) {
          await db.waitlistEntry.deleteMany({
            where: { merchantId: merchant.id, customerEmail },
          });
          await db.lead.deleteMany({
            where: { merchantId: merchant.id, email: customerEmail },
          });
          await db.reviewRequest.deleteMany({
            where: { merchantId: merchant.id, customerEmail },
          });
        }
      }
      break;
    }

    case "SHOP_REDACT": {
      // Sent 48 hours after uninstall. Delete everything we hold for the shop.
      const merchant = await db.merchant.findUnique({
        where: { shopDomain: shop },
        select: { id: true },
      });
      if (merchant) {
        await db.merchant.delete({ where: { id: merchant.id } });
      }
      await db.session.deleteMany({ where: { shop } });
      break;
    }

    default:
      console.warn(`[webhooks] Unhandled topic: ${topic}`);
  }

  return new Response(null, { status: 200 });
}
