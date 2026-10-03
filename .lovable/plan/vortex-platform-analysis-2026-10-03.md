# Vortex Hub: analiza completă a platformei (2026-10-03)

**For:** Mihai Dandea, Director, Vortex Hub S.R.L.
**Basis:** four audits run on 2026-10-03 (product, tech, UX, market), a draft, and an independent review that re-checked the draft against the code, the live site, DNS and the sources. This is the corrected final version.
**Scope:** the repo was only read. The one file created in it is this report (`.lovable/plan/vortex-platform-analysis-2026-10-03.md`). Raw evidence (screenshots, page facts, performance runs, price data, review checks) is in `scratchpad/platform-analysis/{product,tech,ux,market,review}/`.

**Repo:** `/Users/dandeamihai/Desktop/human-digital-forge`. **Live:** https://vortexhub.dev, which runs the committed HEAD `9906c9f`. The working tree has about 60 uncommitted entries (63 at the last count, still changing), so the live site lags the code until someone presses Publish in Lovable.

---

## 0. Executive summary

**Where we stand.** Vortex Hub has a sales engine most Romanian agencies do not have: Vortex Scan looks up any of 1.42M firms, pulls ANAF data, audits the website and writes a costed plan and PDF offer in minutes. Deep Research (Cercetare aprofundată) is being built on top of it. Around that engine the business layer is thin: leads land in tables and nobody is told, the plans promise things a small team cannot deliver, invoicing is not set up, Google sees an English site, and one critical security patch must go in this week.

**5 biggest strengths**
1. **Vortex Scan** (about 34.5k lines): company search, ANAF, site audit, costed plan, PDF and consented lead capture. Termene, RisCo and Confidas stop at risk scores.
2. **Deep Research engine** (about 31.7k lines) with real guardrails: $1.50 cap per run, daily caps, kill switch, admin-only by default, every sentence tied to a source.
3. **A complete product skeleton:** client portal (8 pages), Stripe configured in production, a working MCP endpoint (10 tools, OAuth), Google sign-in.
4. **A distinctive brand:** the ASCII vortex hero, one editorial design plan, four rendered 3D service icons already made, and the footer band already built.
5. **Price advantage:** Vortex Hub is not a VAT payer (ANAF, 2026-10-03), so its prices are final. For clients who cannot deduct VAT (clinics, consumers, small unregistered firms) that is about 17% cheaper than a "+21% TVA" quote.

**5 biggest gaps or risks**
1. **Critical security bug on live:** seroval remote code execution (CVE-2026-59940, CVSS 9.8). Every other security item is Medium or lower.
2. **Leads go nowhere:** no alert for contact, scan leads, call-back requests or consultations; no phone, WhatsApp or calendar anywhere; the contact domain vortexhub.ro answers HTTP 402 and has no SPF or DMARC.
3. **Compliance gaps that cost money:** Lovable's analytics sets a cookie without consent; the plans say "nelimitat"; no invoices or e-Factura; the special VAT code for foreign services (art. 317) is unconfirmed.
4. **Google cannot see the Romanian site:** the server always renders English (`lang="en"`, English titles).
5. **No operations layer:** no error monitoring, no CI, no backup of client files, and the team edits Supabase rows by hand.

**5 highest-value next moves**
1. **This week (about 1 day of dev, 1 hour of yours):** patch seroval, turn off Lovable analytics, commit the checkout fix, add security headers, publish.
2. **Make every lead reach you within a minute:** alerts on every form, phone and WhatsApp everywhere, the call-back block on `/contact`, a booking calendar, SPF/DKIM/DMARC in Hostico.
3. **Relaunch the plans honestly:** Starter 390 / Growth 990 / Pro 2.490 lei a month with 2 / 6 / 15 hours, sold by contract with Oblio e-Factura invoices; fixed "de la" project prices; and fix the scan so it stops arguing against the plans, in the same release.
4. **Romanian on the server** (a 1-day fix first), then three case studies, Google reviews and an About page with your face.
5. **Switch on Deep Research Premium inside the plans** (day 61–90) and measure how many reports turn into projects before selling reports on their own.

**Decisions only you can make** (each blocks work in §6): plan prices and hours (§4.2); how many hours a month the team can really bill; selling plans by contract (recommended) or self-serve; firms-only checkout; which phone and WhatsApp number to publish; vortexhub.ro or vortexhub.dev as the main domain; whether the one-line "Proiecte" link stays on the homepage.

---

## 1. What we have: complete inventory

**Status codes:** **W** works · **P** partial · **S** stub or missing · **IP** in progress by another team · **WT** done in the working tree, not committed or published.

### 1.1 Public site

| Component | Status | Notes and evidence |
|---|---|---|
| Homepage: ASCII vortex hero, company search, 4 pillars | W | `src/routes/index.tsx`, `src/components/landing/**`. The intro costs about 5.4 s on the first visit (a skip button exists) |
| Homepage: tech logo band | W | Claude, OpenAI, n8n, Stripe and others. A non-technical owner may read them as client logos. The tech is listed 3 times on the page |
| Homepage: Services with rendered icons | WT | `ServicesSection.tsx` loads `/media/services/<slug>.webp` (4 files, 10–14 KB each, untracked). Icons lift and rotate on hover (line 37), which the design plan bans (§5.2) |
| Homepage: project examples removed | WT | `WorkSection` replaced by `ProjectsLine` (one line linking to `/portfolio`). Live still shows the 5-project grid (`id="work"`) |
| Homepage: Process, Consultation, Pricing | W | Pricing in `src/components/home/PricingSection.tsx`, prices in `src/lib/plans.ts` |
| Footer ASCII band | WT | `src/components/landing/ascii/VortexBand.tsx` (untracked), mounted in `ContactFooter.tsx` on the homepage only (`band = !compact`, opacity 0.42) |
| Service pages (`/services`, `/websites`, `/ai-automation`, `/digital-products`, `/consultancy`) | P | Each is a list of 6 labels. No prices, deliverables, time frames, FAQ or matching project |
| `/portfolio` (7 projects with a preview dialog) | P | No client, problem, timeline, result or quote. The two Bridge Gateway domains look swapped, one has the typo "gateaway". FaneaProperties shows a white login screen |
| `/contact` | P | Works in production. No anti-spam, no alert to the team, no confirmation to the visitor, no phone, no address. The session type picked under "Programează" is not passed to the form |
| About / team page | S | `/despre` and `/about` return 404. No founder photo or bio, no social links |
| Phone, WhatsApp, address | S | `tel=[]` and `address=false` on every page. The registered seat (Str. Armoniei 23A) appears only in `src/lib/scan/legal/company.ts` |
| Language (RO/EN) | P | `LanguageProvider` starts in English on the server and switches to Romanian after load (0.5–1.0 s of English) |
| SEO: titles, sitemap, JSON-LD | P | English titles. `/scan` missing from `sitemap.xml`. Organization JSON-LD has no address, logo or LocalBusiness data. `meta author="Lovable"` |
| 404 page | P | English only |
| Analytics | P, risk | No analytics of our own, but live `/` and `/scan` load Lovable's `/~flock.js`. It sets a cookie `session-id` (30 minutes) and sends page events to Lovable (Tinybird) whatever the cookie banner says. Not disclosed on live; the uncommitted `cookies.tsx:127` and `privacy.tsx:579` disclose it, but disclosure is not consent. The banner's analytics and marketing toggles control nothing |

### 1.2 Vortex Scan (`/scan`)

| Component | Status | Notes |
|---|---|---|
| Company search over 1.42M firms | W | Static index of 55–57 MB in `public/scan-index/v1`, ONRC open data of 2026-09-02. Suggestions about 0.6 s after typing stops |
| ANAF lookup (VAT v9, `/bilant`) | W | |
| Website discovery, crawl, PageSpeed, presence | W | Strong SSRF guard (`src/lib/scan/net.server.ts`). No rate limit, captcha or daily cap; Brave costs $5 per 1,000 calls after a $5 monthly credit |
| Rules-based plan and offer | P | `src/lib/scan/blueprint/offer.ts`. The demo recommends Growth, then says "investiția nu se recuperează în primele 24 de luni" (`display.ts:881`). `PRICE_BOOK` in `economics.ts` is a placeholder ("Vortex should replace these") |
| PDF offer behind the lead form | W | Writes to `audit_leads` with a consent record. Nobody is notified |
| Open-data attribution | P | ONRC and Ministry of Finance data are CC BY 4.0. The deep PDF credits them (`pages-plan.tsx:272-279`); `/scan` shows no licence or link |
| Claude refinement of the plan | S (by design) | Only `scripts/scan/try-blueprint.ts` calls it |

### 1.3 Deep Research (`/scan/deep`)

| Component | Status | Notes |
|---|---|---|
| Engine `src/lib/deep/**` | IP | Another team is editing it now. 404 on live |
| Access modes | P | `disabled / admin / code / open / premium`. Admins by user ID (`DEEP_RESEARCH_ADMIN_USER_IDS`). Premium defaults to Growth and Pro; no free report since 2026-10-04 (`DEEP_FREE_RUNS_PER_USER` defaults to 0). Admins also by Lovable's `user_roles` admin role |
| Storage tables | P | Superseded 2026-10-04: Lovable's `drizzle/migrations/0000_admin_roles_and_deep_ledger.sql` is applied (the deep tables and functions); the only pending SQL is the additive `drizzle/migrations/0001_deep_research_additions.sql`. `audit_leads` remains the stopgap for a database without the tables |
| Budgets | W | $1.50 per run, 3 runs per user per day, 10 non-admin runs per day in total ($15 a day). Expected cost about €0.94 per run |
| Call-back block ("Recomandări de la Mihai Dandea") | P | The best conversion block on the platform, but only here. In `src/components/deep/contact.ts` the `SIGNATORY` phone, WhatsApp and photo are all `null`, so the Call and WhatsApp buttons are hidden and the photo slot shows "MD". "Sună-mă" requests go to `audit_leads` and nobody is alerted |

