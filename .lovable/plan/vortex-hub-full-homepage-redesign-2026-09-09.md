# Vortex Hub — full homepage redesign

The site gets a new visual system (Midnight Indigo, Sora + Manrope, bento layout) and a completely new hero. The circuit diagram is removed — the hero becomes a cinematic 3D vortex built from your own brand swirl.

## 1. The hero, rebuilt

Out: the SVG "automation circuit" card with nodes and traveling dots.

In: a full-bleed cinematic stage.

```text
+-------------------------------------------------------------+
|  [badge] Your digital partner                               |
|                                                             |
|  Digital work, built                    ( deep 3D vortex )   |
|  around real people.                    ( swirl of light  )  |
|                                         ( slow rotation,  )  |
|  [Start a project] [Book a call]        ( parallax to     )  |
|                                         (  cursor         )  |
|  logos / trust strip                                        |
+-------------------------------------------------------------+
```

- A layered vortex: your swirl mark rendered as a rotating 3D disc of light with depth-of-field style blur, orbiting dust, and a bright core that breathes.
- Slow drift that reacts subtly to cursor movement; freezes completely for reduced-motion users.
- Headline scales far larger with tighter leading; one accent gradient word only.
- A quiet trust strip replaces the busy chart/avatar clutter.

## 2. New look and feel across the page

- **Colour**: Midnight Indigo — near-black ink `#0a0a1a`, deep navy surfaces `#141432`, indigo depth `#1e1e5a`, electric indigo accent `#4f46e5`. Cooler, deeper and less purple-washed than today.
- **Type**: Sora for headings (kept), Manrope introduced for body text — better reading rhythm and a real hierarchy instead of one font doing everything.
- **Surfaces**: fewer, larger glass panels with softer borders and one consistent glow rule. Less neon, more depth.

## 3. Section-by-section

- **Services** → bento grid: one large feature tile plus smaller supporting tiles, instead of three equal cards.
- **Audience** (individuals / businesses) → split bento with imagery bleeding to the panel edge.
- **Process** → horizontal numbered rail with a progress line that fills on scroll.
- **AI spotlight** → wide cinematic band, one strong claim, restrained beam animation.
- **Portfolio** → asymmetric bento gallery, hover lifts the tile and reveals the project name.
- **Pricing** → same 4-across row, retuned to the new palette; Growth stays elevated.
- **Why Vortex Hub** → keeps the animated icons, gets real breathing room and tighter labels.
- **Final CTA** → keeps the looping swirl video, darker vignette, one clear action.
- **Transitions** → the coloured seams are replaced by a single continuous gradient flow so the page reads as one scene.

## 4. Technical notes

- Palette tokens rewritten in `src/styles.css` (`oklch` equivalents of the four hex values); Manrope added via `<link>` in `src/routes/__root.tsx` and a `--font-body` token.
- New `src/components/home/VortexStage.tsx` (React Three Fiber, lazy + client-only) reusing the existing `HeroCanvas` infrastructure; `AutomationCore.tsx` deleted and unwired from `Hero.tsx`.
- Vortex built procedurally (instanced particle spiral + additive glow shell) with the swirl PNG as a texture on the core disc — no new dependencies beyond the already-installed three/fiber stack.
- Reuses existing `Reveal`, `Magnetic`, `GlowCard` primitives; all sections stay token-based, no hardcoded colours.
- Bilingual `t(en, ro)` strings preserved throughout; render budget kept low (capped DPR, single post pass, reduced-motion fallback to a static gradient).

## Result

A darker, deeper, more confident site: one cinematic vortex carrying the hero, a bento rhythm through the middle sections, and typography that finally has a hierarchy. The diagram is gone.
