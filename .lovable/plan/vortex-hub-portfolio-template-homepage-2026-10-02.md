# Vortex Hub homepage — portfolio-template rebuild (customised spec)

The dark single-page portfolio template (loader → video hero → bento work → journal → pinned
parallax gallery → stats → video contact footer), rebuilt for **Vortex Hub** on this repo's real
stack, brand and content. Every visible string is bilingual via `t(en, ro)`.

## Decisions

| Template says | Vortex Hub does | Why |
|---|---|---|
| React + Vite SPA, `react-router-dom`, `Index.tsx` | TanStack Start (SSR) route `src/routes/index.tsx`, TanStack `Link` | Existing app; SSR means every `window`/`document`/hls.js/GSAP call runs client-side only |
| Tailwind v3 config + `tailwindcss-animate` | Tailwind v4 tokens in `src/styles.css`; `tw-animate-css` already installed | Existing setup |
| `framer-motion` | `motion` (`motion/react`, same API) | Already installed |
| GSAP + hls.js | **Added** (`gsap` 3.15 with ScrollTrigger + ScrollToPlugin, `hls.js` 1.7, dynamically imported) | Owner's choice; AGENTS.md updated |
| Inter + Instrument Serif italic | **Space Grotesk** (display) + **DM Sans** (body); emphasised words use the brand gradient (`<Em>`) — no serif | Pure Vortex brand |
| Monochrome tokens, steel-blue gradient | `.cinematic` Midnight tokens; accent gradient = `--gradient-brand` (violet `oklch(0.585 0.225 282)` → mint `oklch(0.83 0.13 174)`) | Pure Vortex brand |
| Forced dark `body` | Dark tokens scoped to a `.cinematic` wrapper on the homepage only (also on portalled Sheet/Dialog content) | Dashboard/auth pages keep their own theme |
| Mux stock HLS stream | The Vortex swirl loop, re-encoded as HLS (540p/1080p, 8.8 MB vs 29 MB MP4) at `public/media/vortex-swirl/` | Own footage; adaptive and far lighter |
| 2.7 s loader on every visit | Same loader, once per session; skipped for reduced motion and `/#section` deep links | Don't tax repeat visitors |
| "Michael Smith", Chicago, Resume, Dribbble, socials | Vortex Hub, real routes, legal links; no invented social URLs | Real business |
| Journal posts | The four services as journal-style pills | No blog exists |
| Stats "20+ years / 95+ projects / 200%" | Verifiable facts only: 4 core services, 5-step delivery, 2 languages | No fabricated claims |
| Portfolio / Selected work | Vortex Hub's seven **published** projects (Momentum One, Bridge Gateway ×2, PP Dashboard, Harvard of Sales, OrbisGrid, Metafit) with researched bilingual details and a "sneak peek" popup of each landing page; the same data drives `/portfolio` | Real proof instead of placeholder examples |
| — | Consultation + Pricing (4 plans, Stripe checkout) kept, restyled to the template language | Core business offers |

## Token mapping (Tailwind classes)

| Template | Vortex class |
|---|---|
| `bg-bg` | `bg-background` |
| `bg-surface` | `bg-card` |
| `text-text-primary` | `text-foreground` |
| `text-muted` | `text-muted-foreground` |
| `border-stroke` / `bg-stroke` | `border-border` / `bg-border` (translucent white; use `bg-white/10` where a visible fill is needed) |
| `.accent-gradient` | `.accent-gradient` (static) / `.accent-gradient-animated` (travelling, for rings) |
| `font-display italic` | `font-display font-semibold` + `<Em>` for the emphasised word |

CSS utilities added in `src/styles.css`: `accent-gradient`, `accent-gradient-animated`,
`animate-gradient-shift(-reverse)`, `animate-scroll-down`, `animate-role-fade-in`, `halftone`,
`animate-pulse-dot`, plus `.intro-loader` (hidden unless the head script opts the load in) and
keyframes `scroll-down`, `role-fade-in`, `gradient-shift`, `pulse-dot`, `intro-failsafe`.

## Shared building blocks (`src/components/landing/`)

