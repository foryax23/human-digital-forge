# Tech stack on the homepage: names now, logos only with permission (plan)

Owner's request: "these are logos with the technologies used in our company, implement it
somewhere in the website, like in a slideshow bar or something, create the plan for
implementing these". Eleven files were sent (Anthropic wordmark, Claude spark, AWS, Microsoft
Azure, OpenAI blossom, Cloudflare, a Gemini-style sparkle, Stripe, Supabase, n8n, Vercel).

This plan is based on three research passes done on 2026-10-03: each vendor's brand rules, a
white-logo test made from the owner's files, and mockups placed on fresh captures of the dev site.
Where the logo test and the brand rules disagree, **the brand rules win** (see section 3).

---

## 0. Summary for the owner

- **Where:** a slim band directly under the hero, headed "Tehnologii cu care lucrăm", plus a short
  "Ce folosim și pentru ce" block at the end of the Services section that says what each tool is for.
- **How it moves:** the names glide slowly left (one loop every 50 s, about 25 px a second). The band stops
  under the mouse and stops with the page's existing pause button. Visitors who turned animations off
  in their system see the same names standing still in a tidy row.
- **What we show:** the 10 names (Claude, OpenAI, Google Gemini, n8n, Supabase, Stripe, Vercel,
  Cloudflare, AWS, Microsoft Azure), set in our own font in one quiet grey. No logos for now.
- **Why not logos:** Anthropic/Claude, OpenAI, Google, Microsoft, AWS and Cloudflare all forbid their
  logos without written permission or partner status. Stripe and Supabase may only be shown in their
  exact official files and colours, and only n8n and Vercel are free to use. Mixing 2–4 logos with
  plain names would look unfinished.
- **The files you sent:** none of them can go on the site. Some are unofficial or old copies (the
  Gemini star is a stock render, the Claude spark is a re-trace, the n8n file has an old colour),
  some need permission, and six are dark logos that disappear on our dark background.
- **Honesty:** we never call these companies partners. A small line in the footer says the marks
  belong to their owners. List only the tools you really use for clients.
- **Later:** if permissions come through, every name is swapped for its official logo at once (a
  one-line switch). Until then names are the safe and cleaner choice, and they suit the redesign.
- **Your part:** confirm each tool is really used, approve the texts, and choose a moving band or a
  still row on desktop (see step 6).

---

## 1. The marks: status, sources, files

Status values: **logo** (official white file allowed) · **colours only** (official dark-background
file, never recoloured) · **name only** (text; a logo needs written permission or partner
membership) · **avoid** (never use the file the owner sent).

**Now (phase 1) every mark is shown as a name.** The logo column is what becomes possible later.
Files go under `public/media/tech/`, as SVG taken unchanged from the official kit. `-white` means the
kit's one-colour white file; `-dark` means the kit's own "for dark backgrounds" colour version.

