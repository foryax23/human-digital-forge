# Vortex Scan: engine, architecture and delivery plan

Date: 2026-10-03. This plan covers the engine, data, AI, PDF, costs and milestones behind the
search-first hero. Its companion, `vortex-scan-experience-2026-10-03.md`, covers the screens. Where
the two disagree, this plan wins; §16 lists every change.

**Pipeline:** Vortex Scan → Business Graph → Strategy Simulation → Blueprint.
**Rule:** Claude judges, code counts. Every number is measured, sourced, or computed by versioned code.

**Labels used in this plan**
- `[Rn]` is a source in the table at the end.
- **UNVERIFIED** means no primary source confirmed the fact.
- **(local)** means the figure comes from our own downloads, parses or prototypes, which are in
  `/private/tmp/claude-501/-Users-dandeamihai-Desktop/98201317-c5fd-4bed-b3dd-e616a5f40dda/scratchpad/scan-research/`.
- **FOLLOW-UP: infra** marks work the infra research should have covered. That area did not
  return (see §4.9).

---

## 0. Summary of decisions

| # | Decision |
|---|---|
| 1 | **Search index:** build our own index from ONRC open data (CC BY 4.0, monthly). Store it in a **dedicated Supabase Pro project, `vortex-intelligence` (EU)**, using Postgres `pg_trgm` + `unaccent`. Do not use a paid API for autocomplete. |
| 2 | **Index scope:** v1 indexes **legal entities only** (≈1.31M active, plus suspended or insolvent ones with a badge). Sole traders (PFA/II/IF) can be found by exact CUI only. The legal-representatives files are never ingested. |
| 3 | **Runtime:** the scan runs inside the Lovable-hosted TanStack Start app. It is a **server-owned state machine driven by the browser**: 5 short phases, each a streaming server function. State lives in the database, so a dropped connection resumes. Before any of this is built, a 1–2 day spike checks Lovable's real limits. |
| 4 | **Audit:** a deterministic rule engine with 66 rules (19 from PageSpeed/CrUX, 47 our own), where every finding carries evidence. PageSpeed and CrUX data come with a free Google Cloud key. Technology detection uses our own fingerprint rules. Romanian compliance checks are worded as "not detected on N pages". |
| 5 | **AI:** four structured-output calls to `claude-opus-5-5` (profile, opportunities, website recommendations, blueprint). Anonymous scans get a **free teaser built by the rules engine (no LLM)**. The **full AI blueprint and the PDF are unlocked by email and consent**. |
| 6 | **Money:** hours saved × a loaded hourly cost from INS release 229/2026, shown as ranges with a 0.6 realisation factor. Opportunities that take more than 24 months to pay back are hidden. Claude never writes a number. |
| 7 | **PDF:** `@react-pdf/renderer` 4.9 generates the file in a browser Web Worker, loaded lazily. It is a 14-page designed template. The animated experience lives in a shareable web report; a PDF cannot animate. |
| 8 | **Monthly cost:** ≈ **$54 / $225 / $2,030** at **100 / 1,000 / 10,000 scans**, assuming 25% of visitors unlock the AI blueprint. The LLM is about 90% of variable cost (§12). |

## 0.1 What already exists (repo audit, read-only, 2026-10-03)

| Item | State | Consequence |
|---|---|---|
| Search-first hero in the mockup style (`HeroSection.tsx`, `HeroCosmos.tsx`, `VortexSearch.tsx`) | Committed in `16b5d85`. `HeroCosmos.tsx` has uncommitted edits. Submitting shows a placeholder toast: "Vortex Scan is almost ready". | M0 changes the copy and wires in the combobox. Do not rebuild the hero. |
| `src/lib/scan.functions.ts` | **Untracked work in progress.** Imports `anaf.server`, `audit/index.server`, `audit/pagespeed.server`, `blueprint/*`, `discover.server` and `presence.server`, none of which exist yet. | Keep these modules as the **step library**. Replace the stateless RPCs, where the client orchestrates every step, with the scan-ID phases in §10. |
| `createBlueprint` (work in progress) | Calls Claude with **client-supplied** company, audit and presence data. No Turnstile, no rate limit, no budget. | **Must fix before any deploy.** Anyone could spend our LLM budget and forge reports. The server must build the blueprint only from facts it stored itself. |
| `src/lib/scan/net.server.ts` | Done. SSRF-guarded `safeFetch` (DoH, manual redirects, 2 MB cap), RFC 9309 robots parser, user agent `VortexScan/1.0`. | Reuse it. Remove ports 8080 and 8443 from `ALLOWED_PORTS` (policy is 80/443 only). |
| `src/lib/scan/types.ts` + `fixtures/sample-blueprint.ts` | The shared contract (`Blueprint`, RON `Range`, bilingual strings). | Every stage and the PDF read this contract. Add the fields listed in §10.3. |
| `src/components/scan/{report,pdf,globe}`, `public/fonts/*.ttf` (Space Grotesk 500/700, DM Sans 400/500/700) | Started | The fonts cover the PDF spec. The globe is parked (§3.4). |
| Dependencies | `@anthropic-ai/sdk ^0.131.0`, `@react-pdf/renderer ^4.9.0`, `qrcode`, `node-html-parser`, `three` (already present), `zod ^3.24.2` (3.25.76 installed) | Bump `zod` to `^3.25.0`, because the SDK's helpers need `zod/v4`. |
| `supabase/migrations/` | **Correction to the brief:** it exists, with 9 Lovable-generated files and `config.toml` (project `fihhxvteymkkhvnosuyh`). | Intelligence-project migrations must **not** go in this folder, because Lovable would apply them to Lovable Cloud (§4.3). |
| `audit_leads` table | Appears in the generated types but has no tracked migration, so its RLS is unknown. | Do not use it for Scan leads (§10). |
| Realtime policy (migration `20260610002123`) | Any authenticated user can read and send on every topic. | Never put scan data on Lovable Cloud Realtime. |
| `public/robots.txt`, `public/sitemap.xml` | Committed. The live vortexhub.dev returned 404 for both on 2026-10-03 (local). | The site has not been published in Lovable since. Publish before the dogfood scan. |
| `.output/server/wrangler.json` | `ASSETS` binding + `nodejs_compat` only | No Queues, Durable Objects, Workflows, KV or Cron inside the Lovable app (§4.2). |

## 0.2 Research coverage

| Area | Status |
|---|---|
| Romanian company data | Returned |
| Website discovery + audit | Returned |
| AI engine + savings | Returned |
| Runtime, data + jobs | Returned |
| PDF | Returned |
| UX + motion | Returned |
| **Infra** | **Did not return.** These items need a follow-up research pass and are tagged **FOLLOW-UP: infra**: Lovable plan limits, Cloudflare account setup, email provider and deliverability, the CI runner for the ETL, backups and disaster recovery, staging, uptime monitoring and alerting. |

---

## 1. Vision and product ladder

**Flywheel:** consultancy generates insight → the scan makes that insight repeatable → the data and
rules become Vortex intellectual property. The same scan engine, the Business Graph and the
simulator serve three products.

| Tier | Who | What they get | Engine | Price / billing |
|---|---|---|---|---|
| **Free scan, teaser** | Anyone, no account | Identity, business type (with an "Adjust" control), 4 scores, top 3 findings, first savings range, locked cards | Registry + audit + rules engine. **No LLM.** | Free |
| **Free scan, full blueprint** | Visitor who gives an email and consent | All findings, AI blueprint (steps A–D), 30/60/90 plan, offer, PDF, share link | Adds 4 Claude calls | Free (lead capture) |
| **Professional blueprint** (later, L1) | Prospect who wants depth | Up to 30 pages crawled, PageSpeed on 5 URLs, named competitors via web search, full consent/journey checks, a 30-minute walkthrough | Adds step E (competitors) and a durable job | **New one-off Stripe Checkout** (`mode: "payment"`), credited against a project. Price is an owner decision. |
| **Vortex Client monitoring** (later, L3) | Paying clients | Monthly digest: new competitors, competitor pricing changes, performance drops, review themes (from their own Google Business Profile via OAuth), martech changes, new automation opportunities | Monthly snapshot diff + 1 batch LLM call (≈ $0.06 per client per month, estimate) | **Bundled into the existing Growth €50 and Pro €200 plans** (`src/lib/plans.ts`, `subscribers.tier`). No new subscription SKU at first. |

**Reuse of what exists**
- Stripe checkout is already in subscription mode (`checkout.functions.ts`). Professional adds a
  one-off payment mode in the same file.
- Monitoring checks `subscribers.status`/`tier` in Lovable Cloud.
- Offer mapping uses `PLAN_PRICING` and never hard-codes prices.
- Scans claimed after sign-up appear in `dashboard.*` (L1).

---

## 2. Hero redesign (search-first, mockup style + owner copy)

The mockup is already implemented and committed: centred brand block, glass pill with a breathing
rim and a top-edge light streak, a white CTA and a black CTA. M0 changes **copy, structure and
behaviour**, not the look. The layout follows the UX research's recommendation, called "Variant B,
brand-led".

| Order | Element | EN | RO |
|---|---|---|---|
| 1 | Eyebrow (existing) | Digital studio · Est. 2026 | Studio digital · Fondat în 2026 |
| 2 | H1 (existing) | **Vortex Hub** | **Vortex Hub** |
| 3 | Rotating tagline (existing; pauses on focus) | {Websites} for people with vision. | {Site-uri web} pentru oameni cu viziune. |
| 4 | **Visible search `<label>`** (owner copy) | What could your business do better? | Ce ar putea face afacerea ta mai bine? |
| 5 | Helper text, linked with `aria-describedby` | Enter your company, CUI or website and let Vortex analyse the opportunity. | Scrie numele firmei, CUI-ul sau adresa site-ului și lasă Vortex să analizeze oportunitățile. |
| 6 | Search pill (combobox, §3) | placeholder: Search a company or website… | Caută o firmă sau un site… |
| 7 | Trust line (12 px) | Free · about 45 seconds · public data only | Gratuit · aproximativ 45 de secunde · doar date publice |
| 8 | Chip row (`<ul aria-label>`, not interactive, wraps on 2 lines on mobile) | Public digital footprint · Technology · Customer journey · Competitors · Automation · AI · Growth | Prezență digitală publică · Tehnologie · Parcursul clientului · Concurență · Automatizare · AI · Creștere |
| 9 | CTAs (existing) | Start a project · Book a consultation | Începe un proiect · Programează o consultanță |

**Further hero changes**
- **Paragraph:** the 3-line paragraph ("Vortex Hub combines strategy…") moves to the meta
  description and the Services intro. Vertical space stays about the same.
- **Trust-line timing:** "45 seconds" replaces the UX deck's "~30 s". It must match the measured
  p50 scan time from M2; update the copy if the measurement differs.
- **A/B test after launch:** "Variant A", with the question as H1 and the brand in the nav only.
- **Superseded:** the experience plan's split layout ("Discover your business potential", orbiting
  labels) is replaced.

**Visual spec**
- Pill: `clamp(320px,44vw,640px)` × 64 px, interior ≈ `#050917`, 1.5 px border
  `rgb(141 170 228/.45)`, 44 px arrow button `linear-gradient(135deg,#7A85F7,#89CBF6)` with a
  `#050917` arrow (contrast 6.17:1, local).
- Breathing glow: 5.6 s CSS loop. The streak runs once on hover (1.4 s).
- Focus: the pill expands to 704 × 68 px with a Motion `layout` spring, plus a 4 px focus ring.
  The glow alone is not a sufficient focus indicator.
- Loops are CSS so that `html[data-motion=paused]` freezes them.

**Background asset (owner decision, §14).** The mockup's deep-space vortex (asteroids,
violet-to-sky-blue light) cannot be extracted from the flattened mockup. The live hero uses the
square purple swirl loop plus generated asteroids. Required deliverable:
- a clean still, ≥ 3840 × 2160, with the vortex and asteroid foreground on separate layers if
  possible;
- a seamless 8–12 s loop, encoded through the existing HLS pipeline (`public/media/vortex-swirl`,
  540p/1080p), with the 1080p loop ≤ 3 MB;
- an AVIF or WebP poster ≤ 200 KB.

The eye of the vortex should sit at 50% / 44% on mobile, behind the copy (`VORTEX_CENTRE`).

**Mobile (< 640 px).** Focusing the input switches to a **full-screen takeover**:
- the pill pins under the safe area, with a 44 px "Cancel";
- the suggestion list is sized from `visualViewport` [R73b];
- Back closes the takeover (via a history entry);
- input text is ≥ 16 px so iOS does not zoom (secondary source, UNVERIFIED).

---

## 3. End-to-end flow, motion choreography, accessibility

### 3.1 Flow

```
type → suggestions → pick (or Enter rule) → scan console (5 phases, 8 steps, live findings)
  → teaser report (free) → "Unlock the full blueprint" → lead form + consent
  → AI steps A–D stream in → full web report → Download PDF (Web Worker) / Copy share link
  → next step: book a call · start plan · scan another company
```

Where the scan lives:
- **On the homepage**, at `/?scan=<id>` (zod-validated search parameter). The pill-to-console morph
  is then a same-page layout animation.
- `/scan/$scanId` renders the same console or report directly, with no morph, for refreshes, deep
  links and shares.
- `/scan?q=` is the no-JS fallback (the `<form role="search" action="/scan">` posts there before
  hydration).

### 3.2 State machine (single `useReducer`, `src/components/scan/scan-machine.ts`)

**States:** `idle`, `focused`, `typing`, `loadingSuggestions`, `results`, `noResults`, `selecting`,
`scanning`, `complete`, `leadForm`, `generatingPdf`, `pdfReady`, `downloaded`, `error{where}`,
`rateLimited`.

**Overlays (not separate states):**
- input `mode`: `name`, `cui`, `cuiInvalid`, `cnpBlocked` or `website`;
- `degraded` flag on `scanning` and `complete`.

The scan ID is in the URL, so a refresh resumes from the server's state.

