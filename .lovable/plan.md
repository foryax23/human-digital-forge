## Goal
Move the ASCII vortex to a subtle full-bleed background layer in the hero, and replace the right-column box with a creative, useful **Booking / Consultation card** that drives conversions.

## 1. ASCII as hero background (subtle wash)

In `src/components/cinematic/HeroBackground.tsx`, layer `AsciiEffect` under the existing WebGL globe:

```
[bg-aurora gradient]  ← base
[AsciiEffect flow]    ← new, ~18% opacity, blurred edges via mask
[HeroCanvas WebGL]    ← existing globe (unchanged)
[bottom fade]         ← existing
```

- Import `AsciiEffect` + the existing `heroAsciiAsset` URL.
- Wrap it in an absolutely-positioned div: `opacity-[0.18]`, radial mask `mask-image: radial-gradient(ellipse at center, black 55%, transparent 85%)` (add utility `.mask-radial-fade` in `styles.css`), `pointer-events-none` so it doesn't steal cursor.
- Slower/gentler settings: `flowSpeed={0.08}`, `flowStrength={6}`, `fontSize={12}`, `mouseStrength={0}` (no cursor interaction on bg).
- Respect reduced motion (component already does).

## 2. Remove ASCII from the right column

In `src/components/home/Hero.tsx`:
- Drop `AsciiEffect` import + asset import + the framed panel.
- Replace the `motion.div` contents with the new booking card component.

## 3. New right-column component: `ConsultationCard`

Create `src/components/home/ConsultationCard.tsx`. Bilingual via `useI18n`. Purpose: instantly show value + book a free discovery call.

### Visual structure

```
┌─ glass-panel, purple border, glow-soft, rounded-3xl ─┐
│  ● Available now  ·  30-min free discovery call      │  ← live status pill (pulsing dot)
│                                                       │
│  Talk to a strategist                                 │  ← h3, gradient
│  Free 30-min call · no obligation                     │  ← muted
│                                                       │
│  ┌───────┬───────┬───────┐                           │
│  │ Thu   │ Fri   │ Mon   │   ← next 3 available days │
│  │ 24    │ 25    │ 28    │      (computed client-side)
│  │ 3 slots│ 5 slots│ 4 slots│                        │
│  └───────┴───────┴───────┘                           │
│                                                       │
│  Preferred time                                       │
│  [ 10:00 ] [ 13:30 ] [ 16:00 ]  ← chip selector      │
│                                                       │
│  What we'll cover:                                    │
│  ✓ Your goals & current stack                         │
│  ✓ A concrete roadmap & estimate                      │
│  ✓ Next steps — zero pressure                         │
│                                                       │
│  [  Book my slot  → ]   ← gradient CTA, magnetic     │
│  Trusted by 40+ founders across EU                    │  ← tiny proof line + avatar stack
└───────────────────────────────────────────────────────┘
```

### Behavior

- Day/time chips are purely presentational selectors (local `useState`); clicking **Book my slot** navigates to `/consultancy?day=<iso>&time=<hhmm>` (existing route), where the real booking form lives. No new backend.
- Dates computed live: next 3 weekdays from `new Date()`; slot counts are deterministic pseudo-random per day so they don't flicker on re-render.
- Pulsing green dot on the "Available now" pill.
- Motion: card fades/scales in (existing wrapper animation stays); chips get a subtle `whileHover` scale via CSS; the CTA uses the existing `<Magnetic>` primitive.
- All text bilingual through `t(en, ro)`.

### Why this is useful + creative
- **Useful:** turns the hero from decorative into a direct conversion surface (matches "powerful selling website" goal).
- **Creative:** feels like a mini product (live availability, slot chips) rather than a static image — reinforces the "we build real digital products" positioning.

## 4. Cleanup

- Remove now-unused imports in `Hero.tsx` (`AsciiEffect`, `heroAsciiAsset`).
- Keep `src/components/ui/ascii-effect.tsx` and the source image — both still used by the background.

## Files touched
- **edit** `src/components/cinematic/HeroBackground.tsx` — add ASCII layer
- **edit** `src/styles.css` — add `.mask-radial-fade` utility
- **create** `src/components/home/ConsultationCard.tsx`
- **edit** `src/components/home/Hero.tsx` — swap right column
