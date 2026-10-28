# Vortex Hub for the UK market

Four parts, built in this order so the UK version is visible early and the deep research work comes last (it is the largest).

## 1. UK region switch (English UK + GBP)
- Add a third site option next to EN / RO: **UK** (British English, prices in pounds, UK legal wording).
- Chosen automatically for visitors whose browser says en-GB, remembered like the language choice today, changeable from the header.
- British spelling for UK visitors where it differs (optimise, organisation, enquiry).

## 2. Prices in pounds
Converted from today's lei prices at roughly 1 GBP = 5.8 RON, rounded to clean numbers:

| Item | Lei today | UK price |
|---|---|---|
| Starter / month | 290 | £49 |
| Growth / month | 790 | £135 |
| Pro / month | 1,990 | £339 |
| Extra hour | 200 | £35 |
| Consultancy hour | 300 | £52 |
| Fixed-price projects | 1,500–6,000 | £259–£1,035 (each converted the same way) |

- Every price stays in one place, so the pricing section, contact form and scan offer all show the same numbers.
- Paid card checkouts (consultation sessions) get a GBP option in Stripe; plans stay "sold by contract" as today.
- You can change any rounded price before or after building.

## 3. UK legal pages
- UK versions of Privacy (UK GDPR + Data Protection Act 2018, ICO named as the complaints authority), Cookies (PECR wording) and Terms (consumer rights wording for UK buyers; VORTEX HUB S.R.L. stays the seller, Romanian law, with UK consumer protections kept).
- Cookie banner text adjusted for UK visitors.
- Wording to be reviewed by your lawyer — I'll flag that on the pages' drafts, not on the live site.

## 4. Deep research for UK companies
- On the research page, choose **Romania (CUI)** or **United Kingdom (company number)**.
- UK data from the official free UK company register (Companies House): name, status, incorporation date, registered address, SIC activity codes, directors and past directors with their other appointments, people with significant control (owners), filing history, accounts dates, charges (loans secured on assets), insolvency notices.
- Financial figures from filed accounts when available (small UK firms often file only a balance sheet — the report will say so instead of guessing).
- Court/insolvency checks via The Gazette notices; news, social profiles, marketplaces and the AI company profile reuse today's steps with UK search wording.
- Atlas works the same: every fact source-linked; directors' networks come from the register itself (strongest source, not "Likely").
- Each UK report uses one deep check, same plans (Free 1, Premium 4).

## What you'll need to provide
- A free Companies House API key (takes 5 minutes at developer.company-information.service.gov.uk). I'll ask for it when we reach part 4.

## Technical details
- Region becomes `Language | "en-GB"` style locale with a currency field; `pricing.ts` gains `priceGbp` per item (explicit numbers, not live FX), tested in a small price test.
- New `src/lib/deep/uk/` steps: Companies House client (basic auth with the key, polite pacing like the ANAF pacer), mapped into existing `contracts.ts` facts with a `jurisdiction` field; pipeline dispatch picks RO or UK steps; RO-only steps (ANAF balance sheets, just.ro, TED-RO peers) skipped for UK.
- Research input accepts 8-character company numbers (e.g. 01234567, SC123456) with validation.
- SEO: hreflang en-GB alternates and UK-specific titles/descriptions on main pages.
