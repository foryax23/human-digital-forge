# ASCII vortex hero (plan)

Owner brief (2026-10-03): evolve the hero's looping Vortex video into a live ASCII / terminal /
business-intelligence rendering of the same video, keeping the current centred composition
(eyebrow, "Descoperă potențialul afacerii tale.", body, central search, the four orbit labels,
nav, project proof, scroll cue). Not a redesign; the technology creates the impact.

## Pipeline

existing swirl loop video → hidden `<video>` → small offscreen canvas (sampling) → per-cell
luminance `0.2126 R + 0.7152 G + 0.0722 B` → ramp `"  .·:;+=xX#%@"` (Vortex set
`"  .·:;+*xX#%@"`), cells darker than ~12–20 stay empty → coloured glyphs drawn on a visible
canvas behind the hero content. The video stays the only motion source (no pre-rendered ASCII
video, no static image).

## Rules

- Columns (first target; the shipped grid is finer, see "As shipped"): desktop 110–150, tablet
  80–110, mobile 55–80; DPR capped at 2; 24–30 fps via
  requestAnimationFrame with throttling; no per-frame allocation (reuse canvases, typed arrays, a
  pre-rendered glyph atlas instead of thousands of `fillText` calls); `willReadFrequently` on the
  sampling context; pause when `document.hidden`, when the hero is off-screen, and under the
  page-wide pause switch; reduced motion → one static ASCII frame.
- Colour: keep the video's colour, biased to deep/electric violet, indigo, cold blue, a little
  cyan, white highlights; background stays black; controlled additive glow on bright cells only.
- Depth: density/opacity/weight follow brightness (bright foreground → dense glyphs; dark inner
  vortex → sparse); never random per-character font sizes.
- Technical glyphs (`0 1 / \ [ ] { } < > + -`) only occasionally and state-driven, never binary
  rain.
- Desktop pointer: within ~100–180 px, glyphs shift 1–5 px, brighten slightly, lean cyan. Off on
  touch devices.
- Canvas is `aria-hidden`; real content stays semantic HTML.
- Fallback: no canvas/JS → the original video; autoplay blocked → poster frame. Never empty.

## States (exposed as a prop; the search doesn't know about the renderer)

`idle` (normal) → `focus` (slightly sharper, faint cyan, centre a touch brighter, orbit paths
lit) → `typing` (near-search cells occasionally flip to `0 1 <> {} []`) → `scanning` (submit:
600–1000 ms, rotation perception up, glyphs drawn towards the centre, centre darkens, glow
contracts, search shows its analysis state) → `analysis` (on /scan while the real steps run: denser
data structures in parts of the vortex) → `result` (calm, so the next screens emerge from the
centre).

Honesty: the hero transition is visual only; "ANALIZĂ ÎN CURS" and the stages (01 Identificăm
compania · 02 Analizăm website-ul · 03 Detectăm tehnologiile · 04 Cartografiem prezența digitală
· 05 Căutăm oportunități · 06 Simulăm strategii) are the real checklist on /scan, which keeps the
same ASCII background and ticks each stage only when it really finishes.

## Hero additions (restrained)

- Search: subtle `>` prompt prefix, placeholder "ex. Clinică dentară București sau
  www.clinica-ta.ro", micro line "Caută după numele firmei, CUI sau adresa unui site." /
  "Search by company name, CUI or website address."
- Orbit labels keep their text; each gets a faint orbital line; hover → that sector's glyphs
  organise slightly, the path brightens and a tiny tag appears (e.g. Automatizează → WORKFLOW ·
  AI · CRM · API). No cards.
- Perimeter telemetry at 0.2–0.5 opacity: VORTEX / SYSTEM ONLINE · SCAN · ANALYSE · STRATEGY ·
  AUTOMATE · AI NODE // ACTIVE · BUSINESS INTELLIGENCE · DATA → SIGNAL → STRATEGY, small node
  coordinates. Reduced on mobile. No fake metrics.
- Grid 40–60 px at 0.03–0.08 opacity, radially masked away from the centre; scan-lines at
  0.02–0.05; controlled vignette (light centre, clear middle, dark edges); hero stays `100svh`.

## As shipped (2026-10-03, after the owner's feedback rounds)

- Sampling clip: `public/media/swirl-loop/swirl-ascii-540.mp4`, 540 × 540, H.264, 30 fps, 10 s,
  300 frames (the 5 s master at half speed, every frame kept), faststart, about 750 KB.
- Finer grid, measured on the WebGL2 renderer (cols × rows): 1920 × 1080 → 330 × 94,
  1440 × 900 → 262 × 83, 1280 × 720 → 233 × 67, 768 × 1024 → 154 × 104, 390 × 844 → 87 × 96.
- The orbit labels became one row of four pillars under the search (`hero/HeroPillars.tsx`);
  the two left pillars stir the left quarters of the vortex, the two right ones the right.
- The perimeter telemetry type and the scan-lines were removed (the owner read them as AI
  filler); only the faint grid remains.

## Files

- New: `src/components/landing/ascii/` (`AsciiVortexBackground.tsx`, renderer/engine, glyph
  atlas, palette, states), `src/components/landing/HeroTelemetry.tsx` (+ CSS module for the
  grid), the ASCII sampling source `public/media/swirl-loop/swirl-ascii-540.mp4`.
- Changed: `HeroCosmos.tsx` (ASCII layer, video fallback), `HeroSection.tsx` (state machine and the
  submit transition), `VortexSearch.tsx` (micro line, `onStateChange`), `hero/HeroPillars.tsx`
  (replaced `HeroOrbits.tsx`: pillar row, hover reactions), `/scan` (`scan.tsx` / `ScanShell.tsx` / `AnalyseStep.tsx`: ASCII
  background driven by real scan progress).
