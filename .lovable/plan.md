# Adopt the Vortex Hub visual identity

Roll the uploaded brand board (purple vortex logo, Exo 2 typography, deep-purple palette) into the live site — replacing the current indigo→teal system and the generic "V" wordmark.

## 1. Brand assets

Save the uploaded reference and generate clean production assets from it via `lovable-assets` (no binaries in the repo):
- `vortex-logo-primary.png` — full "VORTEX HUB" wordmark on transparent background (used in header + footer).
- `vortex-logo-mark.png` — the swirl "V" mark only (used as favicon/app icon and small contexts).
- `vortex-social-banner.jpg` — the social banner from the board (OG image fallback).

Wire the mark as the favicon in `src/routes/__root.tsx` `head()` and as `og:image` where no page-specific hero exists.

## 2. Typography — single font: Exo 2

- Load **Exo 2** (weights 400/500/600/700/800) via `<link>` in `__root.tsx` head (not `@import`, per Tailwind v4 rules).
- In `src/styles.css` set both `--font-sans` and `--font-serif` to `"Exo 2"` so every heading and body element uses it — one font across the site as requested.
- Keep the existing heading weight/tracking rules.

## 3. Color palette (from the brand board)

Replace the indigo/teal tokens with the purple ramp (`#2B0E4A`, `#6A1B9A`, `#9D4EDD`, `#C77DFF`, `#FFFFFF`), converted to oklch:

- Light theme `--primary` → mid purple `#9D4EDD`.
- Dark theme (`.dark` + `.cinematic`) `--background` → deep `#1a0a2e`-ish surface with `--primary` at `#C77DFF` for glow.
- `--gradient-brand` → `linear-gradient(135deg, #6A1B9A, #C77DFF)`.
- Update `.cinematic-flow`, `.bg-aurora`, `.glow-soft`, `flow-orb-*` to shades of purple (drop the teal accent — brand is mono-purple).
- Update `--ring`, `--sidebar-primary`, chart colors to sit inside the same ramp.

## 4. Wordmark component

Rewrite `src/components/layout/nav-data.tsx` `Wordmark`:
- Replace the "V" gradient tile with the `vortex-logo-primary.png` asset (height ~36px, `img` with proper alt).
- On mobile / small contexts, fall back to `vortex-logo-mark.png`.
- Remove the two-line "Vortex / Hub" text — the logo is the wordmark.

## 5. Hero + accents cleanup

- The Hero `PlanetGlyph` (saturn glyph) becomes a small purple swirl chip using the mark asset, keeping the pulsing glow.
- `HeroCanvas` (3D core) recolor: replace `INDIGO/BLUE/CYAN` constants with three purple stops from the ramp so the WebGL globe matches the brand.
- `AutomationCore` circuit strokes/nodes → purple ramp.
- Language toggle active state, buttons, pricing gradient CTA, and all `bg-gradient-brand`/`text-gradient-brand` usages inherit automatically from the new tokens — no per-component edits needed.

## 6. Tagline (optional, from the board)

Update the hero eyebrow / footer tagline to the brand line: **"Powering Ideas. Spinning Solutions."** with the RO equivalent **"Idei puternice. Soluții în mișcare."** — still routed through `useI18n`.

## Files touched

- `src/routes/__root.tsx` — Exo 2 `<link>`, favicon, default OG image.
- `src/styles.css` — font vars, full purple palette, gradient/glow/aurora recolor.
- `src/components/layout/nav-data.tsx` — logo-image Wordmark.
- `src/components/home/Hero.tsx` — PlanetGlyph swap, tagline.
- `src/components/cinematic/HeroCanvas.tsx` — purple color constants.
- `src/components/home/AutomationCore.tsx` — purple strokes/nodes.
- `src/assets/vortex-logo-*.png.asset.json` (+ social banner) — new asset pointers.

## Out of scope

- No layout/component structure changes, no copy overhaul beyond the tagline, no backend work.
- The teal accent color is retired; every "teal" utility resolves to a lighter purple so nothing breaks visually.

## Result

Every page reads as one brand: Exo 2 typography throughout, purple palette, real Vortex Hub swirl logo in the header/footer/favicon, and the WebGL + circuit visuals recolored to match the identity board.
