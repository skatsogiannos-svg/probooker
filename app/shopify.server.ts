import "@shopify/shopify-app-remix/adapters/node";
import {
  AppDistribution,
  BillingInterval,
  shopifyApp,
} from "@shopify/shopify-app-remix/server";
import type { ApiVersion } from "@shopify/shopify-api";
import { PrismaSessionStorage } from "@shopify/shopify-app-session-storage-prisma";
import prisma from "./db.server";

// Keep the Admin API and webhook versions pinned. Must stay in sync with
// `[webhooks] api_version` in shopify.app.toml.
export const API_VERSION = "2026-10" as ApiVersion;

// Billing plans — defined in code so app review sees them, and managed via
// the Billing API. Only seats (staff) are limited; no revenue/booking cliffs.
export const STARTER_PLAN = "Starter";
export const GROWTH_PLAN = "Growth";
export const SCALE_PLAN = "Scale";

/**
 * Webhooks are declared in shopify.app.toml ([[webhooks.subscriptions]]) so
 * they are registered at deploy/dev time and the mandatory GDPR topics are
 * visible to App Store review. They are all delivered to /webhooks and
 * dispatched in app/routes/webhooks.tsx.
 */
const shopify = shopifyApp({
  apiKey: process.env.SHOPIFY_API_KEY,
  apiSecretKey: process.env.SHOPIFY_API_SECRET || "",
  apiVersion: API_VERSION,
  scopes: (process.env.SCOPES || "read_products").split(","),
  appUrl: process.env.SHOPIFY_APP_URL || "",
  authPathPrefix: "/auth",
  sessionStorage: new PrismaSessionStorage(prisma),
  distribution: AppDistribution.AppStore,
  billing: {
    [STARTER_PLAN]: {
      lineItems: [
        {
          amount: 9.99,
          currencyCode: "USD",
          interval: BillingInterval.Every30Days,
        },
      ],
      trialDays: 14,
    },
    [GROWTH_PLAN]: {
      lineItems: [
        {
          amount: 19.99,
          currencyCode: "USD",
          interval: BillingInterval.Every30Days,
        },
      ],
      trialDays: 14,
    },
    [SCALE_PLAN]: {
      lineItems: [
        {
          amount: 39.99,
          currencyCode: "USD",
          interval: BillingInterval.Every30Days,
        },
      ],
      trialDays: 14,
    },
  },
  future: {
    unstable_newEmbeddedAuthStrategy: true,
    expiringOfflineAccessTokens: true,
  },
  ...(process.env.SHOP_CUSTOM_DOMAIN
    ? { customShopDomains: [process.env.SHOP_CUSTOM_DOMAIN] }
    : {}),
});

export default shopify;
export const apiVersion = API_VERSION;
export const addDocumentResponseHeaders = shopify.addDocumentResponseHeaders;
export const authenticate = shopify.authenticate;
export const unauthenticated = shopify.unauthenticated;
export const login = shopify.login;
export const registerWebhooks = shopify.registerWebhooks;
export const sessionStorage = shopify.sessionStorage;