- `gsap.ts` — `gsap`, `ScrollTrigger` (registered client-side), `useGsap(setup, scopeRef, deps)` (gsap.context + revert), `useIsomorphicLayoutEffect`, `prefersReducedMotion()`.
- `intro.tsx` — `IntroProvider`, `useIntroDone()`, `INTRO_HEAD_SCRIPT`, `HERO_REVEAL_ATTR` (`data-hero-reveal`).
- `HlsVideo.tsx` — decorative HLS background video: lazy hls.js import, attaches near viewport, pauses off-screen, poster-only for reduced motion, native-HLS and MP4 fallbacks.
- `RingButton.tsx` — rounded button with the hover gradient ring (`variant`: solid | outline | pill; `size`: md | sm; `arrow`: up-right | right; `to` | `href` | button).
- `SectionHeader.tsx` — `SectionHeader`, `Eyebrow`, `Em`; whileInView opacity 0→1, y 30→0, 1 s, ease [0.25,0.1,0.25,1], once, margin −100px.
- `smooth-scroll.ts` — `scrollToSection(id)` (GSAP ScrollTo, 96 px nav offset, updates hash), `SECTION_IDS`.
- `media.ts` — `SWIRL_VIDEO` (hls/poster/mp4), `BRAND_ICON_SMALL` (96 px icon), `CONTACT_EMAIL`.

## Page structure (`src/routes/index.tsx`)

```tsx
<div className="cinematic min-h-screen bg-background text-foreground">
  <IntroProvider renderLoader={(p) => <LoadingScreen key="intro-loader" {...p} />}>
    <LandingNav />
    <main>
      <HeroSection />          {/* #top */}
      <WorkSection />          {/* #work */}
      <ServicesSection />      {/* #services */}
      <ProcessSection />       {/* #process */}
      <ExplorationsSection />  {/* #explorations */}
      <StatsSection />         {/* #stats */}
      <ConsultationSection />  {/* #consultation */}
      <PricingSection />       {/* #pricing */}
    </main>
    <ContactFooter />          {/* #contact */}
  </IntroProvider>
</div>
```

The head keeps the existing title/description/OG/JSON-LD and adds `INTRO_HEAD_SCRIPT`.
Section containers: `mx-auto max-w-[1200px] px-6 md:px-10 lg:px-16`.

## 1. Loading screen — `LoadingScreen.tsx`

Props `{ active: boolean; onComplete: () => void }`. Root is a keyed `motion.div` with class
`intro-loader fixed inset-0 z-[9999] bg-background` (no display utility — CSS controls display)
and `exit={{ y: "-100%" }}` over 0.8 s, ease [0.76, 0, 0.24, 1] (the curtain is the page transition).

- Counter: requestAnimationFrame 000 → 100 over 2700 ms, only while `active`; at 100 wait 400 ms, then `onComplete()`.
- Top-left: "Vortex Hub" — `text-xs text-muted-foreground uppercase tracking-[0.3em]`, y −20→0, opacity 0→1.
- Centre: words cycling every 900 ms (only while `active`) — EN Design / Build / Automate, RO Proiectăm / Construim / Automatizăm. `AnimatePresence mode="wait"`, y 20→0→−20. `text-4xl md:text-6xl lg:text-7xl font-display font-semibold tracking-tight text-foreground/80`.
- Bottom-right: `String(count).padStart(3, "0")` — `text-6xl md:text-8xl lg:text-9xl font-display font-semibold tabular-nums`.
- Bottom bar: `h-[3px] bg-border/50`; inner `.accent-gradient` with `scaleX(count/100)` from the left, glow `0 0 8px oklch(0.585 0.225 282 / 0.45)`.
- Words/counter are `aria-hidden`; a visually hidden `role="status"` says "Loading Vortex Hub" / "Se încarcă Vortex Hub".

## 2. Navbar — `LandingNav.tsx`

`fixed top-0 inset-x-0 z-50 flex justify-center pt-4 md:pt-6 px-4`; pill
`inline-flex items-center rounded-full border border-white/10 bg-card/85 backdrop-blur-md px-2 py-2`,
plus `shadow-md shadow-black/10` once `scrollY > 100`.

