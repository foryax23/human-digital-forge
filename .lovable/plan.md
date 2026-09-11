# Hero section rebuilt from the reference mockup

The full-screen vortex hero is replaced by the two-column layout in the reference: copy on the left, a floating product scene on the right, and a row of five proof points across the bottom.

## Layout

```text
+---------------------------------------------------------------+
| STRATEGY · DESIGN · AUTOMATION ----                           |
|                                        [ browser mockup    ]  |
| Digital products                       [   with site inside]  |
| built for                                 [ card ] [ AI flow ]|
| real people.                                       [ results ]|
|                                                               |
| supporting paragraph (3 lines)                                |
|                                                               |
| [ Start a project -> ]  [ Book a consultation ]               |
+---------------------------------------------------------------+
| (o) Clear timelines | (o) Transparent pricing | (o) Bilingual  |
|     (o) Private client area | (o) AI automation included       |
+---------------------------------------------------------------+
|        TECHNOLOGY WITH MEANING. FOR PEOPLE WITH VISION.       |
+---------------------------------------------------------------+
```

## Left column

- Small spaced label "STRATEGY · DESIGN · AUTOMATION" with dot separators and a short trailing rule.
- Headline in three lines, heavy and tight, last line in the indigo-to-periwinkle gradient. Slightly smaller than the current full-bleed size so it fits half the width.
- Supporting paragraph, then the two existing buttons: gradient primary with arrow, outlined secondary with calendar icon.

## Right column — the floating scene

Built in markup, not an image, so it stays crisp and animated:

- A tilted browser window (traffic lights, faint nav, headline, small button) with a dark landscape image inside it, drawn from the existing home imagery.
- Three glass cards floating in front, offset at different depths: "Modern website" with three checks, "AI automation" as a three-step trigger → process → action chain with a glowing connector, and "Real results" with three checks.
- A large soft indigo orb glow behind the whole cluster plus a faint arc edge, matching the halo in the reference.
- Gentle idle float on the cards at different speeds, small cursor-driven parallax on the group, everything fading in on load.

## Bottom band

- Five proof points in one row: circular outlined icon, bold title, muted sub-line. Thin dividers between them.
- Under it, a centred spaced tagline "Technology with meaning. For people with vision." between two hairlines.
- The current scrolling proof marquee under the hero is removed since these five replace it.

## Technical notes

- `HeroStage.tsx` rewritten as the two-column layout; new `src/components/home/HeroShowcase.tsx` holds the browser mock plus floating cards; new `HeroProofRow.tsx` for the bottom band.
- `VortexStage`/`VortexScene` are no longer used in the hero (kept in the codebase); the hero background becomes the aurora wash plus a positioned indigo orb, so no WebGL cost on first paint.
- `TrustMarquee` dropped from `src/routes/index.tsx`.
- Bilingual `t(en, ro)` strings for every new label; reduced-motion users get the static composition with no float or parallax; on mobile the showcase stacks under the copy and proof points become a two-column grid.
- All colours stay design tokens; no hardcoded hex. Homepage only.
