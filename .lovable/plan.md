# Match the hero design 1:1

Recreate the homepage hero exactly as in the reference: a two-line stacked logo, refined nav/CTA, a glowing "planet" partner badge, the full headline/CTAs/trust line, a detailed glassy **FLUX DE LUCRU** workflow card on the right, and a glowing network-globe background behind it.

```text
┌───────────────────────────────────────────────────────────────┐
│ [V] Vortex/Hub   Servicii  Automatizare AI ...   [EN|RO] Autent. [Începe →] │
├───────────────────────────────────────────────────────────────┤
│ ( ◍ ) PARTENERUL TĂU DIGITAL                  ╭───── FLUX DE LUCRU ─ ●Proiect──╮ │
│       Strategie • Design • Automatizare       │ Strategie, design și automatizare│ │
│                                               │ Un proces clar, rezultate...     │ │
│ Muncă digitală,                               │ ①Descoperire ②Design ③Automatiz. │ │
│ construită în jurul                           │ ┌Colaborare┐┌Impact +68%┐┌Încredere┐│ │
│ oamenilor reali.   (gradient)                 │ └ avatars  ┘└  chart ↗  ┘└ quote★★┘│ │
│ paragraph...                                  │ Livrabile: Strategie · UI/UX · AI │ │
│ [🚀 Începe un proiect →] [📅 Programează...]   ╰──────────────────────────────────╯ │
│ 👥 Comunicare clară. Livrare sigură...          (glowing network globe behind)     │
└───────────────────────────────────────────────────────────────┘
```

## Files to change

**`src/components/layout/nav-data.tsx`** — `Wordmark`
- Stacked two-line wordmark: gradient rounded "V" tile + "Vortex" / "Hub" on two lines (font-sans, tight leading), matching the reference logo.

**`src/components/layout/LanguageToggle.tsx`**
- Active language pill uses the indigo/primary fill (gradient-brand) instead of `bg-foreground`, matching the highlighted **RO** chip.

**`src/components/layout/SiteHeader.tsx`**
- Header CTA "Începe un proiect" becomes a gradient button (`bg-gradient-brand`, `glow-soft`) with a trailing `ArrowRight`.
- "Autentificare/Login" stays a plain text link (ghost) to the left of the CTA.

**`src/components/home/Hero.tsx`** (main work)
- **Badge**: replace the `Sparkles` pill with a larger rounded glass pill containing a glowing planet glyph (inline saturn-with-ring SVG, indigo→teal gradient + soft glow) and two text lines: eyebrow `PARTENERUL TĂU DIGITAL` (primary, uppercase, tracked) and `Strategie • Design • Automatizare` (foreground, semibold).
- **Headline / paragraph**: unchanged copy; keep gradient on "oamenilor reali.".
- **CTAs**: primary "Începe un proiect" gets a `Rocket` leading icon + `ArrowRight` trailing; secondary "Programează o consultanță" gets a leading `CalendarCheck` icon (outline glass style). Keep `Magnetic` wrappers.
- **Trust line**: prefix with a `Users` icon, text unchanged.
- Replace `FloatingWorkflow` with the new `WorkflowShowcase` card (below).

**`src/components/home/WorkflowShowcase.tsx`** (new) — the right-side card
- Glass card (`glass-panel`, rounded-2xl, border, `glow-soft`) with an outer gradient glow + `animate-float-slow`.
- **Header row**: eyebrow `FLUX DE LUCRU` + a pill badge "Proiect în desfășurare" with a pulsing teal dot.
- **Title block**: `Strategie, design și automatizare` + muted subtitle `Un proces clar, rezultate măsurabile.`.
- **Workflow timeline**: 3 nodes (`01 Descoperire`, `02 Design & Build`, `03 Automatizare`), each a gradient icon circle (lucide `Search`, `PenTool`, `Workflow`) on a connecting line ending in an arrow; each with a short caption.
- **Three sub-cards** (inner bordered tiles):
  - `COLABORARE LIVE` — overlapping avatar stack + "+3", text "Echipă dedicată în timp real. Transparență totală.", "● Online" (teal dot).
  - `IMPACT` — big `+68%`, an inline SVG upward line chart with gradient area fill, caption "Eficiență operațională pentru clienții noștri".
  - `ÎNCREDERE` — quote glyph, testimonial "Vortex Hub ne-a oferit claritate, viteză și rezultate peste așteptări.", "— Andreea P, CEO", 5 filled stars.
- **Livrabile row**: 3 inline items with icons (`Target` Strategie digitală, `PenTool` Design UI/UX, `Share2` Automatizări AI), separated by dividers.
- All copy via `t(en, ro)`; tokens only (primary/teal/muted/border), no hardcoded colors.

**`src/components/cinematic/HeroCanvas.tsx`** — background
- Adjust the existing WebGL scene toward the reference: a **wireframe network globe** (icosahedron/sphere wireframe with node points) as the core on the right, wrapped by 2–3 bright orbital arc rings (violet/blue/cyan, additive) and a soft particle field, with calm continuous auto-rotation. Keep it lazy-loaded, reduced-motion-safe, and SSR-safe via the existing `HeroBackground` wrapper.

## Assets
- **Avatars**: generate 4 small on-brand portrait avatars (or reuse simple gradient avatar circles if generation is skipped) for the COLABORARE LIVE stack. Default: 4 generated square avatars imported into `src/assets/home/`.
- No new fonts; no design-token changes beyond the toggle active color.

## Notes / constraints
- Only the homepage hero, header wordmark/toggle/CTA, and hero background are touched. Other sections stay as-is.
- Bilingual: every new string added to both `t(en, ro)` calls.
- WebGL stays in `@react-three/fiber` + `three` (already installed); no new deps except optional avatar images.

## Result
The homepage hero visually matches the reference: refined header, glowing planet badge, the detailed FLUX DE LUCRU workflow card with timeline, live-collab/impact/trust tiles and deliverables, all over a glowing network-globe backdrop.