## Goal
Sharper, denser, interactive ASCII background across the hero — no WebGL globe competing with it — plus a more visible, punchier booking card.

## 1. Remove the WebGL globe

`src/components/cinematic/HeroBackground.tsx`:
- Drop the `HeroCanvas` lazy import, the `CanvasBoundary` error wrapper, the `ready` state, and the `useEffect` that gates it.
- Keep only two layers: the `bg-aurora` gradient base and the ASCII layer (promoted to hero visual).
- Also delete the now-unused `src/components/cinematic/HeroCanvas.tsx` file (no other importers — verified via search).

## 2. Higher-fidelity ASCII

Same file, upgraded settings so the ASCII reads as a crafted image, not a pattern:

- `fontSize={7}` (was 12) — roughly 3× more characters, denser pixel-grid feel.
- `lineHeight={1}` and `characterSpacing={0.55}` — tighter cell so glyphs read as pixels, not letters.
- `fontWeight={600}` — heavier strokes stay legible at 7px.
- `contrast={1.35}`, `brightnessBoost={2.6}`, `posterize={5}` — crisper tonal separation.
- Richer ramp: `chars=" .·:-=+*#%@█"` (space → full block) for a wider luminance range.
- `dither="floyd-steinberg"`, `ditherStrength={0.35}` — hides banding in the vortex gradient.
- Opacity raised to `~0.55` (was 0.18) since the globe is gone; keep `mask-radial-fade` so copy stays legible on the left half.
- Drop `mix-blend-screen` — with higher opacity it washes out; use straight alpha.

## 3. Make the ASCII interactive again

- `mouseRadius={220}`, `mouseStrength={38}`, `mouseWaveSpeed={1.2}` on the background instance.
- Remove `pointer-events-none` from the ASCII wrapper so the canvas receives pointer events; keep it on the mask overlay only.
- Wrap the hero copy column in `pointer-events-auto` inside a container marked `pointer-events-none` — so the ASCII layer catches cursor movement anywhere the copy isn't, but buttons/links stay clickable. (Concretely: outer hero grid keeps default; only the ASCII wrapper gets pointer events, and the copy column stays above it via `z-10`.)

## 4. More visible booking card

`src/components/home/ConsultationCard.tsx`:

- Solid backdrop instead of translucent glass: replace `glass-panel` with `bg-[oklch(0.12_0.06_300/0.88)]` + `backdrop-blur-xl` so text is always crisp over the ASCII.
- Thicker gradient border via a wrapper: `p-[1.5px] rounded-3xl bg-gradient-brand` around the inner card (double-border trick, gives the card a lit edge).
- Stronger outer glow: swap `glow-soft` for a new `glow-strong` utility in `src/styles.css`:
  ```css
  .glow-strong {
    box-shadow:
      0 0 0 1px oklch(1 0 0 / 10%),
      0 0 60px -10px oklch(0.66 0.22 305 / 45%),
      0 40px 90px -30px oklch(0.30 0.20 300 / 70%);
  }
  ```
- Slightly larger typography (h3 → `text-2xl sm:text-3xl` already, bump to `sm:text-[2rem]`) and increase day-chip contrast: active state uses `bg-primary/25` + `text-primary-foreground`.
- Add a floating "FREE" ribbon in the top-right corner (small rotated gradient badge) — draws the eye immediately.
- Bump CTA size to `h-12` and add `shadow-[0_10px_30px_-8px_var(--primary)]` for lift.

## 5. Keep Hero.tsx wiring

Only tweak: give the copy column `relative z-10` so it sits above the interactive ASCII layer; the right-column `motion.div` already floats above via the grid.

## Files touched
- **edit** `src/components/cinematic/HeroBackground.tsx` — remove globe, upgrade ASCII, interactivity
- **delete** `src/components/cinematic/HeroCanvas.tsx`
- **edit** `src/styles.css` — add `.glow-strong` utility
- **edit** `src/components/home/ConsultationCard.tsx` — solid bg, gradient border, glow, FREE ribbon, bigger CTA
- **edit** `src/components/home/Hero.tsx` — `z-10` on copy column
