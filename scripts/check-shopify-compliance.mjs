import fs from "node:fs";

console.log("🔍 Checking Full Shopify App Store Compliance for ProBooker...\n");

const errors = [];
const warnings = [];

// 1. Check shopify.app.toml
if (!fs.existsSync("shopify.app.toml")) {
  errors.push("shopify.app.toml is missing.");
} else {
  const config = fs.readFileSync("shopify.app.toml", "utf8");

  // Check mandatory compliance webhooks
  for (const topic of ["customers/data_request", "customers/redact", "shop/redact"]) {
    if (!config.includes(topic)) {
      errors.push(`Missing mandatory compliance webhook subscription: ${topic}`);
    }
  }

  // Check mandatory operational webhooks
  if (!config.includes("app_subscriptions/update")) {
    errors.push("Missing required webhook subscription: app_subscriptions/update");
  }
  if (!config.includes("app/uninstalled")) {
    errors.push("Missing required webhook subscription: app/uninstalled");
  }

  // Check app name length <= 30 and no prohibited words
  const nameMatch = config.match(/^name\s*=\s*"([^"]+)"/m);
  if (!nameMatch) {
    errors.push("App name is not specified in shopify.app.toml.");
  } else {
    const appName = nameMatch[1];
    if (appName.length > 30) {
      errors.push(`App name "${appName}" exceeds 30 characters (${appName.length}).`);
    }
    if (/\bshopify\b/i.test(appName)) {
      errors.push(`App name "${appName}" contains "Shopify", which violates Partner Trademark terms.`);
    }
  }

  // Check embedded = true
  if (!config.includes("embedded = true")) {
    errors.push("App must be configured as embedded = true.");
  }
}

// 2. Check shopify.server.ts
if (fs.existsSync("app/shopify.server.ts")) {
  const server = fs.readFileSync("app/shopify.server.ts", "utf8");
  if (!server.includes("AppDistribution.AppStore")) {
    errors.push("Distribution is not set to AppDistribution.AppStore in app/shopify.server.ts.");
  }
} else {
  errors.push("app/shopify.server.ts is missing.");
}

// 3. Check App Icon
if (!fs.existsSync("public/icon-1200.jpg") && !fs.existsSync("public/icon.png")) {
  warnings.push("App icon (1200x1200px) is missing in public folder.");
}

// 4. Check Privacy Policy Route and Email
if (!fs.existsSync("app/routes/privacy.tsx")) {
  errors.push("Privacy policy route (app/routes/privacy.tsx) is missing.");
} else {
  const privacy = fs.readFileSync("app/routes/privacy.tsx", "utf8");
  if (privacy.includes("support@example.com") || privacy.includes("your-domain.com")) {
    errors.push("Privacy policy contains placeholder domain (e.g. example.com). A real email must be configured.");
  }
  if (!privacy.includes("b2apps.dev@gmail.com")) {
    warnings.push("Privacy policy does not explicitly mention b2apps.dev@gmail.com.");
  }
}

// 5. Check Terms of Service Route
if (!fs.existsSync("app/routes/terms.tsx")) {
  errors.push("Terms of service route (app/routes/terms.tsx) is missing.");
} else {
  const terms = fs.readFileSync("app/routes/terms.tsx", "utf8");
  if (terms.includes("support@example.com") || terms.includes("your-domain.com")) {
    errors.push("Terms of service contains placeholder domain (e.g. example.com). A real email must be configured.");
  }
}

// 6. Check Health Check Route
if (!fs.existsSync("app/routes/health.tsx")) {
  errors.push("Health check route (app/routes/health.tsx) is missing.");
}

// 7. Check Error Boundaries on Root and App
if (fs.existsSync("app/root.tsx")) {
  const root = fs.readFileSync("app/root.tsx", "utf8");
  if (!root.includes("export function ErrorBoundary")) {
    errors.push("Root ErrorBoundary is missing in app/root.tsx.");
  }
}
if (fs.existsSync("app/routes/app.tsx")) {
  const appRoute = fs.readFileSync("app/routes/app.tsx", "utf8");
  if (!appRoute.includes("export function ErrorBoundary")) {
    errors.push("App layout ErrorBoundary is missing in app/routes/app.tsx.");
  }
}

// 8. Check Webhook Handlers
if (fs.existsSync("app/routes/webhooks.tsx")) {
  const webhooks = fs.readFileSync("app/routes/webhooks.tsx", "utf8");
  for (const topic of [
    "APP_UNINSTALLED",
    "APP_SUBSCRIPTIONS_UPDATE",
    "CUSTOMERS_DATA_REQUEST",
    "CUSTOMERS_REDACT",
    "SHOP_REDACT",
  ]) {
    if (!webhooks.includes(topic)) {
      errors.push(`Webhook handler in app/routes/webhooks.tsx is missing topic: ${topic}`);
    }
  }
} else {
  errors.push("app/routes/webhooks.tsx is missing.");
}

// 9. Summary
console.log("----------------------------------------");
if (errors.length === 0 && warnings.length === 0) {
  console.log("🎉 ALL SHOPIFY APP STORE COMPLIANCE CHECKS PASSED (100%)! 🎉");
} else {
  if (warnings.length > 0) {
    console.log(`⚠️  WARNINGS (${warnings.length}):`);
    warnings.forEach((w) => console.log(`   - ${w}`));
  }
  if (errors.length > 0) {
    console.log(`❌ ERRORS (${errors.length}):`);
    errors.forEach((e) => console.log(`   - ${e}`));
    process.exit(1);
  }
}
console.log("----------------------------------------\n");