| Key rule | Behaviour |
|---|---|
| Mode detection | Runs on every keystroke, in under 0.1 ms. CUI = `(RO)?\d{2,10}` plus checksum (key `753217532`); a failed checksum means `cuiInvalid` and no request is sent. Exactly 13 digits means `cnpBlocked`: never sent, never logged. A URL or `label.tld` switches to `website` mode. |
| Enter | Picks the active option; else a valid website; else an exact CUI match; else a single result. Otherwise it opens the list without scanning. Arrow keys never start a scan. |
| Suggestion requests | 120 ms debounce. Each new keystroke aborts the previous request. 3 s timeout. Spinner only after 150 ms. Stale results stay visible at 60% opacity. |
| Scan stream | Silence for 15 s switches to polling `getScan` every 2 s for up to 30 s, then `error{scan}`. |
| Cancel | Inline confirmation, not a modal. **Esc never cancels a scan.** "Wrong company? Change" needs no confirmation during the first 10 s. |
| Progress honesty | Weighted by real step completion and never goes backwards. Capped at 99% until `done`. Each step stays visible ≥ 500 ms, with ≤ 3 s of artificial delay in total. Findings are real, queued ≥ 350 ms apart. A cached scan replays at about 3× speed with "Scanned N days ago · Rescan". |

### 3.3 Choreography (GSAP + Motion + CSS only; AGENTS.md forbids other runtimes)

| Moment | Spec | Timing |
|---|---|---|
| Dropdown enter / exit | opacity, y −8→0, scale .98→1; rows stagger 25 ms; exit uses ease-in | 220 ms in / 140 ms out |
| Keyboard highlight | shared `layoutId="suggest-highlight"` pill | spring, visualDuration .18 |
| Select → console morph | pill `layoutId="scan-surface"` becomes the console (radius 999→28 set via `style`, needed for scale correction [R71]); hero copy exits with 30 ms stagger; console content fades in at +420 ms | spring, visualDuration .6, bounce .12; ≈ 650 ms |
| Vortex reaction | GSAP: video wrapper scale 1→1.14 toward the console centre; core glow 0→.7; scrim 40→55%. Calms to 1.04 and 90% scrim when the report shows. | 1.6 s `expo.out` |
| Radar sweep, node pulse, loader dots | CSS keyframes (decorative; frozen by the pause switch) | 2.8 s / 1.4 s loops |
| Progress arc and bar | Motion `MotionValue` + spring, **never CSS**, so it keeps running while paused (essential progress, WCAG 2.2.2 Note 4 [R70]) | visualDuration .5 |
| Completion | ring pulse, nodes converge, **one** burst ring (never a flash, WCAG 2.3.1), console morphs into the report header | ≈ 800 ms |
| Report reveal | gauges draw (900 ms, stagger 90 ms); savings counters 1.2 s (Intl-formatted, `aria-hidden` digits + an sr-only final value); cards stagger 70 ms; charts draw in view, once | ≈ 2.4 s above the fold; **any scroll or keypress completes it** |
| PDF "printing" | A4 silhouette assembles by **real** worker stages, then the real page-1 thumbnail crossfades in | minimum 1.2 s |

Durations follow NN/g's 100–500 ms guidance for UI transitions [R73]. Only large spatial changes
and data reveals run longer.

Why show the work at all: making it visible raises the perceived value of a slower service
(Buell & Norton 2011 [R74]), but only when the work is real.

Budgets:
- ≤ 8 KB gz added to the hero JS;
- ≤ 60 KB gz for the lazy console + report chunk, prefetched on input focus;
- INP ≤ 200 ms while typing [R75].

### 3.4 Scan console and phases

The console is a hand-rolled **SVG radar** with 8 step nodes in 4 owner phases, a step list, a
live findings ticker and a 2 px progress bar. Step IDs reuse `ScanStepId` from `types.ts`.

| Owner phase | Steps (`ScanStepId`) | Server phase (§4.4) |
|---|---|---|
| Vortex Scan | `identify`, `website` | P1 identify; P2 footprint |
| Business Graph | `technology`, `presence`, `competitors` | P3 audit; P2 footprint |
| Strategy Simulation | `journey`, `opportunities` | P4 intelligence |
| Blueprint | `strategy` | P4 intelligence + P5 finalize |

**Decision:** the experience plan's three.js globe (`src/components/scan/globe/`, in progress) is
**parked**. The morph happens on the homepage, where AGENTS.md allows only GSAP + Motion + CSS. The
radar carries the same events and is lighter on mobile. Revisit the globe for `/scan/$scanId` on
desktop after M5 if the owner wants it (§14).

### 3.5 Accessibility (WCAG 2.2 AA)

**Combobox**
- Custom WAI-ARIA 1.2 / APG "list autocomplete" (`useCombobox.ts`, about 200 lines) [R69].
- **Not cmdk.** The installed cmdk 1.1.1 hard-codes `aria-expanded="true"` and overrides props
  (local source inspection).
- The input has `role=combobox`, a real `aria-expanded`, `aria-controls` and
  `aria-activedescendant`.
- Option groups are labelled. Options contain no interactive children. Deregistered companies are
  `aria-disabled`.

**Live regions**
- Results count: one polite `role=status` message, 500 ms after results settle.
- Step completions: announced at most once every 3 s.
- `role=progressbar` with `aria-valuetext` "Step 3 of 8: Auditing the website".
- The findings list is **not** live; read it on demand.
- Errors use `role=alert` [R70].

**Focus**
- To the console `<h2 tabIndex=-1>` on mount, because the input unmounts.
- To the report heading on completion.
- To the first invalid field when the lead form fails.
- To the Download button when the PDF is ready.
- `scroll-padding-top: 88px` keeps focused items clear of the fixed nav (2.4.11).

**Motion**
- `<MotionConfig reducedMotion="user">` [R71], `gsap.matchMedia({ reduceMotion })` [R72] and CSS
  media queries.
- With reduced motion, morphs become 200 ms crossfades and gauges, counters and charts render at
  their final values. Progress still updates.

**Other**
- Pause switch: decorative loops freeze; progress and findings continue.
- Targets ≥ 24 px; the arrow button and rows are ≥ 44 px (2.5.8).
- Colour is never the only signal (1.4.1).
- Charts use `role="img"` with a "View as table" toggle.
- In the RO UI, English brand terms are wrapped in `lang="en"`.

---

## 4. System architecture

### 4.1 Diagram

```
 Browser (hero combobox · scan console · report · PDF Web Worker)
   │ GET  searchCompanies(q) ─────────────┐
   │ POST startScan(target, turnstile)    │   Lovable-hosted TanStack Start  (Cloudflare Workers module,
   │ POST runScanPhase(1..5)  ⇠ stream ───┤   nitro cloudflare-module; ASSETS binding only)
   │ GET  getScan  (poll / resume / share)│   src/lib/scan.functions.ts        ← thin RPC layer (zod)
   │ POST submitLead · createShareLink    │   src/lib/scan/**/*.server.ts      ← portable step library
   │                                      │      (fetch + WebCrypto only: runs on workerd, Deno, Node)
   ▼                                      ▼
 Lovable Cloud (existing, unchanged)     Supabase "vortex-intelligence" (NEW · Pro · eu-central-1)
  auth · profiles · dashboard ·           companies (~1.56M) · company_aliases · company_suppressions
  subscribers (Stripe) · contact          caen_codes · company_financials · domain_verifications
                                          scans · scan_steps · scan_events · findings · blueprints
                                          leads · share_links · source_cache · rate_limits (unlogged)
                                          api_usage · budget_daily · (later) monitoring_*
                                          pg_cron ─► pg_net POST /api/public/scan-tick (secret header)
 External APIs (server-side only):
  ANAF v9 / bilant / e-Factura (1 req/s, DB throttle) · PageSpeed Insights + CrUX (Google key)
  DNS-over-HTTPS · Brave Search (discovery) · Claude API (claude-opus-5-5, structured outputs)
  Vortex-owned Cloudflare account: Turnstile · tiny "vortex-scan-browser" Worker (Browser Rendering)
 Offline (separate private repo "vortex-intelligence-data"):
  GitHub Actions monthly ETL: data.gov.ro CKAN → stream-parse → COPY into staging → atomic swap
  + db/migrations for the intelligence project (never in this repo's supabase/migrations)
```

### 4.2 Runtime choice and justification

| Constraint (verified) | Effect on the design |
|---|---|
| Lovable's build forces nitro `cloudflare-module`; the deployed `wrangler.json` has only `ASSETS` (local) | No Queues, Workflows, Durable Objects, KV or Cron Triggers in-app. Orchestration lives in Postgres (leases + pg_cron) and in the browser. |
| Workers CPU: Free 10 ms, Paid 30 s default. Subrequests: Free 50, Paid 10,000. 6 concurrent connections waiting for headers. 128 MB memory [R25] | **Lovable's actual plan is not documented** [R58] (UNVERIFIED). Every phase is sized for the worst case: ≤ 40 subrequests, ≤ 25 s, ≤ 6 parallel fetches, I/O-bound. |
| No wall-clock limit while the client is connected, but a disconnect may cancel work; `waitUntil` adds ≤ 30 s [R25] | Each step persists its result before yielding. Phases are idempotent (leases). The pg_cron sweeper finishes abandoned scans that have a lead. |
| TanStack Start server functions can be async generators or return `ReadableStream` [R48]. The installed handler frames them as `application/x-tss-framed` (local) | Progress streams over the phase call itself. **Whether Lovable's proxy buffers it is UNVERIFIED**, so polling `getScan` is a first-class fallback. |
| Lovable hosting: 1,000 server requests per project per 10 s for TanStack apps created from 13 May 2026 [R58] | Fine for autocomplete (debounced) at our volumes. Each keystroke request counts. |
| Lovable secrets are write-only; the `SUPABASE_` and `LOVABLE_` prefixes are reserved [R59] | Intelligence secrets are named `VI_SUPABASE_URL` and `VI_SUPABASE_SECRET_KEY`. |
| Env vars bind at request time on Workers (`src/lib/config.server.ts`) | Clients (Supabase, Anthropic) are created **inside handlers**. |

**Portability.** All step code is plain `fetch` with string/SAX parsing; there are no Node or
workerd-only APIs and no HTMLRewriter. If the spike fails:
- (a) **CPU cap ≈ 10 ms:** move the steps to a Supabase Edge Function `scan-runner` (400 s wall,
  2 s CPU on paid [R64]) and keep the UI on polling;
- (b) **stream buffered:** polling only;
- (c) **volume grows:** a Vortex-owned Worker with Workflows ($5 per month plan [R26]).

**Spike S1–S6 (part of M0, 1–2 days, on the published Lovable URL)**

| Test | What it checks |
|---|---|
| S1 | A 90 s async generator that yields every second: buffering and cut-offs on desktop and mobile |
| S2 | 60 sequential fetches in one invocation: whether the 50-subrequest cap applies |
| S3 | CPU used parsing a 749 KB page (dedeman.ro) with `node-html-parser`. Fallback is htmlparser2 SAX, which measured 3–4× cheaper (local benchmark). |
| S4 | Whether `getRequestIP()` returns `cf-connecting-ip`, and whether `waitUntil` is reachable |
| S5 | Fetch success against 50 Romanian SME sites, and ANAF reachability from Lovable's egress (shared egress IPs could be throttled; UNVERIFIED) |
| S6 | `pg_trgm` p95 on the full dataset from the Worker (gate: ≤ 150 ms end to end) |

Record the results in this file.

### 4.3 Data stores

| Store | Holds | Why |
|---|---|---|
| **Lovable Cloud** (existing) | Auth, profiles, portal, Stripe `subscribers`, contact | Unchanged. |
| **`vortex-intelligence`** (new Supabase Pro, Small compute 2 GB, EU) | Company index, scans, findings, blueprints, leads, caches, usage ledger, later monitoring | Lovable Cloud documents **no direct Postgres connection string and no extension list**, so a 1.3M-row bulk `COPY` and `pg_trgm` cannot be relied on. It also has **no one-click migration out** [R59]. Supabase Pro gives transparent pricing ($25 + compute), pg_trgm, unaccent, pg_cron, pg_net and pgmq [R60, R61, R62], and the core Vortex IP stays owned by VORTEX HUB S.R.L. |

Rules for the intelligence project:
- **Schema lives in the separate `vortex-intelligence-data` repo** (`db/migrations/`). Putting it
  in this repo's `supabase/migrations/` would make Lovable apply it to Lovable Cloud.
- Access is **server-only**, with a Supabase secret key (`sb_secret_…`; legacy JWT keys are being
  phased out by end of 2026 [R63]).
- RLS is deny-all, and `anon`/`authenticated` grants are revoked.

### 4.4 Job orchestration

1. `startScan`:
   - verifies Turnstile and checks rate limits;
   - resolves the target;
   - reuses a scan of the same target completed in the last 7 days (**replay scan**,
     `source_scan_id`);
   - otherwise inserts `scans` + `scan_steps`;
   - returns `{scanId, scanToken}`. The token is 32 random bytes; only its SHA-256 is stored, and
     the client keeps it in `sessionStorage`.
2. The browser calls `runScanPhase(p)` for p = 1…5 in order. Each call:
   - leases its steps with `claim_scan_steps` (`lease_until = now()+60s`, at most 3 attempts);
   - runs them with ≤ 6 concurrent fetches and `AbortSignal.timeout`;
   - **persists each result** to `scan_steps.result`, `findings` and `scan_events(seq)`, then
     yields;
   - after a reconnect, replays events with `seq > afterSeq`.

| Phase | Steps | Subrequests | Target wall time |
|---|---|---|---|
| P1 Identify | index row; live ANAF v9 (+ bilant, cached); CAEN resolve | 2–6 | 0.5–3 s |
| P2 Footprint | discovery cascade (§5.4); DoH MX/SPF/DMARC; socials from the homepage; local competitors from the index | 8–18 | 2–8 s |
| P3 Audit | **start PSI mobile + desktop first**, then robots, sitemap and ≤ 6 pages, 404 probe, ≤ 20 link HEADs, CrUX, browser check via `vortex-scan-browser` | 15–35 | 8–25 s (hard cap 60 s, then `partial`) |
| P4 Intelligence | rules classification + savings (always). Claude A → (B ‖ C) → code metrics → D **only for leads** | 0–4 | 0.2 s (teaser) / 60–150 s (AI; latency UNVERIFIED, measure in M3) |
| P5 Finalize | scores, offer mapping, `blueprints` row, share-link eligibility | 2–4 | < 1 s |