1. Logo — 36 px circle with `accent-gradient-animated` ring (direction reverses on hover), inner `bg-background` circle holding the 96 px Vortex icon; scales 110 % on hover; scrolls to top.
2. Divider `w-px h-5 bg-border mx-1` (hidden on mobile).
3. Section links (scroll-spy active state, smooth scroll): Home/Acasă `#top`, Work/Lucrări `#work`, Services/Servicii `#services`, Plans/Planuri `#pricing`, Contact `#contact`. `text-xs sm:text-sm rounded-full px-3 sm:px-4 py-1.5 sm:py-2`; active `text-foreground bg-white/10`; inactive `text-muted-foreground hover:text-foreground hover:bg-white/5`.
4. Divider, EN/RO toggle, Login/Dashboard (lg+).
5. "Start a project ↗" / "Începe un proiect ↗" — `RingButton variant="pill" size="sm"` → `/contact`.

Mobile: logo · menu button · CTA. The menu (Sheet, content has `cinematic` class) lists the section
anchors, every page route from `nav-data.tsx`, Login/Dashboard and the language toggle.

## 3. Hero — `HeroSection.tsx` (`#top`)

Full-viewport (`min-h-[100svh]`) section.

- Background: `HlsVideo` with `SWIRL_VIDEO`, covering and centred; darkening overlay + vignette tuned so the copy stays readable over the bright swirl; bottom fade `h-48 bg-gradient-to-t from-background to-transparent`.
- Eyebrow (blur-in): "Digital studio · Est. 2026" / "Studio digital · Fondat în 2026".
- H1 (name-reveal): "Vortex <Em>Hub</Em>" — `text-6xl md:text-8xl lg:text-9xl font-display font-bold leading-[0.9] tracking-tight mb-6`.
- Role line (blur-in): "{role} for people with vision." / "{rol} pentru oameni cu viziune." — roles every 2 s: Websites, AI automation, Digital products, Consultancy / Site-uri web, Automatizare AI, Produse digitale, Consultanță. Role word: `inline-block font-display font-semibold text-gradient-brand animate-role-fade-in`, `key={roleIndex}`. Screen readers get one static sentence instead of the rotation.
- Description (blur-in, `text-sm md:text-base text-muted-foreground max-w-md mb-12`): "Vortex Hub combines strategy, premium web design and practical AI automation into digital solutions that create measurable momentum." / "Vortex Hub combină strategia, designul web premium și automatizarea AI practică în soluții digitale care creează progres măsurabil."
- CTAs: `RingButton solid` "Start a project" → `/contact`; `RingButton outline` "Book a consultation" → `/consultancy`.
- GSAP entrance once `useIntroDone()` is true — timeline ease `power3.out`: `.name-reveal` opacity 0→1, y 50→0, 1.2 s, at 0.1 s; `.blur-in` opacity 0→1, blur(10px)→0, y 20→0, 1 s, stagger 0.1, at 0.3 s. Always `fromTo` (the head script keeps `[data-hero-reveal]` at opacity 0 until then). Reduced motion: set final state, no tween.
- Scroll indicator: "Scroll" / "Derulează" (`text-xs uppercase tracking-[0.2em]`) above a `w-px h-10 bg-border` line with an `animate-scroll-down` highlight; click scrolls to `#work`.

## 4. Selected work — `WorkSection.tsx` (`#work`)

`bg-background py-12 md:py-16`. Header: eyebrow "Selected work" / "Lucrări selectate"; title
"Work designed around an <Em>outcome</Em>." / "Lucrări construite în jurul unui <Em>rezultat</Em>.";
subtext "Example projects across websites, digital products, documents and automation — from first
concept to launch." / "Proiecte exemplu din zona site-urilor, a produselor digitale, a documentelor
și a automatizărilor — de la primul concept la lansare."; action "View all work" / "Vezi toate
lucrările" → `/portfolio` (plus a mobile-only button under the grid).

