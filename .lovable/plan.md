# Replace the workflow card with a living automation circuit

Swap the right-side `WorkflowShowcase` card for a dynamic SVG automation diagram: a glowing central core with curved circuit paths reaching out to service nodes, with bright "information" packets traveling along every circuit so the whole scene feels alive.

```text
        ╭ Strategie
   ╭────●──────╮
   │           ╲   ● Design
 ( ◎ CORE ) ====●───────
   │           ╱   ● Automatizare
   ╰────●──────╯
        ╰ Website-uri / AI / Răspuns rapid
   (packets of light travel along each line toward/away from the core)
```

## What changes

**New component `src/components/home/AutomationCore.tsx`**
- A single responsive SVG (viewBox-based, scales to the column) on a glass panel matching the existing card frame (`rounded-3xl`, border, `glow-soft`, soft outer gradient glow).
- **Central core**: layered radial-gradient orb (violet→blue→cyan brand tokens) with a soft pulsing glow and a small lightning/automation glyph in the center.
- **Service nodes** arranged around the core, each a rounded glass chip with a Lucide icon + label: Strategie, Design, Automatizare, Website-uri, AI, plus Răspuns rapid.
- **Circuits**: smooth curved SVG paths from the core to each node, drawn with a faint base line plus an additive glowing stroke.
- **Traveling information**: small bright dots animate along each path (animated `<circle>` packets moving with offset distances / a moving dashed glow), so circuits continuously pulse with data flowing in and out of the core.

**Wire-up in `src/components/home/Hero.tsx`**
- Replace `<WorkflowShowcase />` with `<AutomationCore />` inside the existing animated right-column wrapper (keep the entrance animation).

**Cleanup**
- Delete `src/components/home/WorkflowShowcase.tsx`.
- Delete the now-unused avatar assets: `src/assets/home/avatar-1.jpg` … `avatar-4.jpg`.

## Technical details
- Pure SVG + CSS keyframes / `motion` — no WebGL, SSR-safe, no new dependencies.
- Respects `prefers-reduced-motion`: packets and pulse stop, leaving a static lit diagram.
- All labels bilingual via `t(en, ro)` from `useI18n`.
- Colors strictly from existing design tokens (primary / teal / brand gradients) — no hardcoded hex in components.

## Result
The hero's right side becomes a calm, premium automation diagram: a pulsing core feeding glowing data packets through circuits to the service nodes, replacing the static workflow card while keeping the same on-brand framing.