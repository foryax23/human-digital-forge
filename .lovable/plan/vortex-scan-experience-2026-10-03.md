# Vortex Scan — the 5-screen experience (plan)

The owner's 5-screen concept (search-first hero → live analysis → business overview → strategy
options → personalised roadmap), rebuilt in the Vortex brand, upgraded, and wired to a real engine.
Engine research (data sources, costs, infrastructure) lives in
`vortex-scan-engine-2026-10-03.md`; this plan covers what the visitor sees and the functions behind
each element.

## Journey

| Step | Screen | Route | What happens |
|---|---|---|---|
| 01 Find business | Hero search | `/` | Visitor types a company, CUI or website; live suggestions from the Romanian company index |
| 02 Analyse | "Analysing your business…" | `/scan?cui=…` / `?url=…` | 8-item checklist runs for real while a 3D globe lights up data-source cards as each finishes |
| 03 Generate strategy | Business overview → Strategy options | same route, stage 3 | What we found (company, website score, presence, technologies, competitors), then 3 strategies to compare or see as a roadmap, with a live simulation |
| 04 Get results | Personalised roadmap | same route, stage 4 | Month-by-month plan, 6/12/24-month impact, the offer, PDF download (with consent) |

A stepper (01–04) sits under the nav on every scan screen; finished stages stay clickable.

## Brand adaptation