**Sweeper.** pg_cron runs every minute and calls `net.http_post(…/api/public/scan-tick)` with
`timeout_milliseconds := 55000`; the default 2,000 ms is too short [R62]. It fires only when stale
`running` scans with a lead exist. The route finishes ≤ 5 scans per tick, then sends the report
email (provider: FOLLOW-UP: infra).

**Later.** Professional and monitoring jobs go on a `pgmq` queue drained by the same tick. A
Vortex-owned Worker with Workflows comes in only when volume justifies it.

### 4.5 Search index

- `searchCompanies(q)` is a GET server function that calls the `search_companies(q, lim, county)`
  RPC.
- Per-isolate LRU cache: top 2,000 queries, 5 min.
- Debounce 120 ms, at least 2 characters.
- Queries under 4 normalised characters use a `text_pattern_ops` prefix index. Longer queries use
  trigram `%` plus a prefix boost. A CUI goes to exact lookup.
- **Gate:** p95 ≤ 150 ms end to end over 500 sampled queries. Otherwise switch to Typesense Cloud
  (1 GB cluster, about $15–45 per month, UNVERIFIED [R67]) behind the same interface.
- Algolia is rejected: about $1.6k per month at 4.1M records [R66].
- The experience plan's sharded static index is rejected:
  - monthly snapshots would bloat git and the deploy;
  - no live alias or suppression updates;
  - weak typo tolerance;
  - no popularity boost.

### 4.6 Progress transport

1. **Primary:** the streamed async generator per phase.
2. **Fallback:** `getScan` polled every 1.2 s with a `version` ETag.
3. **No Supabase Realtime for anonymous visitors.** Lovable's Realtime policy leaks across users,
   and the new project would need its own auth.

The UI keeps each step on screen for a minimum time, so the choreography stays smooth even when the
backend answers instantly.

### 4.7 Caching (`source_cache`, keyed by `(source, key)`)

| Source | TTL |
|---|---|
| ANAF v9 | 7 d |
| ANAF bilant / MF financials | 90 d |
| DNS / TLS | 1 d |
| robots.txt | 24 h (RFC 9309 [R28]) |
| Crawl + tech stack | 7 d |
| PSI | 3 d |
| CrUX | 1 d |
| Blueprint | 7 d, keyed by `(cui, domain, calc_version, prompt_version, rule_set_version, locale)` |

Brave results are **not stored**; storage needs a plan that grants storage rights [R36]. Only the
derived `domain ↔ CUI` verification is kept. Places content is not cached (§5.5).

### 4.8 Secrets (names only)

**Lovable secrets (server)**

| Name | Purpose |
|---|---|
| `VI_SUPABASE_URL`, `VI_SUPABASE_SECRET_KEY` | Intelligence project access |
| `ANTHROPIC_API_KEY` | Claude API |
| `GOOGLE_API_KEY` | PSI + CrUX |
| `BRAVE_SEARCH_API_KEY` | Website discovery |
| `TURNSTILE_SECRET_KEY` | Bot protection |
| `SCAN_BROWSER_URL`, `SCAN_BROWSER_TOKEN` | `vortex-scan-browser` Worker |
| `SCAN_TICK_SECRET` | Sweeper route |
| `IP_HASH_SALT` | HMAC of visitor IPs |
| `SHARE_LINK_SECRET` | Share links |
| `EMAIL_API_KEY` | Email provider (FOLLOW-UP: infra) |

**Other locations**
- `.env` (public, build time): `VITE_TURNSTILE_SITE_KEY`.
- Intelligence project Vault: `site_base_url`, `scan_tick_secret`.
- ETL only, never in Lovable: `VI_DATABASE_URL`.

### 4.9 FOLLOW-UP: infra (the area that did not return)

| Item | Open question |
|---|---|
| Lovable plan | Which plan the workspace is on, and its CPU and subrequest caps (the spike covers part of this) |
| Cloudflare account | Account for Turnstile, Workers Paid and `vortex-scan-browser`; `@cloudflare/puppeteer` deployment and token scoping; whether REST quick actions can expose cookies for the consent check (UNVERIFIED) |
| Email | Provider (report link, lead notification, monthly digest), pricing, and SPF/DKIM/DMARC on the sending domain |
| ETL runner | GitHub Actions minutes for a private repo (UNVERIFIED) |
| Data safety | Backups / PITR and restore drill for the intelligence project |
| Environments | Staging: a Lovable preview pointing at a staging intelligence project |
| Monitoring | Uptime, error tracking (Sentry pricing and compatibility UNVERIFIED), alert routing |
| DNS for vortexhub.dev | MX/SPF/DMARC (§6.6) |

None of this blocks M0–M1. All of it must be closed before M4.

---

## 5. Data sources

### 5.1 Romanian company index

| Layer | Source | Licence / cost | Cadence | Fields used |
|---|---|---|---|---|
| Identity + status | ONRC `firme-DD-MM-YYYY` on data.gov.ro: OD_FIRME (694 MB) + OD_STARE_FIRMA (92 MB) [R1] | CC BY 4.0, €0 | ≈ monthly since May 2025; August 2026 was skipped [R2] | DENUMIRE, CUI, COD_INMATRICULARE (both formats), EUID, FORMA_JURIDICA, ADR_JUDET, ADR_LOCALITATE, DATA_INMATRICULARE, WEB (mostly empty), status codes |
| Labels | `nomenclatoare-DD-MM-YYYY`: N_CAEN (651 Rev.3 classes), N_STARE_FIRMA (197), N_VERSIUNE_CAEN [R3] | CC BY 4.0 | per snapshot | RO labels, CAEN version |
| Size + main CAEN | MF `situatii_financiare_2025`: WEB_UU + WEB_BL_BS_SL, `CUI,CAEN,I1..I20` [R4] | €0. **The 2025 licence field is empty** (2024 was CC BY 4.0) | yearly (June) + "actualizat" re-releases | I13 turnover, I18 net profit, I20 employees, CAEN (no version flag) |
| Live at scan time | ANAF v9 VAT/registry (≤ 100 CUIs per request, 1 req/s) [R6]; bilant 2019–2025, 1 CUI per request [R7]; e-Factura registry [R8] | €0, no key | real time, cached | VAT, e-Factura, fiscal inactivity, current `cod_CAEN`, financial trend |
| English CAEN labels | Eurostat NACE Rev.2.1 + correspondence [R10] | €0 | static | Class-level matching of CAEN Rev.3 to NACE 2.1 is UNVERIFIED (spot checks only) |
| Rev.2 → Rev.3 | ONRC correspondence table, September 2026 edition [R9] | €0 | ad hoc | many-to-many map |

**Counts (local parse of the 02.09.2026 snapshot)**

| Group | Rows |
|---|---|
| All rows | 4,219,081 |
| Active (`1048`) | 1,784,256 |
| Struck off (`1084`) | 2,188,325 |
| Suspended / dissolving / insolvent | ≈ 246k |
| Active legal entities | 1,310,407 |
| Active PFA/II/IF | 473,876 |
| WEB field filled (active) | 6,560 (so ONRC is not a website source) |
| Active firms with co-status 2069 "sediu expirat" (a free audit signal) | 187,419 |
| MF 2025 coverage | 834,443 active legal entities (64%) |

The index includes ≈ 1.56M rows: active legal entities plus suspended, dissolving and insolvent
ones. Struck-off firms are excluded.

**ETL (monthly, GitHub Actions in `vortex-intelligence-data`)**
1. Find the newest `firme-*` and `nomenclatoare-*` through the CKAN API [R2]; detect changes with
   HEAD and Last-Modified.
2. Stream-parse: UTF-8 with BOM, CRLF, `^` delimiter, `DD/MM/YYYY` dates. Validate headers and
   **fail loudly** on drift.
3. Join status codes. Keep active plus suspended, dissolving and insolvent rows. **Drop CUIs
   matching `^[1-8]\d{12}$`** (≈ 122k CNP-like legacy rows).
4. Deduplicate on CUI, preferring the active row (95,158 CUIs are duplicated).
5. Normalise names and join the latest MF figures.
6. Resolve CAEN as `(code, version, source)`. Precedence: ANAF v9, then MF, then ONRC. Codes that
   exist only in Rev.2 are tagged Rev.2.
7. `COPY` into `companies_staging`, swap in one transaction, record `snapshot_date`.
8. Alert when headers change or row counts fall more than 5%.

The prototype load took about 4 minutes to download and 48 s to build (local).

**Normalisation (identical for names, queries and aliases)**
- Lowercase.
- Fold both cedilla (ş ţ, U+015F/U+0163) and comma-below (ș ț, U+0219/U+021B) forms, plus ă â î.
- Strip `s.c.`, `srl`, `s.r.l.`, `srl-d`, `sa`, `pfa`, `ii`, `if`.
- Turn `&` and other non-alphanumerics into spaces and collapse whitespace.
- For display, convert cedilla to comma-below and use smart title case. Keep legal forms as
  written.

**Query routing**
1. Digits (with or without `RO`) that pass the checksum → exact CUI. If missing from the index,
   look up live in ANAF v9; this covers firms newer than the snapshot.
2. `[JFC]\d{1,2}/\d+/\d{4}` or `[JFC]\d{13}` → registration number.
3. A dot plus a TLD, or `http` → domain. Check `company_aliases(kind='domain')`, otherwise go
   straight to the website scan.
4. Otherwise → name search.

**Ranking**
```
score = 10×text(exact 3 | prefix 2.5 | word-prefix 2 | trigram sim)
      + status(active 0 | suspended −4 | dissolving/insolvent −6)
      + log10(turnover+1) + log10(employees+1)
      + 3 if registered < 18 months ago and no financials
      + 1 if same county as the visitor or typed in the query
      + log(1+scans_30d)
```
Prototype lessons (local): a plain substring search for "emag" put CEMAGRO first, which
word-prefix ranking fixes. The eMAG brand is legally Dante International, so the `company_aliases`
table is required. It is seeded from verified scans, ONRC WEB domains and manual curation.

### 5.2 GDPR stance

| Topic | Rule |
|---|---|
| Legal entities (SRL/SA…) | Not data subjects. Index and scan freely. Never pull administrator or shareholder names. |
| **PFA / II / IF** | Natural persons: the firm name is the person's name, and the seat is often their home (CJEU C-398/15 Manni: register data is personal data [R13]). **v1: not in name autocomplete. Reachable by exact CUI only, via live ANAF.** Store no address or phone. No public pages about them. Redact their contact data in stored evidence. If they are added later: name, county, city and CAEN only, plus a legitimate-interest assessment, an Art. 14 notice and a suppression list. |
| Representatives files | **Never ingested** (names, birth dates and places). |
| CNP-like values | Dropped at ETL. A 13-digit query is blocked in the browser (Law 190/2018 art. 4 requires safeguards [R12]). |
| Opt-out | A `company_suppressions` table, filled from the `/scan-bot` objection form, hides a company from suggestions and scans immediately. |
| Attribution | Footer, report and PDF: "Sursa: ONRC / Ministerul Finanțelor, data.gov.ro, CC BY 4.0, date la DD.MM.YYYY". The EU High-Value Datasets Regulation 2023/138 requires basic company data to be open, and GDPR still applies to any personal data in it [R11]. |

### 5.3 Enrichment

- **ANAF v9:** one server-side queue with a **DB-backed global token bucket** of 1 req/s.
  Per-isolate limits do not work across Workers. Batches up to 100 CUIs, exponential backoff,
  7-day cache. Never called from the browser. ANAF warns that overload attempts are penalised [R6].
  The live test (CUI 54747928) returned VORTEX HUB S.R.L., CAEN 7020, in 0.77 s (local).
- **Bilant:** 2019–2025 trend, sequential, cached 90 days. The official doc still says 2014–2019;
  the service returned 2019–2025 (local).
- **Free audit signals from the registry:**
  - registered-office proof expired (2069);
  - not in RO e-Factura;
  - fiscally inactive;
  - CAEN still on Rev.2 after the **25.09.2026** update deadline [R9] (updating is free, and there
    is no fine);
  - no website on record.

  Each is worded as an observation, never an accusation.

**Paid APIs.** Termene and RisCo look up by CUI only. openapi.ro has a name search but returns
limited, unpaginated results [R14, R15, R16]. None is used in v1. Termene is a candidate for
Professional-tier extras (courts, insolvency).

### 5.4 Website discovery cascade

| Step | Method | Cost |
|---|---|---|
| 1 | Visitor-typed URL. Still verified by CUI for the badge. | $0 |
| 2 | **Domain guessing:** slugs of the normalised name (joined, hyphenated, first 1–2 tokens, acronym) × `.ro .com .eu .net .shop .store .online .info .dev .io` → DoH → GET the top ≤ 8 that resolve → parked-page detection | $0 |
| 3 | **Brave Search API**, ≤ 2 queries (`"name" city`, `"name" CUI`), `search_lang=ro`, aggregator blocklist (listafirme, termene, risco, totalfirme…). Socials kept as footprint signals. | $5 per 1k, $5 free credit per month [R36] |
| 4 | Claude `web_search` (`max_uses` 3), **Professional only** | $10 per 1k + tokens [R40] |

**Scoring:** +60 CUI match (checksum-valid, from home, contact, terms, privacy, cookies and
footer); +25 exact legal name; +15 city or street; +10 phone; +10 slug similarity; −40 different
valid CUI (agency or parent); −30 parked page.

**Outcome:**
- ≥ 60: verified.
- 30–59: ask "Is this your website?"
- < 30: "no website found", which becomes the headline opportunity.

**Rejected:**
- Bing Search API: retired 11 Aug 2025 [R38].
- Google CSE: closed to new customers, ends 1 Jan 2027 [R37].
- Serper and SerpApi: Google sued SerpApi in December 2025 [R39].
- ROTLD WHOIS: never discloses registrants (local).

### 5.5 Google Business data

- **Places API is off in v1.** Vortex Hub has an EEA billing address, so Places content (other than
  place_id and lat/lng) may be used only for 9 permitted uses [R43]. The EEA terms forbid saving
  reviews, "creating content" from Maps content and ML use (EEA ToS §3.3.2) [R43]. **Analysing
  "negative review themes" from Places is not allowed.**
- A live, attributed, uncached rating and count *might* fit permitted use #3 ("sales team's
  opportunities"). It needs legal sign-off first. Price: Place Details Enterprise $20 per 1k after
  1k free per month [R42].
