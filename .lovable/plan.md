# Homepage Polish — Unified Font, Imagery & Flowing Color Transitions

Building on the cinematic homepage, this round raises the craft of every section: one elegant typeface across the whole site, real imagery in each section, refined decorative figures, and seamless color transitions so each section melts into the next instead of stopping at a hard edge.

## 1. One font for the whole website

Replace the current two-font setup (Instrument Serif + Inter) with a single, premium, versatile typeface used for both headings and body:

- **Sora** — a geometric, modern sans with strong personality at display sizes and excellent readability at body sizes. Fits the cinematic, next-gen agency feel.

Implementation:
- Swap the Google Fonts `<link>` in `src/routes/__root.tsx` to load Sora (weights 300–800).
- Update `--font-sans` and `--font-serif` in `src/styles.css` to both point at Sora, so every existing `font-serif` heading and `font-sans` body element instantly uses one family.
- Tune heading weight/letter-spacing for a refined editorial look (lighter weights at large sizes, tighter tracking).

## 2. Flowing color transitions between sections

Right now sections sit on flat backgrounds with hard `border-y` edges. We'll make the page feel like one continuous cinematic gradient:

- Introduce a set of subtle per-section background tints (deep ink → indigo-tinted → teal-tinted → back to ink) using the existing oklch token system.
- Add a reusable `SectionTransition` divider (soft vertical gradient fade) placed between sections so each one bleeds into the next with no visible seam.
- Add gentle glow "orbs"/aurora accents that span section boundaries, reinforcing continuity.

```text
Hero (deep ink + glow)
  ⤷ fade →
Services (indigo tint)
  ⤷ fade →
Audience (teal tint)
  ⤷ fade →
Process (ink)
  ⤷ fade →
AISpotlight (deep indigo band)
  ⤷ fade →
Portfolio (ink + image cards)
  ⤷ fade →
Consultation (teal tint)
  ⤷ fade →
Trust (ink)
  ⤷ fade →
FinalCTA (full gradient finale)
```

## 3. Imagery in each section

Generate a cohesive set of dark, cinematic, on-brand images (indigo/teal lighting, abstract + workspace themes) and wire them in:

- **Hero** — a subtle background image layer behind the WebGL/gradient for extra depth.
- **ServicesIntro** — a small thematic image per service card (digital products / websites / AI).
- **AudienceSection** — one image per column (individuals / businesses).
- **PortfolioPreview** — replace the gradient placeholders with real project-style images (4 images), keeping the glass label + hover bloom.
- **AISpotlight** — an abstract "automation/flow" visual beside the copy.
- **ConsultationSection** — a warm workspace/meeting image near the booking card.

All images generated to `src/assets/` and imported as ES6 modules, with descriptive `alt` text for SEO/accessibility.

## 4. Refined figures & 10x craft per section

For each section, sharper visual detail:

- **Hero** — larger, layered headline; refined floating workflow card with depth shadows and the new image backdrop.
- **ServicesIntro** — image-topped glass cards, hover tilt + glow border, numbered accents.
- **AudienceSection** — richer two-column split with imagery, animated divider between columns, check-list polish.
- **ProcessSteps** — upgraded illuminated timeline: glowing numbered nodes, animated draw-on-scroll connector, subtle figure accents.
- **AISpotlight** — animated "beam" figure connecting the use-case cards, paired with the abstract image.
- **PortfolioPreview** — real images, parallax + bloom on hover, refined type.
- **ConsultationSection** — polished session cards, glowing book CTA, image-backed panel.
- **TrustSection** — animated count-up / fade-up trust points, refined testimonial placeholder.
- **FinalCTA** — bigger gradient finale with stronger glow and magnetic CTA.

Motion stays at the current high-intensity level with `prefers-reduced-motion` fallbacks intact.

## Technical notes

- **Files edited:** `src/routes/__root.tsx` (font link), `src/styles.css` (font tokens, section tint utilities, transition gradients, heading tuning), all nine `src/components/home/*` sections, and a new `src/components/cinematic/SectionTransition.tsx`.
- **Assets:** new images under `src/assets/` generated via the image tool, imported directly (no layout shift; sized/`loading="lazy"` where below the fold).
- **Scope:** homepage (`/`) only, consistent with the current cinematic redesign. No backend/data changes.
- **SEO/a11y:** single H1 preserved, alt text on all images, lazy loading, existing metadata untouched.

## Out of scope

Other routes (services, websites, AI, consultancy, portfolio, contact, auth, dashboard) and any backend work — homepage only. The new font tokens and transition primitives are built so the same treatment can extend site-wide later if you want.
