# Pricing Section + Stripe Subscriptions

## Goal
Add a pricing section to the landing page with 4 plans (1 free + 3 paid), bilingual EN/RO, prices following the language toggle (EUR in English, LEI/RON in Romanian). Paid plans charge as **monthly subscriptions** through **your own Stripe account**.

## The plans

| Plan | Price (EUR / RON) | What's included |
|------|------|------|
| **Free** | 0 | Talk to us and build a plan for your future business. Intro conversation only. CTA → contact form. |
| **Starter** | 20 EUR / 100 LEI / mo | 30 min live Zoom consultation each month, 1 month access to our AI tools. |
| **Growth** | 50 EUR / 250 LEI / mo | 2 hours of live Zoom consultation, expanded access to our AIs and programs. |
| **Pro** | 200 EUR / 1000 LEI / mo | Full access to our program, unlimited live support from us. |

Each plan card shows a title, price with `/mo`, short description, a bullet list of features, and a CTA button. The Growth plan is highlighted as "Most popular". All copy written in both English and Romanian using the existing `t(en, ro)` convention. The currency shown switches automatically with the language toggle.

## How payments work (your Stripe key)
You chose to connect your own Stripe account. The flow:

1. You provide your Stripe **secret key**, stored securely as a backend secret (never in the code or frontend).
2. Clicking a paid plan opens Stripe's hosted checkout in **subscription mode**, in the currency matching the active language (EUR or RON).
3. After payment, Stripe redirects back to the site with a success message; cancelling returns to the pricing section.
4. Logged-in users get their subscription tracked so the app knows their current tier; a webhook keeps that status in sync when subscriptions renew, change, or cancel.

## Technical details

**Frontend**
- New `src/components/home/PricingSection.tsx` — 4 responsive cards, reuses `SectionHeading`, `GlowCard`, `Reveal`, `Magnetic`, `Button`. Prices/features defined inline with `t()`. Currency picked from `useI18n().lang` (`ro` → RON, else → EUR).
- Mount it in `src/routes/index.tsx` between existing sections (e.g. after `ConsultationSection`), with a `SectionTransition`.
- A `src/routes/billing-success.tsx` (or success/cancel handling on the pricing section) to show confirmation after Stripe redirect.

**Backend (your Stripe key, BYOK)**
- Enable the bring-your-own-key Stripe integration and add `STRIPE_SECRET_KEY` as a secret (you'll paste it into a secure form — I never see or store it in code).
- `src/lib/checkout.functions.ts` — a `createServerFn` that builds a Stripe Checkout Session in `subscription` mode using inline `price_data` (amount + currency + monthly recurrence based on chosen plan and language) and returns the checkout URL. Validates the plan id and currency server-side.
- A Stripe webhook route at `src/routes/api/public/stripe-webhook.ts` that verifies the Stripe signature and upserts subscription status.
- `subscribers` table (user_id, email, stripe_customer_id, tier, status, current_period_end) with RLS — users read only their own row; the webhook writes via the service role. Includes GRANTs.

**Notes**
- Amounts are passed as fixed server-side maps keyed by plan + currency, so the client cannot tamper with prices.
- Free plan button links to `/contact` (no Stripe).
- Going fully live with real charges requires your Stripe account to be active; test mode works immediately for verifying the flow.

## Out of scope (unless you want it)
- Gating actual AI/program features behind tiers (this plan tracks subscription status; wiring each feature to a tier can be a follow-up).
- A customer billing portal for self-service cancellation (can add later).