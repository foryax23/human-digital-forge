# Company Atlas: everything public about a company, in one report

Deep research grows from a report into an **atlas**: one map of the company's assets, people, contacts, online presence and history. Every item links to the page it came from. The strategy built on top of the atlas is a **later phase**. It is listed at the end and not built now.

## What the atlas will contain

1. **Identity and legal**
   - Legal name, trade names, CUI, registration number, address, CAEN code, VAT status.
   - Every former name, address and status change (official registers, ANAF history).
   - Branches and work points.
2. **People and ownership**
   - Founders, shareholders, administrators and managers, with their role and start date where public.
   - Other companies each person runs or owns (the "networking history"), shown as a small network map.
   - Only public business roles. No home addresses or personal phone numbers (see Privacy rules).
3. **Contact details (company only)**
   - Official phone numbers, e-mails and contact forms from the website, registers and Google Business.
   - Business e-mails of named staff only when the company publishes them itself.
4. **Assets**
   - Websites and domains, including other domains linked to the same company.
   - Trademarks (OSIM, EUIPO).
   - Public contracts won (SEAP/SICAP in Romania, TED in the EU), EU funds received.
   - Locations and shops from Google Maps.
   - Apps in the app stores, and the technology the website uses.
   - Real estate and vehicles are not public in Romania, so they are left out.
5. **Online presence**
   - Social profiles (Instagram, Facebook, TikTok, LinkedIn, YouTube), with follower counts when the search results show them.
   - Reviews and ratings (Google, Trustpilot), active ads (Meta Ad Library, Google Ads Transparency), press news, job ads.
6. **History timeline**
   - One dated timeline that merges register changes, financial years, court cases, contracts, news and events.
7. **Money and risk** (already built)
   - Financial results, sector comparison, court cases, insolvency, tenders.

## How it works for the user

- Research takes longer and runs in stages ("deep digging"). Each finished stage appears live in the report.
- The report gets a new **Atlas** tab with a section for each area above, plus the people network map and the history timeline.
- Every item has a confidence label ("Confirmed" from official sources, "Likely" from search) and a link to its source.
- The atlas can be exported as a PDF.

## Privacy rules

- People are listed only in their public business role.
- No private contact details are collected or guessed, and no profiles are scraped from social networks.
- Searches use only public sources and official APIs.
- Each person can ask to be removed. The privacy page will say so.

## Build order

1. Atlas structure, the new tab and the history timeline (from the data we already have).
2. People and networking: other companies of each founder or administrator, and the network map.
3. Assets: trademarks, SEAP contracts, EU funds, linked domains, Google Maps locations, apps.
4. Contacts and presence: company contacts, follower counts, reviews, Meta and Google ad libraries, job ads.
5. Longer staged runs with live progress, and the PDF export.

## Later phase (not in this plan): strategy

The atlas will feed a strategy section: market position, growth opportunities, risks, and a 90-day action plan, each point backed by atlas facts.

## Open points

- Meta Ad Library needs a free Meta access token.
- Full shareholder history from ONRC (the Trade Register) is a paid service. Without it, the atlas uses public sources only.
- Website traffic needs a paid data service.
- Each longer run will cost more in Claude usage. The current per-report and daily spending caps will be raised carefully.

## Technical details

- New atlas sections are new fact predicates (`atlas.*`) in `contracts.ts`. Each step stays budget-ledgered and keeps the rule that every item cites a URL the search really returned.
- New steps are added to the pipeline: `people-graph`, `assets`, `presence2`. Each is a separate claimed and resumable step, so runs can last minutes without hitting the per-request time limit.
- The network map uses the existing person/company matching in `parse/people.ts`. Links between people are inferred only from register data or the profile items that cite a source.
- Social networks are never fetched directly; the existing anti-hallucination verifier stays.
