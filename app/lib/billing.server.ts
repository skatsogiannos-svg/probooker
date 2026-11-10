/**
 * Shopify Billing API test mode.
 *
 * Test charges can be created on development stores without moving money.
 * Outside production we always use test mode. During App Store review the
 * production deployment can opt in explicitly with SHOPIFY_BILLING_TEST=true
 * so reviewers can approve a plan on their development store. Remove that
 * variable after approval so real merchants are billed normally.
 */
export function billingIsTest(): boolean {
  const override = process.env.SHOPIFY_BILLING_TEST?.trim().toLowerCase();
  if (override === "true") return true;
  if (override === "false") return false;
  return process.env.NODE_ENV !== "production";
}
