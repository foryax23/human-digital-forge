# Vortex Scan Deep: the company-intelligence engine for the Finder

Final plan, 2026-10-03. Written for the owner of Vortex Hub first and engineers second. §0–§10 take about 25 minutes to read; Appendices A–E hold the detail engineers and counsel need.

- **Scope:** evaluate `edwardtay/awesome-scrapers` and `scrapy/scrapy`, then design the strongest lawful engine for researching Romanian companies in the Finder (Vortex Scan on vortexhub.dev).
- **Status:** research only. This file is the only file created in the repo. Research notes and the three reviews are in `/private/tmp/claude-501/-Users-dandeamihai-Desktop/98201317-c5fd-4bed-b3dd-e616a5f40dda/scratchpad/deep-engine/`.
- **Dates:** prices, limits and laws were checked on 2026-10-03 unless another date is shown. Not legal advice: items marked **COUNSEL** need a Romanian data-protection lawyer.
- **Relation to the engine plan** (`vortex-scan-engine-2026-10-03.md`): this plan extends it and reuses its `vortex-intelligence` Supabase project ("VI"), tables and milestones M0–M5. Changes to its decisions are marked **Changes engine plan**.

---

## 0. Short answer for the owner

1. **awesome-scrapers is not a scraper.** It is one README (CC0, 12 stars, created 2026-03-01) linking 92 tools, not the "150+" it claims, with affiliate links and a section on evading bot protection. There is nothing to "implement" in the Finder. We used it as a shopping list and took 8 tools (§5.3).
2. **Scrapy: yes, but offline, not in the live scan.** It is the most mature and politest crawler (BSD-3, v2.19.0 of 2026-09-10), but it is Python, and neither Lovable nor Cloudflare Workers run Python. It runs in our data pipeline: store-locator spiders, sector registries (BNR, ASF, ANCOM, ANRE) and, later, bulk monitoring re-crawls. The per-visitor deep scan runs in TypeScript on Cloudflare Workflows, reusing today's code, with Crawlee as the fallback engine.
3. **What we build: "Cercetare aprofundată" (deep research).** A background mode of 5–10 minutes that joins the free official sources by CUI (ANAF, financial statements 2008–2025, ONRC, courts, SEAP/TED, EU funds), crawls the company's site and up to 5 competitors politely, reads the public footprint through official APIs and open datasets, and lets Claude extract facts and write the analysis. **Every fact carries its source, the date it is valid for, when we retrieved it, and a confidence level.**
4. **People and staff:** headcount and its trend, hiring, departments and decision roles for every company. Names appear only as the company itself publishes them, in full for the company's verified owner. For other companies we show counts and roles and link to the official source. No employee dossiers, no LinkedIn, no private contacts (§2.2).
5. **Cost and first steps:** about **$0.75–1.45 per deep run** (expected ≈ $1.06) until a spike measures it. The first wins (financials, headcount, CAEN competitors, full ANAF data, two legal fixes) ship inside today's app with no new accounts.

**Where we stand against the Romanian platforms** (Termene, RisCo, ListaFirme, FirmePeNet, Totalfirme):

| Area | They offer | We deliver | Verdict |
|---|---|---|---|
| Identity, status, financials, courts, procurement | Same official sources, 10+ years of history | Same sources, live at scan time, with peer benchmarks | **Match**, beat on benchmarks |
| Website, tech, presence, ads, jobs, offers | Nothing | Full audit and footprint with evidence | **Beat** |
| Competitors | Top turnover in the same CAEN; Termene compares 3 firms on request | Real competitors from 5 lanes, graded, with financials | **Beat** |
| Analysis, savings, strategy, offer | Risk scores only | Scorecard, opportunities in €, plan and offer | **Beat** |
| Shareholders, beneficial owners | Paid feeds (RisCo 1 RON per call) | Link-out to ONRC | **Behind by design** |
| Tax-debt list, RNPM, BPI detail, payment incidents | Resold | Link-out (CAPTCHA or paid) or not offered | **Behind by design** |
| Daily monitoring | Termene: 12 criteria, daily | Monthly digest from F3, full monitoring in F5 | **Behind until F5** |

---

## 1. Goals and benchmark

### 1.1 What "the best engine for Romanian companies" means

