
# Cinematic v2 — Vortex Black Hole Hero + Full Homepage Asset Overhaul

Goal: replace the current WebGL globe hero with a looping, cinema-grade **vortex / black hole** background video, then re-audit and upgrade every homepage section's imagery, iconography, and micro-motion so the whole page reads as one premium product — matching the Vortex Hub purple identity.

---

## 1. Hero — looping vortex black-hole video

**Generate a 10s seamless-loop 1080p MP4** with `videogen--generate_video`:
- Prompt: ultra-detailed swirling accretion disk / event horizon, deep purple and magenta light bending inward, volumetric dust, slow inward spiral, camera locked, seamless loop, cinematic, 4k.
- 16:9, 1080p, `camera_fixed: true`, duration 10s.
- Stored as CDN asset: `src/assets/home/vortex-hero.mp4.asset.json`.
- Also generate a matching **poster frame** (`vortex-hero-poster.jpg`) as SSR / low-bandwidth fallback.

**New component `src/components/cinematic/VortexVideoBackground.tsx`:**
- `<video>` with `autoPlay muted loop playsInline preload="metadata" poster={...}`.
- Absolute, `object-cover`, blurred vignette + purple color-grade overlay (`mix-blend-color`, `backdrop-` free — CSS filter only).
- Respects `prefers-reduced-motion` → falls back to poster + subtle CSS animated gradient.
- Client-only mount (same pattern as `HeroBackground`) so SSR ships the poster.

**Retire `HeroCanvas` / `HeroBackground`** from the hero (kept in repo, unimported) — the video replaces the WebGL globe. `AutomationCore` on the right side stays, recolored so it reads over the darker video.

Darkening: add a `bg-[radial-gradient(...)]` scrim + bottom-to-background fade so text stays AAA-legible.

---

## 2. Full asset re-audit

Inventory every image currently under `src/assets/home/` and `src/assets/brand/`, score each on brand fit (purple palette, Exo 2 era, cinematic tone). Then:

- **Regenerate** any image that reads as generic-stock, off-palette, or low detail — using `imagegen` at `premium` quality for anything with text/UI, `standard` otherwise.
- **New/refreshed art targets** (dark cinematic, purple/magenta, volumetric light):
  - `hero-bg.jpg` → retired (video replaces it).
  - `services-*.jpg` (3): abstract product/website/AI stills matching the vortex tone.
  - `audience-individual.jpg`, `audience-business.jpg`: portrait-mood editorial.
  - `portfolio-1..3.jpg`: three fake case-study covers in-palette.
  - `ai-spotlight.jpg`: neural-mesh / data-stream close-up.
  - `consultation.jpg`: warm studio scene, purple rim light.
  - `trust-bg.jpg`: dark textured backdrop for TrustSection band.
- Every generated file is uploaded via `lovable-assets create` and referenced by its `.asset.json`. Old orphaned images are deleted with `lovable-assets delete`.

---

## 3. Section-by-section upgrades

All sections keep their current structure and copy; the work is visual polish + motion.

- **ServicesIntro** — swap card images to new set; add subtle parallax on image + Magnetic hover; unify to `GlowCard` variant with purple edge glow.
- **AudienceSection** — new duotone imagery; add scroll-linked `Reveal` and a soft purple gradient wash on hover.
- **ProcessSteps** — replace flat step numerals with animated SVG connectors between steps (dashed line drawing in on scroll, purple gradient stroke).
- **AISpotlight** — new background image + a small looping neural-flow SVG (nodes + traveling packets, reusing the AutomationCore animation vocabulary).
- **PortfolioPreview** — new case-study covers; hover reveal: image scales, title slides up, magenta underline draws.
- **PricingSection** — keep layout, refresh: elevated Growth card gets a subtle animated aurora gradient border (CSS `@property` + `conic-gradient` rotation).
- **ConsultationSection** — new image + a live-availability chip ("Next slot: this week") — purely presentational.
- **TrustSection** — the custom SVG icons stay; add a very subtle vortex loop (reused, low-opacity) as section background instead of the flat card.
- **FinalCTA** — add a vortex-tinted glow behind the CTA button and a magnetic pull effect on hover (reuse `Magnetic`).
- **SectionTransition** — retune tones to `deep-purple` / `magenta` / `violet` (retire the leftover `teal` prop values in `src/routes/index.tsx`).

---

## 4. Typography & micro-details

- Confirm Exo 2 weights 400/500/600/700/800 are loading (already wired in `__root.tsx`) — add `font-feature-settings: "ss01","cv11"` for tighter numerals.
- Tighten heading tracking on hero (`tracking-[-0.02em]`) for cinematic feel.
- Add a subtle `text-shadow` glow to hero H1 so it reads over the video without a heavy scrim.

---

## Technical notes

- Video hosted as a CDN asset (`.asset.json`) — never committed as binary.
- `preload="metadata"` + poster keeps LCP fast; the video only bytes-in after mount.
- Reduced-motion users get the poster image and CSS aurora — no autoplay video.
- No backend changes. No copy changes beyond the tagline retune already in place.
- No new dependencies.

## Files touched

- `src/components/cinematic/VortexVideoBackground.tsx` (new)
- `src/components/home/Hero.tsx` (swap background component, retune scrim + heading)
- `src/routes/index.tsx` (SectionTransition tones)
- `src/components/home/{ServicesIntro,AudienceSection,ProcessSteps,AISpotlight,PortfolioPreview,PricingSection,ConsultationSection,TrustSection,FinalCTA}.tsx` (visual polish only)
- `src/components/cinematic/SectionTransition.tsx` (new tone values)
- `src/styles.css` (aurora border utility, heading shadow, transition tones)
- `src/assets/home/*.asset.json` (regenerated pointers), plus new `vortex-hero.mp4.asset.json` and poster

## Out of scope

- No changes to routes other than `/`.
- No layout/IA changes, no new sections, no backend, no i18n edits.
- WebGL hero code is kept in the repo but unused, so it can be restored later.

## Result

Homepage opens on a slow-drifting purple black-hole, headline glowing over it, the AutomationCore diagram animating on the right; every downstream section then feels like a chapter cut from the same film — new imagery, refined motion, one identity end-to-end.
