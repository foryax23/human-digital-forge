# React Bits-style blocks for the homepage

Bring the React Bits look and feel (dynamic backgrounds, animated text, interactive cards, scroll animations) into the Vortex Hub homepage, rebuilt on the libraries this project already uses so nothing new needs installing and the page stays fast.

Scope: homepage only. Motion intensity: high (8/10), with a calm fallback for people who prefer reduced motion.

## What you will see

**Dynamic backgrounds** — a small set of reusable animated backdrops, each usable behind any section:
- Aurora: flowing indigo/periwinkle light bands behind the hero.
- Silk / Waves: soft moving fabric-like gradient for the AI and consultation bands.
- Threads: thin drifting light lines behind the process section.
- Particles: slow floating dust behind the trust and final CTA bands.
- Squares grid: subtle animated grid behind pricing.

**Animated text**
- Hero headline reveals character by character with a blur-to-focus rise.
- A shiny sweep on the gradient accent line and key labels.
- Section headings reveal on scroll; the intensity is uniform across sections.
- Animated counters in the proof row (years, projects, response time).

**Interactive cards and blocks**
- Spotlight cards: a light follows the cursor across service, audience and trust cards.
- Tilted cards: portfolio tiles tilt in 3D toward the cursor with a glare highlight.
- Magnetic buttons and elastic hover on CTAs (extends the existing magnetic effect).
- Bento-style animated tiles for the services block.

**Scroll and list animations**
- Scroll-stacked panels for the process steps (each step pins and stacks as you scroll).
- Staggered animated list reveals for feature and pricing lists.
- A looping logo/keyword marquee re-introduced as a thin band under the hero.

## Technical notes

- Backgrounds are built as self-contained components in `src/components/backgrounds/` (`AuroraBackground`, `SilkBackground`, `ThreadsBackground`, `ParticlesBackground`, `SquaresBackground`), each accepting `className` and colour props driven by existing design tokens. React Bits uses `ogl`; these are ported to the already-installed stack instead: `@react-three/fiber` + `three` with a custom shader for Aurora/Silk, and plain 2D canvas for Threads/Particles/Squares. No new dependencies.
- All canvas backgrounds are client-only and lazy-loaded (`lazy()` behind a hydration/`prefers-reduced-motion` gate), wrapped in an error boundary, capped at `dpr<=1.5`, and paused via `IntersectionObserver` when off-screen — the pattern already used by `VortexStage`.
- Text and card effects use `motion/react` (no GSAP): `SplitText`, `ShinyText`, `GradientText`, `CountUp` in `src/components/cinematic/`, plus `SpotlightCard`, `TiltedCard`, `AnimatedList`, `ScrollStack`.
- Reuse and extend the existing `Reveal`, `Magnetic`, `GlowCard`, `SectionTransition` primitives rather than duplicating them; `GlowCard` gains the spotlight behaviour.
- Colours come only from the `.cinematic` scoped tokens in `src/styles.css`; new keyframes/utilities are added there (`@utility`, Tailwind v4 form).
- Every effect respects `prefers-reduced-motion`: static gradients replace canvases, text renders immediately.
- Sections touched: `HeroStage`, `HeroProofRow`, `ServicesIntro`, `AudienceSection`, `ProcessSteps`, `AISpotlight`, `PortfolioPreview`, `PricingSection`, `TrustSection`, `FinalCTA`, `src/routes/index.tsx`. The hero product mockup and all copy, pricing and links stay as they are.
- Verification: typecheck, then a browser pass at desktop and mobile widths checking for console errors and confirming each background renders and pauses off-screen.

## Build order

1. Background components + reduced-motion/lazy infrastructure.
2. Text primitives (split, shiny, gradient, counters) wired into hero and section headings.
3. Card primitives (spotlight, tilted, elastic) applied to services, audience, portfolio, trust.
4. Scroll blocks (scroll stack for process, animated lists for pricing/features, marquee band).
5. Full-page pass for rhythm, spacing and performance.