- **Reviews for Vortex Client** come from the client's own Google Business Profile via OAuth
  (`accounts/{a}/locations/{l}/reviews`). That needs an approved API application: a profile
  verified for 60+ days and a website; default 300 QPM [R44]. **Apply in M5.**
- v1 presence signals: links on the site to Maps or Business Profile, plus social profiles linked
  from the site.

---

## 6. Website audit engine

### 6.1 Crawl rules

| Rule | Value |
|---|---|
| User agent | `VortexScan/1.0 (+https://vortexhub.dev/scan-bot)`, plus a published bot page with an opt-out address |
| Methods | GET/HEAD only. Never forms, logins or carts. |
| Concurrency | ≤ 2 per host, ≥ 250 ms spacing |
| Timeouts and caps | 10 s per request, 2 MB body cap, ≤ 5 redirects re-validated per hop (already in `net.server.ts`) |
| robots.txt | Honoured for every page beyond the user-triggered homepage. 4xx means allow; 5xx or unreachable means no crawl (PSI and CrUX still run) [R28] |
| Page selection | Nav and footer links scored by RO/EN regex: contact, despre/about, termeni/terms, confidentialitate/privacy, cookie, servicii/produse/shop, blog, programari/rezervari. Fallback: sitemap (≤ 500 KB read [R29]). |
| Page caps | Free: 6 HTML pages + robots + sitemap + 404 probe + ≤ 20 link HEADs. Professional: 30. |
| JS shell | If the SSR HTML has < 300 visible characters, the static rules run on the **rendered DOM** from the browser stage. Never fail on content the scanner could not see. |
| SSRF | http/https only, ports 80/443, no IP literals or private ranges, DoH answers re-checked |
| Blocked by a WAF | Mark the checks `unverified`, keep PSI and CrUX (Google-run), try the browser once |

### 6.2 Deterministic checklist (66 rule IDs, `rule_set_version` pinned per scan)

**States:** pass / fail / warn / n/a / unverified. Only `fail` with `confidence=confirmed` appears
as a problem. Every result carries evidence ≤ 300 characters: URL, header, selector count,
Lighthouse ID and value, DNS record or cookie name. A source that failed gives `unverified`, never
`fail`. Thresholds marked † are Vortex heuristics, worded as "recommended".

| Group | Checks | Examples (pass rule → fail severity) | Data source |
|---|---|---|---|
| Performance (PERF-01…11) | 11 | Mobile performance score ≥ 0.90 → <0.50 High. LCP ≤ 2.5 s, INP ≤ 200 ms, CLS ≤ 0.1 at p75 [R21]. TTFB ≤ 0.8 s. `image-delivery-insight`, `render-blocking-insight`, page weight ≤ 3 MB†, `third-parties-insight`, `use-cache-insight` | PSI, CrUX |
| SEO (SEO-01…11) | 11 | Homepage indexable → **Critical**. Title and meta description. ≥ 1 H1 (several is not a fail). Canonical. robots + sitemap. Organization/LocalBusiness JSON-LD. OG image returns 200. LH SEO ≥ 0.90. 0 broken links among ≤ 20 sampled. Soft-404 | Static, PSI |
| Accessibility (A11Y-01…08) | 8 | LH accessibility ≥ 0.90. `html[lang]` matches the text language. image-alt, label, color-contrast, link/button names, zoom allowed. EAA accessibility statement (n/a when not e-commerce or a micro-enterprise; Law 232/2022, secondary source [R76]) | Static, PSI, registry |
| Security, privacy, RO compliance (SEC-01…09, PRV-01…04, RO-01…04) | 17 | Valid HTTPS → **Critical**. HTTP→HTTPS redirect. HSTS ≥ 15552000†. Baseline headers. CSP. Mixed content. Version disclosure. EOL stack (PHP ≤ 8.1 is EOL [R35]). Email authentication: SPF+DMARC, or null MX + `-all` + p=reject for non-mail domains [R34]. **No tracking cookies or tracker hits before consent** (Legea 506/2004 art. 4(5) [R32]). Reject button on the first layer (EDPB taskforce [R33]). Consent Mode v2 [R82]. Privacy and cookie policy reachable. **CUI + trade-register number found on any crawled page** (Legea 365/2002 art. 5 [R30]). ANPC SAL link for B2C shops (secondary source [R77]; Order 270/2026 changes UNVERIFIED). Stale EU ODR link (platform closed 20 Jul 2025 [R31]). Shop terms + returns page | Static, browser, DNS, registry |
| Conversion + trust (CNV-01…10) | 10 | `tel:` link. CTA above the fold at 390×844. Lead path within 1 click. **Opportunities:** WhatsApp/chat, online booking (n/a when the CAEN is not appointment-based), social proof, analytics, lead capture, business email domain, Maps/Business Profile link | Static, browser, registry |
| Content (CNT-01…05) | 5 | Freshness ≤ 180 days†. EN version (Opportunity, sector-gated). hreflang reciprocity. Cedilla diacritics ≤ 20%†. ≥ 250 words† | Static |
| Technology (TEC-01…04) | 4 | Stack identified (info only). Tag hygiene. `viewport-insight`. Builder leaks (generator, `twitter:site`, preview-domain `og:image`) | Static, PSI |

The audit research summarised this as "48 checks", but its own tables list **66 rule IDs**. This
plan adopts all 66:
- **19** are read straight from PSI/CrUX: PERF-01…11, SEO-09, A11Y-01 and 03–07, TEC-03.
- **47** are Vortex's own static, browser, DNS and registry rules.

All 66 ship in M2.

**Gating rules from the 6-site prototype** (vortexhub.dev, emag, dedeman, libris, gomag, smartbill;
12–20 fails each, local). These fixed observed false positives:
- consent and privacy checks are verified in the browser (custom banners, JS-rendered footers);
- a shop is detected by platform fingerprint or schema.org Product/Offer plus a cart, never by a
  text regex alone;
- "not found" only after searching ≥ 6 pages;
- the scanner's own latency is never reported as the site's TTFB; that comes from CrUX or
  Lighthouse.

**"Always find something" without inventing**
- Output buckets: **Issues** (confirmed fails, ranked by severity weight 10/6/3/1 × business
  relevance by CAEN), **Opportunities** (capabilities the vertical needs but the site lacks),
  **Strengths** and **Not verified**.
- Lighthouse categories below 90, email-auth checks and opportunity checks gave ≥ 3 items on every
  test site.
- A site that passes everything moves on to stack-derived "advanced" opportunities, for example
  WooCommerce without SmartBill/AWB integration → order-to-invoice automation.

### 6.3 PageSpeed Insights + CrUX

- `runPagespeed` with all 4 categories, mobile **and** desktop, in parallel, `locale=ro`, with a
  60–90 s client timeout [R18].
- **A key is mandatory in practice:** a keyless call on 2026-10-03 returned `429`,
  `defaultPerDayPerProject = 0` (local).
- The quota is 25k per day per project according to a secondary source, UNVERIFIED. Confirm it in
  Cloud Console.
- **Field data comes from the CrUX API** (free, 150 queries per minute, PHONE/DESKTOP, 28-day
  window) [R19]. Google plans to remove CrUX data from PSI [R17].
- Many Romanian SMEs have no CrUX data. Field checks are then n/a, and lab values are labelled
  "lab".
- **Lighthouse 13 changed the audit IDs** [R20]. Map checks to `render-blocking-insight`,
  `image-delivery-insight`, `document-latency-insight`, `cls-culprits-insight`,
  `lcp-discovery-insight`, `third-parties-insight`, `use-cache-insight` and `viewport-insight`.
  `font-size` and `offscreen-images` no longer exist. Unit-test the ID mapping against saved PSI
  JSON.

### 6.4 Technology detection

- **Primary:** Vortex-owned curated rules for about 150 SME technologies, in a
  Wappalyzer-compatible JSON format extended with `vx` fields (`business_signals`,
  `automation_hooks`). Each pattern must be validated on ≥ 10 live sites.
- **Includes the Romanian vendors the open forks lack:** MerchantPro, Netopia/mobilPay, EuPlatesc,
  LibraPay, Twispay, 2Performant, Profitshare, Compari, Trusted.ro, FAN Courier, Sameday RO, and
  SmartBill/Oblio/FGO widgets.
- **Fork bug to avoid:** the open fork's "Sameday" entry is a US AI phone company (local).
- **Optional enrichment:** enthec/webappanalyzer (GPL-3.0, 7,628 fingerprints) [R22], in an
  **isolated, server-only** module with its licence file. Serving it from a SaaS backend is not
  "conveying" [R23]. It must **never** be shipped to a browser, extension, SDK or on-prem build.
- Commercial Wappalyzer ($250 per month for 5k lookups [R24]) is rejected.

### 6.5 Browser stage (`vortex-scan-browser`, a Vortex-owned Worker + Browser Rendering)

- One mobile session at 390×844, 10–15 s.
- Checks: cookies and tracker requests fired before any click (5 s idle); reject button on the
  first layer; `dataLayer` consent defaults; rendered DOM for SPAs; JS-global fingerprints;
  an above-the-fold JPEG screenshot for the PDF.
- Cost: 10 h per month included on Workers Paid, then $0.09/h [R27]; ≈ 2,400 scans included.
- Until the account exists, these checks are `unverified`, never `fail`.

### 6.6 Dogfood: fix vortexhub.dev before launch (local findings, 2026-10-03)

The first public demo scan will be of our own site, so these must be fixed first:
1. Publish robots.txt and the sitemap (already committed).
2. Put `VORTEX HUB S.R.L. · CUI 54747928 · J2026033767000` in the global footer.
3. Remove `meta author=Lovable`, `twitter:site=@Lovable` and the lovable.app `og:image`; add a
   branded 1200×630 image.
4. Add per-locale URLs with `hreflang`.
5. Serve WebP/AVIF with width and height set.
6. Add CSP with `frame-ancestors`.
7. Add a `tel:`/WhatsApp CTA.
8. DNS for vortexhub.dev: `MX 0 .`, `v=spf1 -all`, `_dmarc p=reject` (mail runs on vortexhub.ro).

---

## 7. AI engine

### 7.1 Who does what

| # | Step | Done by | Output |
|---|---|---|---|
| D1–D4 | Registry, crawl, PSI/CrUX, 66-rule audit (W1…Wn) | Code | facts |
| D5 | Redact personal data; sanitise; build a **facts dossier** with stable IDs (F1…, W1…, M1…), serialised deterministically, 6–10k tokens | Code | dossier |
| R | **Rules blueprint** (teaser): CAEN + keyword vertical classification, playbook tasks, savings, offer | Code (`buildRulesBlueprint`) | `Blueprint` with `engine:"rules"` |
| **A** | Business profile + process map (Business Graph) | Claude, effort `medium` | `BusinessProfile` |
| **B** | Automation opportunities with explicit task assumptions | Claude, effort `high` | `Opportunities` |
| **C** | Website recommendations from the W findings (runs in parallel with B) | Claude, effort `low` | `WebsiteRecs` |
| D6 | Strategy Simulation: hours, money, payback, ROI as low/typical/high | Code | metrics M1…Mn |
| D7 | Offer mapping (plan + project band) | Code (rules) | offer |
| **D** | Blueprint narrative, 30/60/90 plan, offer pitch, discovery questions | Claude, effort `medium` | `Blueprint` narrative |
| D8 | Fill placeholders, validate, store, render | Code | report, PDF |
| E | Competitors via `web_search` (Professional, background) | Claude ×2 | `Competitors` |

**Steps A–D run only after the visitor gives an email and consent.** Before that, the teaser uses
R. Step B receives the vertical's playbook task list and default ranges, and may adjust frequency
and minutes only within ×0.5–×2, clamped in code. The refined numbers therefore stay close to the
teaser.

### 7.2 Call settings (verified against the claude-api skill and SDK 0.131.0 source)

**Model and request settings**
- Model `claude-opus-5-5` for every step: $4 / $20 per MTok, cache reads $0.20 [R40].
- Thinking is always on and cannot be disabled. **Set `output_config.effort` explicitly**; the
  default is `medium`.
- Use `client.beta.messages.stream(...)` with `betas: ["server-side-fallback-2026-07-01"]` and
  `fallbacks: "default"` [R46].
- Structured output: `output_config.format = betaZodOutputFormat(schema)` from
  `@anthropic-ai/sdk/helpers/beta/zod`, with **zod/v4** schemas [R45]. Read
  `finalMessage().parsed_output`.
- Check `stop_reason` first:
  - `refusal`: degrade to the deterministic sections;
  - `max_tokens`: retry once with a higher limit (`max_tokens` 12k–32k, because it includes
    thinking).
- No forced `tool_choice` (returns 400 on Opus 5.5). No assistant prefill.
- Create the client inside the handler (`maxRetries: 2`, `timeout: 180_000`).

**Schema rules**
- All fields required: use `""` or `[]`, never nullable unions. This stays within the limits of 24
  optional and 16 union parameters [R45].
- No min/max in the schema; clamp in code.
- **No field named `reasoning`, `thinking` or `trace`.** Those names trigger billed
  `reasoning_extraction` refusals [R46]. Use `rationale` (2–3 sentences).

**Caching**
- A frozen system prompt of ≈ 3.5k tokens with `cache_control`. No dates or language switches in
  it; the language goes in the user turn.
- Changing the output format invalidates the cache, so v1 accepts little caching within one scan
  (it would save ≈ $0.08).
- v2 option: a constant set of strict `emit_*` tools so the dossier prefix is cached across steps.

**Competitors (E)**
- Call 1: `web_search_20260209` or newer (`_20260318` per the docs), `max_uses` 5,
  `user_location` RO with city and timezone, no structured output, citations shown [R41].
- Call 2: no tools, structured `Competitors` output. Two calls are used because structured outputs
  and citations are incompatible [R45].
- Handle `pause_turn`.

**Monthly digest (L3)**
- Batch API at $2/$10 per MTok, effort `low`.
- Batches reject `fallbacks`, so re-run any refused items as normal calls.

### 7.3 Output schemas (field lists)

- **A `BusinessProfile`:**
  - `display_name`;
  - `activity_check{caen_code_used, caen_rev[rev2|rev3|unknown], website_consistency, fact_ids[]}`;
  - `business_type{vertical (≈25 enum: restaurant_cafe … other), sub_vertical, business_model[b2b|b2c|b2b2c|mixed], sales_channels[], confidence}`;
  - `evidence[]{claim, fact_ids[], quote}`;
  - `processes[]` (6–12): `{process_id, name, category (14 enum), roles_involved[], digital_maturity, basis[observed_on_website|registry_data|sector_typical], fact_ids[], pain_points[]}`;
  - `data_gaps[]`, `rationale`.

  Size, employees and financials are filled by code, not Claude.
