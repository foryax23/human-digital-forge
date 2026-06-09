# Cinematic Homepage Redesign — Vortex Hub

A full reimagining of the landing page (`/` only) into a dark, premium, "next-gen agency" experience. Same content and messaging, dramatically elevated presentation. Scope is the homepage and the design tokens that power it — other pages keep their current look this round.

## Design direction

- **Mood:** Deep Ink + Indigo — near-black navy base (`#0a0a1a`), layered indigo (`#1e1e5a` / `#4f46e5`), with the existing teal kept as a secondary glow accent.
- **Type:** Keep Instrument Serif for big editorial headlines, Inter for UI/body. Headlines go larger, tighter, more cinematic.
- **Feel:** Dark, glowing, depth-rich. Living gradients, soft bloom, glass panels, generous negative space, confident motion. High motion intensity (level 5) with full `prefers-reduced-motion` fallbacks.

## Effects to include

1. **3D / WebGL hero** — an interactive animated background (floating geometry / particle field reacting subtly to the pointer) behind a strong headline + CTAs.
2. **Scroll-driven animations** — each section reveals, parallaxes, and pins as you scroll; numbers/process steps animate into view.
3. **Animated gradients & glow** — slow-moving aurora gradient backdrops and soft glow halos behind key elements.
4. **Magnetic / interactive cursor** — custom cursor with magnetic pull on buttons and links (auto-disabled on touch devices).

## Section-by-section plan

Reusing the existing copy from each component, redesigned:

```text
Hero            WebGL/particle background, oversized headline, magnetic CTAs,
                floating glass "workflow" cards drifting with parallax
ServicesIntro   3 glass service cards with glow borders + hover tilt, staggered reveal
AudienceSection Split "Individuals / Businesses" with animated divider + parallax
ProcessSteps    Cinematic 5-step timeline that draws/illuminates on scroll
AISpotlight     Dark feature band with animated beam connecting use-case cards
PortfolioPreview Project cards with hover bloom + scroll parallax
ConsultationSection  Glass session cards, glowing "book" CTA
TrustSection    Animated counters / trust points fading up in sequence
FinalCTA        Full-bleed gradient finale with magnetic primary CTA
```

The header/footer get a darker, glassier treatment so the page reads as one cohesive cinematic surface.

## Technical approach

- **Color system:** Add a dark cinematic theme to `src/styles.css` (new oklch tokens for the ink base, indigo layers, glow/teal accents, gradient + shadow tokens). The homepage renders on this dark surface; tokens stay semantic so no hard-coded colors land in components.
- **Animation library:** Add `motion` (Framer Motion) for scroll reveals, parallax (`useScroll`/`useTransform`), and staggered entrances.
- **WebGL hero:** Add `three`, `@react-three/fiber`, and `@react-three/drei`. The 3D canvas is a client-only, lazy-loaded component with a static gradient fallback for SSR/reduced-motion so it never blocks first paint or break the build.
- **Magnetic cursor:** A custom React hook + overlay component (no extra dependency), pointer-driven, disabled when `pointer: coarse` or reduced-motion is set.
- **New components:** A `src/components/home/` rebuild plus small shared primitives (`MagneticButton`, `GlowCard`, `Reveal`, `HeroCanvas`, `AnimatedGradient`, `CustomCursor`). The homepage route (`src/routes/index.tsx`) is rewired to the new sections; SEO `head()` metadata is preserved.
- **Performance & a11y:** WebGL and heavy motion lazy-load and respect `prefers-reduced-motion`; semantic HTML, single H1, alt text, and keyboard focus states are kept intact.

## Out of scope this round

Other routes (services, websites, AI, consultancy, portfolio, contact, auth, dashboard) and any backend/data changes — homepage only, as requested. The new tokens and primitives are built so the same treatment can extend to those pages later.