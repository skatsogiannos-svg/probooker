# Staff-First Booking

**Let customers book the person, not just a slot.**

A Shopify appointment-booking app built around choosing a staff member first.
Only staff seats are limited — bookings and revenue are never capped.

## Stack

- **Remix** (Vite) + TypeScript
- **Polaris v12** + **App Bridge v4** (embedded admin)
- **Prisma** + **PostgreSQL** (Neon / Supabase / local)
- **Shopify Admin GraphQL API**
- **Theme app extension** + **App Proxy** (storefront widget)
- **Shopify Billing API** (Pro $14.99/mo, Growth $29.99/mo, 14-day trial)

## What the app does today

- Convert Shopify products into bookable services (duration, buffer, price).
- Staff profiles, weekly availability, time off and per-service assignment.
- A storefront widget that lets customers pick a staff member and a time.
- Server-validated booking creation with a Postgres advisory lock so two
  customers cannot take the same slot.
- A private self-service link so customers can cancel or reschedule without an
  account.
- Admin bookings list with status updates, per-staff analytics and plan billing.
- Mandatory GDPR webhooks (`customers/data_request`, `customers/redact`,
  `shop/redact`) plus `app/uninstalled` and `app_subscriptions/update`.

Payments are intentionally **not** collected by this app. Bookings are records
in the app database; if a merchant wants to charge for an appointment, that
happens through their own Shopify store. Deposits and checkout integration are
on the roadmap, not in the current listing.

The current version also does **not** send email or SMS. After booking, the
customer sees a confirmation on screen and gets a private link to cancel or
reschedule. Automated confirmations, reminders and marketing messages are
roadmap items and are not claimed in the listing.

## Quick start

### 1. Prerequisites

