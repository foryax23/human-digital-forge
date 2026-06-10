# Rework the hero 3D scene into a refined digital ecosystem

Replace the current abstract WebGL scene (random particle cloud + wireframe torus knot) with a structured, professional composition: a glowing central core on the right, surrounded by smooth neon orbit rings in violet, blue and cyan, with small service nodes (Strategy / Design / Automation) slowly orbiting the core. The core pulses softly, rings rotate at different speeds, and fine particles drift in the background. Motion is calm, continuous and seamless — no cursor reactivity.

## What changes

Only the hero background scene is touched. The headline, copy, buttons and the floating workflow card stay exactly as they are.

```text
        ┌──────────────────────────────────────────────┐
        │  Headline + CTAs        ◯ ← orbit ring (violet)│
        │  (unchanged)         ◯  ●  ◯  ← rings (blue/cyan)│
        │                         ╲ ◉ ╱  ← glowing core   │
        │                       node·  ·node (orbiting)    │
        │                    · · drifting particles · ·    │
        └──────────────────────────────────────────────┘
```

## Files

**`src/components/cinematic/HeroCanvas.tsx`** (full rewrite of the scene)
- **Core**: a layered glowing sphere positioned to the right (`position ≈ [3, 0.4, -1]`, matching the current knot placement so it sits behind the hero card). Built from an inner emissive sphere + an additive-blended glow halo sprite/shell. Soft pulse via scale + emissive intensity oscillating on `Math.sin(clock.elapsedTime * ~0.6)`.
- **Orbit rings**: three rings using `ringGeometry` (thin, large-radius) or `torusGeometry` with small tube radius, each tilted on different axes and rotating at different speeds (e.g. 0.05 / 0.08 / 0.12 rad/frame-scaled). Colors map to brand tokens: violet `#4f46e5` (primary/indigo), blue `#7c75ff`, cyan/teal `#3b9eae`. `transparent`, additive blending, low opacity for neon glow.
- **Service nodes**: a few small emissive spheres parented to invisible pivot groups that rotate around the core, so they travel along the ring paths at different radii/speeds. Each leaves a subtle light-trail feel via a faint additive sprite. (Conceptually Strategy / Design / Automation — visual only, no labels in 3D.)
- **Background particles**: keep a reduced, slow-drifting point field (lower count than today, ~1200) for depth, drifting gently rather than the current fast rotation.
- **Lighting/colors**: keep ambient + two colored point lights (indigo + teal) for depth. All colors use the existing brand hexes already in this file so it matches the design system.
- **Motion**: continuous auto-rotation only. Remove the `state.pointer`/cursor-parallax lerp logic so it is calm and seamless.

**`src/components/cinematic/HeroBackground.tsx`** (unchanged logic)
- No structural change. It already lazy-loads `HeroCanvas`, gates on `prefers-reduced-motion`, keeps the static `bg-aurora` gradient fallback, and wraps in an error boundary. The new scene benefits from all of this automatically.

## Notes / constraints
- Stays WebGL via `@react-three/fiber` + `three` (already installed and used).
- Respects `prefers-reduced-motion` (handled by `HeroBackground` — reduced-motion users see the static gradient, scene never mounts).
- SSR-safe: scene remains client-only and lazy-loaded, so build prerender renders only the gradient fallback.
- No new dependencies, no design-token or color changes elsewhere, no copy changes.

## Result
The right side of the hero reads as a structured, glowing digital ecosystem — a pulsing core with neon orbit rings and slowly circling service nodes over a soft particle field — calm, premium and on-brand, replacing the generic abstract knot.