- **B `Opportunities`:**
  - `opportunities[]` (5–10): `{opportunity_id, title ≤70 chars, process_id, category (9 enum), problem, proposed_solution}`;
  - per opportunity, `tools[]{name, kind[detected_on_site|saas_suggested|custom_build], fact_ids[]}`;
  - per opportunity, `tasks[]` (1–4): `{task, freq_month_{low,typical,high}, minutes_{low,typical,high}, people, role, automation_share_{low,typical,high}, basis[observed|sector_benchmark|vortex_assumption], basis_note}`;
  - per opportunity, `implementation{complexity[quick_win|standard|advanced], build_hours_low/high, tool_cost_eur_month_low/high, dependencies[]}`, `risks[]`, `confidence`, `evidence[]`;
  - `excluded_ideas[]{title, why_not}`, `rationale`.
- **C `WebsiteRecs`:**
  - `has_website`, `overall_assessment`, `strengths[]{text, finding_ids[]}`;
  - `recommendations[]{rec_id, finding_ids[] (≥1, or content/conversion with fact_ids + quote), area (10 enum), title, why_it_matters, what_to_do, effort[hours|days|weeks], impact, priority, vortex_can_deliver}`;
  - `quick_win_ids[]`, `no_website_plan`, `rationale`.
- **D `Blueprint`:**
  - `headline`;
  - `executive_summary` (≤ 120 words; numbers only as `{{m.<id>}}` placeholders);
  - `top_priorities[3]{ref_id, why_now}`;
  - `phases[3]{phase[days_0_30|days_31_60|days_61_90], goal, items[]{ref_id, action, owner[vortex|client|joint], deliverable, success_metric}}`;
  - `kpis[]{name, baseline_fact_id, target_description}`;
  - `offer_pitch`, `included_in_offer[]`, `discovery_questions[]`, `cta`.

  The disclaimer and the assumptions appendix are fixed text generated by code.

**Clamps applied by code:**
- frequency 0–10,000 per month;
- minutes 0.5–480;
- people 1 to employees (or 50 if unknown);
- automation share 0–0.95;
- build hours 2–400;
- low ≤ typical ≤ high, enforced by sorting.

### 7.4 Guardrails

**1. Only supplied facts**
- Every `fact_ids` entry must exist.
- Every `quote` must be a verbatim substring of the cited fact, after normalising whitespace and
  diacritics.
- Every `finding_ids` entry must exist in W.
- Every `ref_id` must resolve.
- A `detected_on_site` tool must match the fingerprint list.
- On failure the claim is demoted to an assumption or dropped. If more than 20% of claims fail, the
  step retries once.

**2. Numbers:** a regex gate rejects digits in narrative fields unless they are `{{m.*}}`
placeholders or quoted dates and codes. Code fills the placeholders with RO formatting (1.234,56
lei) or EN formatting.

**3. Prompt injection**
- Each page is wrapped as `<untrusted_website_content source="F12" url=…>`.
- Before that, the code strips scripts, styles, comments, hidden text and zero-width characters, and
  caps each page at ≈ 2k tokens (8k in total).
- **Calls that see scraped text get no tools**, so nothing can be fetched or exfiltrated.
- Output is schema-bound and rendered as plain text. PDF links come only from the dossier URL
  allowlist.
- Phrases like "ignore previous instructions" are logged as a finding.

**4. Personal data**
- Emails, +40/07xx phones, 13-digit numbers, IBANs and administrator names are replaced with
  `[EMAIL_1]`-style tokens before any call. The map stays on the server.
- **The visitor's own lead data never goes to Claude.**
- Anthropic is listed as a processor in /privacy.

**5. Romanian language**
- A style guide is part of the system prompt.
- Code normalises cedilla to comma-below.
- The register ("tu" vs "dumneavoastră") is an owner decision.
- Generation is in the visitor's language only. Translation is on demand (effort `low`).

**6. Refusals:** `fallbacks:"default"` on every live request. Branch on `stop_reason`. Audit
wording is "configuration hygiene", passive only, never phrased as an exploit.

**7. Cost:** per-scan cap (abort at ≈ $2), daily circuit breaker (`budget_daily`), and a usage
ledger per call: input, output, cache read/write, web searches.

### 7.5 Cost per scan (estimates; replace with measured `usage` in M3)

| Step | Effort | Input tokens | Output incl. thinking | Est. cost |
|---|---|---:|---:|---:|
| A | medium | ~12k | ~5.5k | $0.16 |
| B | high | ~14k | ~10k | $0.26 |
| C | low | ~10k | ~5k | $0.14 |
| D | medium | ~12k | ~8k | $0.21 |
| **Full blueprint (lead)** | | 48k | 28.5k | **≈ $0.76 (€0.68)** |
| Teaser (rules engine) | none | 0 | 0 | **$0** |
| Optional free AI classification (A at `low`) | low | ~12k | ~2.5k | ≈ $0.10 |
| Professional (+E, 5 searches, +1 retry) | | 93k | 46.5k | ≈ $1.35 |
| Monthly digest (Batch) | low | 15k | 3k | ≈ $0.06 per client |

Output, which is mostly thinking, is about 75% of the cost, so **effort is the first cost lever**.
Lower B to `medium` before considering a different model. For reference, the same scan costs about
$0.38 on Sonnet 5.5 and about $0.19 on Haiku 4.5 [R40]. **Changing the model is the owner's
decision** (§14). Fast mode doubles the price ($8/$40) for up to 2.5× output speed [R40]; consider it
only if M3 latency is unacceptable.

### 7.6 Evaluation (before launch, re-run on every prompt change)

The eval set is ≈ 30 Romanian companies across ≥ 12 verticals: micro to medium, with and without a
website, including PFAs found by CUI.

| Metric | Target |
|---|---|
| Schema parse rate | 100% |
| Evidence-check pass rate | ≥ 95% |
| Digit-gate violations | 0 |
| Vertical agreement with a human label | ≥ 90% |
| Share of opportunities with typical payback ≤ 24 months | Logged as a sanity check, not a target |
| Romanian quality | Reviewed by a native speaker |
| Cost and latency per step | Logged |

---

## 8. Savings and pricing model

### 8.1 Formulas (code, versioned as `calc_version`)

For every task t and scenario s ∈ {low, typical, high}, using all-low or all-high inputs together:

```
hours_s        = freq_s × minutes_s × people × share_s / 60            (per month)
hourly_cost    = max(28.8, G12(sector) × 1.0225 / 153.33) × size_f × role_f   (lei/h)
value_s        = hours_s × hourly_cost                                  (lei/month, time value)
realizable_s   = value_s × R            R = 0.6 (Vortex assumption, shown + adjustable)
one_off        = build_hours × VORTEX_RATE + setup                      (VORTEX_RATE: owner input)
recurring      = tool_cost_month (+ optional Vortex plan fee)
payback_best   = one_off_low  / (realizable_high − recurring_low)
payback_worst  = one_off_high / (realizable_low  − recurring_high)
roi_12m        = (12·realizable − one_off − 12·recurring) / (one_off + 12·recurring)
```

**Rule:** if the denominator is ≤ 0 or payback exceeds 24 months, the item gets no headline and is
listed as "not a priority".

**Inputs and their sources**
- **G12:** the 12-month average gross wage (Aug 2025–Jul 2026) by CAEN Rev.3 section, from INS
  release no. 229 of 11.09.2026 and its annex. July 2026 average gross wage: 9,709 lei [R49]. The
  next release (August data) is due 12 Oct 2026, so refresh monthly.
- **1.0225:** CAM 2.25% (Fiscal Code art. 220^3 para. 1). Sector-reduced rates were repealed from
  01.11.2023 [R50].
- **153.33 h:** monthly hours actually worked in 2026. 250 working days − 20 days minimum leave,
  × 8 h, ÷ 12 (Labour Code art. 112, 139, 145 [R51]). The 2026 Easter date used for the holiday
  count is UNVERIFIED.
- **Floor 28.8 lei/h:** minimum gross wage of 4,325 lei from 1 Jul 2026 (HG 146/2026; secondary
  source, UNVERIFIED [R53]).
- **size_f** (assumption): micro firms 0.8, small 0.9, others 1.0.
- **role_f** (assumption): admin 0.85, operations 0.9, sales 1.0, specialist 1.15, owner 1.6.

### 8.2 Default loaded hourly cost by sector (computed from [R49] + [R50]; € at BNR 5.3447, 2026-10-02 [R52])

| Sector (INS CAEN Rev.3) | 12-month average gross (lei) | **Loaded lei / worked hour** | ≈ €/h |
|---|---:|---:|---:|
| All sectors (default) | 9,447 | **63.0** | 11.79 |
| Restaurants (56) | 5,451 | 36.4 | 6.80 |
| Hotels (55) | 6,171 | 41.2 | 7.70 |
| Retail / e-commerce (47) | 7,456 | 49.7 | 9.30 |
| Wholesale (46) | 10,095 | 67.3 | 12.60 |
| Manufacturing (10–33) | 8,687 | 57.9 | 10.84 |
| Construction (41–43) | 8,508 | 56.7 | 10.62 |
| Transport & logistics (49–53) | 9,204 | 61.4 | 11.48 |
| Healthcare (86) | 10,999 | 73.3 | 13.72 |
| Legal & accounting (69) | 12,278 | 81.9 | 15.32 |
| Marketing (73) | 12,052 | 80.4 | 15.04 |
| IT / software (62) | 22,354 | 149.1 | 27.89 |
| Real estate (68) | 8,718 | 58.1 | 10.88 |
| Personal services / beauty (96) | 4,894 | 32.6 | 6.11 |
| Sports & leisure (93) | 7,184 | 47.9 | 8.96 |

The full 21-row table is in `scratchpad/scan-research/hourly_cost_table.md` and becomes
`src/lib/scan/blueprint/hourly-cost.ts`. A company's CAEN is mapped to a row through the
Rev.2→Rev.3 table; Claude step A confirms the vertical.

### 8.3 Presentation (honesty rules)

**What the report shows**
- **Four separate figures:** hours freed, value of that time, realisable savings, and revenue
  upside (scenarios only, **never added** to savings).
- Always low–typical–high. Hours rounded to whole numbers; lei rounded to 50/100.
- Labels "Estimare" / "Ipoteză". Every assumption carries a basis tag.
- Sliders for headcount, volumes and hourly cost recalculate on the client with the same formulas.
  Changing them is also a signal of a qualified lead.

**Fixed disclaimer** (code, both languages):
- RO: "Estimări orientative bazate pe date publice și ipoteze declarate; nu reprezintă o garanție a
  rezultatelor."
- EN: "Indicative estimates based on public data and stated assumptions; not a guarantee of
  results."

**Sources appendix:** INS 229/2026, Fiscal Code art. 220^3, Labour Code art. 112/139/145, BNR rate
and date, HG 146/2026.

**Currency:** RON in the RO UI and EUR in the EN UI, converted at the **BNR rate with its date**.
Plan prices always come from `plans.ts`, where RON is a fixed 5:1. The report says so.

**Why honesty matters here.** At Romanian SME wage levels, time savings alone often pay back slowly.
Worked example: restaurant booking automation saves 10.5 h per month × 36.4 lei = ≈ 382 lei per
month. A build of 8–16 h at €35–60/h (placeholder rate) pays back in ≈ 4–18 months (illustrative).
Compliance risk avoided, such as e-Factura B2C fines of 1,000–10,000 lei (secondary source,
UNVERIFIED), and revenue upside are shown **separately** as scenarios.

### 8.4 Mapping to Vortex offers (deterministic; thresholds need owner approval)

| Condition | Offer |
|---|---|
| 1 quick win (4–16 build hours) | **Starter** (€20 / 100 lei per month) + a quick-win quote |
| 2–4 opportunities, ≤ 60 build hours in total | **Growth** (€50 / 250 lei) + a project quote |
| ≥ 5 opportunities, any advanced item, > 60 h, or ≥ 50 employees | **Pro** (€200 / 1000 lei) + a project quote |
| Website rebuild is the top issue, or there is no website | Web project quote (`planId: "project"`) |
| Micro business, no site, < 5 h per month typical savings | "Talk to us" CTA (Free) |

Claude only writes the pitch. **Before launch the owner must set `VORTEX_RATE` and the project price
bands**, because €20–200 per month subscriptions do not cover implementation work.

---

## 9. The Blueprint PDF and the animated web report

### 9.1 Engine choice

**Chosen: `@react-pdf/renderer` 4.9.0** (MIT, React 19 compatible) [R54], already a dependency. A
proof of concept was built (local):
- A4 pages with a gradient cover, Romanian diacritics, an SVG score ring, bar and donut charts,
  lucide icons and a QR code that decodes correctly.
- 2 pages render in 104–132 ms in Chrome; 12 pages in 299 ms in a Web Worker with no main-thread
  jank. Size 212 KB.
- The lazy chunk is 470.6 KB gz. It is fetched **only on Download**.

| Alternative | Why not |
|---|---|
| pdfmake 0.3.11 | Weak layout control for art-directed pages (354 KB gz) |
| jsPDF + svg2pdf | No layout engine |
| Typst WASM | 10.8 MB gz compiler |
| Cloudflare Browser Run `/pdf` ($5 per month + $0.09/h [R56]) | Kept as a later server-side option for emailed PDFs |

### 9.2 Generation flow

1. A click starts the "printing" animation.
2. Images are pre-processed on the main thread: canvas → JPEG 0.8, cropped to the frame, ≤ 1600 px.
   WebP is not embeddable [R54].
3. `new Worker(new URL('./render.worker.ts', import.meta.url), {type:'module'})`.
4. Inside the worker: `await import('@react-pdf/renderer')`, `registerFonts(origin)`,
   `pdf(<BlueprintDocument blueprint lang/>).toBlob()`.
5. The blob becomes an object URL and downloads as
   `Vortex-Blueprint_<slug>_<YYYY-MM-DD>.pdf` (diacritics stripped in the file name only).
6. If the worker fails, render on the main thread. iOS gets an "Open PDF" fallback.

