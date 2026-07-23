## Goal
Replace the `AutomationCore` SVG diagram in the hero's right column with the Componentry **AsciiEffect** component, rendering a business-relevant image as animated ASCII art in the Vortex Hub purple palette.

## What to build

### 1. Add the component
Create `src/components/ui/ascii-effect.tsx` with the full source from the Componentry snippet. Fixes required while transcribing:
- Restore the JSX return (the pasted snippet has empty `return ( ... )` blocks). Render a wrapping `div` with `ref={containerRef}`, `className`, `onPointerMove={trackPointer}`, `onPointerLeave={resetPointer}`, and a child `<canvas ref={canvasRef} aria-label={alt} role="img" />`.
- Restore preset returns: `AsciiImage` → `<AsciiEffect variant="image" {...props} />`, `AsciiFlow` → `variant="flow"`, `AsciiGlitch` → `variant="glitch"`.
- Add typed refs (`useRef<HTMLDivElement>(null)`, `useRef<HTMLCanvasElement>(null)`) so strict TS builds pass.

### 2. Generate the source image
Business-relevant subject that reads well as ASCII (high contrast, clear silhouette on dark bg): a stylized **vortex/spiral network node** — concentric swirl converging to a bright core with faint orbiting data points. Saved to `src/assets/home/hero-ascii-source.jpg` (1024×1024, dark background, luminous purple/violet subject). This ties the ASCII visual to the Vortex Hub identity and the "automation core" concept it replaces.

### 3. Wire it into the Hero
Edit `src/components/home/Hero.tsx`:
- Remove `import { AutomationCore }` and its usage inside the right-column `motion.div`.
- Import `AsciiEffect` and the new image.
- Replace `<AutomationCore />` with a framed panel:

```tsx
<div className="relative aspect-square w-full overflow-hidden rounded-3xl border border-border glass-panel glow-soft">
  <AsciiEffect
    variant="flow"
    imageSrc={heroAscii}
    fontSize={10}
    scale={1.1}
    colors={["#2B0E4A", "#9D4EDD", "#C77DFF", "#F5E9FF"]}
    backgroundColor="#0F0620"
    flowSpeed={0.18}
    flowStrength={10}
    mouseRadius={180}
    mouseStrength={26}
  />
  <div aria-hidden className="pointer-events-none absolute inset-0 rounded-3xl ring-1 ring-inset ring-white/5" />
</div>
```

- Keep the existing `motion.div` entrance animation and `useReducedMotion` behavior (AsciiEffect internally respects `prefers-reduced-motion` and falls back to a static render).

### 4. Cleanup
Leave `AutomationCore.tsx` on disk (still exported, no other importers) — safe to delete once we confirm nothing else references it. The plan will remove it after a project-wide search confirms zero usages.

## Technical notes
- No new dependencies; component uses only React + Canvas 2D.
- Purple gradient (`colors`) drives the character color so the visual matches the site palette without changing tokens.
- `variant="flow"` gives a subtle continuous motion + magnetic cursor interaction, matching the hero's "Motion: 5 / interactive cursor" spec.
- Image asset generated at build time — no runtime fetch, works with SSR/edge Worker.

## Files touched
- **create** `src/components/ui/ascii-effect.tsx`
- **create** `src/assets/home/hero-ascii-source.jpg` (generated)
- **edit** `src/components/home/Hero.tsx`
- **delete** `src/components/home/AutomationCore.tsx` (after usage check)
