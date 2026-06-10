# Trust section: icons-only, no boxes

Rework the "Why Vortex Hub" trust section so each item is just a large dynamic animated icon with its label — no GlowCard boxes and no rounded icon tile behind the icon.

## Changes (frontend only)

**`src/components/home/TrustSection.tsx`**
- Remove the `GlowCard` wrapper around each item.
- Remove the rounded square tile (`span` with `bg-teal/15 ... glow-teal`) that frames each icon.
- Render each icon directly at a larger size (e.g. `h-16 w-16` / `h-20 w-20`) so the animated SVGs read as standalone, floating icons.
- Keep the existing 4-column responsive grid (`sm:grid-cols-2 lg:grid-cols-4`), the `Reveal` staggered entrance, the labels, and the bilingual `t()` copy.
- Keep the existing "Client feedback" panel below unchanged.

No changes to the animated icon SVGs themselves (`TrustIcons.tsx`) or the `ti-*` animations in `styles.css` — they already loop continuously. The icons stay dynamic; only the surrounding boxes/tiles are removed.

## Result
Four standalone looping icons sit directly on the section background, each centered above its label, with no card or tile chrome.