### 1.4 Client portal (`/dashboard/*`)

| Page | Status | Main gap |
|---|---|---|
| Auth (email and password, Google, reset) | W | Minimum password length 6. The dashboard login check runs only in the browser; the data itself is protected by RLS |
| Overview | P | "Book a consultation" links to the marketing page. The "next" consultation is actually the oldest. Step labels in English |
| New request | P | No attachments, no alert |
| My projects | P | Read-only cards. No detail page, milestones or approvals |
| Messages | P | One flat chat. The team replies by inserting rows by hand |
| Files (25 MB, private bucket, signed links) | P | The team has no screen to deliver files; the client can delete files the team uploaded |
| Consultations | P | Free-text request. No calendar, meeting link or record of minutes used |
| Billing | S | Reads `invoices`, which nothing writes. Currency defaults to USD. No subscription shown, no cancel |
| Settings | P | No password change, account deletion or data export |
| Shell | P | Nav labels in English. The bell is decorative |
| Back office for the team | S | No `/admin`, no roles table |

### 1.5 Billing

| Component | Status | Notes |
|---|---|---|
| Stripe Checkout (subscriptions) | P | Configured in production: the live webhook answers 400 "Missing signature", which proves both keys are set. **Test or live mode, and whether any subscriber exists, are not verified** (owner check, §6 week 1). Uses inline `price_data`, no Stripe products. Charges RON in Romanian and EUR in English (follows the language toggle) |
| Checkout identity | Risk (Medium) | The live build puts the browser-sent `userId` and `email` into Stripe metadata. The attacker has to pay, and a unique `user_id` index on `subscribers` (`20260610142244`) blocks a second row, so the effect is a mislinked row, not free access. The fix exists only as an uncommitted change; it is self-contained and can be committed alone |
| Webhook `/api/public/stripe-webhook` | P | Signature checked, but: upserts on email; `current_period_end` always null (moved in Stripe's basil API); `invoice.*` not handled; marks active without checking `payment_status` |
| `/billing-success` | P | Shows "Abonamentul tău este activ" to anyone. No `session_id` check |
| Customer Portal / cancel | S | |
| CUI, company name, billing address | S | No `tax_id_collection` or `billing_address_collection` |
| Romanian invoices, e-Factura | S | Stripe receipts are not e-Factura invoices |

### 1.6 Integrations and MCP

| Component | Status | Notes |
|---|---|---|
| MCP server `/mcp` ("vortex-hub" v0.1.0) | W | Supabase OAuth with self-registration. 7 read and 3 write tools, acting as the signed-in client under RLS. Not mentioned on the site |
| Supabase (Lovable Cloud) | W | 8 tables in migrations. `audit_leads` has no migration in the repo |
| External data | W | ANAF, PageSpeed, Brave, Cloudflare DoH, ONRC, TED, portal.just.ro, a Ministry of Finance data file, Google Places (Deep Research, optional) |
| Anthropic | W (Deep Research only) | Opus 5.5 writes, Haiku 4.5 extracts |
| Email provider | S | None in the code (no Resend, Brevo or SMTP) |

### 1.7 Legal, tax and compliance

| Component | Status | Notes |
|---|---|---|
| Company identity in the footer (CUI 54747928, J2026033767000) | W | |
| Privacy, cookies, terms | P | Terms link the EU ODR platform, closed 2025-07-20. No subscription clauses (renewal, cancellation, 14-day withdrawal, refunds) |
| Lovable analytics cookie without consent | Risk | Law 506/2004 art. 4(5) requires consent for non-essential cookies; fines 5.000–100.000 lei. The deep plan's decision D22 already recommends turning it off |
| ANPC SAL pictogram | S | Required on the home page; ANPC Order 270/2026 updated the rules (SAL via reclamatiisal.anpc.ro) |
| VAT statement | S | Never stated on the site, although the scan notes say "fără TVA" |
| Special VAT code for foreign services (Cod fiscal art. 317) | Unknown | A firm not registered for VAT that buys services from abroad (Anthropic, Lovable, Brave, Google Workspace, Cloudflare) needs this code before the first purchase, then pays 21% VAT on those services through form D301, with no deduction. If it is missing, current purchases are already non-compliant. Accountant check |
| Scan lead consent | W | Consent record stored |
| Google Fonts loaded from Google's servers | Low | The fonts are already in `public/fonts`. The German ruling (LG München I, 3 O 17493/20) does not bind Romania; fix it as part of the speed work |
| Accessibility | P | Good basics (alt text, one H1, reduced motion, pause button). Missing: skip link; footer links below the 24 px target; unclear focus rings |

### 1.8 Ops

| Component | Status | Notes |
|---|---|---|
| Hosting | W | Lovable's Cloudflare account (`foryax23-human-digital-forge`). No access to KV, Queues, Cron, rate limiting or logs |
| Release | P | Publish is manual in Lovable. About 60 uncommitted entries; some files depend on the Deep Research team's untracked files (see §6 commit order) |
| Dependencies | Risk | `bun audit`: 75 advisories (1 critical, 33 high, mostly dev-only). Two lockfiles that disagree (`bun.lock` seroval 1.5.2, `package-lock.json` 1.5.4) |
| CI and tests | S | Tests only in `tests/deep/**`. No `test` script, no `.github` |
| Error monitoring, uptime | S | |
| Backups | P | Lovable Cloud keeps daily database snapshots for about 14 days. Client uploads in storage are not backed up |
| Security headers | P | HSTS, nosniff, referrer policy sent. No CSP, no frame-ancestors, no Permissions-Policy |
| Mobile performance | P | Live home: largest paint 4.61 s (target 2.5 s or less), 849 KB. `/scan`: 3.81 s, 1.54 MB |
| Mail domain vortexhub.ro | S | DNS at Hostico. Only TXT record is a Google site verification, so no SPF; `_dmarc` does not exist; MX points to Google. HTTP 402, probably an inactive Hostico hosting plan |
| `.env` tracked in git | W | Checked: `git show HEAD:.env` holds only the public Supabase URL, project ID and publishable key (plus `VITE_*` copies). Not a risk |

---

## 2. What is broken or risky today (ranked, with fixes)

**1. seroval remote-code-execution bug (Critical)**
- **Problem:** GHSA-mv8w-475r-vwqw / CVE-2026-59940, CVSS 9.8, published 2026-07-08, names TanStack Start. `bun.lock` pins 1.5.2; fixed in 1.5.3. TanStack Start decodes every server-function request body with it.
- **Why it matters:** someone could run code on our server through any public server function. Whether live is exposed depends on which lockfile Lovable builds from, so confirm after the patch.
- **Fix:** add an override `"seroval": "^1.5.4"` (or bump TanStack), keep one lockfile, rebuild, Publish, re-run `bun audit`.
- **Effort:** 1 hour. **Owner:** Dev.

**2. Leads arrive silently, and the mail domain is not set up (High)**
- **Problem:** no notifications at all, including the Deep Research "Sună-mă" requests. vortexhub.ro has no SPF, DKIM or DMARC and returns HTTP 402.
- **Why it matters:** every enquiry, scan lead and consultation waits until someone opens a table. Replies from hello@vortexhub.ro may land in spam.
- **Fix:** an email or Telegram alert on every new row plus a confirmation to the visitor; in Hostico: SPF `v=spf1 include:_spf.google.com ~all`, DKIM from Google Workspace, DMARC `p=none`, and a 301 redirect of vortexhub.ro to vortexhub.dev (or decide .ro is the main domain).
- **Effort:** 2–3 hours in Hostico (you), 1 day for the alerts (Dev). You create the email or Telegram account the alerts use.

**3. Lovable analytics runs without consent (High, 5-minute fix)**
- **Problem:** `/~flock.js` sets a cookie and tracks page views on every visit, ignoring the banner. Vortex Scan itself flags "Lovable Analytics" on prospects' sites (`src/lib/scan/audit/technologies.ts:306`).
- **Why it matters:** Law 506/2004 art. 4(5); fines 5.000–100.000 lei. Also awkward for an agency that sells compliance checks.
- **Fix:** turn off Lovable analytics in the Lovable project settings. Later add cookieless analytics (item 15).
- **Effort:** 5 minutes. **Owner:** Mihai.

**4. Tax set-up for foreign services is unconfirmed (High)**
- **Problem:** art. 317 special VAT code and D301 reverse-charge filing for Anthropic, Lovable, Brave, Google Workspace and Cloudflare.
- **Why it matters:** if missing, purchases are non-compliant now; it also makes every foreign cost in this report about 21% higher (the €0.94 Deep Research run included).
- **Fix:** one call with the accountant: confirm the code, the VAT wording for the site, the e-Factura route (§4.6) and euro sales.
- **Effort:** 1 hour. **Owner:** Mihai and Contabil.

**5. The plans promise things that do not exist (High)**
- **Problem:** "nelimitat", undefined "instrumente AI", Zoom minutes with no booking, "poți anula oricând" with no way to cancel.
- **Why it matters:** misleading claims: Legea 363/2007 for consumers, Legea 158/2008 (misleading advertising) for firms. And a Pro client could use unlimited hours for 1.000 lei.
- **Fix:** remove "nelimitat" and the AI-tool lines this week; publish new copy and prices together in week 2–3 (§4).
- **Effort:** 1 hour now, half a day later.

**6. Billing and invoicing are incorrect and not compliant (High)**
- **Problem:** webhook keyed on email, renewal date always null, `invoice.*` ignored, `/billing-success` unchecked, no CUI, no e-Factura invoice.
- **Why it matters:** companies cannot get a valid invoice; e-Factura is required for B2B and, since 2025-01-01, B2C.
- **Fix (recommended route, §4.6):** sell plans by contract with Oblio recurring invoices (e-Factura built in) and keep Stripe only for one-off items. Then the Stripe work shrinks to: `session_id` check on the success page, webhook keyed by Stripe customer or payment, `payment_status` check, products for one-off items. Customer Portal, `tax_id_collection` and the withdrawal button move out of month 1.
- **Effort:** 1 day for Oblio and a contract template, 1 day for the Stripe minimum.

**7. Google cannot see the Romanian site (High)**
- **Problem:** the server always sends English.
- **Why it matters:** no ranking for "site de prezentare Timișoara" or any Romanian search.
- **Fix, cheap first:** in `LanguageProvider`, start in Romanian on the server (`lang="ro"`) and switch to English only when the visitor saved that choice; set Romanian titles per route. Later, only if English traffic matters: `/en/…` addresses with hreflang.
- **Effort:** 0.5–1 day now; 2–4 days later.

**8. No abuse protection (High)**
- **Problem:** contact form, lead gate and scan have no captcha, rate limit or cap.
- **Why it matters:** spam, burned Brave and PageSpeed quotas, our servers used to crawl others' sites.
- **Fix:** Cloudflare Turnstile (free), a Postgres rate limiter (hashed IP plus window), daily caps on paid APIs.
- **Effort:** 1 day.

**9. The scan argues against the plans, and will do so more after the price change (High)**
- **Problem:** `offer.ts` drops to a cheaper plan while `monthlyGain − planFee ≤ 0`, and values each saved hour at about 32 lei. At the new prices a firm must save about 12 h a month for Starter, 31 h for Growth and 78 h for Pro, so the scan will rarely recommend Growth or Pro and will often print "investiția nu se recuperează".
- **Fix:** project-first mapping and a cautious money value for new customers (§4.4). **This must ship in the same release as the new prices.**
- **Effort:** 1–2 days.

**10. Checkout trusts the browser (Medium)**
- **Fix:** commit the existing fix (the server reads the session token). Self-contained; commit it alone.
- **Effort:** 15 minutes plus a publish.

**11. Clients can write team-only fields (Medium)**
- **Problem:** in `supabase/migrations/20260602123020_…sql` a client can post messages as "team", delete team replies, mark their own projects done and confirm their own consultations. Limited to their own rows: a data-integrity problem, not cross-account access.
- **Fix:** `WITH CHECK (sender='client')` on message insert; column-level updates only; check `project_id` ownership; `user_roles` and `has_role()` for a future admin area.
- **Effort:** half a day with tests.

**12. Client files are not backed up and the database cannot be rebuilt from the repo (Medium)**
- **Fix:** export `audit_leads` and the Deep Research tables into migrations; weekly `pg_dump` and bucket copy off-site; one restore drill.
- **Effort:** half a day.

**13. No security headers (Medium)**
- **Fix:** in `src/server.ts`: report-only CSP first, `frame-ancestors 'none'`, Permissions-Policy. The Supabase session sits in localStorage, so XSS means token theft.
- **Effort:** 3 hours.

**14. Terms out of date (Medium)**
- **Problem:** ODR link, no subscription clauses, no SAL pictogram. From 2026-06-19 online consumer contracts also need an online withdrawal function (Directive 2023/2673).
- **Fix:** lawyer review; remove ODR; add renewal, cancellation, withdrawal, hour and response-time definitions; SAL pictogram linking reclamatiisal.anpc.ro; firms-only checkout reduces the consumer exposure.
- **Effort:** 1 day plus the lawyer.

**15. We cannot see what happens (Medium)**
- **Fix:** Cloudflare Web Analytics (no cookies) or Plausible, funnel events, Sentry free plan, an uptime monitor; fix or remove the banner toggles.
- **Effort:** half a day.

**16. Mobile pages load slowly (Medium)**
- **Fix:** hero poster as AVIF/WebP of 40 KB or less; self-hosted fonts; supabase-js only on login and dashboard; poster instead of video on mobile; cache headers on `/media` and `/scan-index`.
- **Effort:** 1–2 days.

**17. The live site lags the code (ongoing)**
- **Fix:** commit in reviewed batches in the order in §6, Publish after each, check that the live file names change.

**18. Realtime broadcast open to any signed-in user (Low)**
- `realtime.messages USING(true)` affects only broadcast and presence, which nothing uses; the app's `postgres_changes` path obeys RLS. Migration `20260610002123` actually tightened access (anonymous to signed-in). Scope topics to `auth.uid()` during item 11.

**19. Small but visible mistakes (Low)**
- Swapped portfolio domains and the "gateaway" typo; three names for one service ("Materiale grafice", "Produs digital", "Digital Product"); two reply promises (2 working days on `/contact`, 1 in Deep Research); "7 proiecte lansate" shown twice; `meta author="Lovable"`; no CC BY 4.0 credit on `/scan`. One cleanup pass, about 2 hours.

---

## 3. What we can implement: prioritized backlog

**How to read:** Impact is for the business (leads, revenue, risk). Effort: **XS** (an hour or less), **S** (1 day or less), **M** (2–5 days), **L** (1–3 weeks). Quick wins first in each group.

### 3.0 Top 10 overall

| # | Item | Impact | Effort | Owner |
|---|---|---|---|---|
| 1 | seroval patch, one lockfile, Publish | Critical | XS | Dev |
| 2 | Turn off Lovable analytics | High (legal) | XS | Mihai |
| 3 | Lead alerts to the team plus confirmation to the visitor; SPF/DKIM/DMARC and the vortexhub.ro redirect in Hostico | High | S | Dev, Mihai |
| 4 | Accountant call: art. 317 code, VAT wording, e-Factura through Oblio, euro sales | High (tax) | XS | Mihai, Contabil |
| 5 | Reachability: phone, WhatsApp and address on every page; fill `SIGNATORY` in `src/components/deep/contact.ts`; the call-back block on `/contact` and in Consultation; a booking calendar | High | S–M | Mihai, Dev |
| 6 | Plan relaunch (§4): new copy and prices, sold by contract with Oblio invoices, "de la" project prices, and the scan mapping fix in the same release | High | M | Mihai, Dev |
| 7 | Romanian on the server (cheap fix) and Romanian titles | High | S | Dev |
| 8 | Turnstile, rate limits and daily caps on paid APIs | High | S | Dev |
| 9 | Publish the homepage changes you asked for (projects off the homepage, rendered icons without hover motion, footer band), committed together with the Deep Research team | Medium-High | S | Dev |
| 10 | Trust pack: 3 case studies, About and founder block, Google Business Profile and first reviews, one named client quote | High | M | Mihai, Dev |

Next in line: checkout identity commit, RLS hardening and security headers (Medium, S); cookieless analytics, Sentry and uptime (Medium, S).

### 3.1 Conversion and trust

| Item | Impact | Effort | Notes |
|---|---|---|---|
| Phone and WhatsApp click-to-chat (`wa.me`) in the nav, a sticky button on mobile, the footer and `/contact` | High | S | The scan flags "Fără contact pe WhatsApp" on prospects, and our own site fails it. WhatsApp is widely used in Romania ([Romania Insider](https://www.romania-insider.com/news/how-many-romanians-use-whatsapp)) |
| Reuse the Deep Research call-back block on `/contact` and in Consultation | High | S | Named person, phone, morning or afternoon, "în cel mult o zi lucrătoare". Needs `SIGNATORY` filled in first |
| Full address, a named person and one reply promise (1 working day) | High | S | |
| Pass the session type from each "Programează" to the form | Medium | S | |
| Booking calendar for the free 30-minute call and plan hours | High | M | Cal.com or Google Calendar booking pages with a Meet link |
| Testimonials policy (below); ask the 7 launched clients for a quote and a Google review | High | S to start | 97% of consumers read reviews ([BrightLocal 2026](https://brightlocal.com/research/local-consumer-review-survey/)) |
| Three short case studies on `/portfolio`: client, problem, what we built, time, result, quote | High | M | Start with MetaFit and Harvard of Sales (Romanian) and Momentum One |
| About and founder block: photo, bio, LinkedIn, Timișoara address | High | S | The company is 4 months old; a face makes up for missing history |
| Written guarantees (below) | Medium | S | |
| A hero sub-line that says what we sell | High | S | Suggested: "Facem site-uri și automatizări pentru firme din România. Scrie numele firmei și vezi gratuit ce poți îmbunătăți." |
| Move the tech band below Services, or shrink it | Medium | S | Do not replace it with client wordmarks: those are the project examples you asked to hide (§5.1) |
| Show a screenshot of the client portal | Medium | S | Process step 3 sells the portal, nothing shows it |
| Shorten the intro, or skip it for campaign traffic (`utm_*`) | Medium | S | |

**Testimonials policy (proposal):** only real clients, with full name, role, company and written consent; no paid, invented or edited reviews; never ask only the happy clients for public reviews; say on the page how reviews are collected and whether they are verified ([Directive 2019/2161](https://eur-lex.europa.eu/eli/dir/2019/2161/oj)); link the Google Business Profile.

**Guarantees we can keep:** fixed price agreed before work starts; 50% upfront, 50% at launch; 30 days of free bug fixes after launch; code, domain and accounts in the client's name; the client can leave and take everything. Avoid "ROI garantat" and uptime percentages we cannot measure.

### 3.2 Product

| Item | Impact | Effort | Notes |
|---|---|---|---|
| Fix the scan results: plan fee as its own line, a cautious money value for new customers, project-first recommendation | High | S–M | `offer.ts`, `economics.ts`, `display.ts`. Coordinate: `economics.ts` is already modified by the Deep Research team (§6) |
| Replace `PRICE_BOOK` placeholders with the real project prices (§4.3) | High | S | Its own comment asks for this |
| Lead and project notifications (team and visitor) | High | M | §2 item 2 |
| Hide unfinished portal parts: the Billing page (empty, USD), the decorative bell, and Messages (point clients to email or WhatsApp) | Medium | S | Cheaper than building them before there are clients |
| Mark plan entitlement by hand until a back office exists | Medium | XS | Plans sold by contract (§4.6) still need a `subscribers` row with the tier for Deep Research access; the team writes it |
| Monitoring: monthly re-scan plus alerts (site down, ANAF status change, PageSpeed drop) | High | M–L | Needs a scheduler: Supabase `pg_cron` or our own Cloudflare account (Workers Paid, $5 a month) |
| Run Vortex Scan on vortexhub.dev and fix what it finds | Medium | S | Also a good story for the site |
| Dashboard polish: Romanian nav, password change, account deletion and data export (GDPR) | Medium | M | |
| Deferred until about 5 active clients: `/admin` back office (L), client "Instrumente" area (L), MCP docs and public tools (M), partner-branded reports (M, needs a lawyer) | Medium | L | Clinics will not connect Claude through MCP; alerts and a simple lead pipeline are enough for now |

### 3.3 Growth

| Item | Impact | Effort | Notes |
|---|---|---|---|
| Romanian on the server, cheap fix first (§2 item 7) | High | S | |
| Google Business Profile (Timișoara) and a Clutch profile | High | S | Reviews feed both |
| Sitemap with `/scan`; LocalBusiness / ProfessionalService JSON-LD (address, logo, social profiles); let Google index the `/scan` start page (results stay `noindex`) | Medium | S | |
| Service pages that sell: "Ce primești", "de la X lei", "în Y săptămâni", what is included, FAQ, a matching project, the icon | High | M | |
| `/en/…` addresses with hreflang | Medium | M | Only if English traffic matters ([Google](https://developers.google.com/search/docs/specialty/international/managing-multi-regional-sites)) |
| Industry pages for what the scan already understands: clinici dentare, saloane, magazine online, cabinete, HoReCa | Medium | M | |
| Follow-up emails only to leads who ticked the marketing box | Medium | M | Law 506/2004 art. 12 requires prior consent, also for companies |
| Partnerships: accountants (Oblio and SmartBill users), grant consultants, booking software (MERO) | Medium | S to start | Grants: the PR Vest 1.2 digitalisation call article is dated 2024-07-24 (call planned for Jan–Feb 2025), and applicants need at least 2 years of history and a profit; PNRR digitalisation ended 2026-06-30. Check for an open call before building on it ([StartupCafe](https://startupcafe.ro/noi-fonduri-europene-digitalizare-imm-judete-timis-arad-hunedoara-caras-severin-27873)) |
| "Scanează-ți firma" campaigns (LinkedIn, local groups) landing on `/scan` | Medium | S | The scan is the hook |

### 3.4 Ops

| Item | Impact | Effort | Notes |
|---|---|---|---|
| seroval patch and one lockfile | Critical | XS | §2 item 1 |
| Turn off Lovable analytics | High | XS | §2 item 3 |
| Turnstile, rate limits, caps on paid APIs | High | S | §2 item 8 |
| Keep `DEEP_DAILY_RUN_CAP` at 3–5 until report-to-project conversion is measured | High (cost) | XS | §4.2 running costs |
| RLS hardening with tests | Medium | S | §2 item 11 |
| Security headers | Medium | S | §2 item 13 |
| Cookieless analytics and a funnel: scan started → company identified → lead → call booked → project | Medium | S | Cloudflare Web Analytics is free ([docs](https://developers.cloudflare.com/web-analytics/about/)) |
| Sentry and an uptime monitor | Medium | S | Sentry free plan: 5,000 errors a month ([pricing](https://sentry.io/pricing/)). The uptime monitor is also what the plans' "alertă dacă site-ul cade" needs |
| CI: `tsc --noEmit`, eslint, `node --test`, `bun audit --audit-level=high`, build | Medium | S | Add RLS and webhook tests |
| Backups and schema in migrations | Medium | S | §2 item 12 |
| Performance pass to largest paint 2.5 s or less; self-hosted fonts | Medium | M | §2 item 16 |
| Our own Cloudflare account (KV, Queues, Cron, rate limiting) | Medium | M | Needed for monitoring and the deep engine |

### 3.5 Monetization

| Item | Impact | Effort | Notes |
|---|---|---|---|
| Remove "nelimitat" and the AI-tool lines now, at the old prices | High | XS | |
| New prices and hours (§4) in `plans.ts`, `PricingSection.tsx`, `offer.ts`, `PRICE_BOOK`, together with the scan fix | High | S–M | Existing Stripe subscribers (if any, owner check) keep their old price unless you decide otherwise |
| Plans sold by contract, invoiced monthly through Oblio (e-Factura) | High | S | Oblio: one plan at €29 a year with e-Factura and integrations, first year free ([oblio.eu](https://www.oblio.eu/)). SmartBill's cheap plan (Silver, €5,84 + TVA a month) has no API; the API comes with Platinum, price not public ([smartbill.ro](https://www.smartbill.ro/preturi)) |
| Project invoicing (50/50, or 40/40/20 above 10.000 lei) through Oblio | High | XS | |
| Stripe only for one-off items (extra Deep Research report, later Monitor): products and prices, `mode: "payment"`, success-page check, Oblio invoice from the webhook | Medium | S–M | |
| Deep Research Premium inside the plans (§4.5) | Medium | S once the engine ships | |
| Yearly prepayment at 10% off | Medium | XS | Market yearly discounts range 8–40% |
| "Monitor" plan, software only (99 lei) | Medium | after monitoring exists | §4.2 |

---

## 4. Pricing plans proposal

### 4.1 What is wrong with today's plans

Today (`src/lib/plans.ts`, `PricingSection.tsx`): Gratuit 0, Starter 100 lei (€20), Growth 250 lei (€50), Pro 1.000 lei (€200) a month.

- **Too cheap for what they promise.** Romanian retainers cost 300–1.200 lei a month for 2–10 hours ([tibis.ro](https://tibis.ro/servicii/mentenanta), [iuli.dev](https://iuli.dev/), [creative-side.ro](https://creative-side.ro/mentenanta-wordpress/)); extra hours about 200 lei; IT contracting 130–340 lei an hour ([Everhour / Hays](https://everhour.com/calculators/hourly-rate-calculator-in-romania)). Growth works out under 60 lei an hour; Pro's "nelimitat" stops covering cost after about 5 hours a month.
- **Promises with nothing behind them:** "suport live nelimitat", "acces nelimitat la instrumentele AI", "programări cu prioritate" with no booking system, "1 lună de acces la instrumentele noastre AI" on a monthly plan (and Starter has no AI access in code).
- **Missing information:** no VAT line; Growth's "2 ore" does not say "pe lună"; no minimum term; no cancel path; no link to project prices, so the scan's 4.500–19.000 lei setup comes as a surprise.
- **Currency:** euro buyers pay about 7% more than lei buyers (€20 against 100 lei at 5,3488 lei per euro).

### 4.2 Proposed structure: a fixed-price project first, then a care plan

This is how the Romanian market buys ([Revelia](https://revelia.ro/creare-site-web/pret-realizare/), [Brig](https://brig.ro/serviciu/web-design)). Keep the plan IDs Starter / Growth / Pro (Stripe, `offer.ts` and Deep Research access use them) and add a Romanian name that says what the plan does.

**Hours are the single currency.** Every piece of staff work (changes, calls, reports, fixing a broken automation) counts against the included hours. The plan adds the things that cost us little per client: hosting, backups, uptime alerts, monitoring of automations, a reply-time promise.

**VAT basis.** ANAF (2026-10-03): Vortex Hub S.R.L. (CUI 54747928) is not a VAT payer, so the prices below are **final, no TVA added**. If turnover passes 395.000 lei, Vortex must register and add 21% ([StartupCafe, OG 22/2025](https://startupcafe.ro/publicat-monitorul-oficial-ordonanta-22-2025-nou-plafon-scutire-de-tva-ce-trebuie-faca-firmele-85889)). That row belongs in contracts, not on the public price table. Confirm status and wording with the accountant. Euro amounts at 5,3488 lei per euro (ECB, 2026-10-02).

**Primul pas, gratuit** (a band above the plans, not a plan card): Vortex Scan, the PDF plan and a 30-minute call with Mihai.

| | **Starter · Îngrijire** | **Growth · Creștere** (recomandat) | **Pro · Partener** |
|---|---|---|---|
| For whom | A firm with a site we built or took over that needs it kept healthy | A firm with a few automations that wants steady improvements | A firm whose site, automations and AI assistant are part of daily work |
| **Price a month, final (no TVA added)** | **390 lei** (≈ €73) | **990 lei** (≈ €185) | **2.490 lei** (≈ €466) |
| Contract clause only: if Vortex becomes a VAT payer (+21%) | 471,90 lei | 1.197,90 lei | 3.012,90 lei |
| Yearly, paid upfront (−10%) | 4.212 lei (351 lei/lună) | 10.692 lei (891 lei/lună) | 26.892 lei (2.241 lei/lună) |
| **Hours included each month** | **2 h** | **6 h** | **15 h** |
| Effective rate per included hour | 195 lei | 165 lei | 166 lei |
| Hosting, SSL, updates, backups | 1 site | 1 site | Up to 2 sites |
| Alert if the site goes down | Yes (needs the uptime monitor, roadmap week 2) | Yes | Yes |
| Health report (we run Vortex Scan; time counts in the hours) | Every quarter | Every month, 1 page | Every month, plus a quarterly review against the first scan |
| Automations monitored (built as a separate project; fixes count in the hours) | – | Up to 3 | Up to 8 |
| AI assistant kept running (built separately) | – | – | 1, up to 1.000 conversations a month; AI usage above that at cost |
| Calls | Inside the hours | A 60-minute monthly call, inside the hours | A 2-hour monthly strategy session, inside the hours |
| Reply time (Mon–Fri, 9–18) | 2 working days | 1 working day | Critical issues (site down, payments broken) within 4 working hours; the rest in 1 working day |
| Minimum term | None, monthly | 3 months, then monthly | 3 months, then monthly |
| Extra hours | 200 lei/h | 200 lei/h | 200 lei/h |
| Unused hours | Carry over 1 month | Carry over 1 month | Carry over 1 month |
| Not included | New features beyond the hours; third-party fees at cost or paid by the client (domain, n8n or Make, SMS, Meta message fees, AI usage above the cap); ad spend; copywriting beyond the hours | Same | Same |

**Added only when Premium launches (day 61–90), not on the page before:** Cercetare aprofundată, Starter 1 report a quarter, Growth 2 a month, Pro 5 a month.

**Why these numbers**
- **Per hour, still at the top of the market, not above it.** Per included hour the market runs: Tibis 129 lei (900 lei / 7 h), iuli.dev 75–90 lei, Creative Side 150–200 lei (with a 2-hour critical response including weekends). The draft's 1 / 4 / 10 h cost 248–249 lei an hour on Growth and Pro, 1.9 to 3 times those providers; that was not realistic. At 2 / 6 / 15 h we sit at 165–195 lei.
- **What justifies the premium over Tibis or iuli.dev:** hosting included (hosting alone costs 100–600 lei a year, Brig and Alex-Design), a written health report from our own scan, monitored automations, and no VAT on top for clients who cannot deduct it. Note that Tibis and Creative Side also include backups and monitoring, so do not claim those as unique.
- **Alternative if you prefer fewer hours:** keep 1 / 4 / 10 h and lower prices to about 290 / 790 / 1.990 lei.
- **Card fees, only if a plan is paid by card through Stripe:** 1,5% + 1 leu for standard EEA cards, 2,8% + 1 leu for company and premium cards, plus 0,7% for subscriptions ([Stripe](https://stripe.com/en-ro/pricing)). On 390 lei that is 9,6–14,7 lei. Invoiced by contract and paid by bank transfer, it is near zero.

**Capacity: a ceiling, not a forecast.** 10 Starter, 8 Growth and 3 Pro clients would use 113 hours and bring 19.290 lei a month. Nothing in the repo says how many hours the team can really bill; "240 billable hours for two people" would be about 71% of working time, while the founders also sell, run the firm and build the platform. **Your decision:** how many hours a month can we really bill? Keep plan hours under about 40% of that, so projects still fit.

**Running costs and a realistic 6-month scenario**

Known monthly costs (all foreign services carry about 21% reverse-charge VAT, see §2 item 4):

| Cost | Per month | Note |
|---|---|---|
| Deep Research at `DEEP_DAILY_RUN_CAP` 3 runs a day | ≈ €85 ≈ 450 lei, ≈ 550 lei with VAT | Only if the runs are used; near zero in admin-only mode |
| Deep Research at today's defaults (10 runs, $15 a day) | expected ≈ €280; worst case ≈ €375 ≈ 2.000 lei, ≈ 2.430 lei with VAT | Deep-engine plan §8.4 |
| Brave Search | $5 credit free, then $5 per 1,000 calls | [brave.com](https://brave.com/search/api/) |
| Oblio | ≈ 13 lei (€29 a year; first year free) | |
| Own Cloudflare Workers Paid (when monitoring starts) | $5 | |
| Sentry, uptime monitor, Cloudflare Web Analytics, Turnstile | free tiers | |
| Lovable plan and Cloud usage, Google Workspace seats, domains, accountant | fill in from invoices | Not verified here |

Revenue scenario for a 4-month-old firm with no reviews yet (projects at about 4.500–5.500 lei each):

| | Month 3 | Month 6 |
|---|---|---|
| **Conservative:** plan clients | 1 Starter (390 lei) | 2 Starter + 1 Growth (1.770 lei) |
| **Conservative:** projects | 1 every 2 months (≈ 2.250 lei a month on average) | same |
| **Conservative:** revenue a month | ≈ 2.640 lei | ≈ 4.020 lei; plans use 10 h |
| **Base:** plan clients | 2 Starter + 1 Growth (1.770 lei) | 2 Starter + 2 Growth + 1 Pro (5.250 lei) |
| **Base:** projects | 1 a month (≈ 5.500 lei) | 1 a month (≈ 5.500 lei) |
| **Base:** revenue a month | ≈ 7.270 lei | ≈ 10.750 lei; plans use 31 h |

What this says: in the first 6 months projects bring most of the cash and plans are retention. At the default Deep Research caps, report costs alone (up to about 2.430 lei) could exceed the conservative plan revenue, so keep the cap at 3–5 runs a day until you can see how many reports turn into projects.

**Later, once monitoring exists (day 60–90): a "Monitor" plan.** 99 lei a month (119,79 lei if VAT applies), software only: monthly automatic re-scan, alerts (site down, ANAF status, review changes), comparison with similar firms, 1 Deep Research report a quarter, email questions, no staff hours. Positioned between Confidas (199–699 lei a year, [confidas.ro](https://www.confidas.ro/preturi)) and RisCo (850 lei per 6 months, [risco.ro](https://www.risco.ro/abonamente)). Do not sell it before the scheduler and alerts work.

### 4.3 Fixed project prices (one-off)

Use these to replace `PRICE_BOOK` in `src/lib/scan/blueprint/economics.ts`.

| Project | Price, final (no TVA added) | Contract clause if VAT payer (+21%) | What is included | Delivery |
|---|---|---|---|---|
| Audit și plan (scan, Cercetare aprofundată, 90-minute session, written plan) | 1.500 lei, deducted from the project | 1.815 lei | For `/consultancy` | 5 working days |
| Remedieri site (the fixes the scan found) | from 1.500 lei, fixed after the scan | from 1.815 lei | Speed, mobile, forms, Google profile, consent banner, analytics | 1–2 weeks |
| Site de prezentare | from 4.500 lei | from 5.445 lei | Up to 6 pages in Romanian, contact form, basic SEO, GDPR pages, Google Business Profile, analytics with consent, 30 days of fixes | 2–3 weeks |
| Second language (RO/EN) | +1.000 lei | +1.210 lei | | +3–5 days |
| Site with online booking, as an integration (MERO or a calendar tool), not our own booking system | from 7.500 lei | from 9.075 lei | Everything above, plus booking and reminders through the client's tool | 3–5 weeks |
| Online shop on Shopify or Gomag | from 6.000 lei | from 7.260 lei | Setup, theme, payments, courier, Oblio or SmartBill | 3–5 weeks |
| Custom online shop | not offered by default; if asked, from 20.000 lei | from 24.200 lei | Steer clients to Shopify or Gomag. Brig quotes 10–20k lei for a mid-size shop, Binary Code €3–5k; a custom shop is long-term upkeep for a small team | 8–12 weeks |
| One automation (invoice from each order, booking reminders, lead routing) | 1.500–3.500 lei | 1.815–4.235 lei | n8n or Make; the client pays the tool fees | 1–2 weeks |
| Pack of 3 automations | from 6.000 lei | from 7.260 lei | | 3–4 weeks |
| AI assistant (site or WhatsApp) | 3.000–6.000 lei setup; upkeep in Pro, or 290–590 lei a month alone | 3.630–7.260 lei; 350,90–713,90 lei | Included and required: a visible "you are talking to an AI" notice (AI Act art. 50(1), applies since 2026-08-02); a data-processing agreement (GDPR art. 28) and a sub-processor list (Anthropic, US transfers); for clinics, health data rules (GDPR art. 9) and no medical advice, checked by a lawyer. Meta's WhatsApp fees extra | 2–4 weeks |
| Consultancy without a plan | 300 lei/h | 363 lei/h | | |
| Materiale grafice | Quote after the brief | | Not priced by the research; set it from your past jobs | |

**Market anchors:** budget sites 990–2.990 lei ([Alex-Design](https://alex-design.ro/preturi-website-prezentare-si-magazin-online/)); mid-market 3.500–7.500 lei ([Brig](https://brig.ro/serviciu/web-design)); Revelia 4.000 / 7.500 / 12.500 lei + TVA; custom sites €1.000–3.000 (Binary Code via [Agerpres, 2026-03-09](https://agerpres.ro/ots/cat-costa-un-site-si-de-ce-difera-atat-de-mult-preturile--659727)); automations €200–3.000 each ([cursuri-ai.ro, 2026-09-24](https://cursuri-ai.ro/blog/cat-costa-implementarea-ai-intr-o-firma-romania-2026-chatbot-automatizari-agenti)).

**The VAT advantage, stated correctly:** for clients who **cannot deduct VAT** (consumers, clinics and dental practices exempt under Cod fiscal art. 292, firms not registered for VAT), our 4.500 lei compares with 3.720 lei + TVA from a VAT-registered agency. For VAT-registered firms there is no difference.

**Payment terms:** 50% upfront, 50% at launch; above 10.000 lei, 40% / 40% / 20%. Invoices through Oblio (e-Factura).

### 4.4 What the scan offer should map to

Today `offer.ts` picks a plan by the size of the work, then drops to a cheaper plan while `monthlyGain − planFee ≤ 0`, valuing a saved staff hour at about 32 lei. At the new prices that rule would almost never keep Growth or Pro (a firm would need to save about 31 or 78 hours a month). So the mapping must change **in the same release** as the prices:

1. **Step 1, a first project** with a "de la" price from §4.3: no site or a broken site → Site de prezentare or Remedieri site; manual work found → 1 automation or the pack of 3; gaps in booking → site with a booking integration.
2. **Step 2, the plan after launch:** new site or fixes, at most 1 automation → **Starter**; 2–3 automations, booking or a shop → **Growth**; 4+ automations, an AI assistant or several locations → **Pro**. If even Starter does not pay back → recommend **the project alone**. That is honest and still a sale.
3. **Payback lines:** show the project's payback on its own; show the plan fee as its own monthly line ("costul lunar al îngrijirii"); never fold the plan into "investiția nu se recuperează"; put a cautious money range for new customers next to the value of hours saved.
4. **Fix the contradictions:** the build is always a separate project (Pro's "with Pro we build them" goes); lower `PROJECT_FROM_RON` from 50.000 to about 25.000 lei; "de la" only for projects, always followed by "preț fix după o discuție de 30 de minute".
5. **Update the unit economics** in the deep-engine plan §8.4 (still €20 / €50 / €200 and projects from 50.000 lei).

### 4.5 Deep Research "Premium" pricing

**What a report costs us:** about €0.94 per run, hard cap $1.50 (about 5–7 lei, plus about 21% reverse-charge VAT). The real cost is the follow-up call.

**What is decided:** every account keeps 1 free report; the Premium price is set at the switch after asking test users what they would pay (decision D24 in `.lovable/plan/vortex-deep-research-build-2026-10-03.md`).

**The catch:** an owner's first report on their own firm is free. People who would pay are mostly researching *other* companies, which is Confidas and RisCo territory (Confidas: 199 lei a year for 50 reports) and carries the lawyer items (court data). So a per-report price will bring little revenue; the value is in turning reports into projects.

| Option | Price, final (+21% if VAT applies) | Pros | Cons |
|---|---|---|---|
| C. Included in the plans | Starter 1 a quarter, Growth 2 a month, Pro 5 a month | Makes the "AI" in the plans real and concrete | Needs monthly caps per plan (today: 3 a day, Growth and Pro only) and a team-set entitlement while plans are sold by contract |
| A. Extra report, one-off, firms only (CUI) | test 149 / 249 / 349 lei (180,29 / 301,29 / 422,29), credited against a first project | Simple Stripe one-off; keeps it B2B | Low expected revenue; one e-Factura invoice per sale |
| B. Pack of 3 for partners (accountants, consultants) | 599 lei (724,79) | Feeds the partner channel | Competes with Confidas on price; needs a lawyer's check on reports about other companies |
| D. Standalone subscription ("Monitor") | 99 lei a month (119,79) | Recurring revenue without staff hours | Only after monitoring and alerts exist |

**Recommendation:** at the switch, launch **C** and keep 1 free report per account. Offer **A** as "raport suplimentar" and test the price, but judge Premium by one number: how many reports lead to a booked call and a project. Add **D** around day 60–90; **B** only after the lawyer.

**Code changes:** add `starter` to `DEEP_RESEARCH_PREMIUM_TIERS` with a monthly cap per plan (`src/lib/deep/access.server.ts`, `env.server.ts`); a one-off Stripe price (`mode: "payment"`); a webhook that links payments to accounts correctly (§2 item 6).

### 4.6 How to sell the plans: contract first, Stripe for one-offs

**Recommended default.** Sell plans with a short contract and Oblio recurring invoices (e-Factura built in; confirm the recurring feature during the free year). The pricing buttons become "Programează o discuție" or "Vreau planul Growth", which open the booking page or `/contact` with the plan pre-selected. Keep Stripe only for one-off items (the extra report, later Monitor).

**Why:** it matches "plans are for after launch"; a 3-month minimum is enforced by the contract, which Stripe does not do by itself; and it takes the Customer Portal, `tax_id_collection`, the online withdrawal button and most webhook work out of month 1. Firms get a proper invoice with their CUI from day one.

**If you later want self-serve plans:** firms only (CUI required), Customer Portal, Stripe products and prices, RON only, `locale: "ro"`, and a lawyer's sign-off on the terms.

**Before switching:** check in Stripe whether live mode is on and whether anyone already subscribes. If someone does, decide whether they keep the old price.

### 4.7 Copy guidance for the pricing section and the scan

- **Never write** "nelimitat" / "unlimited", "acces complet" or "garantat" (ROI or uptime). Write "6 ore pe lună" and "răspuns în 1 zi lucrătoare".
- **Name the tool:** "Cercetare aprofundată: 2 rapoarte pe lună", never "instrumentele noastre AI", and only once Premium is live.
- **Do not list anything that will not exist on launch day.** The uptime alert needs the monitor set up first; reports are a named staff task inside the hours.
- **"pe lună" on every hour figure**, and "orele nefolosite se reportează o lună".
- **VAT line under the prices,** once the accountant confirms: "Prețuri finale. Vortex Hub S.R.L. nu este plătitoare de TVA." Keep the "+21%" scenario in contracts only.
- **Minimum term and cancelling, in plain words:** "Growth și Pro: minimum 3 luni, apoi lunar. Ne scrii și oprim abonamentul de la luna următoare."
- **What happens next:** "În cel mult o zi lucrătoare te sunăm să stabilim prima sesiune."
- **Plans and projects together:** "Abonamentele sunt pentru după lansare. Proiectele au preț fix, stabilit înainte să începem." Show 3–4 "de la" project prices next to the plans.
- **One currency (RON).** Euro only as "≈ €" on the English site. Selling to firms in other EU countries needs the art. 317 code; keep it to Romanian clients until the accountant confirms.
- **Claims are regulated:** Legea 363/2007 (consumers) and Legea 158/2008 (misleading advertising to firms).
- **Romanian first**, English mirrors it ("abonament", not "subscription").
- **Mark the recommended plan** with a 2 px top line, not an animated "CEL MAI POPULAR" badge (ui-refresh plan, decision D5).

---

## 5. Homepage changes you asked for

### 5.1 Remove the project examples from the homepage (keep `/portfolio`)

**Status:** done in the working tree by another team, not live yet.
- `src/routes/index.tsx` shows `ProjectsLine` instead of `WorkSection`: one thin row after Services, "7 proiecte lansate, de la site-uri la aplicații private. / Vezi proiectele lansate →".
- `WorkSection` and `WorkCard` stay in the code; `/portfolio` keeps all 7 projects; "Proiecte" in the nav points to it.
- Live vortexhub.dev still shows the 5-project grid (`#work`).

**To finish:**
1. Decide whether the one-line link stays (recommended: it is not an example, and it helps visitors who want proof) or goes too.
2. Keep "7 proiecte lansate" in one place only (hero or line).
3. Before more traffic goes to `/portfolio`, fix the Bridge Gateway domain swap, the "gateaway" typo and the white FaneaProperties screenshot.
4. Do not bring the projects back as client logos: wordmarks like Momentum One or MetaFit are the examples you asked to hide. When you have one, add a single named client quote instead.
5. If "examples" meant the hero search chips ("Clinică dentară", "Magazin online", vortexhub.dev, 54747928), they live in `EXAMPLES` and `QUICK_PICKS` in `VortexSearch.tsx`. Recommendation: keep them; they teach people how to use the search.
6. Commit with the Deep Research team's batch (§6), then Publish.

**Acceptance checks:** at 1440 and 390 px the homepage shows no project frames or cards; `/portfolio` shows 7 projects; "Proiecte" opens `/portfolio`; after Publish, `curl https://vortexhub.dev/` returns no `id="work"`.

### 5.2 Representative rendered icons

**Status:** another team rendered four 3D icons from a three.js scene (`scripts/brand/render-service-icons.mjs`, `scripts/brand/service-icons/scene.js`): transparent 320 px WebP and PNG in `public/media/services/`, 10–14 KB each. `ServicesSection.tsx` already shows them. All untracked.

What they show (one family, violet, lavender and cyan glass): **Site-uri web** (stacked browser windows with a cursor), **Materiale grafice** (fanned documents with a chart), **Automatizare AI** (an infinity loop with nodes), **Consultanță** (two speech bubbles).

| Option | Where | Effort | Notes |
|---|---|---|---|
| A. Service rows | Homepage and `/services` | Done | |
| B. Top of the four service pages | `/websites`, `/digital-products`, `/ai-automation`, `/consultancy` | S | Re-render a 640 px WebP from the same scene (the 1024 px master is not committed) |
| C. Three plan icons from the same scene | Above each plan name, 40–56 px | S (half a day) | Starter / Îngrijire: a shield over a browser; Growth / Creștere: rising stacked blocks; Pro / Partener: two linked rings |
| D. A Vortex Scan icon | Nav link, `/scan` start, PDF cover | S | A lens over the vortex |

**Recommendation:** A and B now; C as one batch if you want icons on the plans (it helps compare the columns on mobile, where features hide behind "Ce include"); D later.

**Two conflicts with the design plan to settle:**
- `.lovable/plan/vortex-ui-refresh-2026-10-03.md` rule 7 (lines 140–141) bans decorative icons **and "hover lift or hover scale"**. `ServicesSection.tsx:37` lifts and rotates the icons on hover. Recommendation: keep the icons, drop the hover motion (a one-line class change), and amend rule 7 to: "Rendered service and plan illustrations from the brand scene are allowed; no icon tiles, no hover motion."
- The plan also warns against "purple everywhere" (line 7). Check the violet and cyan glass against the page in light and dark mode; if it reads too purple, re-render with a cooler palette from the same scene.

**Rules to keep:** one family from one scene; no tiles, circles, glow or gradients behind them; meaningful `alt`; lazy loading below the fold; no motion under reduced motion.

### 5.3 The hero's ASCII style in the footer

**Status:** built in the working tree by another team. `src/components/landing/ascii/VortexBand.tsx` (untracked) draws a flattened ASCII ring strip under the footer's top line, above "Hai să vorbim despre afacerea ta". It starts near the viewport, pauses off screen, on hidden tabs, under the pause switch and while the hero draws, and shows one still frame under reduced motion. Homepage footer only (`band = !compact` in `ContactFooter.tsx`), opacity 0.42.

| Option | What | Cost |
|---|---|---|
| 1. Homepage only (current) | The hero vortex opens the page, the band closes it | Nothing more |
| 2. Every page, fainter | Turn the band on in the compact footer (`SiteLayout`) at about 0.25 opacity | Those pages also need `MotionPauseProvider` and the "Oprește animațiile" switch; today only `index.tsx` provides them |
| 3. A still ASCII frame on inner pages | One pre-rendered frame as text or an image | No CPU cost, same look |
| 4. "VORTEX HUB" in ASCII | The name in the same characters as a sign-off | S; one more style to keep consistent |

**Recommendation:** option 1 now plus option 3 on inner pages, so every footer carries the look without another animation. Option 2 later only with the pause provider. At most one animated vortex visible at a time.

**Acceptance checks:** no sideways scroll at 390 px; homepage largest paint unchanged; CPU idle when the footer is off screen; still frame under reduced motion; "Oprește animațiile" stops hero and band; footer link targets at least 24 px (WCAG 2.2, 2.5.8).

---

## 6. 30/60/90-day roadmap

**Owners:** **Mihai** (decisions, content, DNS in Hostico, phone, reviews, calls, accounts for third-party services) · **Dev** (engineering in Claude Code / Lovable, coordinated with the Deep Research team) · **Contabil** · **Avocat** (consumer and data-protection law).

**Commit order (read before any commit).** The working tree mixes this work with the Deep Research team's. `src/lib/scan/blueprint/economics.ts` is modified by that team and imports an untracked file (`src/lib/deep/report/hourly`); `ResultsStep.tsx` is modified; `routeTree.gen.ts` references the untracked `scan_.deep.tsx`. Committing price-book, `offer.ts` or route-tree changes on their own can break the Lovable build or overwrite their work. Safe to commit alone: the seroval override plus lockfile, and the checkout fix (`auth-attacher.ts` is already tracked). Everything else: agree a batch with the Deep Research team. After each Publish, check that the live file names change.

### Days 1–30: safe, honest, reachable

| Week | Work | Owner | Acceptance check |
|---|---|---|---|
| 1 | seroval override, one lockfile, Publish | Dev | `bun audit` shows no critical; live file names change |
| 1 | Turn off Lovable analytics in project settings | Mihai | Live `/` no longer loads `/~flock.js` and sets no `session-id` cookie |
| 1 | Commit the checkout identity fix alone | Dev | Checkout ignores a browser-sent `userId`; the session token decides |
| 1 | Fill `SIGNATORY` phone, WhatsApp and photo (`src/components/deep/contact.ts`, photo at `public/media/team/mihai-dandea.jpg`) | Mihai, Dev | Call and WhatsApp buttons show in the Deep Research call-back block |
| 1 | Create the email or Telegram account for alerts (Claude does not sign up for services) | Mihai | Credentials stored as project secrets by you |
| 1 | Check Stripe: live or test mode, number of active subscriptions | Mihai | A written answer |
| 1 | Accountant: art. 317 code, VAT sentence, Oblio e-Factura route, euro sales | Mihai, Contabil | Written confirmation |
| 1 | In Hostico: SPF, DKIM, DMARC; 301 from vortexhub.ro to vortexhub.dev (or decide .ro is main) | Mihai | `dig TXT` shows the records; a test email passes SPF and DKIM; vortexhub.ro answers 301 |
| 1 | Alerts for contact, scan lead, call-back, consultation, new project and message, plus visitor confirmation | Dev | Each form delivers an alert within 1 minute and a confirmation to the visitor |
| 1 | Remove "nelimitat" and the AI-tool lines from the plans (old prices stay for now) | Dev, Mihai approves | `grep -ri "nelimitat\|unlimited"` in `src/` finds nothing in pricing |
| 1 | Security headers in `src/server.ts` | Dev | Responses carry a report-only CSP, `frame-ancestors 'none'`, Permissions-Policy |
| 1–2 | Romanian on the server (cheap fix) and Romanian titles | Dev | `curl -A Googlebot https://vortexhub.dev/` returns `lang="ro"` and a Romanian title and H1 |
| 2 | Review and publish the homepage changes (projects off, icons without hover motion, footer band) in the agreed batch | Mihai approves, Dev | §5 checks pass on live |
| 2 | Phone, WhatsApp, address, named person; call-back block on `/contact` and in Consultation; booking calendar | Mihai (number, calendar), Dev | Every page shows phone and WhatsApp; booking a test slot creates an event with a Meet link |
| 2 | Turnstile, rate limits, daily caps on Brave and PageSpeed; `DEEP_DAILY_RUN_CAP` 3–5 | Dev | 20 quick scan requests from one IP: the extra ones are refused; caps logged |
| 2 | Uptime monitor and Sentry | Dev | A test outage alerts; a test error reaches Sentry |
| 2 | RLS hardening and `user_roles` | Dev | A test client cannot post as `team`, change project status or confirm a consultation |
| 2 | Pricing decision (§4) and billable-hours decision | Mihai | A written decision |
| 3 | One release: new prices and hours in `plans.ts`, `PricingSection.tsx`, `PRICE_BOOK`; scan mapping and payback fix in `offer.ts` / `display.ts`; "de la" project prices; plan buttons to booking or contact | Dev (with the Deep Research team for `economics.ts`) | The scan demo recommends a project plus a plan; no "investiția nu se recuperează" under a recommended plan |
| 3 | Contract template for plans; Oblio account and recurring invoices | Mihai, Contabil | A test invoice reaches SPV |
| 3–4 | Stripe minimum for one-offs: products and prices, `session_id` check on `/billing-success`, webhook keyed by customer or payment with `payment_status` check | Dev | A test one-off payment shows on the account; opening `/billing-success` without a valid session shows no "activ" message |
| 4 | Hide unfinished portal parts (Billing page, bell, Messages) | Dev | None of them visible to a test client |
| 4 | Terms: remove ODR, add plan clauses, SAL pictogram | Avocat, Dev | Lawyer signs off; pictogram links reclamatiisal.anpc.ro |
| 4 | Cleanup: portfolio domains and typo, one service name, one reply promise, author meta, CC BY 4.0 credit on `/scan` | Dev | Visual check of `/portfolio`, `/scan`, nav and footer |

### Days 31–60: found by Google, invoiced properly, measured

| Work | Owner | Acceptance check |
|---|---|---|
| Oblio invoice from the Stripe webhook for one-off payments; invoices copied into `invoices` in RON | Dev, Contabil | A test payment produces an invoice in Oblio, uploaded to SPV |
| Cookieless analytics and the funnel; banner toggles fixed or removed | Dev | Counts for scan started → lead → call booked |
| Performance pass and self-hosted fonts | Dev | Mobile largest paint 2.5 s or less on home in the same throttled test (was 4.61 s); no requests to fonts.googleapis.com |
| 3 case studies, About page, Google Business Profile, first reviews | Mihai (content, client permissions), Dev | 3 case-study pages live; at least 5 Google reviews |
| Service pages with "Ce primești", prices, delivery times, FAQ, icon | Mihai (text), Dev | Every service page has a price, a time frame and a matching project |
| Sitemap with `/scan`, LocalBusiness JSON-LD, `/scan` start page indexable | Dev | Search Console shows the pages indexed in Romanian |
| Backups, schema in migrations, CI | Dev | A fresh Supabase project builds from migrations; weekly dump and bucket copy exist; CI runs on every push |
| `/en/…` with hreflang, only if English traffic matters | Dev | hreflang ro, en, x-default present |

### Days 61–90: turn services into products (kept light)

| Work | Owner | Acceptance check |
|---|---|---|
| Deep Research Premium switch: 1 free report, included in each plan with monthly caps, "raport suplimentar" price test | Mihai (price), Avocat (COUNSEL items), Dev | A Starter test account gets 1 report a quarter, Growth 2 a month; a firm without a plan can buy one; the payment produces an Oblio invoice |
| Monitoring (monthly re-scan and alerts) on `pg_cron` or our own Cloudflare account; then the 99-lei Monitor plan | Dev, Mihai | A test site going down alerts within 10 minutes; monthly report emails go out |
| Partnerships pilot: 2–3 accountants or consultants | Mihai | Signed referral terms; a first referred lead |
| Dashboard: Romanian nav, password change, account deletion and data export | Dev | Dashboard fully Romanian; GDPR export downloads a file |
| Accessibility fixes (skip link, focus rings, 24 px targets, landmarks) | Dev | Scripted check and a keyboard-only pass on home, `/scan`, `/contact`, `/login` |
| **Deferred until about 5 active clients:** `/admin` back office, client "Instrumente" area, MCP docs and public tools, partner-branded reports | – | Revisit at day 90 with real client numbers |

---

## Appendix: sources

All accessed 2026-10-03 unless another date is shown.

**Security, platform, tools**
- seroval advisory GHSA-mv8w-475r-vwqw: https://github.com/advisories/GHSA-mv8w-475r-vwqw
- Stripe basil change (subscription period fields): https://docs.stripe.com/changelog/basil/2025-03-31/deprecate-subscription-current-period-start-and-end ; https://dev.to/flarecanary/stripe-basil-quietly-moved-currentperiodend-off-subscription-and-a-lot-of-code-broke-3eo7
- Stripe prices and products: https://docs.stripe.com/payments/checkout/migrating-prices ; https://docs.stripe.com/products-prices/how-products-and-prices-work
- Stripe fees in Romania: https://stripe.com/en-ro/pricing
- Cloudflare Workers limits: https://developers.cloudflare.com/workers/platform/limits/
- Cloudflare Turnstile plans: https://developers.cloudflare.com/turnstile/plans/
- Cloudflare Web Analytics: https://developers.cloudflare.com/web-analytics/about/
- Sentry pricing: https://sentry.io/pricing/
- Lovable Cloud database: https://docs.lovable.dev/features/database
- Supabase backups: https://supabase.com/docs/guides/platform/backups
- Brave Search API ($5 per 1,000 calls, $5 monthly credit): https://brave.com/search/api/
- Gmail sender requirements: https://support.google.com/a/answer/81126
- Oblio: https://www.oblio.eu/ ; SmartBill: https://www.smartbill.ro/preturi

**SEO, performance, accessibility**
- Google, sites in several languages: https://developers.google.com/search/docs/specialty/international/managing-multi-regional-sites
- Core Web Vitals: https://web.dev/articles/vitals
- European Accessibility Act exemptions: https://www.taylorwessing.com/en/interface/2025/accessibility/key-eu-accessibility-act-exemptions-and-the-challenges-they-pose

**Legal and tax (Romania and EU)**
- e-Factura B2C: https://www.fiscalitatea.ro/e-factura-obligatorie-din-1-ianuarie-2025-pentru-relatia-b2c-ce-trebuie-sa-stie-firmele-23870/ ; https://startupcafe.ro/e-factura-b2c-perioada-fara-sanctiuni-expira-in-iunie-2025-ce-amenzi-risca-firmele-82751 ; https://www.fiscalitatea.ro/e-factura-b2c-23791/
- Law 88/2026 on consumer invoices (sources disagree): https://www.comarch.com/trade-and-services/data-management/legal-regulation-changes/romania-simplifies-ro-e-factura-e-invoicing-rules-for-b2c-transactions/ ; https://www.contzilla.ro/e-factura-furnizori-cu-cnp-agricultori-institute/
- VAT 21% and the 395.000 lei threshold: https://www.capital.ro/plafonul-national-de-scutire-de-tva-pentru-intreprinderile-mici-va-creste-de-la-300-000-de-lei-la-395-000-de-lei-de-la-1-septembrie.html ; https://startupcafe.ro/publicat-monitorul-oficial-ordonanta-22-2025-nou-plafon-scutire-de-tva-ce-trebuie-faca-firmele-85889 ; https://romania.europalibera.org/a/plafon-tva-intreprinderi-mici-scazut/33515513.html
- Art. 317 special VAT code and D301: https://infotva.manager.ro/articole/studii-de-caz/achizitii-intracomunitare-de-serviciicod-special-de-tva-si-depunere-d3890-19598.html ; https://www.fiscalitatea.ro/declarare-achizitie-servicii-de-la-firma-non-ue-in-301-cum-aplicam-regimul-pe-veniturile-nerezidentilor-14131/
- Micro-enterprise tax in 2026: https://www.fiscalitatea.ro/microintreprindere-in-2026-2-schimbari-importante-pentru-firme-24602/
- Online withdrawal button (Directive 2023/2673): https://www.gtlaw.com/en/insights/2026/5/eu-consumer-law-new-withdrawal-button-requirements-for-online-contracts ; https://www.iubenda.com/en/blog/the-new-online-withdrawal-function-what-eu-directive-2023-2673-means-for-your-business/
- EU ODR platform closure: https://www.iubenda.com/en/blog/discontinuation-of-the-european-online-dispute-resolution-odr-platform/ ; https://cms.law/en/svk/legal-updates/the-odr-platform-is-closing-what-businesses-need-to-know
- ANPC SAL, Order 270/2026: https://financialintelligence.ro/?p=300700 ; https://informat.ro/actualitate/anpc-actualizeaza-regulile-pentru-solutionarea-alternativa-a-litigiilor-122026 ; earlier rules: https://contabilul.manager.ro/a/27077/reguli-noi-pentru-magazinele-fizice-si-online-din-18-august-ce-placute-trebuie-sa-afiseze-comerciantii.html
- Omnibus Directive (reviews): https://eur-lex.europa.eu/eli/dir/2019/2161/oj
- AI Act art. 50 transparency (CSA note, 2026-07-29): https://labs.cloudsecurityalliance.org/research/csa-research-note-eu-ai-act-article-50-transparency-20260729/
- Law 506/2004 art. 12 (consent for commercial messages): https://legislatie.just.ro/Public/DetaliiDocument/56973 ; fines (art. 13): https://legeaz.net/legea-506-2004-prelucrare-date-caracter-personal/articolul-13
- Legea 363/2007 (unfair commercial practices, consumers) and Legea 158/2008 (misleading advertising): law texts on legislatie.just.ro
- Google Fonts ruling, LG München I 3 O 17493/20: https://www.gesetze-bayern.de/Content/Document/Y-300-Z-GRURRS-B-2022-N-612?view=Print

**Market and prices**
- Websites: Binary Code via Agerpres (2026-03-09) https://agerpres.ro/ots/cat-costa-un-site-si-de-ce-difera-atat-de-mult-preturile--659727 ; https://brig.ro/serviciu/web-design ; https://revelia.ro/creare-site-web/pret-realizare/ ; https://alex-design.ro/preturi-website-prezentare-si-magazin-online/ ; Webforge (2026-07-20) https://webforge.org.ro/blog/cat-costa-un-site-web ; https://designcreatorlab.ro/cat-costa-un-site ; https://clutch.co/profile/netreach-0 ; https://sitela90lei.ro/creare-site-de-prezentare/
- Shops: https://www.gomag.ro/resurse/regulament/regulament-kickstart-16-31-august-2026.pdf ; https://financiarul.ro/companii/un-magazin-online-in-2026-costa-de-la-500-de-euro-cat-ajunge-investitia-totala/
- Maintenance: https://tibis.ro/servicii/mentenanta ; https://iuli.dev/ ; Creative Side (2026-05-20) https://creative-side.ro/mentenanta-wordpress/ ; https://brig.ro/mentenanta-site-wordpress/bucuresti ; https://brig.ro/mentenanta-site-wordpress/arad ; https://www.acciyo.com/ro/recenzii-si-preturi-despre-emblematic-ro/
- Automation and AI: cursuri-ai.ro (2026-09-24) https://cursuri-ai.ro/blog/cat-costa-implementarea-ai-intr-o-firma-romania-2026-chatbot-automatizari-agenti ; https://automatizez.ro/ ; https://paladiumai.com/ ; https://receptionerulvirtual.ro/ ; https://chatbotsite.ro/ ; https://www.nextchapter.ro/servicii/implementare-ai/chatbot-whatsapp ; https://aifactory.ro/servicii/chatbot-ai ; Webforge (2026-08-27) https://webforge.org.ro/blog/cat-costa-un-chatbot-ai
- Tools: https://www.mero.ro/pro/preturi ; https://www.sent.dm/en/resources/sms-pricing/romania-sms-pricing
- Hourly rates: https://everhour.com/calculators/hourly-rate-calculator-in-romania ; https://clutch.co/ro/web-designers/timisoara.md
- Company-data platforms: https://apis.termene.ro/ ; https://www.risco.ro/abonamente ; https://www.confidas.ro/preturi ; https://listafirme.eu/abonamente.asp (search excerpt only)
- EU comparison: alloq.digital (2026-09-24) https://alloq.digital/de/blog/firmenwebsite-erstellen-lassen/ ; https://cenauslug.pl/firma-i-biuro/stworzenie-firmowej-strony-internetowej-do-5-podstron ; https://www.costbench.com/compare/intercom-fin-vs-tidio/ ; https://www.manypixels.co/blog/get-a-designer/designjoy-alternatives
- Grants (article dated 2024-07-24): https://startupcafe.ro/noi-fonduri-europene-digitalizare-imm-judete-timis-arad-hunedoara-caras-severin-27873
- Reviews and WhatsApp: https://brightlocal.com/research/local-consumer-review-survey/ ; https://www.pinmeto.com/news/brightlocal-local-consumer-review-survey-2026/ ; https://www.romania-insider.com/news/how-many-romanians-use-whatsapp
- Euro rate: ECB reference rate 5,3488 lei, 2026-10-02

**Live checks (2026-10-02/03)**
- vortexhub.dev: `/`, `/scan`, `/sitemap.xml`, `/~flock.js` and `/.well-known/oauth-protected-resource` fetched; `/scan/deep` 404; `/mcp` 401 without a token; `/api/public/stripe-webhook` 400 "Missing signature".
- vortexhub.ro: HTTP 402; DNS (via dns.google) NS at Hostico, MX `smtp.google.com`, only TXT a Google site verification, `_dmarc` NXDOMAIN.
- ANAF VAT register v9 for CUI 54747928: not a VAT payer; registered 2026-05-22; activity code 7020.

**Not verified**
- Stripe live or test mode, and the number of subscribers
- Lovable, Lovable Cloud and Google Workspace costs
- How many hours the team can bill
- ListaFirme and Termene platform prices; usual payment terms (no survey); the exact scope of Law 88/2026
- The dashboard in a live session (audited from code)
- Which Cloudflare plan Lovable's Worker runs on
- Oblio's recurring-invoice feature details (check in the free year)

**Key repo paths**
- Pricing and offer: `src/lib/plans.ts`, `src/components/home/PricingSection.tsx`, `src/lib/scan/blueprint/offer.ts`, `src/lib/scan/blueprint/economics.ts`, `src/lib/scan/blueprint/display.ts`
- Checkout and access: `src/lib/checkout.functions.ts`, `src/routes/api/public/stripe-webhook.ts`, `src/routes/billing-success.tsx`, `src/lib/deep/access.server.ts`, `src/lib/deep/env.server.ts`
- Contact and call-back: `src/components/deep/contact.ts`, `src/components/deep/report/CallBlock.tsx`, `src/lib/contact.functions.ts`
- Homepage: `src/routes/index.tsx`, `src/components/landing/WorkSection.tsx`, `src/components/landing/ServicesSection.tsx`, `src/components/landing/ContactFooter.tsx`, `src/components/landing/ascii/VortexBand.tsx`, `scripts/brand/render-service-icons.mjs`, `public/media/services/`
- Server and language: `src/routes/__root.tsx`, `src/i18n/LanguageProvider.tsx`, `src/server.ts`
- Database rules: `supabase/migrations/20260602123020_e7e9b846-a9e4-4d1f-9c43-b07e37d70820.sql`, `supabase/migrations/20260610002123_27dd8471-c7e1-40d6-9573-d5121c2330d7.sql`
- Plans: `.lovable/plan/vortex-ui-refresh-2026-10-03.md`, `.lovable/plan/vortex-deep-research-build-2026-10-03.md`, `.lovable/plan/vortex-scan-deep-engine-2026-10-03.md`
