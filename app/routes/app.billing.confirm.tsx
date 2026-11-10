import type { LoaderFunctionArgs } from "@remix-run/node";
import { redirect } from "@remix-run/node";
import { authenticate, STARTER_PLAN, GROWTH_PLAN, SCALE_PLAN } from "../shopify.server";
import prisma from "../db.server";
import { getOrCreateMerchant } from "../lib/merchant.server";
import { billingIsTest } from "../lib/billing.server";
import type { Plan } from "@prisma/client";

/**
 * Return URL after the merchant approves (or declines) a subscription in the
 * Shopify confirmation flow. Sync the local plan from the active subscription.
 */
export async function loader({ request }: LoaderFunctionArgs) {
  const { session, billing } = await authenticate.admin(request);
  const merchant = await getOrCreateMerchant(session.shop);

  try {
    const { hasActivePayment, appSubscriptions } = await billing.check({
      plans: [STARTER_PLAN, GROWTH_PLAN, SCALE_PLAN],
      isTest: billingIsTest(),
    });

    const activeName = hasActivePayment ? appSubscriptions[0]?.name : undefined;
    const newPlan: Plan =
      activeName === SCALE_PLAN
        ? "SCALE"
        : activeName === GROWTH_PLAN
          ? "GROWTH"
          : activeName === STARTER_PLAN
            ? "STARTER"
            : "FREE";

    await prisma.merchant.update({
      where: { id: merchant.id },
      data: { plan: newPlan },
    });
  } catch (error) {
    console.error("[billing] Could not confirm subscription", error);
  }

  return redirect("/app/billing");
}