- Palette: the Vortex night (`#00020f` space, `#04061a` glass), violet `#6c63ff` → blue `#5b8cf0` →
  sky `#89cbf6` for accents and the primary buttons, mint `#5fe3d0` for success/done ticks; no new
  colours. Glass panels: `bg-[#070a1f]/70`, `border-white/10`, `rounded-3xl`, soft violet glow on the
  active/recommended element (the mockup's blue outline on strategy 02).
- Type: Space Grotesk (headings, numbers), DM Sans (body). The mockup's title weight and sizes are
  matched; letter-spaced eyebrows and the spaced "V O R T E X  H U B" wordmark stay.
- Motion: the existing Motion + GSAP stack, every loop under the page-wide pause switch and
  `prefers-reduced-motion`.

## Screen by screen

### 01 — Hero (homepage)
- Left column: eyebrow "Business intelligence meets real solutions" / "Inteligență de business,
  soluții reale"; title "Discover your **business** potential." / "Descoperă **potențialul**
  afacerii tale."; pitch "Search any business and let Vortex Hub analyse its digital footprint,
  simulate strategies and create a personalised automation plan."; the glass search pill with the
  placeholder "e.g. Dental clinic Bucharest or www.yourdentist.ro".
- Right: the vortex with four orbiting labels — Analyse, Automate, Growth, Strategy — riding
  elliptical paths (upgrade: they orbit slowly, brighten when the search is focused, and each
  label scrolls to its explanation).
- Search (WAI-ARIA combobox): company suggestions (name, CUI, city, status) as you type, a "Scan
  website …" row when the input is a URL, a "Look up CUI …" row for digits; keyboard, loading
  shimmer, empty state that offers a website scan.
- Bottom bar: **real** proof instead of the mockup's stock avatars — thumbnails of the live
  projects with "7 live projects launched"; "Scroll to explore"; "Powered by AI · Built for real
  business outcomes".

### 02 — Analysing your business…
- Checklist (left) = the engine's real steps: Identifying business (ANAF + index) · Scanning website
  (crawl) · Detecting technologies · Analysing online presence · Researching competitors · Mapping
  customer journey · Finding automation opportunities · Generating strategy options. Each ticks only
  when its call returns; a live line under the active step shows what was just found.
- Right: a Three.js globe (already in the stack) centred on Romania; each data source becomes a
  floating glass card linked to the globe as it completes — Website (pages analysed), Social media
  (profiles found), Business info (city, activity), Reviews (only with Google Places data),
  Technology stack (detected), Competitors (how many found). Upgrade: arcs travel from the globe to
  each card when data lands; mobile/reduced motion gets a static map with the same cards.
- Never fake progress: steps that can't run (no website, no API key) are marked "skipped" with why.

### 03a — Business overview
- Company card: website screenshot/Open Graph image, name, activity and city tags, Google rating
  only when real, website/phone/address. "Edit business" lets the visitor correct the activity,
  city or website and re-runs only the affected steps (upgrade).
- Tabs: Digital presence · Technologies · Market position · Customer journey.
  - Digital presence: website score ring (overall) with Performance, SEO, Accessibility,
    Conversion, Content bars; channel tiles (Google Business, Facebook, Instagram, LinkedIn,
    YouTube) with Active / Detected / Opportunity — follower counts never shown unless measured.
  - Technologies: detected stack grouped (CMS, analytics, marketing, chat, booking, payments).
  - Market position (upgrade): local competitors from the company index (same activity and city)
    and, where they have a website, their website score next to yours.
  - Customer journey (upgrade): discover → consider → contact → book/buy → return, each stage marked
    strong / weak / missing from the audit signals, with the fix.

### 03b — Strategy options
- Three cards (Win more customers · Automate operations · AI assistant — wording adapts to the
  business type), each with tactics, the headline outcome with its basis, implementation level,
  time to value and investment (€ / €€ / €€€ plus a RON range). The recommended one glows.
- Toggle: Comparison view ↔ Roadmap view (the same three as a timeline).
- Upgrade — **Strategy simulation**: sliders for team size, hourly cost and volume; savings,
  payback and outcomes recalculate live from the same formulas the engine uses.
- CTA "View recommended roadmap".

### 04 — Your personalised roadmap
- Timeline 01 Foundation (month 1) · 02 Automation (months 2–3) · 03 AI assistant (months 3–4) ·
  04 Growth (months 4–6), each with brand artwork, bullets and an Essential / High impact / Growth tag.
- Estimated impact toggle 6 / 12 / 24 months: cumulative savings vs. cost curve with the payback
  point (upgrade), and the outcome tiles.
- Actions: Start your project · Book a consultation · Download the blueprint PDF (name, email,
  consent → stored in `audit_leads` → designed PDF) · copy a share link.

## Honesty rules (non-negotiable)
- Every number is either measured (shown as data) or an estimate with its assumptions one tap away.
- No stock testimonials, follower counts, review counts or competitor claims we didn't obtain.
- Outcome ranges come from the playbooks' stated assumptions, never from the model's imagination;
  Claude may adjust assumptions and wording, the money math is deterministic.
- A visible "Estimates, not guarantees" note on strategy, roadmap and PDF.

## Functions behind the screens

| Element | Source | Module |
|---|---|---|
| Suggestions | Trade Register open data (Sept 2026), legal entities only, sharded static index | `src/lib/scan/company-search.ts`, `scripts/scan/build-company-index.mjs` |
| Company details | ANAF v9 API (free, live) | `src/lib/scan/anaf.server.ts` |
| Website | Trade Register WEB column → domain guesses verified by CUI/name on the page | `src/lib/scan/discover.server.ts` |
| Website audit | Crawl ≤6 pages, 40+ deterministic checks, tech fingerprints | `src/lib/scan/audit/*` |
| Performance + screenshot | PageSpeed Insights API (optional key) | `src/lib/scan/audit/pagespeed.server.ts` |
| Presence | Social links on the site; Google rating via Places API when keyed | `src/lib/scan/presence.server.ts` |
| Competitors | Company index (same activity words + city) | `src/lib/scan/competitors.ts` |
| Business type, opportunities, strategies, roadmap, projection, simulation | Playbooks + Romanian wage data; Claude (Opus 5.5) refinement when keyed | `src/lib/scan/blueprint/*` |
| Leads | Existing `audit_leads` table | `saveScanLead` in `src/lib/scan.functions.ts` |
| PDF | @react-pdf/renderer in the browser, fonts embedded | `src/components/scan/pdf/*` |

## Keys (all optional — the scan works without them)
`ANTHROPIC_API_KEY` (AI refinement), `PAGESPEED_API_KEY` (higher PageSpeed quota),
`GOOGLE_PLACES_API_KEY` (ratings/reviews count), `BRAVE_SEARCH_API_KEY` (website discovery when
the registry has none). Set them as Lovable secrets; never in the repo.

## Acceptance
- A real Romanian company (e.g. CUI 54747928) goes from search to PDF with no mock data.
- A website-only scan works for any public site; unreachable sites degrade gracefully.
- Every animated element has a reduced-motion version; the flow works by keyboard and screen reader.
- EN/RO everywhere; 375 px to 1920 px without overflow; no console or hydration errors.
