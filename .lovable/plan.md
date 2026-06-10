# Plan: Detailed animated icons for the "Why Vortex Hub" cards

## Goal
Upgrade the four trust cards (`Propuneri clare`, `Comunicare privată`, `Livrare sigură`, `Verificare umană`) from simple flat Lucide glyphs to richer, multi-layered SVG icons with continuous, subtle looping motion — fully on-brand (indigo `--primary` → teal `--teal`), no flat color hardcoding, no new dependencies.

## Approach
Build four bespoke SVG icon components rendered inline (so they can be themed with CSS tokens and animated with CSS keyframes). Each icon is composed of several layers — a soft glowing aura, a rounded gradient tile/backing, the main glyph, and 1–2 accent details — that animate independently in a slow, ambient loop. Pure CSS/SVG, GPU-friendly transforms only.

```text
each icon
 ├─ aura        slow pulse (scale + opacity)  ~4s loop
 ├─ tile/back   gentle drift / breathing      ~6s loop
 ├─ main glyph  subtle float + draw shimmer    ~5s loop
 └─ accent dot/ring  orbit or twinkle          ~3s loop
```

## What gets built

1. **New animated-icon set** — `src/components/cinematic/TrustIcons.tsx`
   - One small React component per concept, each a self-contained inline `<svg>` with layered `<g>` groups:
     - `ProposalIcon` — document with an animated check stroke + floating accent lines.
     - `PrivacyIcon` — shield/lock with a pulsing keyhole and orbiting privacy dot.
     - `DeliveryIcon` — shield + file with an upward "delivery" shimmer and traveling spark.
     - `ReviewIcon` — person + check with a sweeping verification ring.
   - All strokes/fills use `currentColor` and gradient `<defs>` referencing brand tokens, so the existing `text-teal` wrapper continues to drive color.
   - Gradients defined inline via SVG `linearGradient` using the indigo→teal brand pair.

2. **Animation keyframes** — added to `src/styles.css` (utility classes, e.g. `trust-aura-pulse`, `trust-float`, `trust-orbit`, `trust-shimmer`, `trust-draw`)
   - Each is an `infinite` loop with eased timing and small offsets so the four cards feel alive but not distracting.
   - Wrapped in `@media (prefers-reduced-motion: reduce)` to disable looping for users who opt out (accessibility).

3. **Wire into the section** — `src/components/home/TrustSection.tsx`
   - Replace the `points[].icon` Lucide references with the new components.
   - Keep the existing `GlowCard` + `Reveal` layout and the circular `bg-teal/20 text-teal glow-teal` icon tile; the new SVG sits inside it at the same `h-12 w-12` footprint so layout is unchanged.
   - No changes to copy, grid, or the testimonial block.

## Scope / constraints
- Frontend/presentation only — no data, routing, or backend changes.
- No new npm packages (hand-authored SVG + CSS keyframes only).
- Reuse existing design tokens (`--primary`, `--teal`, `--gradient-brand`); no hardcoded hex/`text-white` etc.
- Motion is always-looping (per selection), kept subtle, and respects reduced-motion.
- Only the four icons in `TrustSection` change; the rest of the page is untouched.

## Technical notes
- Icons render at a fixed `viewBox="0 0 48 48"` and scale to the tile via `className="h-5 w-5"`/container, matching the current sizing.
- Animations rely only on `transform` and `opacity` for smooth compositing; `transform-box: fill-box` + `transform-origin: center` set on animated `<g>` elements so SVG transforms pivot correctly.
- Stagger via per-icon `animation-delay` to avoid synchronized "blinking" across cards.