The Romanian platforms resell the same official sources (ONRC, ANAF, MF financial statements, portal.just.ro, BPI, SICAP, RNPM) and add history, monitoring, risk scores and prospecting filters. None audits a website, measures presence or ads, finds real competitors, quantifies automation savings or writes an offer; their suggested peers are the top companies by turnover in the same CAEN (seen in a browser on RisCo's Dedeman page, [RisCo](https://www.risco.ro/verifica-firma/dedeman-cui-2816464)). Per-field provenance is already standard there ("Sursa: Website Firma, actualizat in 12 aug. 2026", same page), so source and date on every fact is our minimum, not our edge.

Best means: **coverage** (every lawful official source joined by CUI, plus website, footprint, locations and competitors), **evidence** (every fact sourced and dated, every sentence backed by facts, every number computed by code), **freshness** (official checks and site reads at scan time), **analysis** (benchmarks, positioning, savings, strategy, offer) and **outcome** (meetings and clients at a known cost per lead).

### 1.2 Targets

**Business targets (launch gate)**

| Funnel step | Gate | Measured by |
|---|---|---|
| Quick scan → gate submitted | baseline in weeks 1–2, then +20% relative | `scans` vs `leads` |
| Gate → email verified | ≥ 70% | magic-link clicks |
| Deep run → report viewed / PDF opened | ≥ 70% / ≥ 50% | open and download events |
| Deep report → meeting booked | lift ≥ +30% relative vs quick-only | 4–6 week holdout: eligible leads split 50/50 |
| Cost per booked meeting | owner sets it (suggested ≤ €40) | `api_usage` ÷ meetings |
| Confirmed factual errors per report | ≤ 0.1 | error reports + weekly QA |

When the daily cap binds, a lead score (turnover band and headcount from bulk MF data, company-domain email, relationship "owner/employee", digital gap, engagement) decides who gets a deep run first. The cap is raised only if the holdout shows the lift.

**Headline data and speed targets** (full table, statistical rules and the golden set in Appendix D)

| Metric | v1 gate | +6 months |
|---|---|---|
| Identity and tax precision; latest-FY financials shown for filers | 99.5%; ≥ 98% | 99.9%; ≥ 99% |
| Website "verified" precision / recall | ≥ 97% / ≥ 85% | ≥ 98% / ≥ 92% |
| Competitors: top-10 precision; absolute nDCG@10 gain over "top turnover in CAEN + county" | ≥ 0.60; +0.15 | ≥ 0.75; +0.25 |
| Chain locations recall / precision | ≥ 70% / ≥ 95% | ≥ 85% / ≥ 97% |
| Adverse facts (litigation, insolvency) precision | ≥ 99% | ≥ 99.5% |
| AI sentences without evidence; numbers written by the LLM | ≤ 2%; 0 | ≤ 0.5%; 0 |
| Blind expert rating; native Romanian rating | ≥ 4.0; ≥ 4.5 | ≥ 4.3; ≥ 4.7 |
| Quick scan p50 / p95 at 100 concurrent scans | ≤ 60 s / ≤ 120 s | ≤ 45 s / ≤ 90 s |
| Deep research p50 / p95 / hard cap | ≤ 6 / ≤ 10 / 15 min | ≤ 4 / ≤ 8 min |
| Deep research cost p50 / hard cap | ≤ $1.10 / $1.50 | ≤ $0.85 / $1.50 |
| CNP, personal contacts or PFA/II/IF data in stored evidence | 0 | 0 |

### 1.3 Golden set and evaluation (summary)

- **40 companies before F1 acceptance** (8–12 person-days), growing to **100 by +6 months**, weighted to real traffic: 45 micro, 30 small, 15 medium, 10 large, at least 30 without a website.
- **Labels only from primary sources** (ANAF, ONRC, MF, portal.just.ro, the company's own site). Official fields are checked automatically; people label web, LLM, competitor and location facts.
- **Blind comparison on 30 companies** against ChatGPT Deep Research, Perplexity and the best Romanian platform profile; target: we win ≥ 70% against ChatGPT, with 0 errors in our top 3 recommendations.
- **Regression gate:** a replay on a redacted "golden corpus" (kept ≤ 12 months, separate from the 30-day snapshots) on every rule, prompt or schema change.
- **QA staffing:** about 0.15 FTE (6 hours a week) re-checks 20 random deep reports weekly.

---

## 2. What a deep scan finds

### 2.0 How to read it

- **Badges:** "Sursă oficială" (registries and official APIs, 0.95–1.0) · "De pe site-ul firmei" (0.85–0.90; 0.75–0.85 when an LLM extracted it with a verified quote) · "Declarat de firmă" (owner corrections, shown beside the official value, never overwriting it) · "Sursă terță" (open datasets, 0.50–0.80) · "Potrivire după nume" (0.60–0.85) · "Calculat" / "Estimare" (derived; lowest input confidence).
- **Display:** ≥ 0.90 "Confirmat", 0.70–0.89 "Probabil", 0.50–0.69 "Posibil", below 0.50 hidden. **Adverse facts** (litigation, insolvency, inactivity, blocked site) are stated only at ≥ 0.90; below that they become a "Verifică la sursă" link.
- **Provenance chip:** `source · valabil la <as-of date> · confidence`, for example "Sursă oficială: ANAF (date publice) · valabil la FY2025 · Confirmat". Retrieval time, method and the quote sit behind "vezi dovada", so a month-old ONRC snapshot never looks like today's data.
- **GDPR classes:** G0 company data · G1 company data that can identify a person (one-person SRL, micro-firm phone, seat in a flat: minimised) · G2 named people (tiers, 90-day purge) · GX never collected.
- **Natural-person entities (PFA/II/IF)** reached by exact CUI show only name, status, main CAEN and county.

### 2.1 The catalogue

Appendix A gives method, freshness, confidence rule and GDPR class for every group.

| Group | What we find | Main sources | Ships |
|---|---|---|---|
| A. Identity and status | name, CUI, J, EUID, legal form, status, seat **and** fiscal address | ONRC open data; ANAF v9 | F0 |
| B. Tax profile | VAT history, VAT on cash, split VAT, large-taxpayer flag, ownership form | ANAF v9; MF taxpayer file | F0/F1 |
| C. Registry timeline | renames, seat moves, status and CAEN changes | 55 historic ONRC snapshots (2014–2026) | F3 |
| D. Financials by year | turnover, profit, employees, debts, equity 2008–2025; ratios; health indicator | MF bulk; ANAF bilant for the newest year | F0/F1 |
| E. People and roles | headcount trend, hiring, departments, roles, team as published | §2.2 | F0–F4 |
| F. Litigation and insolvency | cases where the company is a party, its role, stage | portal.just.ro; ONRC status codes | F0 (lead report) |
| G. Procurement | contracts won, authority, CPV, value | SEAP open data; TED | F1 |
| H. Funding | grants received; programmes it may qualify for (Estimare) | MFE, CORDIS, Kohesio, PNRR lists with CUI | F4 |
| I–J. Trademarks, licences | EU marks; BNR, ASF, ANCOM, ANRE, CNAS registers | EUIPO API; Scrapy ETL | F4 |
| K. Website and technology | audit with evidence, stack with versions, real-user speed, site age | our crawl; PageSpeed + CrUX; Wayback | F0–F2 |
| L. Offers and prices | catalogue, prices, packages, guarantees, B2B/B2C | own site (JSON-LD, then LLM with quote) | F2 |
| M. Contact channels | generic emails, main phone, forms, chat, hours | own site; ANAF/MF (phones masked for micro firms) | F0 |
| N. Locations | seat, units, shops, service area, map | §2.3 | F3 |
| O–P. Reviews and social | Facebook rating, followers, networks used; owner's own Google profile | Meta and YouTube APIs; Business Profile API (owner OAuth) | F3 |
| Q. Ads | Google ads present, formats, dates, impressions; Meta ads link | Ads Transparency (BigQuery); Meta Ad Library | F3 |
| R. Jobs and growth | open roles, departments, locations | JobPosting markup; Greenhouse/Lever APIs | F3 |
| S. News | dated, classified mentions | terms-checked RSS archive; GDELT batch | F3 |
| T. Domain and email | email provider, SPF, DMARC, TLS, subdomains | DNS over HTTPS; Cert Spotter | F2 |
| U. SEO and traffic | Romanian traffic tier, rank, optional keywords | CrUX `country_ro`; Tranco; DataForSEO (optional) | F3 |
| V. Competitors | 5 direct, 3 digital, 3 county leaders, benchmarks, "Tu vs 5" | §2.4 | F0/F1/F3 |
| W. Gaps | what we looked for and did not find, where and when | derived | F2 |

**Removed:** "not registered in RO e-Factura". ANAF v9 returns `false` for eMAG, OMV Petrom and Vortex Hub alike, because B2B e-invoicing has been mandatory since 2024 ([Deloitte](https://www2.deloitte.com/content/dam/Deloitte/ro/Documents/tax/romana/tax-and-legal-alert-250624-ro.pdf)). Showing it would be a false accusation.

### 2.2 People and staff (the strongest lawful version)

This is where company-data businesses get fined in the EU: Bisnode PLN 943k for not informing people taken from public registers (upheld 19 Sep 2023, [UODO](https://uodo.gov.pl/en/553/1572)); KASPR €240k for LinkedIn contact data ([CNIL](https://www.cnil.fr/en/data-scraping-kaspr-fined-eu240000)); Lusha €2M with Italian data ordered erased, legitimate interest held inadequate (2026-07-27, [report](https://ppc.land/italy-fines-lusha-2-million-euros-orders-erasure-of-italian-contact-data/)). The Dutch DPA calls private scraping "almost always" unlawful unless very targeted ([AP](https://www.autoriteitpersoonsgegevens.nl/documenten/handreiking-scraping-door-particulieren-en-private-organisaties)), and the EDPB's draft Guidelines 03/2026 (GenAI-focused, persuasive for any scraping) treat robots.txt and CAPTCHAs as opposition signals ([EDPB](https://www.edpb.europa.eu/system/files/2026-07/edpb_guidelines_2020603_webscraping_v1_en_0.pdf)). Our purpose (a business report and an offer for the requester) does not need the names of another company's staff, so names go only where the purpose clearly supports them.

**For every company (no names):**
- **Headcount and trend** 2008–2025 (Dante International: 3,231 in 2023, 3,191 in 2024, 2,889 in 2025), turnover per employee, CAEN × county peer percentiles.
- **Hiring now:** open roles, department mix, locations, first and last seen, links.
- **Departments and decision roles** found on the site ("există un director de operațiuni listat"), marked "Estimare", and **team size as published** with a link to the team page.
- **Official management as counts and roles** ("1 administrator înregistrat"), from ONRC with names, birth data and residence dropped at parse time, plus a **link-out to the official source** (ONRC certificate, 30 lei, ordered by the requester).
- **Organisational maturity:** careers page, ATS, HR tech, languages, locations, generic contact channels.

**Names, by tier**

| Tier | Who sees it | What | Status |
|---|---|---|---|
| **Tier 1: verified owner** | Proves control: mailbox on a domain already verified for that CUI (no free-mail), or a DNS / meta-tag code | Their team exactly as their own site publishes it: name, role, link, date | **F4**, the first person-level feature |
| **Tier 2: lead viewing another company** | A lead | Name and role of the company's public faces, verbatim from its own site | **Off until COUNSEL signs the LIA**, with an informational Art. 14 letter to the company when a report first names people |
| **ONRC administrators by name, third parties** | — | — | **Dropped.** Only with a future KYB purpose, own LIA, DPIA, DPO check |

**Context gates:** membership organisations (CAEN 94.11–94.99; religious, political, union or patient NGOs) get counts only, Tier 1 included; health (86.x) never has testimonials or reviews extracted; education and childcare (85.x, 88.91) never has pupils' pages processed. Person facts live only inside the run, are purged after 90 days, are never searchable or tracked over time, and objections go to a suppression list checked before collection. Report footnote: *"În acest raport apar doar numele și funcțiile publicate de companie pe site-ul propriu. Nu afișăm date de contact personale. Detalii și obiecții: vortexhub.dev/scan-bot."*

**What we will NOT do**

| We will not | Why |
|---|---|
| Build employee dossiers, search by person, show "other companies this person runs", track job moves | Profiling; Bisnode-style Art. 14 duties; ANSPDCP's DPIA list names employee monitoring ([Decision 174/2018](https://www.edpb.europa.eu/our-work-tools/consistency-findings/register-decisions/2018/romania-sas-list-kind-processing_ro)) |
| Scrape LinkedIn or personal social profiles | [LinkedIn User Agreement §8.2](https://www.linkedin.com/legal/user-agreement); Proxycurl shut down after being sued ([nubela](https://nubela.co/blog/goodbye-proxycurl/)); KASPR |
| Guess or verify emails; collect private phones or home addresses | Creates new personal data; Art. 5(1)(c); Law 506/2004 |
| Take names or birth data from ONRC for third parties; resell shareholder data | Not needed for the purpose; Bisnode |
| Store staff photos; process sensitive or criminal data about individuals | AI Act art. 5(1)(e); GDPR Art. 9–10; CJEU C-439/19 |
| Scrape job boards; infer an individual's pay in micro firms | Board terms and database right (CJEU C-762/19); financial personal data |
| Get around logins, CAPTCHAs or anti-bot systems | Codul penal art. 360 ([text](https://legislatie.just.ro/Public/DetaliiDocument/109855)) |

**What the owner gets instead:** size, growth and productivity against peers, where and what the company hires, how it is organised, how many people officially manage it (names one click away at the official source), and, for their own company or once Tier 2 is approved, who leads it exactly as the company chose to publish.

### 2.3 Locations

| Layer | Source | Note |
|---|---|---|
| Registered seat and fiscal address | ONRC, ANAF v9 | Both labelled (fixes `anaf.server.ts`, which stores the fiscal address as "address"); a seat in a flat shows locality and county only |
| Units with their own tax code | MF taxpayer file | Parent link to verify |
| Work points (puncte de lucru) | **In no open dataset**; ONRC certificate (30 lei) or licensed API (RisCo 0.5 RON) | Professional tier (Q5a) |
| Locations the company declares | JSON-LD, store locators, contact page, job locations | Strongest proof of ownership |
| Shops and branches from open POI data | Overture (~81M, [guide](https://docs.overturemaps.org/guides/places/)), Foursquare OS Places, AllThePlaces (CC-0, Scrapy spiders) | Monthly PostGIS load; phones stored only as HMACs; **sample 50 SMEs before relying on it** |
| Google Places | IDs only, free and storable ([pricing](https://developers.google.com/maps/billing-and-pricing/pricing)) | Names, addresses and reviews may not be saved ([EEA terms](https://cloud.google.com/terms/maps-platform/eea), 2026-08-26); display-only cards need counsel (Q6) |

A scored match (company domain, phone, name, CUI on the location page, CAEN fit; Appendix B) decides "confirmed" vs "locație posibilă". Only POIs matched to a legal-entity CUI are shown; others become an anonymous count. Geocodes come from a self-hosted Nominatim (ODbL layer) or OpenCage (storable; €450 for the one-off index run, [pricing](https://opencagedata.com/pricing)), never Google (30-day cache limit). Service area comes from `areaServed`, locality names matched to the INS SIRUTA list, "livrăm în toată țara" phrases and job locations.

### 2.4 Competitors, with financial benchmarking

Today the index has no CAEN and `competitors.ts` matches name words in the same city, so the UI must say "afaceri similare". A bulk-MF shard brings the CAEN lane forward to F0 (§3.1).

| Lane | Method | Cost per run |
|---|---|---|
| Registry | same 4-digit CAEN, same locality then county, size band; legal entities only | €0 |
| Maps category | radius search over open POIs with a CAEN → category table | €0 |
| Search / SEO | ≤ 3 Brave queries; optional DataForSEO | ≈ $0.015 (+ $0.05) |
| Paid ads | same-category advertisers in the Ads Transparency extract | €0 |
| Marketplaces | links on the site and search counts; no marketplace scraping | ≈ €0 |

```
rel = 0.35·activity (same CAEN class 1.0 | same group 0.6 | authorised only 0.4 | keyword 0.3)
    + 0.25·geo (exp(−d/R); R = 5 km food/beauty, 25 km trades/clinics, national for e-commerce/B2B)
    + 0.15·size (turnover similarity) + 0.15·digital (search, POI overlap) + 0.10·market (ads, marketplaces)
    − penalties (suspended or insolvent; no financials for 2+ years)
```

- AI "find all" agents are not used for discovery: an independent test measured 19.6% recall for Exa Websets and 5.5% for Parallel FindAll ([test](https://parallel.ai/articles/exa-vs-parallel-findall.md)). Our 1.42M-entity registry is a closed world; models only rank and verify.
- **Per deep run:** 5 analysed in depth and 10 benchmark-only. The 5 get a resolved domain (≤ 1 extra Brave query each), up to 10 pages, the quick audit, presence, traffic tier, ads and tech, and a Claude summary of offers and positioning (cached 14 days per competitor).
- **"Tu vs 5 concurenți" matrix** (web and PDF): audit score, speed, booking or shop, reviews and social, ads, technology, turnover, employees, growth. Compliance-type checks appear only for the subject company, never on competitor cards.
- **Benchmarks** are precomputed offline (€0 per run) per CAEN × county and CAEN × national: P25/P50/P75 and N for turnover, margin, employees, turnover per employee, 3-year growth, equity and debt ratios. Peer sets under 5 firms are hidden, sanity rules run first (FirmePeNet lists hunting associations with 181,522 employees), and every chart says "compania vs P25/P50/P75 din N firme, anul YYYY · Sursa: Ministerul Finanțelor, data.gov.ro".

### 2.5 Analysis on top

- **Scorecard** (0–100 per pillar, with a peer percentile and evidence): Sănătate financială · Creștere · Productivitate · Maturitate digitală · Vizibilitate și reputație · Poziție competitivă · Conformitate (subject company only). Code computes every score.
- **Financial-health indicator:** approximate liquidity (current assets ÷ debts), negative equity, loss streak, debt trend; inputs visible; labelled "nu este scor de credit"; never for natural persons.
- **Blueprint v2 inputs** (changes `economics.ts` and `offer.ts`): real headcount (I20) replaces today's guessed team size; savings capped by headcount; the offer tier bounded by turnover and size (never Starter above 50 employees); strategies built from competitor gaps; opportunities ranked by gap to peers. Acceptance: a sales reviewer rates the offer "sensible" for ≥ 90% of the golden set.
- **Funding hook:** grants received and likely-eligible programmes feed the offer ("automatizare cofinanțată").
- **Sales brief** (internal, per run): size and budget proxy, the visitor's relationship to the company, decision roles as published, top 3 opportunities with € and evidence, recommended plan, likely objections, talk track, lead score. CRM export holds company facts plus the lead's own consented data only.

---

## 3. Two modes, plus monitoring

### 3.1 Quick scan ("Scanare rapidă"): today's flow, under 60 s, improved

Built as unit-tested server step modules wired into the engine plan's M2 phases, not into today's browser runner, so nothing is built twice.

1. **Legal fixes first:** the two-box consent (§6.2); a natural-person guard (PFA/II/IF: name, status, CAEN, county only); phones masked for firms under 10 employees; seats in flats shown as locality and county.
2. **Full ANAF v9 parse:** both addresses, VAT history, inactive dates, ownership form, large-taxpayer flag; the e-Factura finding removed.
3. **Bulk-MF shard:** main CAEN and size band in the index rows, financials 2019–2025 in CUI-keyed shards, precomputed peer percentiles. This gives financials, the headcount sparkline and **CAEN competitors with benchmarks** with no new infrastructure and no ANAF load (live bilant only for a missing newest year). Interim until VI serves the same data.
4. **Values instead of booleans:** JSON-LD address, phone, hours, service area, employee count, generic emails, prices; **sitemap-guided page choice** (both wait for the engine plan's CPU spike S3).
5. **Presence fix:** no more requests to Facebook, Instagram, LinkedIn or X pages (all disallow bots); Places off in the public flow.
6. **Identity safety:** a confirm step after a name search; "Acesta e site-ul tău?" for uncertain websites; better discovery (CUI and exact-name queries, ANAF phone and address matched on the page, more TLDs).
7. **Server-held facts** for the blueprint (today a report can be forged), ports 80/443 only, DNS check fails closed, the PageSpeed key made mandatory.
8. **Litigation in the lead report only:** counts by category and role over 36 months, counted in a streaming pass, nothing stored; anonymous visitors see only "Verificat în portal.just.ro: în raportul complet".
9. **A minimal privacy update and the `/scan-bot` page** ship before litigation and the wider crawl; the `Fact` envelope covers every field shown.

Until VI exists, the cache and the ANAF token bucket live in a Lovable Cloud table. No LLM for anonymous visitors.

### 3.2 Deep research ("Cercetare aprofundată"): minutes, in the background

**Who can start it:** a lead (email, required notice box) for a resolved legal entity. Limits: 1 concurrent and 3 a day per visitor, one run per company per 24 h (repeats replay the cached run, re-rendered for the viewer's tier). Third parties ("client/furnizor", "concurent", "altceva") get a due-diligence view: no Vortex offer, 3 competitor crawls, and a "Scanează-ți propria firmă" invitation.

**How it runs:** free phases (registry, financials, courts, own-site crawl) start when the form is submitted; LLM and paid phases wait for the email to be verified. The visitor watches the timeline or leaves and gets an email. A run ends `succeeded`, `partial` (a budget or source ran out; findings kept) or `failed`.

| Time | Phase (in parallel where hosts differ) | First visible result |
|---|---|---|
| 0–30 s | Registry and money from VI tables, then live ANAF, courts, TED, GLEIF | identity ≤ 1.5 s; first peer insight ≤ 15 s |
| 0–4 min | Own site: robots → sitemaps → ≤ 60 pages, ≥ 1 s apart | live page counter |
| 0–3 min | Footprint: search, DNS, certificates, Wayback, ads and traffic tables, job APIs | each signal as it lands |
| 1–4 min | Locations and competitors (5 competitor crawls in parallel) | map, peer table, competitor cards |
| 2–5 min | Extraction: deterministic, then Claude on candidate pages | offers, prices, team (per tier) |
| 4–8 min | Reconcile, then the analysis written section by section | each section as it is ready |
| end | Dossier stored, PDF ready, email sent | link and PDF |

### 3.3 Monitoring

- **"Alerte" light (F3):** for leads who ticked the marketing box, a monthly digest of changes to their company and its 5 competitors, from free official deltas (ONRC, new financial year, ANAF status, court cases, SEAP).
- **Full monitoring (F5, with engine plan L3):** TTL-driven re-checks, change events (never about persons), batch summaries at ≤ $0.10 LLM per client a month, bulk re-crawls in the Scrapy lane.

---

## 4. Architecture

### 4.1 Constraints (verified)

- The Lovable build deploys a Worker with only an `ASSETS` binding: no Queues, Workflows, Durable Objects, R2, Cron or browser bindings, no Python, no headless browser ([Lovable hosting](https://docs.lovable.dev/features/hosting.md) documents none).
- Workers allow 30 s CPU on Paid (10 ms on Free), 128 MB, and **at most 6 connections waiting for response headers per invocation** ([limits](https://developers.cloudflare.com/workers/platform/limits/)). Supabase Edge Functions allow 2 s CPU ([limits](https://supabase.com/docs/guides/functions/limits)). Anonymous visitors cannot use Supabase Realtime private channels.
- **So minutes-long, multi-engine work runs in a separate service Vortex owns.**

### 4.2 Recommended design: a deep engine in a Vortex-owned Cloudflare account

```
Browser (/scan) ── quick scan: engine plan M2 phases in the Lovable Worker
   │  deep: startDeepRun after the gate; then polls the deep engine directly
   │        (run-scoped signed token; 2 s while active, paused when the tab is hidden)
   ▼
Lovable Worker ── gate checks (consent, Turnstile, limits, flags, suppressions)
   │  POST https://deep.vortexhub.dev/v1/runs  (HMAC-signed; *.workers.dev if the DNS zone is elsewhere)
   ▼
Vortex Cloudflare account (Workers Paid, $5/month)
   deep-engine Worker + DeepResearchWorkflow (instance id = run id → idempotent)
     registry · own-site crawl (child workflow) · footprint · locations · competitors (5 child workflows)
     · extraction (Haiku 4.5 / Sonnet 5.5, verified quotes) · reconcile · synthesis (Opus 5.5, citations)
   HostGate (per-site politeness) · RunGate (concurrency, leased slots) · R2 EU snapshots (30 days)
   FETCH TIERS: T0 plain fetch → T1 Browser Run (JavaScript-only pages) → T2 Firecrawl (deferred)
                blocked / CAPTCHA / robots disallow → stop and record it, never escalate
   ▼
Supabase VI (EU, system of record) ◄── offline ETL repo: ONRC, MF, SEAP, POIs, CrUX, ads, news, Scrapy spiders
```

**Why this design**
- **It reuses today's code:** the fetch-only TypeScript (`safeFetch`, robots parser, page extraction, tech detection, audit rules) runs in the engine after small portability fixes.
- **Durable runs:** Workflow steps get 30 s CPU each (up to 5 min), no wall-clock limit, free waiting, per-step retries, idempotent starts ([limits](https://developers.cloudflare.com/workflows/reference/limits/), [pricing](https://developers.cloudflare.com/workflows/reference/pricing/), 2026-09-21). **Child workflows** give each site crawl its own connection budget.
- **Honest identity:** Browser Run always identifies as a bot, signs its requests and does not bypass bot protection ([bot ID](https://developers.cloudflare.com/browser-run/reference/robots-txt/)); quick actions accept our `userAgent`, and Cloudflare's transparency headers cannot be removed ([headers](https://developers.cloudflare.com/browser-run/reference/automatic-request-headers/)).
- **Cheap to run:** infrastructure is $5–40 a month at any of our volumes; polling the engine directly keeps about 180 requests per run off Lovable's unpublished credit meter.
- Browser Run's `/crawl` (beta) is a shortcut only for very large sites and F5 diffs, and only after our own robots, suppression and TDM checks, because its agent name is fixed.

### 4.3 Fallback

A Node worker on Fly.io in Frankfurt (1–3 machines at about **$29 each a month**, [pricing](https://docs.fly.io/about/pricing)) running Crawlee + Playwright and the same TypeScript library, fed by a Supabase queue. Used if Workflows limits bite, if many Romanian sites block Cloudflare's bot ranges, or if the owner declines a Cloudflare account. The draft's "deep-lite" stopgap is dropped; a minimal Workflow skeleton lands in late F1 instead.

### 4.4 The multi-engine pipeline: what runs where

| Need | Primary | Fallback | Never |
|---|---|---|---|
| Official data | VI bulk tables; live ANAF, courts, TED, GLEIF, EUIPO | — | CAPTCHA registers (ANAF debts, OSIM, RNPM): link out |
| Normal pages | T0 Worker fetch with our SSRF and robots guard | — | — |
| JavaScript-only pages | T1 Browser Run (in F2 only if the spike finds ≥ 10% such sites) | Crawlee + Playwright | stealth browsers |
| Rendering errors that are not blocks | T2 Firecrawl hosted, basic proxy, with a DPA (deferred until needed) | — | unblocking APIs, residential proxies, CAPTCHA solvers |
| Bulk and offline crawling | Scrapy 2.19 + Trafilatura on the ETL VM | — | — |
| Search | Brave ($5 per 1k, $5 monthly credit, [pricing](https://brave.com/search/api/)), company identifiers only | Exa or Tavily | Google CSE (closed), Bing (retired), Google News RSS |
| Extraction | JSON-LD, regex with checksums, fingerprints, Readability; then `claude-haiku-4-5` / `claude-sonnet-5-5` | retry on Sonnet | lead data in prompts |
| Synthesis | `claude-opus-5-5` with citations + one structured call for scores and offer | `claude-sonnet-5-5` if the spike shows equal quality | numbers typed by the model |

**The tiers exist for "needs JavaScript", never for "blocked".** A 401, 403, persistent 429, challenge or CAPTCHA stops us for that host and becomes a fact ("site-ul blochează accesul automat") with an offer of an owner-verified scan. Sites that reserve text-and-data mining are processed in memory only, with short quotes and nothing sent to the LLM or third parties (rules in Appendix B).

### 4.5 Engineering essentials (full specification in Appendix B)

- **Job model:** `deep_runs`, `run_steps`, `run_events`; steps return only IDs and hashes (no personal data in Cloudflare's 30-day workflow state); fetching is idempotent per URL; page outcomes are data, not errors; a reaper fails stuck runs and frees their slots.
- **Budgets per run**, checked before every step and every LLM call: 15 min hard cap, 60 own pages, 5 × 10 competitor pages, 15 searches, **$1.50 hard spend cap** (each LLM call is priced before it is sent).
- **Anthropic spend-limit errors** are not retried: they trip a breaker and runs finish deterministic-only as `partial`.
- **Source health:** circuit breakers and daily canaries for every external source; feature flags switch off deep mode or any source instantly.
- **Entity resolution** on the CUI: the CUI that Romanian law requires on company sites (Legea 365/2002 art. 5, [text](https://legislatie.just.ro/Public/DetaliiDocumentAfis/77218)), name, phone, address and MX matches.
- **Storage:** provenance tables (`sources`, `fetches`, `facts` with an as-of date, `fact_evidence`), monthly partitions, ~10 GB at launch, Supabase Medium compute from F1 (**changes engine plan**, which budgeted Small).
- **ANAF:** financials from bulk MF data first, ANAF v9 once per run, one shared 1 request/s token bucket for both Workers.
- **Delivery:** the engine lives in the private `vortex-intelligence-data` repo and pulls the shared step library from the Lovable repo as a pinned subtree; CI with contract, SSRF, robots and erasure tests; staging before production.

---

## 5. Tooling decision

### 5.1 Verdict on Scrapy: use it, offline only

| Question | Answer |
|---|---|
| Is it good? | Yes. BSD-3, v2.19.0 (2026-09-10), ~64.6k stars, monthly releases, polite defaults (robots on, 1 request per domain, 1 s delay), and a cache that records timestamps ([release notes](https://docs.scrapy.org/en/latest/news.html)) |
| Why not in the live scan? | Python: Lovable and Workers cannot run it. It would mean a second language, rewriting our SSRF guard, robots, audit and extraction, and a pre-1.0 plug-in for JavaScript pages |
| Where it fits | The offline pipeline: store-locator spiders for Romanian chains (contributed to AllThePlaces, after checking each chain's terms), sector registries (BNR, ASF, ANCOM, ANRE), and the F5 bulk monitoring re-crawl |
| How it runs | One job per subprocess on a small EU VM: robots on, 1 request per domain, AutoThrottle, Crawl-delay applied, a private-IP guard, **no proxy middleware** (settings in Appendix B) |
| Never | Against CAPTCHA pages, social networks, Google, marketplaces or job boards (Facebook's robots.txt bans the `Scrapy` agent by name) |

### 5.2 The comparison we made

| | Workflows + Browser Run | Crawlee 3.18 (TS) | Scrapy 2.19 | crawl4ai 0.9.4 |
|---|---|---|---|---|
| Fit with our TypeScript | same code | same language | second stack | second stack |
| Politeness out of the box | our robots parser + HostGate | robots **off** by default ([options](https://crawlee.dev/js/api/basic-crawler/interface/BasicCrawlerOptions)) | **best** | weakest: robots off, 0.1–0.3 s delay ([params](https://docs.crawl4ai.com/api/parameters/)) |
| Anti-detection to switch off | none | fingerprints on by default | none | stealth modes built in |
| Operations burden | low | medium | medium-high | medium-high |
| Licence; 2026 security | n/a | Apache-2.0; no advisories | BSD-3; 1 high, fixed | Apache-2.0 + credit line; 19 advisories, 5 critical ([advisories](https://github.com/unclecode/crawl4ai/security/advisories)) |
| **Role** | **live deep scans** | **fallback engine** | **offline ETL, bulk re-crawl** | not used |

### 5.3 What we use from awesome-scrapers

Crawlee (fallback, stealth off) · Playwright/Puppeteer (inside Browser Run and the fallback) · Cheerio · Readability.js · Docling (F4 documents) · Firecrawl's **hosted** API as deferred T2 (never self-hosted: AGPL and a critical RCE in July 2026, [advisories](https://github.com/firecrawl/firecrawl/security/advisories)) · Playwright MCP for analysts only · Scrapy + Trafilatura. From outside the list: Cloudflare Browser Run, Workflows, Durable Objects and R2; linkedom, Turndown, unpdf; the Wayback, CrUX, Cert Spotter, GDELT, Greenhouse/Lever, Meta, YouTube, iTunes, EUIPO, TED and GLEIF APIs; Overture, Foursquare OS Places and AllThePlaces; GPL webappanalyzer fingerprints kept server-side.

### 5.4 What we reject

| Rejected | Why |
|---|---|
| Stealth and anti-detection tools (Scrapling stealth, Camoufox, Nodriver, Patchright, curl_cffi, crawl4ai stealth, Crawlee fingerprints) | Defeating bot protection is access "fără drept" to a system restricted for a category of users (bots) by specialised programs: Codul penal art. 360(3), 2–7 years |
| CAPTCHA solvers (2Captcha, CapSolver, Bright Data Unlocker and others) | A CAPTCHA is an explicit "no" |
| Residential, mobile or ISP proxies used to evade blocks | Evasion; often built from hijacked devices (Google disrupted IPIDEA, ~9M devices, January 2026, [THN](https://thehackernews.com/2026/01/google-disrupts-ipidea-one-of-worlds.html)) |
| Unblocking APIs (ScrapingBee, ScraperAPI, ZenRows, Zyte API) | Their price pays for unblocking; 10–100× Browser Run's cost |
| Social, Google search and Maps scrapers | Platform terms; KASPR; Google's Maps terms ban scraping and caching |
| Agentic browsers for bulk work (browser-use, Skyvern) | Unpredictable, costly, can submit forms |
| Licence traps (self-hosted Firecrawl, Skyvern, PyMuPDF: AGPL; Browserless: SSPL) | Could force us to open our code |
| Scraping Romanian aggregators (Termene, ListaFirme, RisCo, FirmePeNet) | Database right (Law 8/1996 art. 141(5)), terms, anti-bot walls; a licensed API under contract is fine |
| Paid data with little SME value (Similarweb, Semrush/Ahrefs API, BuiltWith, Wappalyzer) | Cost versus value |

---

## 6. Legal and trust

### 6.1 Do and do not (full texts in Appendix C)

**Do:** identify honestly (`VortexScan/1.0` with a `/scan-bot` page) and crawl gently (≤ 2 requests per host, back off on errors) · obey robots.txt and text-and-data-mining reservations (Law 8/1996 art. 36^2, [text](https://legeaz.net/monitorul-oficial-321-2022/lege-69-2022)) · stop at any login, CAPTCHA or challenge · tokenise emails, phones, CNPs and IBANs before storage or AI processing, and say truthfully that page text, which may contain names, is processed by Anthropic as a processor under a DPA · store provenance for every fact (it also answers access requests, where KASPR failed) · check the suppression list at every stage · label AI text visibly and in metadata (AI Act art. 50 applies from 2 Aug 2026, [Gibson Dunn](https://www.gibsondunn.com/eu-ai-act-omnibus-agreement-postponed-high-risk-deadlines-and-other-key-changes/)) · word findings as "nedetectat pe N pagini verificate" (Civil Code art. 257 protects a company's reputation) · use ANAF within its terms (1 request/s, no "aprobat de ANAF" claims or logos, WCAG AA, [terms](https://static.anaf.ro/static/10/Anaf/termeni_conditii_API.pdf)) · keep the requester's identity confidential from the scanned company.

**Do not:** bypass protections, spoof fingerprints, rotate proxies or log in · scrape aggregators, job boards, Google, marketplaces or social networks · ingest beneficial owners or ONRC names · index people or link a person across companies · store Places content, review texts or search results beyond what the terms allow · send lead data to the AI · score natural persons or list PFAs as competitors · keep raw pages beyond 30 days · show compliance findings about competitors.

**Sales rule (Law 506/2004 art. 12):** commercial email, SMS, automated calls "sau orice altă metodă" need prior express consent, also for companies (art. 12(4); fines 5,000–100,000 lei or up to 2% of turnover, [text](https://legislatie.just.ro/Public/DetaliiDocument/56973)). **A company that was only the subject of someone else's scan is never a prospect.** The sales console hides its contact channels and logs every view, and until counsel rules on live calls there are no calls either. Allowed: follow-ups to leads who ticked the marketing box, postal letters to the company, inbound, ads, "scanează-ți firma" campaigns. Sales staff acknowledge this in writing.

### 6.2 Consent at the lead gate (blocker fix, ships in F0)

Today the gate has one **required** checkbox that ties getting the blueprint to Vortex keeping the data and "following up" (`LeadGateDialog.tsx`; `consent: z.literal(true)` in `scan.functions.ts`). Consent that is a condition of the service is not freely given (GDPR Art. 7(4)) and is not the express consent Law 506 requires.

- **Box 1, required, not consent:** "Am citit Nota de informare și accept Termenii de utilizare a raportului". The report is delivered at the visitor's request (Art. 6(1)(b)); the box is also the express acceptance of the report-use terms (Civil Code art. 1203).
- **Box 2, optional, unticked:** "Vreau să fiu contactat(ă) de Vortex Hub despre oferte (email/telefon)."
- Version, exact text, time, IP-HMAC and channel are stored. The report is delivered either way; without box 2 only transactional emails are sent. Existing `audit_leads` rows count as "no marketing consent" until people re-consent. **Changes engine plan M4.**

### 6.3 Privacy policy, notices, opt-out and retention

- **Privacy policy:** a full Art. 13 notice (controller VORTEX HUB S.R.L., CUI 54747928; named processors; transfers; retention; AI use) and an **Art. 14 public notice** in Romanian and English that lists every source category where personal data may appear, even briefly, with what is kept and for how long. Plus `/scan-bot` (every agent that fetches for us, how to block us) and report-use terms. We draft the texts in F0 week 2; counsel reviews text, not intentions.
- **Opt-out and removal:** a link on every report and PDF ("Reprezinți firma sau ești menționat aici? Cere eliminarea"), `/scan-bot` and privacy@. Companies verify by a role mailbox on their verified domain or a DNS code. A person's objection removes them from every store within 1 hour, blocks re-collection, and leads who received their name get an updated report. Access requests are answered from the provenance store within 1 month. Corrections to findings are reviewed within 5 working days.
- **Retention:** company facts while refreshed; raw pages ≤ 30 days (none for TDM-reserved sites); person data 90 days; leads 24 months after last contact; marketing until consent is withdrawn. Enforced by code and tested (Appendix C, with the data map, processor register and terms register).
- **Marketing copy** counts sources per run ("Am verificat 13 surse oficiale și 11 surse publice") instead of a fixed "25+".

### 6.4 Governance before Deep v1 launches

An LIA per tier and a DPIA (drafts to counsel in week 2), records of processing, processor agreements, the notices, the opt-out flow, AI labels, a named privacy lead, a breach procedure (notify ANSPDCP within 72 hours), and a **terms register** where each source is reviewed by a person and ships only when it reads "OK in reports". A DPO is not mandatory under this minimised design; that assessment is repeated before Tier 2 or F5.

**LIA in one paragraph:** we produce business reports at a requester's request and offers to that requester; personal data is incidental and tiered; names appear only where the purpose needs them; the data is professional and published by the company; nothing is sensitive; no decisions or marketing target individuals; opposition signals are honoured; safeguards are tiers, context gates, tokenisation, a 90-day purge, suppression and notices. **COUNSEL** reviews Tier 2, Law 506 "orice altă metodă", our AI Act role, Places display, court-portal and ad-library terms, and retention.

### 6.5 How the report and PDF present sourced facts

- Every fact line carries the chip (source, "valabil la", confidence) and a "vezi dovada" drawer; every analytical sentence has numbered footnotes to facts; unsupported sentences are cut; all numbers come from code.
- A "Surse și metodă" appendix lists every source with licence, dataset date and attribution ("Sursa: ONRC, date deschise, CC BY 4.0, 02.09.2026"), the pages checked, what was not accessible, and the gaps.
- Labels: "Estimare" on inferred items; an AI label on AI sections; "Date valabile la …", "Raport generat la …", the opt-out link and "nu este consultanță juridică" on every page.
- Litigation appears as counts by role with context ("majoritatea ca reclamant"); criminal matters only as "figurează ca parte (rol: X) în N dosare penale; nu indică o condamnare", without case numbers; insolvency only when the company is the debtor.

---

## 7. UX in the Finder (`/scan`)

### 7.1 From quick scan to deep research

- **Before the gate:** locked counts the quick scan already has ("5 concurenți direcți, 3 locații, istoric financiar 2019–2025 găsite: deblochează").
- **The gate:** name, email, **"Ce relație ai cu firma?"** (proprietar/angajat · client/furnizor · concurent · altceva), box 1 (required), box 2 (optional).
- **On submit:** free phases start at once; the timeline says "Confirmă emailul ca să pornim analiza AI". Drop-off to verification is measured.

### 7.2 The live timeline

1. **Header:** company, CUI, progress ring (Registre · Site · Prezență · Locații · Concurenți · Analiză), ETA, counters ("37 surse verificate · 214 fapte · 41 pagini citite").
2. **Insight cards first** ("Cifra de afaceri +18% față de mediana de −3% din județ"), then fact cards with chips, badges and "vezi dovada".
3. **"Încă săpăm" states** per source ("Interogăm portal.just.ro…", "Site-ul blochează accesul automat; poți verifica firma ca proprietar") and **gaps** as neutral cards ("Am căutat prețuri pe 41 de pagini: nu am găsit").
4. **Section order follows the relationship:** owners see benchmarks, competitors and opportunities first; third parties see identity, money, litigation and contracts first.
5. "Poți închide pagina. Îți trimitem linkul pe email." Reopening resumes where it stopped. ARIA live region with pause; reduced motion; WCAG 2.2 AA.

### 7.3 Report and PDF

- **"Pe scurt" (2 pages) first:** 3 headline numbers against peers, top 3 priorities with € impact and evidence, the recommended plan.
- **Then:** scorecard, Bani, Oameni și echipă, Locații (map), **Tu vs 5 concurenți**, Prezență și reclame, Semnale (jobs, news, contracts, cases, funding), Site și tehnologie, Analiză, and the "Surse și metodă" appendix. At most 12 pages before the appendix.
- Built from **server-held facts** by run ID (fixes the 400 KB limit and forging) and re-rendered for the viewer's tier. Share links last 30 days and the lead can renew them by magic link.

### 7.4 Who sees what

| Visitor | Sees |
|---|---|
| Anonymous | Quick-scan teaser, no AI, anonymised competitors, people as aggregates, litigation locked |
| Lead, third party | Due-diligence deep report, named competitors (**changes engine plan Q13**), people as counts and roles with official links, no offer |
| Lead, owner or employee | Full deep report, scorecard, offer, PDF |
| Verified owner | Tier 1 team list; "corectează datele"; connects their own Google Business Profile (F3) for their own ratings, reviews and insights |
| Internal sales console | Sales brief, lead score, notes; contact channels only for leads |

PFA/II owners can scan their website and, once verified by a code on their site, get the audit and offer (F4); they are never indexed or listed as competitors.

---

## 8. Costs

### 8.1 Per deep run (expected case, before measurement)

Claude prices per million tokens ([pricing](https://platform.claude.com/docs/en/about-claude/pricing)): Opus 5.5 $4 in / $20 out (cached reads $0.20); Sonnet 5.5 $2 / $10; Haiku 4.5 $1 / $5. Citations cannot be combined with structured output ([citations](https://platform.claude.com/docs/en/build-with-claude/citations)), so synthesis makes citation calls for the text and one structured call for scores and the offer, all reading the same cached fact documents.

| Item | USD |
|---|---|
| Official APIs, bulk joins, free footprint APIs (~35 calls) | 0 |
| Brave (10 discovery + ≤ 5 competitor domains) | 0.075 |
| Cloudflare (~200 workflow steps, 15 rendered pages, storage, logs) | 0.006 |
| Haiku 4.5: own pages and documents (~95k in / 15k out) + competitor digests (~75k / 7.5k) | 0.28 |
| Sonnet 5.5: offers, team, locations, 5 competitor summaries (~45k / 7k) | 0.16 |
| Opus 5.5: synthesis over a 25k cached fact prefix, ~7 calls, ~15k out incl. thinking | 0.49 |
| Retries and quote repair (~5%) | 0.05 |
| **Expected / low / high** | **≈ 1.06** / 0.75 / 1.45 |
| **Hard cap**, enforced before each call | **1.50** |
| Sonnet instead of Opus for synthesis (spike 6 decides) | ≈ −0.25 |

For leads who get deep research, the engine plan's AI blueprint (≈ $0.76) is produced inside the synthesis step, not on top. Quick scans stay at ≤ $0.01. Spike 6 replaces these estimates with measured usage.

### 8.2 Monthly, by number of deep runs (USD)

| Line | 100 runs | 1,000 runs | 10,000 runs |
|---|---:|---:|---:|
| Cloudflare Workers Paid | 5 | 5 | 5 |
| Supabase VI (shared with the engine plan; Medium, Large at 10k, [compute](https://supabase.com/docs/guides/platform/compute-and-disk)) | 75 | 75 | 125 |
| ETL runner + BigQuery (dry-run first) | 28 | 28 | 28 |
| Cert Spotter (Medium from ~200 runs a day) | 0 | 0 | 50 |
| Cloudflare variable | 0 | 2 | 37 |
| Brave (after the $5 credit) | 3 | 70 | 745 |
| LLM, low / expected / high | 68 / 98 / 136 | 680 / 980 / 1,360 | 6,800 / 9,800 / 13,600 |
| **Total, low / expected / high** | **≈ 180 / 210 / 250** | **≈ 860 / 1,160 / 1,540** | **≈ 7,790 / 10,790 / 14,590** |

At 10,000 runs, replaying runs younger than 14 days cuts the expected total to about $8,340. Not included: the engine plan's quick-scan and blueprint costs (≈ $225 a month at 1,000 scans), the email provider, optional DataForSEO and Firecrawl, and the Fly fallback ($29–86) if used.

### 8.3 Anthropic spend tiers

Monthly caps are **Start $500, Build $1,000, Scale $200,000**; placement is automatic from usage history and new organisations may start lower. At the cap, calls fail until the 1st of the next month unless a higher limit is granted ([rate limits](https://platform.claude.com/docs/en/api/rate-limits), checked 2026-10-03). The cap is shared with the engine plan's blueprints. **On Start, deep research stops after about 300–450 runs a month; on Build, after about 800.** So: create the organisation in week 1 to build history, set our own limit, request a higher one before Deep v1 launches, and alert at 50% and 80%.

### 8.4 Unit economics (expected case; € at 0.889 per USD, as in the engine plan)

Vortex prices (`offer.ts`): Starter €20, Growth €50, Pro €200 a month; projects from 50,000 RON (≈ €9,355).

| Daily cap | Runs a month | Monthly cost (range) | Anthropic tier | Break-even (revenue) |
|---|---:|---|---|---|
| 10 | 300 | ≈ $420 ($330–540), ≈ €375 | Start (tight), Build comfortable | ~0.6 Growth-year clients a month, or 1 Pro-year every ~6 months |
| 30 | 900 | ≈ $1,060 ($780–1,410), ≈ €940 | Scale | ~1.6 Growth-year clients a month, or 1 Pro-year every ~2.5 months |
| 100 | 3,000 | ≈ $3,290 ($2,360–4,460), ≈ €2,920 | Scale | ~5 Growth-year clients a month, or one project every ~3 months |

A deep run costs about €0.94: it pays for itself if about **1 in 640 runs** becomes a Growth client for a year. The real limits are cash, the Anthropic tier and sales time. **Recommendation:** start at 10 runs a day (owners and employees first), raise to 25–30 once the holdout shows a lift.

### 8.5 Accounts the owner creates (week 1)

Claude never signs up or enters keys.

| Account | For | Cost | Lead time |
|---|---|---|---|
| Anthropic organisation + workspace, spend limit, DPA | extraction, synthesis | usage | tier history takes weeks |
| Google Cloud: one key (PageSpeed, CrUX, YouTube) + BigQuery | speed, traffic tier, ads | free within quotas | days |
| Brave Search API | discovery | $5 per 1k, $5 credit | days |
| Cloudflare account owned by Vortex (Workers Paid); check where vortexhub.dev's DNS lives | deep engine, Turnstile | $5/month | days |
| Supabase VI (Pro, EU) | system of record | ≈ $75/month | days |
| EU email provider with SPF, DKIM, DMARC | magic links, report emails | provider price | days |
| Meta developer app + Business Verification; EUIPO developer account | social metrics, ads; trademarks | free | weeks (F3 passes without Meta) |
| Counsel | LIA, DPIA, notices, Tier 2 | fees | weeks; blocks F2 launch |
| Optional: Cert Spotter key, DataForSEO, Firecrawl, OpenCage (€450 once), RisCo API (Q5a) | | | |

### 8.6 With zero paid keys

All official and open sources, our plain crawl with deterministic extraction, open POIs, Wayback, DNS and the rules blueprint work for free. Without paid keys we lose the Claude analysis, Brave discovery and the SEO lane; a deterministic dossier still costs $0 in variable spend.

---

## 9. Roadmap

### 9.1 Combined schedule (engine plan M0–M5 and F0–F5)

Effort in developer-days with a 1.5–2× buffer. Roles: **Dev A** (app, UX), **Dev B** (data, infra, deep engine), **QA** (0.15 FTE), **Owner**, **Counsel**, **Sales lead**. The owner assigns people (Q7).

| Weeks (2 developers) | Work | Lead | Effort |
|---|---|---|---|
| 1 | All accounts and applications, counsel engaged, terms register started | Owner | — |
| 1–3 | **M0** (spikes, hero) + **F0** quick wins; week 2: notice texts, LIA and DPIA drafts to counsel | A + B | 3–4 + 10–14 |
| 3–7 | **M1** search + VI · **F1** data foundation · **M2** audit console with F0 modules · golden set of 40 | B / A / QA | 6–8 + 15–20 + 8–10 |
| 6–10 | **M3** AI blueprint + Blueprint v2 · **M4** PDF and two-box gate | A | 9–11 + 3–4 + 7–9 |
| 8 | Spike before F2 (§9.3) | B | 2 |
| 8–14 | **F2 Deep v1** · **M5** hardening · counsel sign-off by week 13 | A + B | 25–35 + 5–7 |
| 14–15 | **Deep v1 launch** at 10 runs a day; holdout starts | Owner | — |
| 15–21 | **F3** footprint, locations, competitors in depth, Alerte light, owner Google profile | A + B | 22–30 |
| 20–24 | **F4** people tiers, documents, registries, funding | B | 12–18 + counsel |
| 24–27 | **F5** monitoring, Scrapy bulk lane | B | 10–14 |

**Total:** about **125–175 developer-days** (engine 41–53 including Blueprint v2, F0–F5 94–131, minus ~10 days of overlap): roughly 6 months with two developers to F5, **Deep v1 live in about 14 weeks**, plus QA at 0.15 FTE and counsel time.

### 9.2 Phases and acceptance (engineering detail in Appendix B)

| Phase | Ships | Accepted when |
|---|---|---|
| **F0 Quick wins** | §3.1: legal fixes, full ANAF parse, bulk-MF shard, values, presence fix, identity safety, litigation (lead only), privacy update, `/scan-bot` | 20 reference companies: financials match the source, both eMAG addresses right; 0 requests to facebook, instagram, linkedin, x in logs; 20 PFA CUIs show no address or phone anywhere; two-box consent stored with its version; 100 concurrent quick scans at p95 ≤ 120 s |
| **F1 Data foundation** | VI provenance tables, ETL (ONRC, MF, SEAP, SIRUTA, NGOs), peer benchmarks, CAEN competitor lane from VI, terms register, workflow skeleton | CAEN precision ≥ 97%; competitors ≥ 0.60 and +0.15 nDCG; golden set of 40 labelled; ETL alarms tested |
| **F2 Deep v1** | Cloudflare engine, own-site crawl, extraction with verified quotes, sectioned synthesis with citations, scorecard, budgets and breakers, timeline UI, server-built report and PDF, email, legal pack | p50 ≤ 6 min, p95 ≤ 10 min at 20 concurrent runs; cost p50 ≤ $1.10, cap enforced; ≤ 2% unsupported sentences; a seeded person erased from every store within 1 hour; robots, TDM, SSRF and PII suites pass; counsel sign-off recorded |
| **F3 Footprint, locations, competitors** | search discovery, Meta/YouTube, ads, traffic tier, news, jobs, registry timeline, locations map, competitors in depth with the matrix, Alerte light, owner Google profile | social ≥ 80% / ≥ 95% (link-only counts if Meta is not approved); chain locations ≥ 70% / ≥ 95%; ≥ 3 of 5 competitor sites resolved; no search snippets stored |
| **F4 People, documents, funding** | Tier 1 team, context gates, Tier 2 flag (off until counsel), PDFs, EUIPO, EU funds, sector registries, optional work-points feed, PFA owner path | team precision ≥ 98% and 0 person facts from other sources; no birth or residence columns exist; suppression works everywhere within 1 hour |
| **F5 Monitoring** | scheduler, change events, digests, Scrapy bulk re-crawl | digest ≤ $0.10 LLM per client a month; change precision ≥ 95% |

### 9.3 Spike before F2 (2 days)

1. Signed call Lovable → engine; whether `deep.vortexhub.dev` is possible or we use `*.workers.dev`.
2. The full deep timeline at 10 and 20 concurrent runs (child workflows, connection limit, database writes, the shared ANAF bucket).
3. Browser Run on 20 Romanian sites: cost per page, block rate, share of JavaScript-only sites, our `userAgent` through the binding.
4. `/crawl` vs our own page choice on 10 SME sites; HostGate under 50 concurrent runs.
5. Measured token usage on 20 companies; Opus vs Sonnet synthesis rated blind.
6. Open POI coverage on 50 Romanian SMEs (go/no-go for locations).
7. ANAF throttling from Cloudflare (if yes: a fixed-IP egress, about $3.60 a month on Fly); a BigQuery dry-run of the ads extract.

### 9.4 What ships first

F0: free official data inside today's app, the two legal fixes (two-box consent; PFA and phone guard) and four live defects (wrong address field, false e-Factura signal, robots violations on social sites, Places billed at Google's most expensive Text Search tier).

---

## 10. Risks, mitigations and open questions

### 10.1 Risks

| Risk | L / I | Mitigation |
|---|---|---|
| Person data triggers Art. 14 duties at scale | M / H | Names only for verified owners; counts and link-outs for others; Tier 2 only after counsel |
| The agency uses scans for cold outreach | M / H | Sales rule (§6.1); console hides non-lead contacts; written acknowledgment |
| Romanian sites block Cloudflare's bot ranges | ? / M | Spike 3; an honest "not accessible" fact; owner-verified scans; Fly fallback; never evasion |
| LLM cost above estimate; Anthropic cap stops runs | M / H | Range until measured; pre-call budget checks; Sonnet option; replay cache; early tier request; deterministic fallback |
| Effort overrun on a small team | H / M | Deep v1 scope cut; optional engines only on measured need; one schedule with named owners |
| ANAF throttling | ? / M | Bulk data first; one ANAF call per run; shared bucket; fixed-IP egress |
| LLM invents facts; prompt injection | M / H | Facts-only input, verified quotes, citations, numbers from code, weekly QA; untrusted tags, no tools |
| Raw data errors and name variants distort benchmarks or court matches | H / M | Sanity rules, peer sets ≥ 5, adverse facts only at ≥ 0.90 with CUI confirmation |
| Platform terms change | M / M | Terms register reviewed quarterly; retention per source in code |
| Reputation damage from wrong findings | M / H | Evidence wording, no compliance findings on competitors, 5-day corrections |
| Unverified details (MF tax-flag mapping, Places UI Kit price, Firecrawl prices, ad-library terms, GLEIF limits, PNRR lists with CUI) | certain / L–M | Each checked before its feature ships; off until then |

### 10.2 Open questions for the owner

1. **Infrastructure:** approve a Vortex-owned Cloudflare account (Workers Paid, $5 a month) for the deep engine? The alternative is Fly.io ($29–86 a month, more maintenance).
2. **Who gets deep research:** start at 10 runs a day (owners and employees first, then by lead score) and raise after the holdout? This decides the Anthropic tier we request.
3. **Model routing** (changes engine plan Q7): Haiku and Sonnet for extraction, Opus for synthesis (≈ $1.06 a run), switching synthesis to Sonnet (≈ $0.82) if spike 6 shows equal quality?
4. **People scope:** ship counts, roles and official links for other companies and names only for verified owners, and ask counsel to review Tier 2 (names as published on the company's site, with an Art. 14 letter)?
5. **Paid official extras:** (a) work points through a licensed API (RisCo 0.5 RON a call, minimum 100 RON a month): recommended **yes**, under a contract that allows display; (b) shareholders: recommended **no**, link-out to the ONRC certificate.
6. **Google:** ask counsel to clear display-only Google cards in reports and richer fields in the internal console? Owners can connect their own Google profile either way.
7. **People and roles:** who are Dev A, Dev B, the QA labeller, the privacy lead and the sales reviewer, and which email provider do we use?

---

## Appendix A. Field catalogue detail

**Methods:** API (official, live) · OD (open-data bulk via our ETL, joined by CUI) · Crawl (polite crawl of the company's site) · Dataset (third-party open data loaded offline) · Search (a lead only until our own fetch verifies it; never stored otherwise) · LLM (Claude extraction with a verbatim quote that code checks) · Derived (computed by code). Confidence +0.05 per independent agreeing source (cap 0.99); conflicts kept as `disputed`.

| Group | Method | Freshness | Confidence rule | GDPR |
|---|---|---|---|---|
| A. Identity and status | OD + API | ANAF live (7 d cache); ONRC ≤ 35 d | 0.98; ANAF wins fiscal fields, ONRC registry fields | G0; G1 if residential seat |
| B. Tax profile | API + OD | live / ~2× a year | 0.95; fiscal vector shown only after mapping is verified | G0 |
| C. Registry timeline | OD | monthly | 0.95 | G0 |
| D. Financials | OD (+ API newest year) | yearly; 90 d cache | 1.0 vs source; outliers "valoare suspectă" | G0; no wage estimate under 5 employees |
| F. Litigation | API | 24 h | exact legal-name variant + CUI/seat ≥ 0.9; else link-out | G1/G2: persons removed in memory; criminal matters as counts |
| G. Procurement | OD + API | quarterly / live | 0.99 CUI-matched | G1: PFA winners redacted |
| H. Funding | OD | 4–12 months late | name + locality 0.6–0.85; CORDIS VAT 0.97 | G0 |
| I–J. Trademarks, licences | API; Scrapy OD | live / monthly | 0.95 CUI-matched | G0/G1 |
| K. Website, tech | Crawl + API | 3–7 d | per check or fingerprint | G0 |
| L. Offers | Crawl + LLM | 14–30 d | JSON-LD 0.85; LLM with quote 0.75–0.85 | G0 |
| M. Contacts | Crawl + API + OD | 14 d | site 0.85; official phone 0.9 | G1: masked phones, named contacts counted not stored |
| N. Locations | Crawl + Dataset + OD | monthly | ownership score ≥ 60 confirmed, 30–59 possible | G0/G1 |
| O–P. Reviews, social | API | live / ≤ 30 d (YouTube) | linked from site 0.9; search-found 0.5 until confirmed | reviewer names never |
| Q. Ads | Dataset + API | weekly / live | legal-name match 0.85 | G1: natural-person advertisers dropped |
| R. Jobs | Crawl + API + Search | 7 d | 0.9; board counts 0.6 | recruiter names dropped |
| S. News | Dataset + API | 7 d | CUI/city/domain 0.8; name only 0.5 | person + crime items as counts |
| T. Domain, email | API | 1–30 d | 0.95–1.0 | G0 |
| U. SEO, traffic | Dataset (+ optional API) | monthly | 0.8–0.9 | G0 |

**Source notes**
- **ANAF v9** (`POST https://webservicesp.anaf.ro/api/PlatitorTvaRest/v9/tva`, ≤ 100 CUIs, 1 request/s, [doc](https://static.anaf.ro/static/10/Anaf/Informatii_R/Servicii_web/doc_WS_V9.txt)): `date_generale.adresa` is the fiscal address, the seat is `adresa_sediu_social` (eMAG: Gara Herăstrău 6 vs Șos. Virtuții 148). Parse `perioade_TVA`, `inregistrare_RTVAI`, `inregistrare_SplitTVA`, `stare_inactiv`, `organFiscalCompetent`, `forma_de_proprietate`, `codPostal`.
- **ONRC** monthly `firme-DD-MM-YYYY` (CC BY 4.0, latest 02.09.2026, [data.gov.ro](https://data.gov.ro/dataset/firme-02-09-2026)): full address, `TARA_FIRMA_MAMA`, status codes (1107 insolvență, 1070 faliment, 1057 reorganizare, 1049 dizolvare, 1052 lichidare, 1085 seat expired, 1117 suspended), authorised CAEN with version; 55 historic snapshots since 2014 for the timeline. Representatives file: only company number and role ingested. GLEIF gives parents (CC0, ~9,093 Romanian LEIs). VIES is only a cross-check. NGOs from RNONG 2026. Beneficial owners never (CJEU C-37/20).
- **MF:** taxpayer file (CC BY 4.0, ~870 MB; units, parent tax ID, phone, fiscal vector whose column mapping must be confirmed against OPANAF 1699/2021); financial statements 2008–2025 (2008–2018 Romanian open licence, 2019–2024 CC BY 4.0, 2025 licence field empty, attributed anyway, [CKAN](https://data.gov.ro/api/3/action/package_search?q=name:situatii_financiare*)); ANAF bilant (`GET https://webservicesp.anaf.ro/bilant?an=YYYY&cui=N`) works 2019–2025 ([doc](https://static.anaf.ro/static/10/Anaf/Informatii_R/doc_WS_Bilant_V1.txt)). Banks and insurers use other indicators and are not benchmarked with ordinary firms. Tax-debt and "white" lists are behind a CAPTCHA: link out.
- **Courts:** `http://portalquery.just.ro/query.asmx` (`CautareDosare2`, HTTP only, ~1,000 results per query; "DANTE INTERNATIONAL" returned 466 cases, 2.2 MB, in 2.2 s). Parsed in memory; only the company's own cases and role are kept; the raw response is never stored. BPI detail is a paid subscription and RNPM is behind a CAPTCHA: link out.
- **Procurement:** SEAP quarterly files with winner CUI (CC BY 4.0; ODS despite `.xlsx`; spellings like "RO 12280079"); TED API v3 (query every spelling: `14399840` and `RO 14399840` hit, `RO14399840` does not); e-licitatie `api-pub` is undocumented: low volume after a terms check.
- **Funding:** MFE 2014–2020 projects (name, no CUI), CORDIS (VAT), Kohesio, 2021–2027 operation lists (formats vary), PNRR lists such as "Digitalizarea IMM" (~5,200 approved, [StartupCafe](https://startupcafe.ro/rezultate-digitalizare-imm-doua-lista-firme-admise-granturi-100000-euro-pnrr-htm-25985)) where published with CUI.
- **Website:** the product says 93 checks, the code has 98 IDs (reconcile `CHECK_COUNT`); restore technology version and evidence; PageSpeed keyless returned 429; CrUX API free; site age from the Wayback availability API (CDX only offline, 16.7 s a call). Optional later: European Accessibility Act framing for e-shops; EORI validation (unverified).
- **Social, ads, apps:** Meta Page Public Metadata Access (free, App Review + Business Verification); YouTube (`channels.list` 1 unit of 10,000 a day; refresh or delete after 30 days; no derived metrics; not resold); iTunes `sellerName` gives the legal name but is used as a store link until its terms clear; LinkedIn and TikTok link only; Trustpilot skipped. Google Ads Transparency in BigQuery (`advertiser_legal_name`, Romanian impressions; ~670 GB, no partition info, [README](https://storage.googleapis.com/ads-transparency-center/api-data/README.txt)): materialise a Romania table once, refresh incrementally. Meta Ad Library as a deep link until its terms are confirmed. DSA art. 39 is the basis for these libraries.
- **Jobs:** JobPosting markup; Greenhouse `boards-api.greenhouse.io/v1/boards/{token}/jobs`; Lever `api.lever.co/v0/postings/{slug}`; eJobs, BestJobs, Hipo only as search counts.
- **News:** feeds verified live (zf.ro, profit.ro, economica.net, hotnews.ro, startupcafe.ro, economedia.ro, digi24.ro, mediafax.ro) are added only after a per-publisher terms check, kept only when matched to a company at ingest (24 months; unmatched ≤ 7 days), headline-only (DSM art. 15); GDELT (commercial use allowed, 1 request per 5 s) as a daily batch; Google News RSS rejected (non-commercial only).
- **Domain and traffic:** Cert Spotter (free 10 full-domain queries an hour, Medium $50, [sslmate](https://sslmate.com/ct_search_api/)); ROTLD WHOIS automation forbidden and `.ro` has no RDAP; CrUX `country_ro` (203,629 origins in August 2026, CC BY 4.0); Tranco; Common Crawl ranks; DataForSEO optional (+20% prices since 2026-07-01).

## Appendix B. Engineering specification

**B1. Fetch tiers and escalation.** T0 Worker `safeFetch` (agent `Mozilla/5.0 (compatible; VortexScan/1.0; +https://vortexhub.dev/scan-bot)`, GET/HEAD, robots, SSRF guard, conditional GET). Empty JavaScript shell (< 500 characters of text) → T1 Browser Run binding with `userAgent=VortexScan`, ≤ 15 pages. T1 renderer error code (never a timeout) on a page that was a 200 shell → T2 Firecrawl, `proxy:"basic"` forced (its default `auto` retries through enhanced proxies, [docs](https://docs.firecrawl.dev/features/proxies)), ≤ 10 pages, enabled only when T1 non-block failures reach 5%. 401/403/persistent 429/challenge/CAPTCHA → stop for the host. robots disallow → skip and record. TDM reservation (TDMRep, `Content-Signal: ai-input=no`, IETF `Content-Usage`, a "no scraping/TDM" clause in fetched terms) → in-memory processing, facts and quotes ≤ 120 characters, no snapshot, nothing to T1, T2 or the LLM (Law 8/1996 art. 36^2 reservations apply to any automated analysis; art. 35(3) covers transient copies). `noindex` / `nofollow` / `noarchive` → don't use / don't follow / hashes and quotes only. Every T1/T2 use is logged. **`/crawl`** (fixed agent `CloudflareBrowserRenderingCrawler/1.0`, [endpoint](https://developers.cloudflare.com/browser-rendering/rest-api/crawl-endpoint/)) only for sites with > 500 sitemap URLs and F5 diffs, with `crawlPurposes:["ai-input"]`, after our robots, suppression and TDM checks; our disallowed paths go into `excludePatterns`; skipped if `VortexScan` is disallowed at `/`.

**B2. Job model.**
- `deep_runs` (id, cui, domain, lead_id, relationship, mode, status queued → running → extracting → synthesizing → succeeded/partial/failed/canceled/budget_exceeded, idempotency key = SHA-256 of cui, domain, mode, schema and prompt versions and day, budget and spent, versions, timestamps, error), `run_steps`, `run_events`, `api_usage.run_id`.
- Steps return IDs, hashes and counters only (workflow state retained 30 days by Cloudflare, step result ≤ 1 MiB). Before each request a step checks `fetches(run_id, url)`. Page outcomes become facts or gaps; only infrastructure errors throw; each phase maps failures to `partial`.
- Elapsed time is checked before every step; at 10 minutes the run jumps to synthesis. A pg_cron reaper fails a run, terminates the instance and frees its slot after 5 minutes without events or at the 15-minute cap + 2 minutes. RunGate slots are leases with TTL = hard cap + 2 min, renewed by heartbeat.
- Retries: fetch steps 3× with 10 s exponential backoff and a 2-minute timeout; LLM steps 3× on 429/529 with `retry-after`. Anthropic `429 enforced_spend_limit_reached` and `400` "specified API usage limits" are non-retryable and trip the global breaker.
- `source_health` circuit breaker: 3 consecutive failures → skip 15 minutes, record a gap; per-source timeouts 5–15 s.
- **Budgets:** wall time soft 10 / hard 15 min; own pages 60 (T0), ≤ 15 (T1), ≤ 10 (T2); competitor pages 5 × 10 (3 × 10 for third parties); 30 MB; browser time 300 s; searches ≤ 15; paid SEO ≤ 2; before each LLM call, (counted input tokens × price) + (`max_tokens` × output price) must fit the remaining budget, with `max_tokens` derived from it; hard cap $1.50; `budget_daily` = (Anthropic cap − blueprint spend) ÷ days in month.
- **LLM layout:** fact documents first and cached; the first call writes the cache, then section calls fan out; Haiku's shared prefix padded past its 4,096-token cache minimum; competitor digests ≤ 6k tokens; competitor summaries cached 14 days per competitor CUI. Page text inside untrusted tags, no tools in extraction calls, schema output, verified quotes, plain-text rendering.

**B3. Entity resolution.** Website ↔ company: CUI with valid checksum on the page 0.97; a different valid CUI caps at 0.2; exact legal name 0.72; most of the name 0.55; domain token +0.05; city +0.08; ANAF/MF phone on the page +0.15; ONRC street + postcode +0.15; MX domain = site +0.05; accept at 0.45, ask the visitor at 0.30–0.59. Brand ↔ legal name aliases from footers and terms pages, Wikidata, iTunes `sellerName`, Ads Transparency, GLEIF and visitor confirmation. Profiles accepted when linked from the verified site or confirmed by an official API. Court cases by exact name variants ("X SRL", "SC X SRL", "X S.R.L."), confirmed by CUI or seat. **Location ownership score:** address or CUI on the company's domain +50; POI domain = company domain +30; phone HMAC match +25; name Jaro-Winkler ≥ 0.9 +15; AllThePlaces brand +15; address = seat +10; a different valid CUI on the page −40; category incompatible with the CAEN −20; ≥ 60 confirmed, 30–59 possible; dedupe by place/GERS ID, phone HMAC, or < 50 m with name similarity ≥ 0.85. **Team extraction:** ≤ 6 same-domain team pages; JSON-LD `Person`/`employee`/`founder`, then repeated DOM cards (2–3-token capitalised name within 200 characters of a role keyword), then LLM with `{name, role, department, source_url, evidence_quote ≤ 120}` rejected unless verbatim; photos, personal links, named contacts and bios discarded.

**B4. Storage (VI, RLS deny-all, server-only).** Reused from the engine plan: `companies` (+ CAEN, version, turnover, employees, year, SIRUTA, geometry), `company_aliases`, `company_financials` (one row per CUI-year, I1–I20 as columns), `domain_verifications`, `source_cache`, `api_usage`, `budget_daily`, `rate_limits`, `suppressions` (company, domain, person scope). New: `sources`; `fetches` (append-only, monthly partitions, url, final_url, fetched_at, status, method, agent, bytes, from_304, content_sha256, snapshot_key, robots_allowed, tdm_reserved); `facts` (cui, subject_kind, predicate, value, value_hash, observed_at, first/last seen, last_verified_at, expires_at, confidence, status, gdpr_class, visibility, extractor_version; unique on cui, predicate, value_hash); `fact_evidence` (fetch_id, quote ≤ 300 chars, locator, method, quote_verified); `run_events` (monthly partitions, 90 days); `source_health`; `feature_flags`; `locations` (PostGIS, licence per row); `competitor_sets`; `peer_benchmarks`; `change_events` (no person predicates); `person_mentions` (scan-scoped, 90 days). Any fact or quote containing a person's name inherits G2 and is purged, not superseded. Bulk: `onrc_firme`, `onrc_caen_autorizat` (arrays), `onrc_rep_counts` (roles only), `mf_taxpayers` (phones as keyed HMACs; clear only for ≥ 10 employees or when on the company's site), `mf_financials` 2019–2025 (2008–2018 as Parquet in R2), `seap_contracts`, `eu_funds`, `poi_places`, `crux_ro_rank`, `ads_transparency_ro`, `news_items`, `siruta`; loaded at night into staging tables and swapped atomically.

| Sizing (estimates, measured in F1) | Rows | Size |
|---|---|---|
| `mf_financials` 2019–2025 | ~5.8M | ~2 GB |
| `onrc_firme` + aliases + trigram | ~1.6M | ~1.5 GB |
| `mf_taxpayers`, `poi_places`, `seap_contracts`, CAEN arrays | ~8.5M | ~2.3 GB |
| `facts`, `fetches`, `run_events` at 10k runs a month | +3–5 GB a month | bounded by TTLs and partitions |
| **Hot total** | | ~10 GB at launch, ~25–30 GB steady at 10k runs |

Compute: Medium from F1, Large temporarily for the first bulk load and permanently at 10k runs (Small's 1,000 IOPS baseline would slow search during loads). No point-in-time recovery at launch ($100 a month per 7 days): bulk data is reproducible and runs are short-lived; daily backups (7 days) suffice until F5. App contract (`src/lib/scan/types.ts`, additive): `type Fact<T> = { value: T; source: SourceRef; retrievedAt: string; observedAt?: string; confidence: number; method: "api"|"html"|"jsonld"|"rendered"|"llm"|"derived"; evidence?: string; ttlDays: number }`; `CompanyProfile.facts` keeps per-field provenance; a `CompanyDossier` groups all sections and gaps.

**B5. Freshness.** robots 24 h; ANAF v9 live once per run, 7 d cache; financials bulk yearly, live bilant 90 d (monthly June–August); ONRC monthly; courts 24 h; procurement quarterly (TED live); homepage 7 d; contact, about, services, prices 14–30 d; blog and jobs 7 d via `lastmod` and RSS; DNS, TLS, tech 1–7 d; YouTube ≤ 30 d; Meta and Places live, never stored; POIs and CrUX monthly; ads weekly; competitor summaries 14 d. A fact unseen in 2 runs becomes stale, then superseded (G2 purged). Runs under 14 days old are replayed with only expired facts refreshed.

**B6. Politeness, SSRF, abuse.** robots RFC 9309 (`VortexScan` group, else `*`; 4xx allow; 5xx or unreachable crawl nothing). The quick scan's visitor-triggered exemption covers only the single homepage GET and its asset probes, never a site whose `VortexScan` group disallows `/` and never a suppressed domain. 1 request in flight per host (2 only without Crawl-delay and with TTFB < 500 ms), ≥ 1 s apart, Crawl-delay honoured (above 30 s the page set shrinks), `Retry-After` honoured, stop after 3 failures, daily page cap per host. No proxies, spoofing, CAPTCHA solving, logins or paywalls. SSRF: DNS over HTTPS checked on every redirect hop, private ranges incl. NAT64/6to4/Teredo, ports 80/443, fail closed on resolver errors, larger `maxBytes` only for portal.just.ro; the Fly fallback also blocks `fdaa::/16`, `*.internal` and link-local. Abuse: verified email, single-use Turnstile, legal-entity CUI, limits per IP-HMAC and email, one run per company per 24 h, RunGate, daily budget breaker, suppressions checked at autocomplete, run start, crawl, LLM build and PDF render, no person search, no bulk export.

**B7. Secrets (names only).** Lovable: `DEEP_ENGINE_URL`, `DEEP_ENGINE_HMAC_SECRET` (+ engine plan's `VI_SUPABASE_*`, `GOOGLE_API_KEY`, `BRAVE_SEARCH_API_KEY`, `TURNSTILE_SECRET_KEY`, `ANTHROPIC_API_KEY`). Engine Worker: `VI_SUPABASE_URL`, `VI_SUPABASE_SECRET_KEY`, `ANTHROPIC_API_KEY` (dedicated workspace), `BRAVE_SEARCH_API_KEY`, `CERTSPOTTER_API_KEY`, `META_APP_TOKEN`, `YOUTUBE_API_KEY`, `EUIPO_CLIENT_ID/SECRET`, `RUN_TOKEN_SECRET`, `HMAC_SECRET`, optional `FIRECRAWL_API_KEY`, `DATAFORSEO_*`. ETL: `VI_DATABASE_URL`, `GCP_SA_KEY`, `PHONE_HMAC_KEY`. CI: a scoped `CLOUDFLARE_API_TOKEN` per environment. Rotated quarterly.

**B8. Observability and operations.** Workers Logs (7 days; URLs and IDs only; metrics copied to VI); daily canaries per source and ETL drift alarms; SLO alerts per phase via pg_cron → pg_net → Slack or email (failure rate > 10% an hour, queue age > 5 min, Anthropic or Browser Run 429s, spend at 50%/80%, blocked-host spike, stuck runs); monthly reconciliation of `api_usage` with Anthropic, Brave and Cloudflare invoices (alert at > 10% drift); runbooks for ANAF down, spend cap reached, Browser Run 429s, data.gov.ro schema changes, site-owner complaints and personal-data breaches; a daily deep run on vortexhub.dev and a weekly golden-corpus replay.

**B9. Delivery.** `vortex-intelligence-data` holds `workers/deep-engine`, `etl/`, `spiders/` and `supabase/migrations`; the shared step library is pulled from `src/lib/scan/` as a pinned git subtree; a lint rule in the Lovable repo blocks `process.env`, `@/` and `import.meta.env` in shared modules. GitHub Actions: typecheck, unit, contract (`Fact` and `schema_v` fixtures), SSRF, robots/TDM/challenge and erasure suites, `wrangler deploy --env staging`, then production behind manual approval. Staging has its own Worker, R2 bucket and VI branch or schema.

**B10. Scrapy settings.** `USER_AGENT` VortexScan, `ROBOTSTXT_OBEY=True`, `CONCURRENT_REQUESTS_PER_DOMAIN=1`, `DOWNLOAD_DELAY=1`, `AUTOTHROTTLE_ENABLED=True`, `HTTPCACHE_POLICY=RFC2616Policy`, `DOWNLOAD_MAXSIZE` 10 MB, `CLOSESPIDER_PAGECOUNT`; on `robots_parsed` set the slot delay to `max(1, crawl_delay())`; a custom DNS resolver that blocks private IPs; no proxy middleware; one subprocess per job writing to staging tables. **Crawlee (fallback):** `respectRobotsTxtFile:{userAgent:'VortexScan'}`, `useFingerprints:false`, no proxies, `sameDomainDelaySecs ≥ 1`, `maxRequestsPerCrawl` 200.

## Appendix C. Legal detail and registers

**C1. Notices.** Art. 13 (visitors and leads): controller, data, purposes and bases, named processors (Supabase, Cloudflare incl. Turnstile and Browser Run, Anthropic, Google, Brave, Meta, email provider, Firecrawl if enabled), transfers (DPF or SCCs), retention, rights, ANSPDCP complaint, AI use; fix today's hello@vortexhub.ro contact on a vortexhub.dev site. Art. 14 (public, RO and EN, versioned): every source category where personal data may appear even transiently (registers, court portal, procurement and EU funds, news feeds, search APIs, job postings and ATS boards, ad libraries, POI datasets, company websites, LLM processing by Anthropic), what is kept, what is discarded at once, retention, the crawler's characteristics, Art. 6(1)(f) with the LIA summary on request, recipients, rights with an objection form, no automated decisions, no sale, no marketing to the persons. `/scan-bot`: every agent (`VortexScan`, also through Cloudflare Browser Run with its bot signature; `CloudflareBrowserRenderingCrawler`; `FirecrawlAgent` if T2 is on) and the statement that blocking `VortexScan` blocks all of them; TDM/Content-Signal/Content-Usage support; rate limits; opt-out form. Report-use terms (accepted in box 1): no use of personal data from reports for unsolicited marketing or profiling; accuracy and savings disclaimers; attribution lines. Marketing copy checked against Legea 363/2007; cookie consent if analytics are added (Law 506 art. 4(5)).

**C2. Rights flow.** Company opt-out or correction needs a role mailbox (office@, contact@, admin@) on a domain verified for the CUI or a DNS/meta code; free-mail and ISP domains excluded; every verifier logged; opt-out hides the company from autocomplete, stops runs and purges stored runs. Person objection or erasure (Arts. 21, 17): restriction at once (Art. 18(1)(d)); removal from every store within 1 hour (backups roll off within 7 days); share links invalidated; leads who received the name get an updated-report notice (Art. 19) or disproportionate effort is documented; an HMAC of (CUI, name) blocks re-collection. Access (Art. 15): an internal DSAR tool for the privacy lead only, searching `person_mentions` by (CUI, name), logged, never in the product. Acknowledge at once, finish within 1 month (Art. 12(3)); request log 3 years; authority requests logged by the privacy lead.

**C3. Retention.** Company facts while refreshed (history kept) · raw snapshots ≤ 30 days with contact identifiers tokenised (none for TDM-reserved sites) · G2 facts, quotes and `person_mentions` 90 days, purged · `run_events` 90 days, Workers Logs 7 days, workflow state 30 days (IDs only) · golden corpus ≤ 12 months, redacted · matched news 24 months, unmatched ≤ 7 days · PFA rows reached by CUI 90 days · share links 30 days, renewable · leads 24 months after last contact · suppression list indefinite, minimal · request log 3 years · IP hashes 30 days. Enforced by pg_cron jobs and R2 lifecycle rules, proven by an erasure test in F2 and F4.

**C4. Terms register** (2026-10-03; ships only at "OK in reports")

| Source | Status |
|---|---|
| ANAF APIs | OK with conditions (1 req/s, no accreditation claims or logos, WCAG AA) |
| ONRC, MF, SEAP, SIRUTA, RNONG | OK with CC BY attribution and dates (MF 2024/2025 licence field empty) |
| portal.just.ro web service | COUNSEL (no explicit licence; persons removed) |
| e-licitatie `api-pub` | to review (undocumented) |
| TED, GLEIF / EUIPO | OK / after registration |
| Brave | OK, no storage of results; "POWERED BY BRAVE" where raw results show; company identifiers only |
| Google Places (EEA) | IDs only; UI Kit and console: COUNSEL |
| Meta Page metadata, Ad Library | to review; Ad Library as a deep link meanwhile |
| YouTube | OK in reports, not in paid deliverables |
| iTunes | store link only until reviewed |
| Google Ads Transparency, TikTok Commercial Content API | to review |
| Overture, FSQ OS Places (terms changed Oct 2026: re-read), AllThePlaces, OSM (separate ODbL layer) | OK with attribution |
| Greenhouse, Lever public boards | OK |
| Each RSS publisher; each chain store locator (eMAG bans robots) | per source, before ingest |
| Romanian platforms (parity check) | read by a person before any paid or trial use |

**C5. Processors and transfers.** Supabase (EU, DPA) · Cloudflare (edge; R2 in EU jurisdiction; DPF/SCCs; DPA) · Anthropic (US; DPF/SCCs; DPA; request zero retention, confirm current terms) · Google (Cloud terms) · Brave (US; keeps query logs 90 days) · Meta (platform terms) · email provider (EU, DPA) · Firecrawl if enabled (US, SCCs, DPA) · OpenCage and Fly.io if used (DPA).

**C6. Data map (Art. 30).** VI `facts`/`fact_evidence` (EU; G0 while refreshed, G2 90 d; delete by fact ID) · `person_mentions` (EU; 90 d; delete by CUI + name HMAC) · `fetches`/`run_events` (EU; partitions) · bulk tables (EU; phones as HMACs; reloaded) · R2 snapshots (EU jurisdiction; 30 d; delete by domain/CUI index) · R2 golden corpus (EU; ≤ 12 months) · workflow state (Cloudflare; 30 d; IDs only) · Durable Objects (no personal data) · Workers Logs (7 d) · `audit_leads`, later VI `leads` (EU; 24 months) · Anthropic, Firecrawl (transient, per DPA) · Brave (queries with company identifiers only, 90 d) · email provider (per DPA) · Supabase backups (7 d roll-off).

**C7. COUNSEL items.** Tier 2 balancing and the Art. 14 letter vs 14(5)(b); whether live calls, contact forms and social messages are "orice altă metodă" (Law 506 art. 12); whether we are an AI Act art. 50(2) provider; Places UI Kit display and internal-console permitted use; court-portal and ad-library terms; retention periods; MF licence follow-up for 2024/2025.

## Appendix D. Evaluation detail

Each metric is reported with a Wilson 95% interval; a gate passes when the point estimate meets the target and the lower bound is within 3 points of it. Minimum sample: 300 labelled facts for gates ≥ 95%, otherwise 100. Worst-group gates apply only to groups with n ≥ 30. Provenance completeness is a schema contract test, not a metric.

| Metric | v1 gate | +6 months |
|---|---|---|
| Main CAEN (Rev.3) precision | ≥ 97% | ≥ 99% |
| Website false "no website" | ≤ 5% | ≤ 3% |
| Generic contacts coverage (firms with a site) / precision | ≥ 80% / ≥ 95% | ≥ 90% / ≥ 97% |
| Official social profiles recall / precision | ≥ 80% / ≥ 95% | ≥ 90% / ≥ 97% |
| ≥ 3 of 5 in-depth competitors with a resolved site | ≥ 80% | ≥ 90% |
| Technology precision / recall | ≥ 95% / ≥ 80% | ≥ 97% / ≥ 90% |
| Offers found / price precision | ≥ 70% / ≥ 95% | ≥ 85% / ≥ 97% |
| Litigation recall / precision | ≥ 90% / ≥ 95% | ≥ 97% / ≥ 98% |
| Procurement precision (CUI-matched) | ≥ 99% | ≥ 99.5% |
| Team as published: precision; person facts from other sources | ≥ 98%; 0 | ≥ 99%; 0 |
| Evidence still valid on re-check | ≥ 95% | ≥ 98% |
| Errors in the top 3 recommendations | 0 | 0 |
| Identity card p50 / p95 | ≤ 1.5 s / ≤ 3 s | ≤ 1 s / ≤ 2 s |
| First audit finding; first peer insight | ≤ 15 s | ≤ 10 s |
| Anonymous quick-scan cost p50 / p95 | ≤ $0.01 / ≤ $0.05 | same |
| Progress update interval | ≤ 3 s | ≤ 3 s |

**Golden set (100 at +6 months):** 45 micro, 30 small, 15 medium, 10 large; ≥ 30 without a website; 15 online shops; 10 chains; 10 brand ≠ legal name; 8 under 18 months old; 5 inactive or insolvent; 5 with procurement; 5 with court cases; Vortex Hub; 2 consenting clients. Re-weighted by the size, sector and website mix observed in the first 2–4 weeks of traffic; large firms kept as a robustness set. Labels from primary sources with URL and capture date; 25% double-labelled; competitor relevance 0–3 with weighted kappa ≥ 0.7; stable fields re-checked quarterly, volatile ones within 48 hours of each run. **Blind comparison** (30 companies, 3 raters incl. one external accountant or consultant): ours vs ChatGPT Deep Research vs Perplexity vs the best Romanian platform profile on accuracy, usefulness and actionability. **Platform parity** (30 companies): terms read and archived first; "field present: yes/no" only, no values copied. **Golden corpus:** separate EU bucket, purpose in the LIA, redacted at capture, TDM-reserved sites as fact fixtures only, refreshed quarterly, ≤ 12 months.

## Appendix E. Main sources (checked 2026-10-03 unless dated)

- **Tools:** https://github.com/edwardtay/awesome-scrapers · https://docs.scrapy.org/en/latest/news.html · https://docs.scrapy.org/en/latest/topics/settings.html · https://crawlee.dev/js/api/basic-crawler/interface/BasicCrawlerOptions · https://docs.crawl4ai.com/api/parameters/ · https://github.com/unclecode/crawl4ai/security/advisories · https://github.com/firecrawl/firecrawl/security/advisories · https://www.firecrawl.dev/pricing
- **Cloudflare, Supabase, Fly, Lovable:** https://developers.cloudflare.com/browser-rendering/pricing/ (2026-04-21) · https://developers.cloudflare.com/browser-rendering/limits/ · https://developers.cloudflare.com/browser-rendering/rest-api/crawl-endpoint/ (2026-09-26) · https://developers.cloudflare.com/browser-run/reference/automatic-request-headers/ · https://developers.cloudflare.com/workflows/reference/limits/ · https://developers.cloudflare.com/workflows/reference/pricing/ (2026-09-21) · https://developers.cloudflare.com/workers/platform/limits/ · https://supabase.com/pricing · https://supabase.com/docs/guides/platform/compute-and-disk · https://docs.fly.io/about/pricing · https://docs.lovable.dev/features/hosting.md
- **Anthropic:** https://platform.claude.com/docs/en/about-claude/pricing · https://platform.claude.com/docs/en/api/rate-limits · https://platform.claude.com/docs/en/build-with-claude/citations · https://platform.claude.com/docs/en/build-with-claude/prompt-caching
- **Romanian official:** https://static.anaf.ro/static/10/Anaf/Informatii_R/Servicii_web/doc_WS_V9.txt · https://static.anaf.ro/static/10/Anaf/Informatii_R/doc_WS_Bilant_V1.txt · https://static.anaf.ro/static/10/Anaf/termeni_conditii_API.pdf · https://data.gov.ro/dataset/firme-02-09-2026 · https://data.gov.ro/dataset/situatii_financiare_2025 · http://portalquery.just.ro/query.asmx?WSDL · https://data.gov.ro/api/3/action/package_show?id=achizitii-publice-2026 · https://api.ted.europa.eu/v3/notices/search · https://api.gleif.org/api/v1/lei-records · https://dev.euipo.europa.eu/ · https://onrc.ro/index.php/ro/informatii/certificate-constatatoare
- **Presence and data:** https://brave.com/search/api/ · https://api-dashboard.search.brave.com/terms-of-service · https://developers.google.com/maps/billing-and-pricing/pricing (2026-09-28) · https://cloud.google.com/terms/maps-platform/eea (2026-08-26) · https://cloud.google.com/terms/maps-platform/eea-places-api-permitted-uses · https://developers.facebook.com/docs/features-reference/page-public-metadata-access · https://developers.facebook.com/docs/graph-api/reference/ads_archive/ · https://developers.google.com/youtube/terms/developer-policies · https://storage.googleapis.com/ads-transparency-center/api-data/README.txt · https://cloud.google.com/bigquery/pricing · https://developer.chrome.com/blog/crux-rank-magnitude · https://blog.gdeltproject.org/gdelt-doc-2-0-api-debuts/ · https://sslmate.com/ct_search_api/ · https://performance-partners.apple.com/search-api · https://developers.greenhouse.io/job-board · https://docs.overturemaps.org/guides/places/ · https://www.alltheplaces.xyz/ · https://opencagedata.com/pricing · https://dataforseo.com/update/pricing-update-in-dataforseo-apis
- **Law and enforcement:** https://legislatie.just.ro/Public/DetaliiDocumentAfis/77218 (Law 365/2002) · https://legislatie.just.ro/Public/DetaliiDocument/56973 (Law 506/2004) · https://legislatie.just.ro/Public/DetaliiDocument/203151 (Law 190/2018) · https://legislatie.just.ro/Public/DetaliiDocument/109855 (Criminal Code) · https://legeaz.net/monitorul-oficial-321-2022/lege-69-2022 (TDM) · https://www.edpb.europa.eu/system/files/2026-07/edpb_guidelines_2020603_webscraping_v1_en_0.pdf · https://www.cnil.fr/en/data-scraping-kaspr-fined-eu240000 · https://uodo.gov.pl/en/553/1572 · https://www.autoriteitpersoonsgegevens.nl/documenten/handreiking-scraping-door-particulieren-en-private-organisaties · https://curia.europa.eu/jcms/jcms/p1_3865255 · https://eur-lex.europa.eu/eli/reg/2022/2065/oj · https://www.gibsondunn.com/eu-ai-act-omnibus-agreement-postponed-high-risk-deadlines-and-other-key-changes/ · https://www.jonesday.com/en/insights/2026/06/european-commission-publishes-final-code-of-practice-on-marking-and-labelling-aigenerated-content · https://www.linkedin.com/legal/user-agreement · https://ppc.land/italy-fines-lusha-2-million-euros-orders-erasure-of-italian-contact-data/
- **Competitors:** https://www.risco.ro/verifica-firma/dedeman-cui-2816464 · https://www.risco.ro/api-firme · https://apis.termene.ro/ · https://parallel.ai/articles/exa-vs-parallel-findall.md
