## Goal

Add complete legal content and a working, GDPR-aligned cookie consent system. All text is bilingual (EN/RO) using the existing `t()` pattern, and includes the official VORTEX HUB S.R.L. company identification.

## Company details (used across legal pages)

```text
VORTEX HUB S.R.L.
Sediu social: Municipiul Timișoara, Jud. Timiș, Strada Armoniei, Nr. 23A, Ap. B1
CUI: 54747928 (din 22.05.2026)
Nr. registrul comerțului: J2026033767000 (din 22.05.2026)
EUID: ROONRC.J2026033767000
Email: hello@vortexhub.ro
```

## 1. Legal pages (full GDPR template)

- **`src/routes/privacy.tsx`** — rewrite from placeholder into a full Privacy Policy: operator identity (company block above), what data is collected (contact form, account, uploaded files), legal basis, purposes, retention, third parties/processors, international transfers, data subject rights (GDPR access/rectification/erasure/portability/objection), ANSPDCP complaint right, security, contact. Note that uploaded client files are private and never sent to AI tools without explicit consent.
- **`src/routes/terms.tsx`** — rewrite into full Terms & Conditions: company identification, definitions, scope of services, proposals/quotes, payments, revisions, delivery, intellectual property, client responsibilities, liability limits, termination, governing law (Romania), dispute resolution (ANPC/SOL link), contact.
- **`src/routes/cookies.tsx`** — NEW Cookie Policy page: what cookies are, the categories used (strictly necessary, analytics, marketing), how to manage them, and a button that **reopens the consent banner**. Includes its own `head()` metadata + canonical, mirroring the privacy/terms route shape.

All three keep the existing `SiteLayout` + `PageHero` structure and use long-form `t(en, ro)` strings for bilingual content. A small reusable `CompanyDetails` block component renders the identification consistently.

## 2. Cookie consent system

- **`src/components/cookies/cookie-consent.ts`** — small client helper: typed consent shape `{ necessary: true, analytics: boolean, marketing: boolean, timestamp }`, localStorage read/write (`vortex-cookie-consent`), plus a tiny event emitter so the footer link can reopen the banner and the policy page can read current state.
- **`src/components/cookies/CookieConsent.tsx`** — the banner UI (uses existing shadcn `Button`, `Switch`, design tokens):
  - First visit (no stored consent) → banner slides up with **Accept all**, **Reject all (non-essential)**, and **Customize**.
  - **Customize** expands toggles for Analytics and Marketing (Necessary is always on/disabled).
  - Choice is saved to localStorage; banner hides until reopened or storage cleared.
  - Bilingual via `useI18n()`; respects existing theme tokens (no hardcoded colors).
- **Mount point:** render `<CookieConsent />` once inside `RootComponent` in `src/routes/__root.tsx` (alongside `<Outlet />` / `<Toaster />`) so it appears on every page including the dashboard.

## 3. Footer wiring

- **`src/components/layout/SiteFooter.tsx`** — add **Cookie Policy** link (`/cookies`) to `legalNav` (replacing the current non-clickable "Cookie Policy" span), and add a **"Cookie settings" / "Setări cookie-uri"** button that dispatches the reopen event to show the banner again.

## Technical notes

- Consent is stored client-side only; no backend/database changes. Analytics/marketing toggles simply gate any future scripts — none are active yet, so the banner is honest about current usage.
- New route `/cookies` is auto-registered by the TanStack Router plugin (no manual `routeTree.gen.ts` edits).
- All new strings follow the established inline `t(english, romanian)` convention; `<html lang>` already syncs via the existing provider.
- The legal text is a thorough template aligned with GDPR and Romanian commercial law, clearly intended for a final review by your lawyer before launch.

## Files

```text
src/routes/privacy.tsx          (rewrite: full policy)
src/routes/terms.tsx            (rewrite: full terms)
src/routes/cookies.tsx          (new: cookie policy page)
src/components/cookies/cookie-consent.ts    (new: consent storage helper)
src/components/cookies/CookieConsent.tsx    (new: banner UI)
src/components/shared/CompanyDetails.tsx    (new: reusable company block)
src/components/layout/SiteFooter.tsx        (edit: cookie link + settings button)
src/routes/__root.tsx                       (edit: mount banner)
```