Bento `grid grid-cols-1 md:grid-cols-12 gap-5 md:gap-6`, spans 7/5/5/7, the four portfolio pieces
(images + bilingual titles/types from `PortfolioPreview.tsx`), each linking to `/portfolio`.
Card: `group bg-card border border-border rounded-3xl overflow-hidden`; image `object-cover
group-hover:scale-105`; halftone overlay `opacity-20 mix-blend-multiply`; persistent small caption
(type · "Example project" / "Proiect exemplu") so touch users see what it is; hover/focus overlay
`bg-background/70 backdrop-blur-lg` with a pill label (animated gradient border, light face):
"View — {title}" / "Vezi — {title}".

### 4b. Published projects + sneak-peek popup (replaces the example pieces)

- Data: `src/components/landing/projects.ts` — one entry per published site (name, url, bilingual
  category/tagline/summary/built/highlights, languages, gated flag, accent colour, image crop) and
  the homepage selection. Captures live in `public/media/work/<slug>/` — `hero.webp` (1280×800 first
  screen), `full.webp` (whole landing page, 960 px wide), `mobile.webp` (phone). Captured headless at
  1440×900 with non-essential cookies declined, the builder badge hidden and visitor geolocation
  masked. Details are written only from what each site shows; no client metrics.
- Homepage bento: the featured projects in alternating 7/5 · 5/7 spans; the card opens the popup
  (it no longer navigates). Hover label "Peek — {name}" / "Privește — {name}".
- `ProjectPreview` popup (Radix Dialog, always dark): a browser-window frame (traffic lights, domain
  pill, live dot) whose viewport auto-scrolls slowly through `full.webp` and hands over to the
  visitor's own scroll/drag on interaction, with a Desktop/Mobile toggle (phone frame with
  `mobile.webp`); beside it the category, name, tagline, summary, "What we built" bullets,
  highlight chips, languages, a members-only note for gated products, "Visit live site ↗" (new tab)
  and previous/next project (buttons and ←/→). Esc closes; focus returns to the card.
- `/portfolio`: all seven projects as cards (semantic tokens, so they work on the light theme) that
  open the same popup.

## 5. Services (journal layout) — `ServicesSection.tsx` (`#services`)

`bg-background py-16 md:py-24`. Header: eyebrow "What we do" / "Ce facem"; title "Four ways to
move <Em>forward</Em>." / "Patru moduri de a merge <Em>înainte</Em>."; subtext "Pick the service
that fits — or combine them into one system." / "Alege serviciul potrivit — sau combină-le într-un
singur sistem."; action "All services" / "Toate serviciile" → `/services`.

Four pills (`flex items-center gap-6 p-4 bg-card/30 hover:bg-card border border-border
rounded-[40px] sm:rounded-full`), each a link: Websites → `/websites` (service-websites.jpg),
Digital products → `/digital-products` (service-products.jpg), AI automation → `/ai-automation`
(service-ai.jpg), Consultancy → `/consultancy` (consultation.jpg). Round thumbnail, title, one-line
description (copy from the existing service pages), a tag line in the template's "read time" slot,
the index `01`–`04` in the "date" slot, and an arrow.

## 5b. How it works — `ProcessSection.tsx` (`#process`) and the feature panel

`src/components/ui/features-with-panel.tsx` (shadcn-style, adapted from the 21st.dev
"features with panel" block): numbered items on the left (real buttons, `aria-expanded`, the
active one reveals its description), a sticky 4:3 media panel on the right that swaps with a
**blur crossfade** (opacity + scale 1.08→1 + blur 16px→0, 0.7 s), folding into the active item
below `lg`. Optional `autoAdvanceMs` walks the items with an accent-gradient progress line, paused
on hover/focus, off-screen and in hidden tabs, stopped once the visitor picks an item, off for
reduced motion. `tone="brand"` grades photos into the dark palette (dimmed, violet soft-light,
bottom fade).

- Process: the five existing delivery steps (copy from the old `ProcessSteps`), Unsplash
  photography per step, auto-advancing every 6 s, "Start a project" underneath. Placed after
  Services ("what we do" → "how we work") and kept apart from the second use below.
- Consultation: the three session types (descriptions from `/consultancy`) in the same panel,
  replacing the placeholder booking-calendar mock; booking CTAs underneath.

