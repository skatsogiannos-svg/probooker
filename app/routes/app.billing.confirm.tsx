import type { LoaderFunctionArgs } from "@remix-run/node";
import { redirect } from "@remix-run/node";
import { authenticate, PRO_PLAN, GROWTH_PLAN } from "../shopify.server";
import prisma from "../db.server";
import { getOrCreateMerchant } from "../lib/merchant.server";
import { billingIsTest } from "../lib/billing.server";

/**
 * Return URL after the merchant approves (or declines) a subscription in the
 * Shopify confirmation flow. Sync the local plan from the active subscription.
 */
export async function loader({ request }: LoaderFunctionArgs) {
  const { session, billing } = await authenticate.admin(request);
  const merchant = await getOrCreateMerchant(session.shop);

  try {
    const { hasActivePayment, appSubscriptions } = await billing.check({
      plans: [PRO_PLAN, GROWTH_PLAN],
      isTest: billingIsTest(),
    });

    const activeName = hasActivePayment ? appSubscriptions[0]?.name : undefined;
    const newPlan =
      activeName === GROWTH_PLAN ? "GROWTH" : activeName === PRO_PLAN ? "PRO" : "FREE";

    await prisma.merchant.update({
      where: { id: merchant.id },
      data: { plan: newPlan },
    });
  } catch (error) {
    console.error("[billing] Could not confirm subscription", error);
  }

  return redirect("/app/billing");
}