Requirements:
- `vite.config.ts` needs `defineConfig({ vite: { worker: { format: 'es' } } })`. The IIFE worker
  format fails, and pdfkit crashes in IIFE bundles (local).
- An ESLint `no-restricted-imports` rule forbids `@react-pdf/renderer` outside
  `src/components/scan/pdf/**`. Note this in AGENTS.md so that Lovable edits never pull it into the
  homepage bundle.
- **The PDF never recomputes numbers.** It renders the stored `Blueprint` JSON only.

### 9.3 Template, page by page (A4, 40/48/60 pt margins, 12-column grid)

| # | Page | Content | Variant / skip rule |
|---|---|---|---|
| 1 | Cover (full bleed) | Seeded **Vortex Signature** art (generated from the CUI, scores and opportunity mix; the same geometry function drives the web reveal), company name auto-fitted 44→28 pt, score donut, CUI/CAEN/city/site table, live-report link | Website-only scans show the host |
| 2 | Executive summary | Summary, 4 KPI tiles (hours, lei per month, setup, payback, all as ranges), top 3 moves, clickable mini table of contents | — |
| 3 | Digital health scores | 3 gauges (maturity, site health, automation potential), 5 category bars, Core Web Vitals strip | No PSI: hide the strip |
| 4 | Company snapshot | Registry card with sources and dates, business type + confidence, presence row, competitors (≤ 5) | Competitors anonymised in Free |
| 5 | Your website at a glance | Browser-frame screenshot with ≤ 4 numbered callout pins, tech chips, signals checklist | **No website:** "What a website would bring you" |
| 6 | Website findings | ≤ 8 rows (severity, effort tag, fix), quick-wins box, "+N in the interactive report" | Merged into page 5 if ≤ 3 findings |
| 7 | Automation opportunities | 2-column cards, metrics row, tools | May span 2 pages |
| 8 | Savings | Annual range, range bar chart, donut by process, hourly-cost basis | — |
| 9 | Strategy options | 3 columns; the recommended one gets a gradient border | Empty: skip |
| 10 | 30/60/90 roadmap | Timeline rail, 3 phase columns | > 3 phases: 2 rows |
| 11 | Investment & payback | 12/24-month band chart, dashed cost line, break-even marker, cost table | — |
| 12 | Your Vortex offer | Plan card with validity date, plan ladder from `plans.ts`, book/start links | `project` variant |
| 13 | Next steps | 3 steps, large booking QR + live-report QR (UTM-tagged), contact block | — |
| 14 | Method, assumptions, disclaimer | Data sources with timestamps (ONRC/MF CC BY attribution), method, assumptions, disclaimer, legal line, report ID | — |

**Document metadata:** title, author "Vortex Hub", `language`, `pageMode:'useOutlines'`, a
bookmark on every page, internal links.

**Fonts:** static TTFs, never variable or WOFF2 [R54]. Space Grotesk 500/700 for display and
numbers, DM Sans 400/500/700 for body. Both are OFL [R79] and already in `public/fonts/`. Register
`Font.registerHyphenationCallback(w => [w])` so Romanian words are not hyphenated by English rules.

**Icons:** lucide paths (ISC). Platform logos from simple-icons (CC0 [R78]); LinkedIn uses a local
path.

**Colours:** dark tokens: bg `#070713`, surface `#11112a`, violet `#6c63ff`, blue `#5b8cf0`, sky
`#89cbf6`, mint `#5fe3d0`, amber `#ffb547`, rose `#ff6b8a`. A print variant is optional.

**Workarounds baked into the base components** (react-pdf issues [R55], confirmed locally):
- no gradient strokes; rings are drawn as filled annular paths;
- gradient `x2: '0.0001'`, never `0`;
- full-bleed art goes inside a `fixed` absolute View;
- one `<Defs>` per `<Svg>`;
- letter-spacing only on decorative eyebrows;
- the lucide `check` icon instead of ✓, which neither font has.

**Budgets:**
- ≤ 1.5 MB with the screenshot;
- ≤ 1.5 s on a mid-range Android (measure);
- 10–14 pages.

**The output is not tagged PDF/UA.** The accessible version is the web report.

### 9.4 Animated web report and share link

PDF animation is not viable (RichMedia support is inconsistent [R57]). The motion lives in the web
report:
- **Report route:** `/scan/$scanId` renders the same `Blueprint` JSON with GSAP + Motion (the reveal
  in §3.3). The Vortex Signature spins and settles exactly on the PDF cover frame.
- **Share link:** `/scan/$scanId?s=<token>`. Read-only, `noindex`, expires after 30 days
  (recommendation). Only the token hash is stored (`share_links`).
- **Links back from the PDF:** cover, footers and the page-13 QR, all carrying
  `utm_source=blueprint-pdf&utm_medium=pdf&utm_campaign=vortex-scan&utm_content={page}`.
- **Storage:** PDFs are **not stored server-side by default**, because they are generated in the
  browser. Storage for emailing is an owner decision.

---

## 10. Data model and API contracts

### 10.1 Tables (`vortex-intelligence`; RLS on, a restrictive deny-all policy for `anon`/`authenticated`, grants revoked; server-only access)

| Table | Key columns | Notes |
|---|---|---|
| `companies` | `cui bigint pk`, `name`, `name_norm` (generated by `norm_name()`), `reg_no`, `euid`, `legal_form`, `is_natural_person`, `status` (active / suspended / dissolving / insolvent), `status_codes int[]`, `flags text[]` (e.g. `sediu_expirat`), `reg_date`, `county`, `city`, `caen_code`, `caen_ver`, `caen_rev3`, `caen_source`, `turnover_ron`, `profit_ron`, `employees`, `fin_year`, `website`, `rank_static`, `scans_30d`, `snapshot_date` | GIN `gin_trgm_ops` on `name_norm`; `text_pattern_ops` prefix index; partial index for active rows sorted by rank |
| `company_aliases` | `alias_norm`, `cui`, `kind` (brand / domain / old_name) | PK `(alias_norm, cui)` |
| `company_suppressions` | `cui pk`, `reason`, `requested_at`, `contact_hash` | Opt-outs; filtered out of search and scans |
| `caen_codes` | `(code, rev) pk`, `title_ro`, `title_en`, `section`, `vertical`, `automation_profile jsonb` | Bridges registry codes to playbooks |
| `company_financials` | `(cui, year) pk`, turnover, profit, employees, assets, equity, debts, `source` | From bilant / MF |
| `domain_verifications` | `(domain, cui) pk`, `method` (cui / name / visitor), `score`, `evidence jsonb`, `verified_at` | Only verified links are stored |
| `scans` | `id uuid`, `token_hash`, `kind`, `cui`, `domain`, `locale`, `tier` (free / lead / professional / monitoring), `status`, `current_phase`, `progress`, `degraded`, `source_scan_id`, `ip_hash`, `lead_id`, `user_id` (Lovable uid, no FK), `rule_set_version`, `calc_version`, `prompt_version`, `cost_usd_micros`, `version`, `expires_at` (default +90 d), timestamps | Index on `(cui, domain, completed_at desc)`; partial index on stale running scans |
| `scan_steps` | `(scan_id, step_key) pk`, `phase`, `status`, `attempt`, `lease_until`, `duration_ms`, `subrequests`, `result jsonb`, `error jsonb` | Leases, idempotency |
| `scan_events` | `(scan_id, seq) pk`, `type`, `payload jsonb` | Stream replay after a reconnect |
| `findings` | `id`, `scan_id`, `check_id`, `group`, `status`, `severity`, `confidence`, `tier`, `evidence jsonb`, `offer_code`, `effort_hours int4range`; unique `(scan_id, check_id)` | Copy comes from the rule ID (bilingual, in code) |
| `blueprints` | `scan_id pk`, `engine` (rules / ai), `business_profile`, `opportunities`, `website_recs`, `metrics`, `blueprint jsonb` (the `Blueprint` contract), versions, `model`, `usage jsonb` | One source for the web report and the PDF |
| `leads` | `id`, `scan_id`, `email`, `full_name`, `phone`, `role`, `consent_version`, `consent_marketing`, `digest_opt_in`, `locale`, `ip_hash`, `status` (new / contacted / qualified / won / lost), `created_at` | PII; deny-all; retention §11 |
| `share_links` | `id`, `scan_id`, `token_hash`, `expires_at`, `views` | — |
| `source_cache` | `(source, key) pk`, `payload`, `http_status`, `fetched_at`, `expires_at` | TTLs as in §4.7 |
| `rate_limits` (unlogged) | `(bucket, key_hash, window_start) pk`, `hits` | Token buckets, including the global `anaf_v9` bucket |
| `api_usage` | `scan_id`, `provider`, `sku`, `units`, `cost_usd_micros` | Cost ledger |
| `budget_daily` | `day pk`, `llm_micros`, `full_scans`, `cap_micros` | Circuit breaker |
| later: `monitoring_subscriptions`, `monitoring_snapshots`, `monitoring_events` (new_competitor / competitor_pricing_change / performance_drop / negative_review_theme / martech_change / new_automation_opportunity) | — | Vortex Client |

**RPCs:** `search_companies(q, lim, county)`, `rate_limit_take(bucket, key, limit, window_s)`,
`claim_scan_steps(scan, phase, lease_s)`, `budget_take(micros)`. Plus `v_scan_kpis`: daily scans,
completion %, p50/p95 per phase, cost per scan, lead conversion, cache hits.

**Cron:** `scan-sweeper` (every minute), `kpi-alert` (daily: failure rate > 10% or spend above the
cap), `purge-expired` (daily retention), later `monitoring-monthly`.

### 10.2 Server functions (`src/lib/scan.functions.ts`, zod-validated) and routes

```ts
searchCompanies({ q /*2..80*/, limit? /*≤10*/ })            // GET, soft per-IP limit
  -> { hits: { cui, name, displayName, city, county, caen, caenTitle:{en,ro}, status, legalForm, sizeBand }[],
       domainCandidate?: string, tookMs: number }
startScan({ target: {kind:'company', cui} | {kind:'domain', domain}, locale, turnstileToken, utm? })  // POST
  -> { scanId, scanToken, cached: boolean, phases: { phase, steps: { key, label:{en,ro} }[] }[] }
runScanPhase({ scanId, scanToken, phase: 1|2|3|4|5, afterSeq? })   // POST, async generator
  -> AsyncGenerator<ScanEvent>
type ScanEvent =
  | { t:'step'; key; status:'running'|'done'|'failed'|'skipped'; ms? }
  | { t:'fact'; key; value }                 | { t:'finding'; finding }
  | { t:'metric'; key; low; typical; high }  | { t:'partial'; step; items }   // AI cards as they parse
  | { t:'phase.done'; phase; next; progress }
  | { t:'error'; code:'RATE_LIMITED'|'BUDGET'|'UPSTREAM'|'TIMEOUT'|'INVALID'; retryable }
getScan({ scanId, scanToken } | { scanId, shareToken })      // GET: poll, resume, share
  -> { status, progress, version, company?, steps, findings, blueprint? }
reclassifyScan({ scanId, scanToken, vertical })              // "Adjust": re-runs P4 (rules; AI if lead)
submitLead({ scanId, scanToken, email, fullName?, phone?, role?, consentVersion, consentMarketing,
             digestOptIn, turnstileToken })                  // unlocks tier 'lead' → P4 AI
createShareLink({ scanId, scanToken }) -> { url, expiresAt }
requestOptOut({ cui|domain, email, reason, turnstileToken }) // /scan-bot form → suppression
POST /api/public/scan-tick   (x-scan-tick-secret)  { max? } -> { processed }
// later (requireSupabaseAuth): claimScan · listMyScans · startProfessionalCheckout · subscribeMonitoring
```

**Routes:**
- `/` (`?scan=<id>`)
- `/scan` (`?q=`, SSR fallback)
- `/scan/$scanId` (`?s=` share token)
- `/scan-bot` (bot info + opt-out)
- `/api/public/scan-tick`

The existing `lookupCompany`, `findCompanyWebsite`, `scanWebsite`, `scanPageSpeed`, `scanPresence`,
`createBlueprint` and `saveScanLead` become **internal step functions** called by `runScanPhase`.
They are no longer exported RPCs.

### 10.3 Contract additions (`types.ts`)

| Type | Additions |
|---|---|
| `CompanyStatus` | `suspended`, `dissolving`, `insolvent` |
| `AuditFinding` | `status`, `confidence`, `tier`, `evidence[]`, `offerCode`, `ruleId` |
| `Blueprint` | `versions{rules, calc, prompt}`, `sources[]{name, asOf, licence}`, `locks` (teaser vs full) |
| `AutomationOpportunity` | `tasks[]` with low/typical/high inputs and `basis` |

---

## 11. Security, abuse and compliance