## 6. Explorations — `ExplorationsSection.tsx` (`#explorations`)

`relative min-h-[300vh]`.

- Layer 1 (z-10): `h-screen` centred block pinned with `ScrollTrigger.create({ pin, pinSpacing: false })` across the section. Eyebrow "Explorations" / "Explorări"; title "Ideas in <Em>motion</Em>" / "Idei în <Em>mișcare</Em>"; subtext "A look at the visuals, interfaces and systems we explore — for clients and for ourselves." / "O privire asupra imaginilor, interfețelor și sistemelor pe care le explorăm — pentru clienți și pentru noi."; button "See the portfolio" / "Vezi portofoliul" → `/portfolio`.
- Layer 2 (z-20, absolute): `grid grid-cols-2 gap-12 md:gap-40` inside `max-w-[1400px]`; six cards in two columns moving at different scroll-scrubbed speeds; cards `aspect-square max-w-[320px] rounded-3xl`, slight rotations, open a lightbox (Dialog, `cinematic` class) on click/Enter.
- Images: hero-bg, ai-spotlight, audience-business, audience-individuals, the swirl poster, portfolio-3 — each with an accurate bilingual caption/alt.
- Reduced motion: no pin/parallax, a plain grid.

## 7. Stats — `StatsSection.tsx` (`#stats`)

`bg-background py-16 md:py-24`, three columns, count-up on first view (SSR renders final values):
**4** Core services / Servicii principale — Websites, digital products, AI automation and
consultancy. · **5** Delivery steps / Etape de livrare — From your request to the final delivery. ·
**2** Languages / Limbi — Full support in Romanian and English.

## 8. Consultation + Pricing (existing components, restyled)

Same content, plans, prices, checkout and error handling. Headers become `SectionHeader`
("Not sure what you <Em>need</Em> yet?" / "Încă nu ești sigur de ce ai <Em>nevoie</Em>?";
"Choose your <Em>plan</Em>" / "Alege-ți <Em>planul</Em>"), link CTAs become `RingButton`s, surfaces
`rounded-3xl border-border bg-card`, containers aligned with the other sections.

## 9. Contact / footer — `ContactFooter.tsx` (`#contact`)

`relative overflow-hidden bg-background pt-16 md:pt-20 pb-8 md:pb-12`.

- Background: the same swirl HLS video flipped vertically, heavier overlay.
- GSAP marquee: "TECHNOLOGY WITH MEANING • " / "TEHNOLOGIE CU SENS • " ×10, `xPercent: -50`, 40 s, ease none, repeat −1; paused off-screen; static for reduced motion.
- CTA: eyebrow "Contact"; "Turn the next idea into <Em>momentum</Em>." / "Transformă următoarea idee în <Em>progres</Em>."; "Tell Vortex Hub what you would like to create, improve or automate." / "Spune-i Vortex Hub ce ai vrea să creezi, să îmbunătățești sau să automatizezi."; email `RingButton` → `mailto:hello@vortexhub.ro`; "Start a project" → `/contact`.
- Page links row (Services, Websites, AI Automation, Consultancy, Portfolio, Contact, Login).
- Footer bar: © Vortex Hub · Privacy · Terms · Cookies · Cookie settings | green pulsing dot "Available for new projects" / "Disponibili pentru proiecte noi" · EN/RO toggle.

## Indexing

- `/portfolio` lists every published project as server-rendered HTML with an `ItemList`
  (`CreativeWork`) JSON-LD block.
- `public/robots.txt` (keeps dashboard/auth/API out) and `public/sitemap.xml` (public pages on
  https://vortexhub.dev).

## Quality bar

- No hydration mismatches; no `window`/`document` during render.
- Every GSAP effect inside `useGsap` (reverted on unmount); every ScrollTrigger refreshed after image loads where layout depends on it.
- Reduced motion: no loader, no parallax/pin, no marquee motion, static hero.
- Keyboard: all interactive cards/links focusable with visible focus; lightbox closes on Esc.
- No horizontal scroll at 375 px; text contrast ≥ 4.5:1 over video.
- `npx tsc --noEmit` clean and `vite build` succeeds.
