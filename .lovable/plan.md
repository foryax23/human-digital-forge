# Homepage rebuild — full-bleed cinematic hero + new UI rhythm

Midnight Indigo stays, Sora + Manrope stay. Everything on the homepage gets rebuilt around a single edge-to-edge motion stage instead of the current two-column hero with the vortex parked on the right.

## 1. The hero, from zero

The current hero (badge, left copy column, vortex square on the right, trust strip) is deleted and replaced.

```text
+-------------------------------------------------------------+
|                                                             |
|                 ( full-bleed motion canvas )                |
|                                                             |
|            DIGITAL WORK, BUILT AROUND REAL PEOPLE           |
|                  one-line supporting sentence               |
|                                                             |
|            [ Start a project ]   [ Book a call ]            |
|                                                             |
|   design-led · private client area · clear timelines        |
|                          v scroll                           |
+-------------------------------------------------------------+
```

- The vortex becomes the whole backdrop: it fills the viewport, sits behind the type, and is masked at the edges so it fades into the page instead of ending in a box.
- Headline is centred and much larger (near-viewport-width type, tight leading), one accent-gradient phrase only, letters rising in sequence on load.
- Depth: three layers move at different speeds with cursor and scroll — dust, vortex, foreground vignette — so the scene feels three-dimensional rather than flat.
- Full-height section with a scroll cue at the bottom; the vortex slowly settles and dims as you scroll away.
- Reduced motion: static swirl frame, no parallax, type simply fades in.

## 2. Section rework

- **Trust strip** moves out of the hero into a slim marquee band directly under it.
- **Services** — one tall feature panel plus two stacked supporting panels; image bleeds to the panel edge, label and arrow reveal on hover.
- **Audience** — individuals vs businesses as two large facing panels with an offset overlap, not a symmetric pair.
- **Process** — numbered rail with a line that fills as it scrolls into view.
- **AI spotlight** — full-width dark band, one claim at display size, restrained light sweep.
- **Portfolio** — asymmetric gallery: one wide tile, then mixed sizes; hover lifts the tile and reveals the project name.
- **Consultation / Pricing / Why Vortex Hub / Final CTA** — kept in place, retuned to the new spacing scale and panel rules (fewer borders, softer glass, one glow rule).
- Section seams stay as soft glow bridges so the page reads as one continuous scene.

## 3. Technical notes

- New `src/components/home/HeroStage.tsx` (full-bleed layout, layered parallax, scroll-linked dim) replacing the current `Hero.tsx` body; `VortexStage.tsx`/`VortexScene.tsx` are refactored to fill their container and accept intensity/parallax props.
- `HeroBackground.tsx` and the old hero background image are dropped from the hero — one canvas only, so the hero gets lighter, not heavier.
- Spacing/type scale tokens added to `src/styles.css` (section rhythm, display clamp, panel radius/border/glow), plus a `hero-mask` utility for the edge fade. No hardcoded colours; all values stay tokens.
- Sections rebuilt on the existing `Reveal`, `Magnetic`, `GlowCard` primitives. Bilingual `t(en, ro)` strings preserved everywhere.
- Performance: capped DPR, single canvas on the page, canvas paused when scrolled out of view, WebGL failure falls back to the static swirl.
- Homepage only — inner pages and dashboard untouched.

## Result

A homepage that opens as one cinematic full-screen scene, then moves through asymmetric panels with real hierarchy instead of rows of equal boxes.