| Area | Control |
|---|---|
| **Bots** | Cloudflare Turnstile (Free: unlimited challenges, 20 widgets, 10 hostnames per widget [R65]) on `startScan`, `submitLead` and `requestOptOut`. Server-side `siteverify` with `remoteip` and `idempotency_key`. Tokens are single-use and valid for 300 s [R65]. Hostnames: vortexhub.dev, www, the lovable.app published and preview domains. |
| **Rate limits** (Postgres, by HMAC of the IP) | `startScan`: 3 per hour and 8 per day per IP, 2 concurrent. `submitLead`: 5 per hour. Search: 30 per 10 s (per-isolate LRU). Per-domain cooldown 10 min. Rate-limited visitors are offered "leave your email and we'll run it". |
| **Budgets** | Per-scan abort at ≈ $2. `budget_daily` cap (recommended €15 per day at launch) degrades to "high demand, we'll email your report". Anthropic Console workspace spend limit (recommended €300 per month at launch). Alert at 80%. |
| **Caching** | Replay scans for the same target within 7 days. Blueprint cache keyed by versions. Brave and Places responses are never stored. |
| **SSRF** | `safeFetch` (DoH checks, manual redirects, private-range blocklist, 2 MB cap); ports 80/443 only. |
| **Crawling etiquette** | robots.txt per RFC 9309 [R28], honest user agent + `/scan-bot` page with an opt-out address, ≤ 2 concurrent per host, GET/HEAD only. |
| **Third-party terms** | ANAF: 1 req/s, overload penalised [R6]; DB-global throttle + cache. data.gov.ro: CC BY 4.0 attribution with date [R1]; MF 2025 licence field empty, so attribute and follow up. Brave: no storage without storage rights [R36]. Google Places EEA: off in v1 [R43]. GPL fork: server-only [R23]. Claude web search: show citations [R41]. |
| **Prompt injection** | §7.4: untrusted tags, no tools when scraped text is present, schema-bound output, plain-text rendering, URL allowlist. |
| **GDPR: leads** | Separate, **unticked** consent checkbox (required) for "process my details to send this report and contact me about it". Separate optional digest opt-in. `consent_version` is stored. The visitor's lead data never goes to the LLM. |
| **GDPR: scanned companies** | Legal entities by default; PFA by CUI only; suppression list; no representative data; evidence redaction; legitimate-interest assessment document; Art. 14 wording on /privacy. |
| **Retention** (recommendations; legal check needed) | Anonymous scans and evidence: 90 days. Share links: 30 days. Leads: 24 months after the last contact. IP hashes: 30 days (in rate-limit windows). `api_usage`: 13 months. |
| **Processors** | /privacy must list Supabase (both projects), Anthropic, Google (PSI/CrUX), Cloudflare (Turnstile, Browser Rendering), Brave and the email provider. Controller: VORTEX HUB S.R.L., Str. Armoniei 23A, Timișoara. |
| **Disclaimers** | Savings disclaimer (§8.3). Legal and compliance items worded as "We could not find X on the N pages we checked", with "not legal advice". Counsel reviews the templates before M5. Reports are private to the requester unless shared. |
| **Accessibility law** | The report is the accessible version. WCAG 2.2 AA as in §3.5. |

---

## 12. Costs

### 12.1 One-time

| Item | Estimate | Source |
|---|---|---|
| Engineering M0–M5 | **38–49 developer-days** (§13) | Our estimate |
| Background asset (still + loop) | UNVERIFIED (depends on the tool or artist) | — |
| Legal review (privacy, LIA, report templates, Places opinion) | UNVERIFIED | — |
| Native Romanian proofread of the copy deck and PDF | ≈ 0.5 day | Estimate |
| Data | €0: ONRC, MF and ANAF are free | [R1, R4, R6] |
| Libraries | €0: react-pdf MIT, qrcode MIT, fonts OFL, simple-icons CC0, GSAP free | [R54, R79, R78] |

### 12.2 Monthly fixed

| Item | $ / month | Source |
|---|---:|---|
| Supabase Pro + Small compute ($25 + $15 − $10 credit) | 30 | [R60] |
| Supabase Medium instead, at ≈ 10k scans ($25 + $60 − $10) | 75 | [R60] |
| Cloudflare Workers Paid (Vortex-owned; includes 10 Browser Rendering hours) | 5 | [R26, R27] |
| Turnstile | 0 | [R65] |
| PageSpeed Insights + CrUX | 0 | [R17, R19] |
| Lovable plan and Cloud credits for scan traffic | UNVERIFIED (credit rates not published [R59]) | [R59] |
| Email provider | FOLLOW-UP: infra | — |
| GitHub Actions for the monthly ETL | UNVERIFIED (FOLLOW-UP: infra) | — |

### 12.3 Per scan (variable)

| Item | Unit cost | Source |
|---|---|---|
| Teaser scan: PSI ×2, CrUX ×2, DNS, crawl | $0 within quotas | [R17, R19, R26] |
| Browser stage, ≈ 15 s | ≈ 2,400 scans included, then ≈ $0.0004 per scan | [R27] |
| Brave discovery, ≈ 1 query per scan on average | $0.005 (first ≈ 1,000 per month free) | [R36] |
| Full AI blueprint (lead) | ≈ $0.76 (range $0.36–1.35) | [R40] + §7.5 estimate |
| Professional extras (E) | + $0.30–0.45 | [R40] + estimate |

### 12.4 Scenarios (USD per month; 25% of scans become leads with the AI blueprint; Opus 5.5; € at 0.889 per USD [R52])

| Item | 100 scans | 1,000 scans | 10,000 scans |
|---|---:|---:|---:|
| Supabase | 30 | 30 | 75 (Medium) |
| Cloudflare Workers Paid | 5 | 5 | 5 |
| Browser Rendering overage | 0 | 0 (4.2 h) | ≈ 3 (41.7 h − 10 h, × $0.09) |
| Brave | 0 | 0 (inside the $5 credit) | ≈ 45 |
| LLM (25 / 250 / 2,500 leads × $0.76) | 19 | 190 | 1,900 |
| **Total** | **≈ $54 (≈ €48)** | **≈ $225 (≈ €200)** | **≈ $2,030 (≈ €1,800)** |
| No email gate (AI on every scan) | ≈ $111 | ≈ $795 | ≈ $7,730 |
| Gated, plus the optional free AI classification ($0.10 per scan) | ≈ $64 | ≈ $325 | ≈ $3,030 |
| Gated, Sonnet 5.5 for all steps (owner choice) | ≈ $45 | ≈ $130 | ≈ $1,080 |
| Optional Typesense | + $15–45 (UNVERIFIED [R67]) | same | same or more |

Excluded: Lovable credits, the email provider, Professional and monitoring (those earn revenue).
The 7-day replay cache cuts repeated scans of the same company; that saving is not modelled.

---

## 13. Milestones

Effort is in developer-days (our estimate). Each milestone is pushed to `main` (syncs to Lovable)
and published in Lovable before its acceptance check.

| M | Scope / deliverables | Acceptance criteria | Effort |
|---|---|---|---|
| **M0: Hero + platform spike** | Hero copy Variant B (label, helper, trust line, chips; paragraph moved). Pill polish (CSS breathing, streak, focus expansion). Remove the placeholder toast. `/scan-bot` page. **Spike S1–S6** with results written into §4.2. Accounts created (§14 Q1). Background asset slot ready for the owner's asset. Work-in-progress fixes: ports 80/443; `createBlueprint` no longer exported. | No LCP or CLS regression vs. `16b5d85`. Pause switch and reduced motion pass. Spike verdict recorded: in-app runtime confirmed, or the Edge Function fallback chosen. EN/RO at 375–1920 px. | 3–4 |
| **M1: Company search** | `vortex-intelligence` project + migrations (separate repo). ETL (ONRC + MF + nomenclatures + CAEN correspondence). `search_companies` + `searchCompanies`. APG combobox with input modes, CUI checksum, CNP guard, website mode, live ANAF fallback. Alias seed. CC BY attribution. | p95 ≤ 150 ms end to end over 500 sampled queries (otherwise start Typesense). "emag" → an eMAG/Dante entity in the top 3. "vortex" → VORTEX HUB in the top 3. "54747928" → exact match. "timisoara" matches "TIMIŞOARA". 13 digits never reach the network. No PFA in name results. VoiceOver and NVDA pass on the combobox. | 6–8 |
| **M2: Website audit + scan console** | `scans`/`scan_steps`/`scan_events`/`findings`. `startScan` + `runScanPhase` P1–P3 streaming + `getScan` polling + resume. Discovery cascade. The 66 rules with evidence and states. PSI + CrUX. Curated fingerprints (≥ 60 at M2, ≈ 150 by M5). `vortex-scan-browser`. Radar console, ticker, partial-failure UI. Rules teaser (P4 rules + P5). | The 6 reference sites show **none of the known false positives** and ≥ 3 Issues/Opportunities each. p50 scan ≤ 45 s, hard cap 60 s, `partial` path tested. A reload mid-scan resumes. SSRF test suite (private IPs, redirects to metadata, IPv6 tricks) passes. Lighthouse ID mapping is unit-tested. | 8–10 |
| **M3: AI blueprint + web report** | Savings engine (`calc_version` 1) + hourly-cost table. Claude A–D with schemas and guardrails. Eval set (30 companies). Report reveal: gauges, savings, charts, 30/60/90, offer, locks. Simulation sliders. "Adjust" reclassification. Share links. | Eval: 100% parse, ≥ 95% evidence pass, 0 digit-gate violations, ≥ 90% vertical agreement. Cost and latency per step **measured** and replacing §7.5. Reveal skippable. Reduced-motion final states. Offer mapping matches §8.4. | 9–11 |
| **M4: PDF + lead capture** | Lead form (consent v1, drawer on mobile). `leads` table. Lead unlocks P4 AI. PDF worker + 14-page template + variants. "Printing" animation. Email (report link + internal lead notification). Sweeper. | PDF 10–14 pages, ≤ 1.5 MB, ≤ 1.5 s on a mid-range Android. All skip and variant rules covered by PNG snapshot tests. QR codes decode. Opens in Chrome, Preview, Acrobat, iOS Files and Android Drive. The react-pdf chunk is absent from the homepage bundle (Vite manifest). Lead row stores the consent version. | 7–9 |
| **M5: Hardening + launch** | Turnstile, rate limits, daily budget breaker, KPI view + alerts. /privacy, /terms, /cookies updates + LIA. Opt-out flow. Dogfood fixes (§6.6). Counsel review of the templates. Native RO proofread. Load test (50 concurrent scans). Apply for GBP API access. Close the FOLLOW-UP: infra items. Publish. | Abuse test: a scripted 100 scans per minute is throttled with no LLM spend. Budget breaker trips correctly. vortexhub.dev scores pass on its own scan. All FOLLOW-UP: infra items closed. WCAG 2.2 AA checklist passes. | 5–7 |
| **Later L1: Professional** | One-off Stripe Checkout. 30 pages, PSI on 5 URLs. Competitors (E) via web search. Claim scans into `dashboard.*`. | Paid flow end to end in Stripe test mode. | 6–8 |
| **Later L2: Reviews** | GBP OAuth for clients. Review themes (client-owned data only). | Approved GBP access; client consent recorded. | 4–6 |
| **Later L3: Vortex Client monitoring** | Monthly snapshots via pgmq, diffs (tech, PSI median of 3 runs, ≥ 10-point drop, pricing-page hash, competitors), Batch digest, email + dashboard cards with delta states. | A digest is generated for a test client, at ≤ $0.10 per client per month in LLM cost. | 8–10 |
| **Later L4: Vortex Intelligence SaaS** | Self-serve accounts, API, public company pages (legal entities only) | Separate plan + GDPR review | — |

---

## 14. Decisions needed from the owner

| # | Decision | Options | Recommendation |
|---|---|---|---|
| Q1 | **Accounts and keys to create** (Claude never signs up or enters keys) | — | **Now:** Google Cloud project (enable PageSpeed Insights + CrUX; one key → `GOOGLE_API_KEY`); Anthropic Console workspace + key + spend limit; Cloudflare account (Turnstile site; Workers Paid $5); Supabase org + `vortex-intelligence` Pro project (EU); private GitHub repo `vortex-intelligence-data` with a `VI_DATABASE_URL` secret. **M2:** Brave Search API (needs a card). **M4:** email provider. **M5:** Google Business Profile API application. |
| Q2 | **Budget caps** | €10 / €15 / €30 per day app cap; Console limit | €15 per day app cap, €300 per month Anthropic limit, per-scan abort at $2, alert at 80%. Raise with traffic. |
| Q3 | **Where the index and scan data live** | Lovable Cloud / dedicated Supabase / Typesense | **Dedicated Supabase Pro `vortex-intelligence`** (≈ $30 per month). Lovable Cloud documents no direct connection or extensions and has no migration out [R59]. Typesense only if the M1 p95 gate fails. |
| Q4 | **Gating** | Everything free / teaser + email for full / paywall | **Free teaser without an LLM; email + consent unlocks the AI blueprint, PDF and share link.** Free AI classification (+$0.10 per scan) can be switched on later with a flag. |
| Q5 | **PFA/II/IF indexing** | In name search / CUI only / excluded | **CUI only (live ANAF), no name autocomplete, no public pages.** |
| Q6 | **Suspended or insolvent firms in suggestions** | Show with a badge / hide | Show with a badge and low rank. Struck-off firms are hidden and cannot be scanned. |
| Q7 | **Model tier** | Opus 5.5 everywhere / Sonnet 5.5 or Haiku 4.5 for some steps | **`claude-opus-5-5` everywhere** (default), tuning effort first. Any downgrade is the owner's call after the M3 eval. |
| Q8 | **Hero background asset** | Commission a new loop / keep the swirl | **Supply a clean ≥ 3840×2160 still + a seamless 8–12 s 1080p loop (≤ 3 MB HLS) + poster**, matching the mockup's deep-space vortex. It cannot be extracted from the mockup. |
| Q9 | **Hero copy** | Variant B (brand H1, question as label) / Variant A (question H1) / the experience plan's split layout | **Variant B** now; A/B test Variant A after launch. |
| Q10 | **Implementation pricing** | Hourly rate or fixed bands | Set `VORTEX_RATE` (placeholder €35–60/h) and quick-win, standard and advanced bands before M3. Needed for payback. |
| Q11 | **Product ladder pricing** | New SKUs / bundle | Professional = one-off Stripe product credited against a project (price to set). Monitoring bundled into Growth and Pro at first. |
| Q12 | **Google Places / reviews** | Use Places / skip | **Places off** until a lawyer clears the EEA terms. Apply for GBP API access for client reviews. |
| Q13 | **Competitors in reports** | Named / anonymised | Anonymised in Free; named in Professional. |
| Q14 | **Compliance wording** | Assertive / "not detected" + disclaimer / hidden in Free | "Not detected on N pages" + evidence + not-legal-advice; counsel review. |
| Q15 | **Sharing and retention** | — | Unlisted share links, 30-day expiry. Anonymous scans 90 days. Leads 24 months after last contact. PDFs not stored. |
| Q16 | **Romanian register** | "tu" / "dumneavoastră" | "tu" (the current site voice) on the web; decide for the PDF offer pages. |
| Q17 | **Scan visual** | SVG radar / three.js globe | **Radar** (homepage animation rule). Globe parked. |
| Q18 | **Brand gradient** | Violet→sky for Scan only / site-wide | Violet→sky for Scan surfaces only; site stays violet→mint until a later rebrand. |
| Q19 | **Dogfood fixes on vortexhub.dev** | — | Approve §6.6 as part of M5 (some items in M0). |
| Q20 | **Lovable plan** | Tell us Free / Pro / Business | Needed for the spike and the cost model. |

---

## 15. Risks and mitigations

