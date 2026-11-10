# ProBooker — Shopify App Store Listing & Review Guide

> **Copy-paste ready for the Shopify Partner Dashboard.**  
> Everything follows official Shopify App Store guidelines, trademark policies, and compliance rules.

---

## 1. App Details

### App Name
```text
ProBooker: Team Appointments
```
*(28 characters — well within the 30-character limit; contains no trademarked words).*  
*(Or simply `ProBooker` - 9 characters).*

---

### App Card Subtitle
*(Max 62 characters — appears under the app name in search results)*
```text
Staff-first appointment scheduling & booking widget.
```
*(53 characters)*

---

### Tagline / Short Description
*(Max 160 characters — shown on search and feature cards)*
```text
Let customers book appointments by choosing their preferred staff member first. Zero-fee booking, instant self-service, and calendar slot control.
```
*(144 characters)*

---

### App Store Search Terms
*(Up to 5 search terms, each maximum 20 characters)*

1. `booking`
2. `appointments`
3. `staff booking`
4. `calendar`
5. `service booking`

---

## 2. Full Description
*(Use as-is on the app listing page)*

```text
Let your customers book the person, not just a slot.

In service-based businesses — salons, spas, consulting, coaching, photography, wellness, and personal training — customers rarely book generic time slots. They book specific people: their favorite stylist, trusted coach, or preferred specialist.

ProBooker puts your team front and center. Customers choose their specialist first, see their schedule, and book the ideal appointment in seconds.

---

### 🌟 Why ProBooker?
Most appointment apps treat staff members as an afterthought or assign them randomly behind the scenes. ProBooker builds the entire experience around your specialists, increasing customer trust, booking conversion rates, and repeat appointments.

Best of all: bookings and appointment volume are ALWAYS UNLIMITED on every plan. You are never penalized for growing your client base.

---

### 🧑‍💼 1. Staff Profiles & Custom Working Hours
- Showcase your team with custom names, titles, photos, and bios.
- Set distinct weekly working schedules (e.g., Monday–Friday 09:00–17:00) for each specialist.
- Add blackout periods, holidays, and time-off with a single click.

---

### ✂️ 2. Turn Any Product into a Bookable Service
- Connect appointments directly to your existing Shopify catalog products.
- Configure custom service durations (e.g., 30m, 45m, 60m).
- Add automatic buffer time between appointments for preparation or clean-up.
- Assign individual staff members or your entire team to each service.

---

### 🛍️ 3. Online Store 2.0 Theme Extension
- Zero-code setup: Add the "Choose your staff" widget block directly inside the Shopify Theme Editor.
- High-speed performance: Runs seamlessly inside your theme without slowing down page load times.
- Secure Shopify App Proxy routing guarantees same-origin privacy and security.

---

### ⚡ 4. Atomic Concurrency (Zero Double-Bookings)
- Powered by PostgreSQL advisory concurrency locks.
- Even if two customers click to reserve the exact same slot at the exact same millisecond, our availability engine guarantees only one confirmed booking.

---

### 🔄 5. Instant Customer Self-Service
- Every booking generates a private, tamper-proof management link for the customer.
- Customers can easily view, reschedule, or cancel their appointment on their own without needing an account.

---

### 📊 6. Merchant Management & Analytics
- View all today and upcoming appointments in a unified, clean Polaris dashboard.
- Update appointment statuses (Confirmed, Completed, Cancelled).
- Measure individual staff performance, utilization, and completed booking numbers.

---

### 💰 Transparent Pricing — All Plans Include 14-Day Free Trial
- **Starter Plan ($9.99/month or $99/year):** 1 staff seat, unlimited bookings, storefront widget, self-service links.
- **Growth Plan ($19.99/month or $190/year):** Up to 5 staff seats, unlimited bookings, custom intake questions, staff analytics.
- **Scale Plan ($39.99/month or $390/year):** Unlimited staff seats, unlimited bookings, No-Shield (no-show protection & waitlist auto-fill), resource management, 24/7 priority support.

---

*Questions or custom feature requests? Contact our team anytime at b2apps.dev@gmail.com.*
```

---

## 3. Categories & Industry

* **Primary Category:** `Store management`
* **Sub-category:** `Appointments & bookings`
* **Target Audience:** Salons, spas, wellness clinics, consultants, coaches, fitness trainers, and service merchants.

---

## 4. Pricing Setup for the Listing Form

| Field | Value |
|---|---|
| **Pricing Model** | Recurring subscription (No free plan — 14-day free trial on all plans) |
| **Starter Plan** | $9.99/month (or $99/year) — 1 staff seat, unlimited bookings |
| **Growth Plan** *(Popular)* | $19.99/month (or $190/year) — up to 5 staff seats, custom intake, staff analytics |
| **Scale Plan** | $39.99/month (or $390/year) — unlimited staff seats, No-Shield, resource management |
| **Free Trial** | 14 days on all plans |

---

## 5. Contact & Privacy Information

* **Developer Name:** `B2`
* **Support Email:** `b2apps.dev@gmail.com`
* **Support Website / App URL:** `https://probooker.onrender.com`
* **Privacy Policy URL:** `https://probooker.onrender.com/privacy`
* **Terms of Service URL:** `https://probooker.onrender.com/terms`

---

## 6. App Reviewer Testing Instructions
*(Paste this in the "App testing instructions" field for the Shopify Review Team)*

```text
Thank you for reviewing ProBooker!

Here is how you can test the full end-to-end merchant and customer experience:

1. Installation:
   - Install the app on your development store. The app authenticates seamlessly with App Bridge and opens the Polaris dashboard.

2. Test Billing / Free Trial:
   - Open "Plans". Choose any plan (Starter $9.99, Growth $19.99, or Scale $39.99).
   - Test billing mode is active, so development stores can approve the 14-day free trial charge without real payment.

3. Create a Staff Member:
   - Click "Staff" in the navigation menu.
   - Click "Add staff", enter a name (e.g. "Alex Rivers"), title (e.g. "Master Stylist"), and save.
   - Notice the default weekly availability (Mon–Fri 09:00–17:00) is preconfigured.

4. Convert a Product into a Bookable Service:
   - Click "Services" in the navigation menu.
   - Click "Add service", select any product from your store's catalog.
   - Set duration to 30 minutes, assign Alex Rivers, and save.

5. Test Storefront Booking:
   - In Shopify Admin, open Online Store → Themes → Customize on your active theme.
   - Navigate to the product template for the product you made bookable.
   - Add the App Block "Choose your staff" (under Apps) and save.
   - View the product page on your storefront: select Alex Rivers, pick a date and time slot, enter customer details (e.g. "Jane Doe", "jane@example.com"), and confirm.
   - You will see the confirmation screen with a private link to reschedule or cancel.

6. Test Admin Bookings:
   - Return to the app in Shopify Admin and open "Bookings". The newly placed booking will appear in the list with full details and status controls.

If you have any questions during review, please contact us at b2apps.dev@gmail.com.
```