- Node.js >= 20.10
- A [Shopify Partner account](https://partners.shopify.com) and a development store
- A PostgreSQL database (free [Neon](https://neon.tech) works well)

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment

```bash
cp .env.example .env
```

Set `DATABASE_URL` and `SESSION_SECRET`. The Shopify CLI fills the API key,
secret and app URL when you link the project.

### 4. Link the app to your Partner account

```bash
shopify app config link
```

This updates `client_id` in `shopify.app.toml` and creates the environment
values the CLI needs. Replace the `REPLACE_WITH_...` placeholders in
`shopify.app.toml` before deploying.

### 5. Set up the database

```bash
npx prisma generate
npx prisma db push
```

### 6. Run the app

```bash
shopify app dev
```

Press `p` to open the app in your development store.

### 7. Add the storefront widget

In the Shopify theme editor, add the **"Choose your staff"** app block to a
product template. The widget loads its data through the app proxy at
`/apps/booking/*`; no manual URL setting is required.

## App Proxy

The storefront widget never calls the app domain directly. Instead:

```
Storefront  →  /apps/booking/api/availability  →  Shopify App Proxy  →  /api/availability
```

Configured in `shopify.app.toml`:

```toml
[app_proxy]
url = "https://your-app-domain.example.com"
subpath = "booking"
prefix = "apps"
```

Benefits:

- Same-origin requests (no CORS, no third-party cookie problems).
- Shopify signs every proxied request, and the app verifies the signature with
  `authenticate.public.appProxy`.
- The app URL is not exposed as a theme setting that merchants can break.

`[app_proxy] url` must match the public `SHOPIFY_APP_URL` of the deployment.

## Project structure

```text
app/
  shopify.server.ts        # Auth, billing plans, app config
  db.server.ts             # Prisma client
  components/
    FormFields.tsx         # Controlled Polaris field wrappers
  lib/
    availability.server.ts # Slot engine (DST-safe, buffers, blackouts)
    availability.test.ts   # Unit tests for the slot engine
    merchant.server.ts     # getOrCreateMerchant helper
    billing.server.ts      # Billing test-mode flag
    plan.ts                # Seat limits per plan
    public.server.ts       # App Proxy shop resolution
    time.server.ts         # Timezone helpers
  routes/
    app._index.tsx         # Dashboard
    app.staff.tsx          # Staff list + create
    app.staff.$id.tsx      # Profile, availability, services, time off
    app.services.tsx       # Convert product → bookable service
    app.bookings.tsx       # Bookings list + status updates
    app.analytics.tsx      # Per-staff performance
    app.billing.tsx        # Plan selection (Billing API)
    app.billing.confirm.tsx# Billing return URL
    app.settings.tsx       # Timezone / currency
    api.availability.tsx   # Public: slots for the widget
    api.book.tsx           # Public: create booking (server-validated)
    booking.$token.tsx     # Public: self-service cancel/reschedule
    auth.$.tsx             # OAuth / token exchange callback
    webhooks.tsx           # App + GDPR webhooks
    privacy.tsx            # Public privacy policy
    terms.tsx              # Public terms of service
extensions/
  booking-widget/
    blocks/booking-widget.liquid
    assets/widget.js
    assets/widget.css
prisma/schema.prisma       # Data model
```

## The availability engine

`app/lib/availability.server.ts` is the heart of the product. Given a staff
member's weekly windows, blackout dates, buffer time and existing bookings, it
computes bookable slots in the merchant's timezone — DST-safe (probed offset
conversion), with buffer handling and multi-staff merge for the "any available"
flow.

```bash
npm test
```

## Plans

| Plan | Price | Staff seats | Bookings |
|---|---|---|---|
| Free | $0 | 1 | Unlimited |
| Pro | $14.99/mo | 5 | Unlimited |
| Growth | $29.99/mo | Unlimited | Unlimited |

Billing is implemented with the Shopify Billing API. `isTest` is enabled outside
production, so development stores are never charged. Plan changes made in the
Shopify admin are synced back through the `app_subscriptions/update` webhook.

For App Store review, set `SHOPIFY_BILLING_TEST=true` on the production
deployment so reviewers can approve a plan on their development store. Remove
the variable after approval so real merchants are charged normally.

## Before App Store submission

Infrastructure

- [ ] Replace every `REPLACE_WITH_...` placeholder in `shopify.app.toml`.
- [ ] Set `SHOPIFY_APP_URL` to the production HTTPS domain.
- [ ] Point `[app_proxy] url` at the same domain.
- [ ] Provision PostgreSQL and run `npx prisma db push` against it.
- [ ] Set `SESSION_SECRET`, `SUPPORT_EMAIL`, `SHOPIFY_API_KEY` and
      `SHOPIFY_API_SECRET` in the hosting environment.
- [ ] Set `SHOPIFY_BILLING_TEST=true` during review; remove it after approval.
- [ ] Run `npm run build` and start with `npm run start` (or `shopify app deploy`).
- [ ] Confirm `https://<domain>/webhooks` accepts Shopify webhooks and that all
      mandatory GDPR topics are subscribed.
- [ ] Confirm `https://<domain>/privacy` and `https://<domain>/terms` are live
      and use the same support address as the listing.

Merchant experience

- [ ] Cold install on a clean development store completes without errors.
- [ ] Create staff, assign a service, save availability and time off.
- [ ] Add the app block to a product template and complete a booking from the
      storefront.
- [ ] Cancel and reschedule through the private booking link.
- [ ] Verify the Free plan blocks a second staff seat and links to Plans.
- [ ] Approve a test subscription, confirm the plan updates, then cancel it and
      confirm the app returns to Free.

Compliance and listing

- [ ] GraphQL Admin API only.
- [ ] No off-platform payments; billing uses the Shopify Billing API.
- [ ] GDPR webhooks return 200 and actually anonymise/delete data.
- [ ] Embedded via App Bridge with session tokens.
- [ ] Privacy policy URL, terms URL, icon, 1600×900 screenshot, screencast and
      ≤5 search terms added to the listing.
- [ ] Listing copy matches the feature set above (no unimplemented deposits,
      checkout, email or SMS claims).
- [ ] The widget and self-service page only promise what they deliver (on-screen
      confirmation and a private manage link).

## Testing the widget locally

The app proxy only exists on a real shop domain. For local development, the API
fallback accepts a direct `?shop=` parameter when `NODE_ENV !== "production"`.

```bash
npm run dev      # Shopify CLI + Remix
npm test         # availability engine unit tests
npm run typecheck
npm run build
```

## Competitor research

`research/COMPETITOR-ANALYSIS.md` contains Shopify App Store data captured on
2026-11-10: ratings, review counts, pricing tiers, feature matrices and the gaps
this product targets. The optional competitor-monitoring module
(`app/lib/competitors/`, `app/routes/app.competitors.tsx`) is not linked in the
admin navigation and is not part of the customer-facing product.