| Risk | Likelihood / impact | Mitigation |
|---|---|---|
| Lovable runtime too tight (10 ms CPU or 50 subrequests) or the stream is buffered | Medium / High | Spike first. Portable step library. Supabase Edge Function or own-Worker fallback. Polling transport. |
| A disconnect cancels a phase mid-step | High / Medium | Persist before yielding. Leases. Resume by `afterSeq`. Sweeper for scans with a lead. |
| **Unauthenticated LLM endpoint** (work-in-progress `createBlueprint`) is abused | High if shipped / High | Remove the export. AI only for leads, only from server-held facts. Turnstile, rate limits, budget breaker. |
| False positives destroy credibility | Medium / High | Evidence-first. `unverified` state. Browser verification. Multi-page "not found". The 6-site regression suite. |
| Legal or defamation exposure from compliance findings in a downloadable offer | Medium / High | "Not detected" wording, evidence, disclaimer, counsel review, private reports. |
| Hallucinated facts or numbers | Medium / High | Dossier-only, quote checks, digit gate, money computed in code, eval ≥ 95%. |
| Prompt injection from scraped sites | Medium / Medium | No tools in those calls, untrusted tags, sanitisation, schema output, plain-text rendering. |
| Overstated savings | Medium / High | INS-based costs, realisation factor 0.6, ranges, 24-month cutoff, separate upside, adjustable sliders. |
| ANAF throttles Cloudflare egress IPs | Unknown / Medium | DB-global 1 req/s bucket, 7-day cache, spike S5. Fallback: index data + "live check unavailable". |
| CAEN Rev.2/Rev.3 ambiguity (e.g. 4791 means different things) | High / Medium | Store `(code, version, source)`, precedence ANAF v9 > MF > ONRC, correspondence table, Claude A confirms the vertical, "Adjust" control. |
| Brand ≠ legal name; new firms missing from the snapshot | High / Medium | Alias table, recency boost, live ANAF fallback by CUI, domain path. |
| GDPR (sole traders, CNP, leads) | Medium / High | Legal entities only in search, CNP drop and guard, no representative data, suppression list, consent versioning, retention jobs, LIA. |
| Google Places terms breach | Low (off) / High | Not used in v1. GBP OAuth for client data. |
| GPL contamination | Low / High | Fork isolated server-side. Vortex-owned rules are the primary IP. |
| Search is too slow or misses typos | Medium / Medium | p95 gate, prefix + trigram split, LRU, Typesense swap behind the same interface. |
| ONRC format or resource-ID drift; a skipped month | Medium / Low | Header validation, row-count alarms, CKAN discovery, snapshot date shown. |
| Lovable regeneration pulls react-pdf into the homepage, or rewrites `vite.config.ts` | Medium / Medium | ESLint restricted import, AGENTS.md note, manifest check in CI. |
| PDF renderer quirks or iOS download behaviour | Medium / Low | Workaround components, snapshot tests, "Open PDF" fallback, web report as primary. |
| PSI quota or latency; Lighthouse ID churn | Medium / Medium | Key, 3-day cache, backoff, CrUX API for field data, ID mapping tests. |
| Latency of 4 Opus calls (minutes) | Medium / Medium | Progressive `partial` events, B ‖ C in parallel, lower effort on A and C, fast mode only if needed. Measure in M3. |
| Infra research missing (email, CI, backups, monitoring) | Certain / Medium | FOLLOW-UP: infra items gate M4 and M5 (§4.9). |
| Lock-in to Lovable Cloud | — | Core data lives in the owned Supabase project; the schema is in the separate repo. |

---

## 16. Changes vs. `vortex-scan-experience-2026-10-03.md`

| Topic | Experience plan | This plan (wins) | Why |
|---|---|---|---|
| Hero | Split layout, "Discover your business potential", orbiting labels | Mockup centred hero + owner question as the search label (Variant B) | Owner asked for "this exact style" and their copy |
| Analysis visual | Three.js globe | SVG radar; globe parked | AGENTS.md: the homepage morph is GSAP + Motion + CSS only |
| Company suggestions | Sharded static index | Postgres pg_trgm in `vortex-intelligence` | Monthly refresh without repo bloat, aliases, suppression list, ranking |
| Routes | `/scan?cui=…` | `/?scan=<id>`, `/scan/$scanId`, `/scan?q=` fallback | Same-page morph; scan state is server-owned |
| Orchestration | Browser chains stateless calls and passes data along | Scan ID + server-held facts, 5 streamed phases, leases | Integrity, cost abuse, resume |
| Google rating | Places API when keyed | Off until legal sign-off; GBP OAuth for clients | EEA Places terms |
| Leads | `audit_leads` (Lovable Cloud) | `leads` in `vortex-intelligence` with consent version | Untracked schema / unknown RLS; joins with scans; one retention policy |
| Keys | All optional | PSI/CrUX key mandatory in practice; Turnstile mandatory; Brave at M2 | Keyless PSI quota = 0 (local) |
| Step labels | 8 checklist items | Same `ScanStepId`s, grouped into the owner's 4 phases | — |

---

## Sources

| Ref | URL |
|---|---|
| R1 | https://data.gov.ro/api/3/action/package_show?id=firme-02-09-2026 |
| R2 | https://data.gov.ro/api/3/action/package_search?fq=organization:onrc&sort=metadata_created%20desc&rows=40 |
| R3 | https://data.gov.ro/api/3/action/package_show?id=nomenclatoare-02-09-2026 |
| R4 | https://data.gov.ro/api/3/action/package_show?id=situatii_financiare_2025 |
| R5 | https://data.gov.ro/api/3/action/package_show?id=date_de_identificare_platitori_actualizate_iunie_2026 |
| R6 | https://static.anaf.ro/static/10/Anaf/Informatii_R/Servicii_web/doc_WS_V9.txt |
| R7 | https://static.anaf.ro/static/10/Anaf/Informatii_R/doc_WS_Bilant_V1.txt |
| R8 | https://static.anaf.ro/static/10/Anaf/Informatii_R/Servicii_web/docV1.txt |
| R9 | https://onrc.ro/index.php/ro/caen |
| R10 | https://ec.europa.eu/eurostat/web/nace/transition |
| R11 | https://eur-lex.europa.eu/eli/reg_impl/2023/138/oj |
| R12 | https://insse.ro/cms/files/Informatii%20statistice/microdate/LEGE_190_2018.pdf |
| R13 | https://www.insideprivacy.com/international/european-union/cjeu-limits-public-record-right-to-be-forgotten/ |
| R14 | https://openapi.ro/ |
| R15 | https://apis.termene.ro/ |
| R16 | https://www.risco.ro/api-firme |
| R17 | https://developers.google.com/speed/docs/insights/v5/get-started |
| R18 | https://developers.google.com/speed/docs/insights/v5/reference/pagespeedapi/runpagespeed |
| R19 | https://developer.chrome.com/docs/crux/api |
| R20 | https://developer.chrome.com/blog/lighthouse-13-0 |
| R21 | https://web.dev/articles/vitals · https://web.dev/articles/ttfb |
| R22 | https://github.com/enthec/webappanalyzer |
| R23 | https://www.gnu.org/licenses/gpl-3.0.txt |
| R24 | https://www.wappalyzer.com/pricing/ |
| R25 | https://developers.cloudflare.com/workers/platform/limits/ |
| R26 | https://developers.cloudflare.com/workers/platform/pricing/ |
| R27 | https://developers.cloudflare.com/browser-rendering/pricing/ · https://developers.cloudflare.com/browser-rendering/limits/ |
| R28 | https://www.rfc-editor.org/rfc/rfc9309.html |
| R29 | https://www.sitemaps.org/protocol.html |
| R30 | https://legislatie.just.ro/Public/DetaliiDocumentAfis/77218 (Legea 365/2002 art. 5) |
| R31 | https://eur-lex.europa.eu/eli/reg/2024/3228/oj/eng |
| R32 | https://legeaz.net/legea-506-2004-prelucrare-date-caracter-personal/articolul-4 |
| R33 | https://www.edpb.europa.eu/system/files/2023-01/edpb_20230118_report_cookie_banner_taskforce_en.pdf |
| R34 | https://support.google.com/a/answer/81126?hl=en · https://www.ncsc.gov.uk/blog-post/protecting-parked-domains |
| R35 | https://www.php.net/supported-versions.php |
| R36 | https://brave.com/search/api/ |
| R37 | https://developers.google.com/custom-search/v1/overview |
| R38 | https://learn.microsoft.com/en-us/lifecycle/announcements/bing-search-api-retirement |
| R39 | https://ppc.land/google-sues-serpapi-over-search-scraping-in-copyright-lawsuit/ |
| R40 | https://platform.claude.com/docs/en/about-claude/pricing (also the claude-api skill model table, cached 2026-09-25) |
| R41 | https://platform.claude.com/docs/en/agents-and-tools/tool-use/web-search-tool |
| R42 | https://developers.google.com/maps/billing-and-pricing/pricing · https://developers.google.com/maps/documentation/places/web-service/data-fields |
| R43 | https://cloud.google.com/terms/maps-platform/eea-places-api-permitted-uses · https://cloud.google.com/terms/maps-platform/eea |
| R44 | https://developers.google.com/my-business/content/prereqs · https://developers.google.com/my-business/content/review-data |
| R45 | https://platform.claude.com/docs/en/build-with-claude/structured-outputs |
| R46 | https://platform.claude.com/docs/en/build-with-claude/refusals-and-fallback |
| R47 | https://github.com/anthropics/anthropic-sdk-typescript |
| R48 | https://tanstack.com/start/latest/docs/framework/react/guide/streaming-data-from-server-functions |
| R49 | https://insse.ro/cms/sites/default/files/com_presa/com_pdf/cs07r26.pdf · https://insse.ro/cms/sites/default/files/com_presa/anexa_date/cs07r26.xls |
| R50 | https://legislatie.just.ro/Public/DetaliiDocument/171282 (Fiscal Code, art. 220^3) |
| R51 | https://legislatie.just.ro/Public/DetaliiDocument/41627 (Labour Code) |
| R52 | https://curs.bnr.ro/nbrfxrates.xml |
| R53 | https://startupcafe.ro/salariul-minim-brut-va-creste-la-4-325-de-lei-de-la-1-iulie-2026-ce-cost-vor-suporta-angajatorii-si-cu-cat-vor-ramane-angajatii-in-mana-proiect-91967 (secondary, UNVERIFIED) |
| R54 | https://www.npmjs.com/package/@react-pdf/renderer · https://react-pdf.org/fonts · https://react-pdf.org/svg · https://react-pdf.org/compatibility |
| R55 | https://github.com/diegomura/react-pdf/issues?q=is%3Aissue+is%3Aopen+gradient |
| R56 | https://developers.cloudflare.com/browser-rendering/quick-actions/pdf-endpoint/ |
| R57 | https://loc.gov/preservation/digital/formats/fdd/fdd000474.shtml |
| R58 | https://docs.lovable.dev/features/hosting.md (re-checked 2026-10-03: no runtime, CPU or streaming details published) |
| R59 | https://docs.lovable.dev/integrations/cloud (re-checked 2026-10-03: no connection string or extension list; "no one-click migration") · https://docs.lovable.dev/features/secrets.md · https://docs.lovable.dev/introduction/credits-and-usage.md |
| R60 | https://supabase.com/pricing · https://supabase.com/docs/guides/platform/compute-and-disk |
| R61 | https://github.com/supabase/supabase/blob/master/packages/shared-data/extensions.json |
| R62 | https://supabase.com/docs/guides/cron · https://supabase.com/docs/guides/database/extensions/pg_net |
| R63 | https://supabase.com/docs/guides/api/api-keys |
| R64 | https://supabase.com/docs/guides/functions/limits |
| R65 | https://developers.cloudflare.com/turnstile/plans/ · https://developers.cloudflare.com/turnstile/get-started/server-side-validation/ |
| R66 | https://www.algolia.com/pricing |
| R67 | https://www.modern-datatools.com/tools/typesense/pricing (secondary, UNVERIFIED) · https://typesense.org/docs/guide/locale.html |
| R69 | https://www.w3.org/WAI/ARIA/apg/patterns/combobox/ |
| R70 | https://www.w3.org/WAI/WCAG22/Understanding/pause-stop-hide.html · https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html · https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum.html · https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html · https://www.w3.org/WAI/WCAG22/Understanding/three-flashes-or-below-threshold.html |
| R71 | https://motion.dev/docs/react-layout-animations · https://motion.dev/docs/react-accessibility |
| R72 | https://gsap.com/docs/v3/GSAP/gsap.matchMedia()/ |
| R73 | https://www.nngroup.com/articles/response-times-3-important-limits/ · https://www.nngroup.com/articles/animation-duration/ |
| R73b | https://developer.mozilla.org/en-US/docs/Web/API/VisualViewport |
| R74 | https://ideas.repec.org/a/inm/ormnsc/v57y2011i9p1564-1579.html |
| R75 | https://web.dev/articles/inp |
| R76 | https://www.amcham.ro/business-intelligence/new-accessibility-obligations-how-law-no-2322022-will-affect-economic-operators-starting-june-28-2025 (secondary) |
| R77 | https://www.capital.ro/devine-obligatoriu-din-18-august-este-anunt-oficial-pentru-toata-romania-s-a-dat-deja-ordin.html (secondary) |
| R78 | https://www.npmjs.com/package/simple-icons |
| R79 | https://github.com/google/fonts/blob/main/ofl/spacegrotesk/METADATA.pb · https://github.com/google/fonts/blob/main/ofl/dmsans/METADATA.pb |
| R82 | https://support.google.com/google-ads/answer/13802165?hl=en |

**Still UNVERIFIED** (re-check before relying on them):
- Lovable runtime CPU and subrequest caps, streaming buffering and credit rates;
- the PSI daily quota;
- Typesense pricing and EU region;
- the minimum wage figure (HG 146/2026);
- the 2026 Easter date in the hours calculation;
- e-Factura B2C fine amounts;
- ANPC Order 270/2026;
- the new ONRC number structure;
- class-level matching of CAEN Rev.3 to NACE 2.1;
- whether ANAF throttles Cloudflare egress;
- whether Browser Rendering REST actions expose cookies;
- Opus 5.5 output speed and end-to-end AI latency;
- iOS input zoom and blob-download behaviour;
- the PSI screenshot format;
- GitHub Actions minutes;
- email provider pricing.