| Mark | Status | Owner's file | Official source (download only after approval) | Phase-2 file | What unlocks a logo |
|---|---|---|---|---|---|
| Anthropic | name only, **merged into "Claude"** | avoid (dark-only wordmark) | https://www.anthropic.com/press-kit (26.5 MB zip); rules https://www.anthropic.com/legal/trademark-guidelines | none: never show both Anthropic and Claude | — |
| Claude | name only | avoid (re-traced spark, jagged ray ends) | same press kit | `claude-logo-dark.svg` (spark + "Claude" lockup) | Claude Partner Network (free, https://www.anthropic.com/news/claude-partner-network) or marketing@anthropic.com |
| OpenAI | name only | avoid (Wikimedia copy, likely the pre-2025 blossom, no name) | https://openai.com/brand/ | `openai-logo-white.svg` (blossom + "OpenAI") | written OK from partnercomms@openai.com |
| Google Gemini | name only | avoid (stock 3D render, not a Google asset) | none for non-partners; rules: Google Cloud Customer Co-branding Guidelines (Apr 2026) | none | Google Cloud partner status / https://support.google.com/contact/brand_request_form |
| n8n | **logo** | avoid (old #101330 navy wordmark, invisible on dark) | https://n8n.io/brandguidelines/n8n_logos.zip (41 KB) | `n8n-logo-white.svg` (icon + wordmark together, min 100 px wide) | already allowed |
| Supabase | **colours only** | avoid (icon only, no name) | https://supabase.com/brand-assets.zip (263 KB) | `supabase-logo-dark.svg` (green icon + light wordmark, as supplied) | already allowed |
| Stripe | **colours only** (white wordmark on dark) | avoid (blurple, 4.4:1 on our background) | https://stripe.com/newsroom/brand-assets (Stripe_logo_kit.zip) | `stripe-wordmark-white.svg` | allowed only next to content about our Stripe payments work; for a general homepage band ask trademarks@stripe.com |
| Vercel | **logo** | avoid (black only) | https://k2mkucxia43oc7fa.public.blob.vercel-storage.com/front/press/vercel-assets.zip (127 KB) | `vercel-logotype-white.svg` | already allowed (truthful customer use + attribution line) |
| Cloudflare | name only | avoid (dark-grey wordmark) | https://www.cloudflare.com/press/press-kit/ | `cloudflare-logo-dark.svg` | written permission from Cloudflare |
| AWS | name only | avoid (the "smile" logo is not licensed to customers) | https://aws.amazon.com/trademark-guidelines | none: the "Powered by AWS" badge is only for content that runs on AWS and may not sit next to our own marks | AWS Partner Network badge |
| Microsoft Azure | name only | avoid (product icon: diagrams and docs only) | https://learn.microsoft.com/en-us/azure/architecture/icons/ (diagram use only) | none | Microsoft AI Cloud Partner Program badge |

Consequences:
- A **full** logo band is only possible if AWS, Microsoft Azure and Google Gemini are dropped or partner
  status is earned. Realistically the names stay. Treat the logo phase as optional.
- The white logo set made in the logo test (scratchpad `tech-logos/assets/white/`) was a feasibility
  check. **Do not copy it into `public/`**: it's made from recoloured, unofficial or unlicensed files.

---

## 2. Component spec

### 2.1 Files

| File | Change |
|---|---|
| `src/components/landing/tech-stack.ts` | **new**: the one data source (names, order, groups, legal text, logo slots) |
| `src/components/landing/TechStack.tsx` | **new**: `TechBand` (A), `TechGroups` (B), `TechCredits` (C) |
| `src/components/landing/TechStack.module.css` | **new**: marquee mechanics only (mask, keyframes, pause rules, reduced-motion layout) |
| `src/styles.css` | add one type role `type-mark`; remove the dead `.animate-marquee`, `.animate-marquee-x` and `@keyframes marquee` |
| `src/routes/index.tsx` | mount `<TechBand />` between `<HeroSection />` and `<WorkSection />` |
| `src/components/landing/ServicesSection.tsx` | append `<TechGroups />` after the list and the phone-only "All services" button |
| `src/components/landing/ContactFooter.tsx` | append `<TechCredits />` under the legal bar |
| `src/components/home/TrustMarquee.tsx` | **delete**: unused (no imports), and its uppercase tracked labels with teal dots are the style the refresh removes. Its one useful idea (an `aria-hidden` copy for the loop) is rebuilt in `TechBand` |

### 2.2 Data (`tech-stack.ts`)

```ts
export type TechGroupId = "ai" | "cloud" | "data" | "automation";
export type TechLogo = { src: string; width: number; height: number; displayHeight: number };
export type Tech = {
  id: "claude" | "openai" | "gemini" | "n8n" | "supabase" | "stripe" | "vercel" | "cloudflare" | "aws" | "azure";
  name: string;          // exact, never translated
  group: TechGroupId;
  logo?: TechLogo;       // phase 2 only: official file + source URL and download date in a comment
};

/** Band order. Every entry must be a tool the owner confirmed is used in client work. */
export const TECH_STACK: readonly Tech[] = [
  { id: "claude", name: "Claude", group: "ai" },
  { id: "openai", name: "OpenAI", group: "ai" },
  { id: "gemini", name: "Google Gemini", group: "ai" },
  { id: "n8n", name: "n8n", group: "automation" },
  { id: "supabase", name: "Supabase", group: "data" },
  { id: "stripe", name: "Stripe", group: "data" },
  { id: "vercel", name: "Vercel", group: "cloud" },
  { id: "cloudflare", name: "Cloudflare", group: "cloud" },
  { id: "aws", name: "AWS", group: "cloud" },
  { id: "azure", name: "Microsoft Azure", group: "cloud" },
];

/** Logos render only when this is true AND every entry has a logo: never mixed with names. */
export const TECH_LOGOS_ENABLED = false;
export const showTechLogos = () => TECH_LOGOS_ENABLED && TECH_STACK.every((t) => t.logo);

export const TECH_GROUPS: readonly { id: TechGroupId; title: { en: string; ro: string }; use: { en: string; ro: string } }[] = [/* 2.6 */];
export const TECH_ATTRIBUTION = "…"; // section 3, English, word for word
```

Bilingual copy follows the site's existing pattern: inline `t(en, ro)` for UI strings, and
`{ en, ro }` objects in data (as `footerNav` does in `ContactFooter.tsx`).

### 2.3 New type role (in `src/styles.css`, next to the other `type-*` roles)

```css
/* Product and technology names (tech band, stack block). */
@utility type-mark {
  font-family: var(--font-display);
  font-weight: 500;
  font-size: 1.0625rem; /* 17px */
  line-height: 1.25;
  letter-spacing: -0.01em;
  @media (width < 48rem) {
    font-size: 1rem; /* 16px on phones; keeps the line-height (text-base would reset it) */
  }
}
```
Space Grotesk 500 is already loaded (Google Fonts link in `__root.tsx`), so this adds no font request.
If the parallel UI refresh renames the type roles, follow its naming.

### 2.4 A: `TechBand` (marquee under the hero)

Props:
```ts
export function TechBand(props: {
  /** Still row from 1280 px instead of the marquee (the whole list fits). Default false. */
  staticOnDesktop?: boolean;
  className?: string;
}): JSX.Element;
```

Markup (both lists are always rendered on the server; CSS decides what shows, so there's no
hydration mismatch and no layout shift):
```tsx
<section aria-labelledby="tech-band-title" ref={ref} className={cn(styles.band, staticOnDesktop && styles.staticXl)}>
  <div className="mx-auto max-w-[1320px] px-6 md:px-10 lg:px-12">          {/* = hero bottom bar */}
    <div className="border-y border-border md:grid md:min-h-[72px] md:grid-cols-[auto_minmax(0,1fr)]">
      <h2 id="tech-band-title"
          className="type-body-sm whitespace-nowrap pt-4 text-muted-foreground md:flex md:items-center md:border-r md:border-border md:pr-8 md:pt-0">
        {t("Technologies we work with", "Tehnologii cu care lucrăm")}
      </h2>
      <div className={styles.viewport}>
        <div className={styles.track}>
          <ul role="list" lang="en" className={styles.list}>{items}</ul>
          <ul role="list" lang="en" aria-hidden="true" className={styles.list}>{items}</ul>
        </div>
      </div>
    </div>
  </div>
</section>
```
- Item (text phase): `<li className="type-mark whitespace-nowrap text-foreground/60 transition-colors duration-200 hover:text-foreground">Claude</li>`.
  In Tailwind v4, `hover:` already applies only under `@media (hover: hover)`, so a tap doesn't leave a name lit.
  `text-foreground/60` with hover to full is the nav links' own pattern; it measures about 6.5:1 on the
  night background. The caption in `text-muted-foreground` is above 4.5:1.
- `role="list"` keeps list semantics in Safari/VoiceOver with `list-style: none`. Screen readers read
  "Tehnologii cu care lucrăm, list, 10 items" once; the copy is `aria-hidden`.
- `lang="en"` so the names are pronounced as their owners say them, on the RO page too.
- Names are **not links**: no tab stops added, no outgoing links that look like endorsement.
- Item (logo phase): `<li><img src width height alt="Microsoft Azure" style={{ height: displayHeight }} loading="lazy" decoding="async" /></li>`;
  the copy uses `alt=""`. Official file at 100% opacity: no CSS filters and no opacity dimming,
  because both change the official colour. Height 20–24 px (phones ×0.85), always below the 32/40 px
  Vortex Hub nav logo. n8n is at least 100 px wide. Vercel needs clear space equal to the triangle
  height (the 56 px gap covers it).
- Off-screen pause (AGENTS.md rule): one `IntersectionObserver` sets `ref.current.dataset.onscreen`
  directly, with no React state and no re-render.

CSS (`TechStack.module.css`). Use a **local** keyframe: CSS Modules scope animation names, so the
global `marquee` keyframe would not resolve from here.
```css
.viewport {
  --fade: 64px;
  position: relative; display: flex; align-items: center; overflow: hidden;
  -webkit-mask-image: linear-gradient(90deg, transparent, #000 var(--fade), #000 calc(100% - var(--fade)), transparent);
          mask-image: linear-gradient(90deg, transparent, #000 var(--fade), #000 calc(100% - var(--fade)), transparent);
}
.track { display: flex; width: max-content; will-change: transform;
         animation: scroll var(--duration, 50s) linear infinite; }
.list { --gap: 56px; display: flex; align-items: center; gap: var(--gap);
        margin: 0; padding: 0 var(--gap) 0 0; list-style: none; } /* trailing gap keeps the -50% loop exact */
@keyframes scroll { to { transform: translate3d(-50%, 0, 0); } }

@media (hover: hover) { .viewport:hover .track { animation-play-state: paused; } }
.viewport:focus-within .track,
.band[data-onscreen="false"] .track { animation-play-state: paused; }
/* html[data-motion="paused"] (MotionPauseToggle) already pauses every animation: styles.css ~l.581. */

@media (max-width: 767px) {
  .band { --duration: 40s; }
  .viewport { --fade: 32px; height: 52px; margin-inline: -24px; } /* bleeds to the screen edges */
  .list { --gap: 40px; }
}

/* Reduced motion: one still copy, no fade. */
@media (prefers-reduced-motion: reduce) {
  .track { animation: none; width: auto; flex: 1; }
  .list[aria-hidden="true"] { display: none; }
  .viewport { -webkit-mask-image: none; mask-image: none; height: auto; margin-inline: 0; }
  .list { flex: 1; }
}
@media (prefers-reduced-motion: reduce) and (min-width: 768px) {   /* 2 even rows of 5 */
  .list { display: grid; grid-template-columns: repeat(5, auto); justify-content: space-between;
          gap: 14px 24px; padding: 18px 0 18px 32px; }
}
@media (prefers-reduced-motion: reduce) and (min-width: 1280px) {  /* 1 even row of 10 */
  .list { grid-template-columns: repeat(10, auto); padding-block: 0; }
}
@media (prefers-reduced-motion: reduce) and (max-width: 767px) {   /* wrapped run of names */
  .list { flex-wrap: wrap; gap: 10px 24px; padding: 12px 0 18px; }
}
/* .staticXl: inside @media (min-width: 1280px), repeat the base reduced-motion rules (no animation,
   no mask, duplicate hidden) plus the one-row grid (repeat(10, auto), padding 0 0 0 32px). */
```

Sizes per breakpoint (measured in the mockups):

| | ≥1280 | 768–1279 | <768 |
|---|---|---|---|
| Layout | caption cell, hairline, marquee cell | same | caption on top (16 px pad), marquee below |
| Row height | 72 px min | 72 px min | 20 px caption + 52 px track |
| Caption | `type-body-sm` 14/21 | same | same |
| Names | 17 px | 17 px | 16 px |
| Gap / edge fade | 56 / 64 px | 56 / 64 px | 40 / 32 px |
| Loop | 50 s, set 1241 px, 24.8 px/s | same | 40 s, set 1041 px, 26 px/s |
| Reduced motion | one row of 10 | two rows of 5 | wrapped, left-aligned |

If the list changes, keep the speed near 25 px/s (duration = width of one set ÷ 25). One set must stay
wider than the marquee cell: at 1920 the cell is about 990 px. With fewer than 7 names, render 3 copies.

### 2.5 B: `TechGroups` (closes the Services section)

```ts
export function TechGroups(props: {
  /** Defaults to "What we use, and what for" because the band already uses the short caption. */
  title?: { en: string; ro: string };
  className?: string;
}): JSX.Element;
```
- Mount: last child of the `max-w-[1200px]` container in `ServicesSection`, after the phone-only
  "All services" button, with `mt-14 md:mt-18` (56 / 72 px).
- Markup: `<div>` → head (`<h3 className="type-h3 text-foreground">` + `<p className="type-body-sm text-muted-foreground text-pretty">`
  lead; side by side on the baseline from 768) → `<ul role="list" className="border-t border-border">`
  with 4 `<li className="border-b border-border py-5">`. Each has `<h4 className="type-mark font-semibold text-foreground">`,
  `<p className="type-body-sm text-muted-foreground text-pretty">` and `<ul role="list" lang="en">` of names in
  `type-mark text-foreground/85`, `gap-x-6 gap-y-1.5` (`gap-x-7` from 1024). The mockup set descriptions at
  15 px; `type-body-sm` (14 px) keeps them inside the type roles.
- Grid: from 1024 `grid-cols-[208px_minmax(0,5fr)_minmax(0,6fr)] gap-x-8` (rows about 65 px, block
  about 480 px); 768–1023 `grid-cols-[184px_minmax(0,1fr)]` with names under the description; phones stacked.
- Static: no hover states, no motion (the list's `motion.ul` fade doesn't apply here).
- If the homepage gets too long, move `TechGroups` to `/services` and keep `TechBand` on the homepage.
- The 4-column version (`b-stack-cols`) was rejected: its columns end at uneven heights and the text wraps.

### 2.6 Strings (Romanian first)

| Key | RO | EN |
|---|---|---|
| Band caption (h2) | Tehnologii cu care lucrăm | Technologies we work with |
| Groups title (h3, with the band on the page) | Ce folosim și pentru ce | What we use, and what for |
| Groups title (page without the band) | Tehnologii cu care lucrăm | Technologies we work with |
| Groups lead | Platforme consacrate, alese pentru fiecare proiect. | Established platforms, chosen project by project. |
| AI | AI · Asistenți, agenți și analiză de documente. | AI · Assistants, agents and document analysis. |
| Cloud | Cloud și găzduire · Unde rulează site-urile și aplicațiile pe care le livrăm. | Cloud and hosting · Where the sites and apps we deliver run. |
| Data | Date și plăți · Baze de date, conturi de utilizator și plăți online. | Data and payments · Databases, user accounts and online payments. |
| Automation | Automatizări · Fluxuri care leagă formularele, e-mailul și CRM-ul. | Automation · Workflows that connect forms, email and your CRM. |
| Footer disclaimer | Mărcile menționate aparțin proprietarilor lor. Menționarea lor nu implică un parteneriat sau o recomandare. | Trademarks mentioned belong to their respective owners. Mentioning them does not imply partnership or endorsement. |
| Footer disclaimer (logo phase) | Mărcile și siglele afișate aparțin proprietarilor lor. Folosirea lor nu implică un parteneriat sau o recomandare. | Trademarks and logos shown belong to their respective owners. Their use does not imply partnership or endorsement. |
| "We work with" line (only on pages without A or B) | Lucrăm cu Claude, OpenAI, Google Gemini, n8n, Supabase, Stripe, Vercel, Cloudflare, AWS și Microsoft Azure. | We work with Claude, OpenAI, Google Gemini, n8n, Supabase, Stripe, Vercel, Cloudflare, AWS and Microsoft Azure. |

- "și" instead of "&" in group titles, because it reads more naturally in Romanian. Use comma-below ș/ț (U+0219/U+021B), never
  cedilla ş/ţ. Names are never translated or declined ("lucrăm cu Supabase", not "Supabase-ul").
- Build the "We work with" line from `TECH_STACK` with `Intl.ListFormat(lang, { type: "conjunction" })`,
  so it stays in sync and gets "și"/"and" right.

### 2.7 C: `TechCredits` (footer small print)

- In `ContactFooter`, after the legal bar `div` (`type-micro mt-8 … border-t`): a new block
  `mt-6 border-t border-border pt-4 grid gap-1.5 text-center md:text-left`.
- Line 1: the disclaimer (`type-micro text-muted-foreground`).
- Line 2: `TECH_ATTRIBUTION` in English in both languages (`<p lang="en" className="type-micro text-muted-foreground max-w-[124ch] text-pretty">`).
  It stays visible, not behind a link (Vercel and Cloudflare ask for a visible statement).
- `ContactFooter` is only used on the homepage, so the credits appear on the page that carries the
  band. If the stack is added to other pages, add `TechCredits` to their footer too.

### 2.8 Mounting (`src/routes/index.tsx`)

```tsx
import { TechBand } from "@/components/landing/TechStack";
…
<main>
  <HeroSection />
  <TechBand />
  <WorkSection />
  <ServicesSection />   {/* renders <TechGroups /> at its end */}
  …
```
`TechBand` gets no `id` and stays out of `SECTION_IDS`, so the nav scroll-spy and the hero's
"Scroll to explore" (→ `#work`) are unchanged.

---

## 3. Legal

**Allowed wording:** "Tehnologii cu care lucrăm / Technologies we work with", "Lucrăm cu / We work
with", "Ce folosim și pentru ce / What we use, and what for". "Work with" is the relational phrase
AWS asks for.

**Never use:** "Parteneri", "Partenerii noștri", "în parteneriat cu", "Partener oficial" / "Partners",
"Official partner" (only after joining that vendor's programme). Also never: "Susținut de" / "Backed by",
"Powered by" (Google forbids it outright), "Certificat de" / "Certified by", "Recomandat de" /
"Recommended by", and "Construit cu" / "Built with" for the agency as a whole.

**Rules for the names:**
- Exact names, untranslated: Claude, OpenAI, Google Gemini (never just "Gemini": a crypto exchange
  uses that brand), Microsoft Azure (full name), AWS, Cloudflare, Stripe, Supabase, n8n, Vercel.
- Anthropic is folded into Claude: one vendor, one slot.
- No ™/® in the band: Anthropic and Stripe forbid the symbols. Cloudflare's strict reading wants ®
  on the first mention. The footer attribution covers it; adding a small superscript ® after
  "Cloudflare" is optional.
- Only list tools really used in client work (Cloudflare, Vercel and AWS insist on truthful claims).
  Review the list when it changes and remove anything no longer used.
- Never put vendor names in the page `<title>`, meta description, OG image or ads.

**Rules for logos (phase 2 only):**
- Official files only, unchanged: no recolouring, no CSS `filter`, no opacity dimming, no cropping
  the name off a lockup, no re-tracing. Never use the owner's 11 files.
- Never bigger or louder than the Vortex Hub logo (AWS, OpenAI, Stripe, Vercel and Google all require
  this): at most 24 px tall, compared with the 32/40 px nav logo.
- All logos at once or none (`showTechLogos()`); never logos and names in one row.
- Stripe: only near content about the payments work, or with written OK. Supabase: dark-theme file
  as supplied (its icon stays green).

**Footer attribution (word for word, English; Vercel's sentence must not change):**

> Anthropic and Claude are trademarks of Anthropic, PBC. Amazon Web Services and AWS are trademarks of Amazon.com, Inc. or its affiliates. Microsoft and Azure are trademarks of the Microsoft group of companies. OpenAI is a trademark of OpenAI. Cloudflare is a trademark and/or registered trademark of Cloudflare, Inc. in the United States and other jurisdictions. Google and Gemini are trademarks of Google LLC. Stripe is a trademark of Stripe, Inc. Supabase is a trademark of Supabase, Inc. n8n is a trademark of n8n GmbH. Vercel, the Vercel design, Next.js and related marks, designs and logos are trademarks or registered trademarks of Vercel, Inc. or its affiliates in the US and other countries.

If a name is removed from `TECH_STACK`, remove its sentence too. The Anthropic sentence stays while
Claude is listed.

**Hero copy to check:** an earlier capture of the hero bar showed "Bazat pe AI · Pentru rezultate
reale" (EN "Powered by AI · built for real outcomes") directly above where the band goes. The current
source no longer has it. If it comes back, reword the English so "Powered by" does not sit above the
vendor names (for example "AI-assisted · built for real outcomes").

Not legal advice. EU trademark law generally allows naming a product honestly in text. Logos are
where each vendor's own rules apply, and some of those rules are part of terms already accepted
(for example the API terms).

---

## 4. Steps and acceptance checks

Check every step on the `vortex-dev` preview (http://localhost:5184) in RO and EN, at **1920, 1440,
1280, 768 and 390 px** wide. Coordinate with the hero work in progress: the band mounts after
`HeroSection` and relies on the hero bar's `MotionPauseToggle`.

1. **Data and type role.** Add `tech-stack.ts` and `type-mark`.
   *Check:* `bunx tsc --noEmit` and `bun run lint` clean; names and order exactly as in 2.2; `showTechLogos()` returns false.
2. **Band (A).** Add `TechStack.tsx`/`.module.css` with `TechBand`, mounted under the hero.
   *Check:*
   - Rows are 72 px at 1920/1440/1280/768. At 390: caption, then a 52 px track that runs to the screen edges.
   - The caption is on one line at every width. No horizontal page scroll (`scrollWidth === innerWidth`).
   - The loop is seamless: the frames at 0 and −50% are pixel-identical (screenshot both).
   - Hover pauses it (desktop only). A tap on a phone does not freeze it.
   - The hero pause button and the footer pause button stop it, and it resumes when clicked again.
   - It pauses when scrolled out of view (`data-onscreen="false"`).
   - With emulated `prefers-reduced-motion`: no movement, no fade and one copy. One row at 1920/1440/1280,
     two rows of five at 768, a wrapped run at 390.
   - VoiceOver reads the heading and one 10-item list; nothing in the band takes keyboard focus.
3. **Stack block (B).** Add `TechGroups` to `ServicesSection`.
   *Check:* columns line up across all four rows at 1920/1440/1280 (and 1024). At 768 there are two
   columns with the names under the text, and at 390 everything stacks. The RO lines don't wrap
   awkwardly at 1280. The title reads "Ce folosim și pentru ce" while the band is on the page.
4. **Footer credits (C).** Add `TechCredits` under the legal bar.
   *Check:* the disclaimer is in the active language and the attribution matches section 3 character
   for character (diff it). It is centred at 390 and left-aligned from 768, with lines no longer than 124ch at 1920.
5. **Cleanup.** Delete `src/components/home/TrustMarquee.tsx` and remove `.animate-marquee`,
   `.animate-marquee-x` and `@keyframes marquee` from `styles.css` (after `grep -rn marquee src` shows no other users).
   *Check:* the build passes; `grep` finds no references.
6. **Owner's choice: moving or still on desktop.** Default is the marquee everywhere (the owner asked for a
   "slideshow bar"). If the owner prefers a calmer desktop, set `<TechBand staticOnDesktop />`: from 1280 px
   the ten names stand in one even row (they need about 681 px of width) and the marquee runs only below 1280.
7. **Performance and stability.** Compare a production build (`vite build` + `vite preview` on a free
   port; never the dev server) before and after. Use the Chrome DevTools Lighthouse panel (mobile and
   desktop); nothing new needs downloading.
   *Check:*
   - No new requests (no images or fonts in phase 1). HTML grows by under 3 KB.
   - Performance moves by no more than ±2 points (noise). Accessibility and Best Practices: no new failing audits.
   - No "non-composited animations" entry: the animation uses transform only.
   - CLS added by the band is 0.00. Measure it with a `PerformanceObserver('layout-shift')` script while
     loading and scrolling past the band at 1440 and 390. The band has fixed heights, and both lists are
     on the server, so a font swap or a reduced-motion setting can't move the content below it.
8. **Phase 2 (optional, only after permissions).** Download the approved kits, place the files from
   section 1 in `public/media/tech/` unchanged, fill `logo` (with `width`/`height` attributes, so no
   layout shift) for **every** entry, and set `TECH_LOGOS_ENABLED = true`. Switch the footer disclaimer
   to the logo version.
   *Check:* everything in step 2 again. Every logo is at most 24 px tall, at 100% opacity, with no filters.
   The image is 100 px wide or more for n8n, and every `alt` is the exact company name.

### Owner's to-dos
- [ ] Confirm each of the 10 is really used in client work, especially **Cloudflare, Vercel, AWS,
      Microsoft Azure and Google Gemini**. Anything unconfirmed is removed from the list and the attribution.
- [ ] Approve the RO/EN texts in 2.6 (heading, group lines, disclaimer).
- [ ] Choose: moving band on desktop (default) or a still row from 1280 px (step 6).
- [ ] Agree that the attribution paragraph is shown in the homepage footer.
- [ ] Do not hand over the 11 files for the site: they are unofficial, old, or need permission.
- [ ] Only if you want logos later:
  - approve the downloads: n8n kit (41 KB), Vercel kit (127 KB), Supabase kit (263 KB), Stripe logo kit (size not checked);
  - join the Claude Partner Network (free), and email partnercomms@openai.com (OpenAI) and trademarks@stripe.com (Stripe, for a general band);
  - ask Cloudflare for written permission;
  - accept that AWS, Microsoft Azure and Google Gemini stay as names unless you join their partner programmes.
  The Anthropic press kit (26.5 MB) and the Cloudflare zip are downloaded only once permission is granted.

---

## References (session scratchpad, 2026-10-03)
- Brand rules data: `…/scratchpad/tech-logos/brands/brands.json` (+ `page_*.txt` copies of the guideline pages).
- Logo test (not for shipping): `…/scratchpad/tech-logos/assets/preview.png`, `manifest.json`.
- Mockups: `…/scratchpad/tech-logos/mockup/index.html` (`?lang=en`, `?clean`).
  - A: `shots/a-desk.png`, `a-mob.png`, `a-tab-reduced.png`, `a-desk-reduced.png`.
  - Why not logos: `shots/a-logos-desk.png`.
  - B: `shots/b-desk.png`, `b-mob.png`.
  - C: `shots/c-desk.png`.
