# Vortex UI refresh: one human design language for the site, the scan and the PDF (plan)

Owner brief (2026-10-03): the business logic is good, but the UI reads as "AI slop". Make every
box and component more aesthetic and professional, with hand-made "human" components. Text is too
spaced and there is too much free space. Rethink the small buttons (the "NO-NO" pills: "↗ CREȘTERE",
"⚡ IMPACT MARE", "AUTOMATIZARE · LUNI … ⚡ IMPACT MARE"). Standing rules: no glows, glass pills,
gradient borders, icon-in-circle or purple everywhere; consistent text; natural Romanian with
diacritics; few em dashes; no fake metrics. The underline hero search and the ASCII vortex stay.

Inputs: scan audit (77 shots), homepage audit, content/numbers audit (engine probes), reference
research (Linear, Stripe, Vercel, Mercury, cmdk, GOV.UK, McKinsey/FT charts), two direction sheets
(Precision, Editorial) and three judges. This plan supersedes the visual rules in
`vortex-scan-experience-2026-10-03.md` ("Brand adaptation": glass, glows, letter-spaced eyebrows) and
the card styles in the homepage plans. It does not touch the hero composition, the ASCII renderer
or the brand media; those plans stay in force.

Reference screenshots (scratchpad, not in the repo):
`/private/tmp/claude-501/-Users-dandeamihai-Desktop/98201317-c5fd-4bed-b3dd-e616a5f40dda/scratchpad/ui-refresh/final/`
`precision-01…10-*.png` (the base) and `graft-editorial-01…05-*.png` (the parts grafted in).

---

## 0. Summary for the owner

1. One calm language for the homepage, the scan and the PDF: night background, solid panels with
   thin lines instead of glass, one violet accent used only where you act and on the money line.
   The ASCII vortex and the underline search stay the single bold moment.
2. The "NO-NO" pills disappear everywhere (about 25 on each scan page). Status becomes a small
   square plus a plain word ("Lipsește"), priority a three-bar signal ("Prioritate mare"), and a
   card gets at most one honest marker ("Începem aici", always followed by the reason).
3. Text stops looking spaced: no uppercase mono labels anywhere below the hero. Labels are normal
   sentence-case text at zero letter-spacing, figures use aligned Space Grotesk digits, and the mono
   font is kept only for CUI codes and web addresses.
4. Free space shrinks: headings go from 55 px to 28–40 px, sections sit 96–128 px apart instead
   of 192, the scan's first numbers move from the middle of the screen to the top third, and the
   homepage gets roughly half as long (Explorations and Stats removed, card stacks turned into lists).
5. The plan stops being a glowing timeline with stock "AI network" pictures. It becomes a
   month-by-month calendar table with hours and cost per stage and a total, then one short row per
   stage. No images, no numbered circles.
6. The impact chart states its conclusion as the title ("Se recuperează în luna 14"), labels its own
   lines and areas, and sits on one row of four plain numbers instead of icon tiles full of ranges.
7. Every metric shows one rounded estimate, identical on screen, in the table and in the PDF. Ranges
   and assumptions move to short numbered notes, and "3,4–36 luni" is replaced by the month the chart
   actually crosses.
8. One button system (solid violet, outlined, text link, 8 px corners) replaces five button styles
   and the animated gradient rings. The PDF dialog loses the icon tile, glow and purple pills and gets
   about 30% shorter. The search dropdown loses the keyboard hints and filler subtitles.
9. Delivered in 7 phases by 2–3 engineers in about 8 working days; every phase ships on its own.

---

## Decision record

**Winner by the rule (sum of scores): Precision.** Ties would have gone to the human lens; there is
no tie.

| Judge (lens) | Editorial: human / prof. / density / brand / lens = sum | Precision: same = sum | Judge's pick |
|---|---|---|---|
| 1 Human + professional | 8.5 / 8 / 7.5 / 7 / 8.5 = **39.5** | 7 / 8.5 / 8.5 / 7.5 / 7.5 = **39.0** | Editorial |
| 2 Clarity + credibility | 8.5 / 8.5 / 8 / 7.5 / 8.5 = **41.0** | 7.5 / 8.5 / 8.5 / 8 / 8 = **40.5** | Editorial |
| 3 Buildability + consistency | 9 / 8.5 / 8.5 / 7 / 6.5 = **39.5** | 7.5 / 9 / 8.5 / 8.5 / 9 = **42.5** | Precision |
| **Total** | **120.0** (96.5 without the lens column) | **122.0** (97.5 without the lens column) | |

Two of three judges preferred Editorial's character, and all three told the winner to take
Editorial's human details. So the system is **Precision's tokens, primitives, number discipline,
search menu and file-by-file migration, with Editorial's voice grafted on**.

**Taken from Precision (base):** token set and radii (4/6/8/10/12), flat `Panel` replacing
`GlassCard` 1:1 (restyle, not re-architecture), button scale 40/36/28 with states, segmented control
with a neutral active segment, search company rows (name, city, CUI; honest "4 din 128" count;
"Scanează după nume" fallback), the KPI strip doubling as the chart legend, the out-of-window
payback note, rounding to 1.000 so KPIs and table never disagree, the content card with a facts
list, the input "găsit la ANAF" status and fix-it errors, the honest consent sentence, the milestone
diamond and dashed "în funcțiune" tail on the Gantt, the allowed/banned badge vocabulary, the
34–40 px row rhythm.

**Grafted from Editorial:** the "Pe scurt" column with three numbered conclusions; titles that
state the conclusion; square status markers (replacing Precision's dots and coloured tint tags); the
dashed assumption tag ("De confirmat", "Date de exemplu"); the Gantt cost column plus Total row; the
hatched "Încă nerecuperat" area and the "Câștig net" label instead of a violet uncertainty band;
KPI sub-lines that say what each number means; the text step bar with a 2 px underline echoing the
hero indicator; separate tabular and proportional numerals; the typed-state footer "Nu e aici?
Scrie CUI-ul sau adresa site-ului."; the mobile bottom sheet for the PDF dialog; Romanian-first copy;
a 34% "rule" line for section and table heads.

**Every named weakness, and its fix:**

| Weakness (who said it) | Fix in this plan |
|---|---|
| Precision still puts everything in 12 px boxes (J1, J3) | Panels only for top-level data groups on /scan, where the dimmed ASCII backdrop needs a solid surface: at most 2 per view, never a card inside a panel. Homepage uses lists, rules and image frames, no panels. "Pe scurt" and "Ce se schimbă" sit on rules, not in boxes. |
| Filled red/green/amber tags and filled month chips are still badges (J1, J3) | One marker language: 6 px square plus neutral text. Months are plain text in the date column. The only tinted tag is "Începem aici", once per page. |
| Violet uncertainty fan on the chart (J1, J3) | Removed. The range is note ¹; the chart shows a labelled hatch for the unrecovered area and a labelled net-gain tint. |
| Type icon on every search row, kbd clutter (J1) | No row icons. Right-aligned plain hint. One ↵ chip on the active row, desktop pointer only. |
| English sheet chrome (J1, J2, J3) | All UI copy Romanian-first through `t(en, ro)`; the RO strings in §3.8 are the source of truth. |
| Mobile hero dropped "Analizează"; placeholder changed (J1, J2) | Hero field is untouched at every width (hero-owned). Placeholder wording is owner decision D6. |
| Invented company names and CUIs (J1) | Never in the UI. Demo data comes from the fixture regenerated from the engine, labelled "Date de exemplu". |
| No headline summary (J1) | "Pe scurt" on the results step, generated by `copy.ts`. |
| Gantt names differ from phase titles; cards rename the same work (J2, J3) | One `title` per phase from the display selector (§3.1), read by the Gantt, the phase rows, the strategy cards and the PDF. |
| No cost column, no total (J2) | Gantt has "Ore / lună" and "Cost unic, lei" columns and a Total row. |
| Chart not self-explanatory for a lay owner (J2) | Axis unit "mii lei", axis title "luna", labelled hatch and net area, conclusion title. |
| "Cam jumătate" not flagged as an assumption (J2) | Dashed "De confirmat" tag on that cell plus note ⁴. |
| "Profit" as a table status (J2) | Status column reads "Implementare / În funcțiune / Recuperat". |
| Two parallel marker languages (J3) | Squares only; dots survive only as the 6 px "online" indicator in the homepage footer. |
| Full-width dialog on mobile (Precision open question) | Bottom sheet on < 640 px with the existing `ui/drawer.tsx` (vaul). |
| Editorial numbers disagree (−2.000 KPI vs −1.300 table; 62.000 vs 62.300) (J1, J2, J3) | One selector, one rounding: cumulative values to 1.000 everywhere; net is always displayed value minus displayed cost. |
| Cyan bar on a rounded search row (J1) | Active row = neutral fill plus ↵ chip. Cyan stays an underline echo only (step bar, tabs). |
| Gradient fade on the break-even table row (J1) | Flat brand tint at 14%. |
| 6-month label collides with the hatch (J1) | Plain note at the top of the plot: "Se recuperează în luna 14, după perioada afișată." |
| Footnotes faded to illegible (J1) | Notes use `fg-3` (5.0:1 on panel), never masks or gradients. |
| Mobile chart "mii lei" breaks the gutter (J1) | Unit label sits inside the plot; 16 px gutter respected. |
| Footed "1" in "Luna 1" (J1, J2, J3) | `type-pnum` (proportional) for dates and running text; `type-num` (tabular) only for columns. |
| Under-branded, ASCII never checked (J1, J2, J3) | /scan already renders the ASCII vortex at 40% behind the flow; all specs are verified over it (acceptance §5.4). Step bar and tabs echo the hero's cyan underline. |
| Editorial too airy (46 px rows, 64 px sections) (J1) | Rows 36–40 px, Gantt rows 36, blocks 24–32 px apart on /scan, homepage sections `py-12 md:py-16`. |
| Editorial expensive to build: no panels, footnote registry, leader-line chart, two Gantts, Drawer (J3) | Panels kept; notes use a static per-step map; chart labels have fixed anchors and are omitted when there is no room; one Gantt with a `density` prop; Drawer already exists. |
| Footnote numbers restart with different meanings (J2) | Fixed order per step: ¹ payback range, ² cost scope, ³ value of an hour, ⁴ assumptions. |
| Bare "–²" hours cell (J2) | "–" in the cell; the phase row says "aduce solicitări, nu ore"; on mobile that text replaces the dash. |
| `fg-4` (28%) used for text (J3) | `fg-4` is for disabled controls and marker glyphs only. |
| Typed search rows without CUI (J2) | Name, city and CUI on one line (two lines on mobile). |

---

## 1. Design language

### 1.1 Principles

1. **One accent per view.** Violet (`#5b52f0`) marks the primary action, the series that matters
   (value of hours saved), the starting phase and focus rings. Everything else is neutral. Green,
   amber and red appear only as 6 px status squares. Cyan exists only as the hero underline and its
   two echoes (step bar, tabs).
2. **Sentence case at zero tracking.** No uppercase below the hero. The hero eyebrow is the only
   uppercase text on the site (`type-caps`). Mono never carries uppercase or tracking.
3. **Lines before boxes.** One panel level, solid, no blur. Inside a panel, parts are split by 1 px
   hairlines. No card inside a card, no tile grids of KPIs.
4. **One honest number per metric**, rounded, the same in every place. Ranges, method and scope go in
   numbered notes. No info icons, no count-up animations, no percentages that nothing measured.
5. **Titles say the conclusion.** "Se recuperează în luna 14", not "Impact estimat". Kickers appear
   only where they carry information.
6. **Dense, on a 4 px grid.** Panels pad 20 px (16 on mobile), rows 36–40 px, groups 24 px apart.
   The first useful number sits in the top half of the first screen.
7. **No decoration.** No glow, blur, gradient text or border, icon tile, pill, stock image, halftone,
   pulsing dot, hover lift or hover scale. An icon appears only if it does something (download, copy,
   edit, close, external link).
8. **Spend boldness once.** The hero (ASCII vortex, underline search, uppercase eyebrow) is loud;
   everything after it is quiet so the data reads first.

### 1.2 Tokens (exact code for `src/styles.css`)

Owner: engineer A (Phase 1). Replace the radius lines of the existing `@theme inline` block (lines
15–21) with the ones below, add the colour mappings to the same block, and put the `--vx-*` values
inside the existing
`.cinematic` scope (both the homepage and /scan render inside `.cinematic`; portalled dialogs and
sheets must keep the `cinematic` class as they do today). Do not change `--background`: the hero is
tuned to it.

```css
/* ---------- Vortex UI refresh tokens (2026-10) ---------- */

/* Radius: base 8 px; 12 px is the maximum. Legacy 2xl/3xl/4xl collapse to 12 so every old
   rounded-3xl glass panel de-rounds on day one. rounded-full stays for true dots only. */
@theme inline {
  --radius-sm: calc(var(--radius) - 4px);   /* 4  tags, kbd, checkbox */
  --radius-md: calc(var(--radius) - 2px);   /* 6  small buttons, menu rows, segments */
  --radius-lg: var(--radius);               /* 8  buttons, inputs, segmented shell */
  --radius-xl: calc(var(--radius) + 4px);   /* 12 panels, dialogs, cards, image frames */
  --radius-2xl: var(--radius-xl);
  --radius-3xl: var(--radius-xl);
  --radius-4xl: var(--radius-xl);
  --radius-menu: 10px;                      /* rounded-menu: dropdowns, popovers, search menu */

  --color-s1: var(--vx-s1);
  --color-s2: var(--vx-s2);
  --color-s3: var(--vx-s3);
  --color-fill-1: var(--vx-fill-1);
  --color-fill-2: var(--vx-fill-2);
  --color-fill-3: var(--vx-fill-3);
  --color-line-1: var(--vx-line-1);
  --color-line-2: var(--vx-line-2);
  --color-line-3: var(--vx-line-3);
  --color-rule: var(--vx-rule);
  --color-fg: var(--vx-fg);
  --color-fg-2: var(--vx-fg-2);
  --color-fg-3: var(--vx-fg-3);
  --color-fg-4: var(--vx-fg-4);
  --color-brand: var(--vx-brand);
  --color-brand-hover: var(--vx-brand-hover);
  --color-brand-line: var(--vx-brand-line);
  --color-brand-fg: var(--vx-brand-fg);
  --color-brand-tint: var(--vx-brand-tint);
  --color-ok: var(--vx-ok);
  --color-warn: var(--vx-warn);
  --color-bad: var(--vx-bad);
  --color-echo: var(--vx-echo);
  --shadow-pop: var(--vx-shadow-pop);
}

:root {
  --radius: 0.5rem; /* was 0.625rem */
}

.cinematic {
  /* Surfaces are solid: the ASCII backdrop must never show through data. */
  --vx-s1: #0a0b16;                         /* panels */
  --vx-s2: #0f111c;                         /* menus, dialogs, sheets */
  --vx-s3: #161826;                         /* pressed */
  --vx-fill-1: rgb(255 255 255 / 0.03);     /* inputs, quiet fills */
  --vx-fill-2: rgb(255 255 255 / 0.055);    /* hover rows, active search row */
  --vx-fill-3: rgb(255 255 255 / 0.09);     /* selected segment, pressed chip, count */
  --vx-line-1: rgb(255 255 255 / 0.07);     /* hairlines inside panels, table rows */
  --vx-line-2: rgb(255 255 255 / 0.10);     /* panel and popover edges */
  --vx-line-3: rgb(255 255 255 / 0.16);     /* control edges, outline tags */
  --vx-rule: rgb(255 255 255 / 0.34);       /* section rules, table heads, total rows */
  --vx-fg: #ececf1;                         /* primary text */
  --vx-fg-2: #a7a9b9;                       /* secondary text, bullets */
  --vx-fg-3: #7d8095;                       /* labels, notes, ticks (5.0:1 on s1) */
  --vx-fg-4: #4f5265;                       /* disabled, marker glyphs only (never text) */
  --vx-brand: #5b52f0;                      /* fills: primary button, checkbox */
  --vx-brand-hover: #6961f5;
  --vx-brand-line: #8079ff;                 /* chart series, focus ring, start bar */
  --vx-brand-fg: #aaa5ff;                   /* brand as text */
  --vx-brand-tint: rgb(91 82 240 / 0.14);   /* "Începem aici", break-even table row */
  --vx-ok: #45c08a;
  --vx-warn: #d9a346;
  --vx-bad: #e5675f;
  --vx-echo: #8be3f0;                       /* match the hero underline value in VortexSearch.module.css */
  --vx-shadow-pop: 0 0 0 1px rgb(0 0 0 / 0.35), 0 2px 6px -1px rgb(0 0 0 / 0.45),
    0 16px 36px -10px rgb(0 0 0 / 0.7);     /* menus, dialogs: the only shadow */
  --vx-overlay: rgb(0 0 0 / 0.55);          /* dialog backdrop, no blur */
}

/* One container for nav, homepage sections and /scan (fixes the 56 px nav/content offset). */
@utility container-vx {
  width: 100%;
  max-width: 80rem;
  margin-inline: auto;
  padding-inline: 1rem;
  @media (width >= 40rem) { padding-inline: 1.5rem; }
  @media (width >= 64rem) { padding-inline: 3rem; }
}
/* Homepage section rhythm: 48 / 64 px (was 64 / 96). */
@utility section-y {
  padding-block: 3rem;
  @media (width >= 48rem) { padding-block: 4rem; }
}
```

**Spacing scale** (4 px base, Tailwind classes in brackets): 2 (0.5), 4 (1), 6 (1.5), 8 (2),
12 (3), 16 (4), 20 (5), 24 (6), 32 (8), 40 (10), 48 (12), 64 (16). Nothing else.

| Use | Value |
|---|---|
| Panel padding | header 16 20 12, body 16 20, footer 12 20; mobile 16 on every side |
| Row height | 36 (list, table, menu), 44 on touch for interactive rows; Gantt 36 (compact 32) |
| Title → content | 12–16 |
| Related items | 8–12 |
| Groups inside a step | 24; blocks/panels on /scan 24 (mobile 16) |
| Homepage sections | `section-y` (48 / 64), so section-to-section ≈ 96–128 |
| Header margin below a homepage SectionHeader | 32 (md 40) |
| Line length | report text 60–72ch, leads ≤ 60ch |

**Retired utilities** (delete from `styles.css` in Phase 7, once the grep gates in §5.4 are green):
`glow-soft`, `glow-teal`, `glass-panel`, `bento-panel`, `bg-aurora`, `animate-glow-pulse`,
`animate-float-slow`, `flow-orb`, `gradient-travel`, `accent-gradient`, `accent-gradient-animated`,
`halftone`, `animate-pulse-dot`, `text-gradient-brand`, `bg-gradient-brand`, `text-gradient-hero`
(keep only what the hero engineer still uses inside the hero, renamed with a `hero-` prefix).

### 1.3 Type roles (exact new values)

| Role | Today (working tree) | New |
|---|---|---|
| `type-label` | JetBrains Mono 500, 11 px, **+0.16em** (0.06em at HEAD), UPPERCASE | **DM Sans 500, 13 px / 1.35, 0 tracking, sentence case** |
| `type-tech` | JetBrains Mono 400, 10 px, **+0.14em**, UPPERCASE | **JetBrains Mono 400, 13 px / 1.35, 0 tracking, no transform, tabular** (codes only; renamed `type-code`, removed in Phase 7) |
| `type-h2` | SG 600, clamp 32→52 px, -0.025em | SG 600, clamp 28→40 px, 1.1, -0.02em |
| `type-h3` | SG 600, clamp 18→22 px | SG 600, clamp 17→20 px, 1.25, -0.012em |
| `type-lead` | DM 400, clamp 16→20 px | DM 400, 17 px / 1.5 |
| `type-body` | DM 400, 16 / 1.6 | DM 400, 15 / 1.55 |
| `type-micro` | 12 px, +0.01em | 12 px / 1.45, 0 |
| `type-button` | DM 500, 15 px | DM 500, 14 px |
| new `type-title` | | SG 600, clamp 24→28 px, 1.15, -0.02em (scan step titles, page titles) |
| new `type-h4` | | SG 600, 16 / 1.35, -0.01em (row titles, phase titles) |
| new `type-caps` | | DM 500, 12 / 1.3, +0.08em, UPPERCASE (**hero eyebrow only**) |
| new `type-code` | | = new `type-tech` (CUI, domains, kbd) |
| new `type-num` | | SG, `tabular-nums lining-nums`, -0.01em (table columns, axes, KPIs) |
| new `type-pnum` | | SG, `proportional-nums lining-nums`, 0 (dates "Luna 1", numbers in running text) |
| new `type-figure` | | SG 600, clamp 20→22 px, 1.1, -0.015em, tabular (KPI and stat values) |

```css
@utility type-h2 { font-family: var(--font-display); font-weight: 600; font-size: clamp(1.75rem, 1.2rem + 1.6vw, 2.5rem); line-height: 1.1; letter-spacing: -0.02em; }
@utility type-title { font-family: var(--font-display); font-weight: 600; font-size: clamp(1.5rem, 1.25rem + 0.6vw, 1.75rem); line-height: 1.15; letter-spacing: -0.02em; }
@utility type-h3 { font-family: var(--font-display); font-weight: 600; font-size: clamp(1.0625rem, 1rem + 0.25vw, 1.25rem); line-height: 1.25; letter-spacing: -0.012em; }
@utility type-h4 { font-family: var(--font-display); font-weight: 600; font-size: 1rem; line-height: 1.35; letter-spacing: -0.01em; }
@utility type-lead { font-family: var(--font-body); font-weight: 400; font-size: 1.0625rem; line-height: 1.5; letter-spacing: 0; }
@utility type-body { font-family: var(--font-body); font-weight: 400; font-size: 0.9375rem; line-height: 1.55; letter-spacing: 0; }
@utility type-body-sm { font-family: var(--font-body); font-weight: 400; font-size: 0.875rem; line-height: 1.5; letter-spacing: 0; }
@utility type-micro { font-family: var(--font-body); font-weight: 400; font-size: 0.75rem; line-height: 1.45; letter-spacing: 0; }
@utility type-label { font-family: var(--font-body); font-weight: 500; font-size: 0.8125rem; line-height: 1.35; letter-spacing: 0; text-transform: none; }
@utility type-caps { font-family: var(--font-body); font-weight: 500; font-size: 0.75rem; line-height: 1.3; letter-spacing: 0.08em; text-transform: uppercase; } /* hero eyebrow only */
@utility type-code { font-family: var(--font-mono); font-weight: 400; font-size: 0.8125rem; line-height: 1.35; letter-spacing: 0; text-transform: none; font-variant-numeric: tabular-nums; }
@utility type-tech { font-family: var(--font-mono); font-weight: 400; font-size: 0.8125rem; line-height: 1.35; letter-spacing: 0; text-transform: none; font-variant-numeric: tabular-nums; } /* alias of type-code; delete in Phase 7 */
@utility type-num { font-family: var(--font-display); font-variant-numeric: tabular-nums lining-nums; letter-spacing: -0.01em; }
@utility type-pnum { font-family: var(--font-display); font-variant-numeric: proportional-nums lining-nums; letter-spacing: 0; }
@utility type-figure { font-family: var(--font-display); font-weight: 600; font-size: clamp(1.25rem, 1.1rem + 0.4vw, 1.375rem); line-height: 1.1; letter-spacing: -0.015em; font-variant-numeric: tabular-nums lining-nums; }
@utility type-button { font-family: var(--font-body); font-weight: 500; font-size: 0.875rem; line-height: 1.2; letter-spacing: 0; }
```

`type-display` (hero title) is unchanged and hero-owned.

**Order of the switch (avoids breaking the hero):** A adds `type-caps` → the hero engineer moves the
eyebrow at `HeroSection.tsx:140` (and the scroll cue at :217, the proof label in `HeroProof.tsx:34`)
to `type-caps` / `type-label` as they see fit → A then redefines `type-label` and `type-tech` in place.
That one redefinition turns all 44 `type-label` uses and 26 `type-tech` uses into sentence-case,
untracked text in a single release; Phases 3–4 then fix casing in the strings and move numbers to
`type-num`. Also remove the `tracking-widest` shortcut style in `ui/command.tsx`,
`ui/dropdown-menu.tsx`, `ui/menubar.tsx`, `ui/context-menu.tsx`, and the `tracking-[0.2em]` /
`[0.34em]` / `[0.14em]` / `uppercase` overrides in `shared/SectionHeading.tsx`,
`layout/LanguageToggle.tsx`, `routes/portfolio.tsx` and the legacy `home/*` files (Phase 7).

### 1.4 Fonts

- Keep the three families and the current Google Fonts request. No new font.
- **Space Grotesk** for titles and every figure. DM Sans as served ignores `tabular-nums`
  (measured: "1111" 49.9 px vs "0000" 109.5 px at 40 px), so numbers that line up use
  `type-num` / `type-figure`. Space Grotesk's tabular "1" has a foot; use `type-pnum` for dates and
  numbers inside sentences.
- **DM Sans** for all UI and body text, 0 tracking.
- **JetBrains Mono** only for CUI, domains and kbd (`type-code`), never uppercase. Once Phase 7 lands,
  request only weight 400 (drop 500/600) in `routes/__root.tsx`.
- Optional test (A, 30 min, Phase 1): request `DM+Sans:opsz,wght@9..40,300..700` with
  `font-optical-sizing: auto` and compare 15 px body and 17 px lead side by side; adopt only if it
  reads tighter without hurting 12–13 px labels.

### 1.5 Colour rules

- Text levels: `fg` titles and values, `fg-2` body and bullets, `fg-3` labels, notes, ticks.
  `fg-4` never for text a person must read.
- Brand violet: primary button fill, focus ring (`brand-line`), the value-of-hours series,
  the starting Gantt bar and the single "Începem aici" tint. One primary button per viewport.
- Status squares: `ok` Există / Finalizat / Bun, `warn` Lipsește / Acceptabil / De confirmat context,
  `bad` Urgent / Slab / errors. Never as fills behind text, never as tag backgrounds.
- Error text uses `bad`, never violet.
- No hard-coded hex in components after Phase 7 (`#5b52f0`, `#6c63ff`, `#5b8cf0`, `#89cbf6`,
  `#5fe3d0`, `#1fa898`, `#c4b5fd`, `#67e8f9`, `#a5b4fc`, `#070a1c`, `#070a1f`, `#04061a`): use tokens.

### 1.6 Motion

- Nothing fades up per section; no hover lift or scale; no count-up numbers; no layout springs on
  high-frequency interactions (search highlight, tabs, segmented control change instantly).
- Allowed: menu open 140 ms (opacity + translateY -4 px), dialog 180 ms (opacity + scale .98),
  sheet slide 220 ms, chevron rotate 150 ms, chart content 200 ms opacity on horizon change.
- Every animation respects `prefers-reduced-motion` and the page-wide pause switch. Never
  `transition: all`.

---

## 2. Component specs

### 2.0 Shared primitives (new folder `src/components/system/`, engineer A, Phase 1)

| File | Exports | Replaces |
|---|---|---|
| `button.tsx` | `buttonClass(variant, size)`, `Button`, `ButtonLink` (TanStack `Link`), `IconButton` | `scan/report/buttons.ts` (becomes a shim: `scanButton(v, s)` → `buttonClass`), `landing/RingButton.tsx` (shim, deleted Phase 7), nav CTA, pricing buttons |
| `marker.tsx` | `Status`, `Priority`, `Tag`, `Count`, `Kbd` | `scan/report/Tag.tsx` and every inline pill (§2.2) |
| `panel.tsx` | `Panel`, `PanelHeader`, `PanelBody`, `PanelFooter`, `PanelDivider` | `scan/report/GlassCard.tsx` (`GLASS`, `TILE`, `GlassCard`, `PanelEyebrow` become shims) |
| `segmented-control.tsx` | `SegmentedControl` (same props as today) | `scan/report/SegmentedControl.tsx` (shim) |
| `field.tsx` | `Field` (label, optional marker, hint, error, status), uses `ui/input`, `ui/checkbox`, `ui/label` | `LeadGateDialog` `FIELD` constant, ad-hoc inputs |
| `stat.tsx` | `Stat`, `StatStrip` | `ImpactFigure`, `EstimatedResults`, `VitalsRow`, `ScoreStat`, `MarketStat`, simulation KPI tiles |
| `notes.tsx` | `NoteRef` (superscript link), `NoteList` | 7 `InfoTip` uses, duplicated disclaimers |
| `section-header.tsx` | `SectionHeader` (`kicker?`, `title`, `lead?`, `actions?`, `layout: "stacked" \| "split"`) | `landing/SectionHeader.tsx` (`Em`, `Eyebrow`), `shared/SectionHeading.tsx`, `report/StepHeader.tsx` (step variant) |
| `index.ts` | re-exports | |

A also restyles the shadcn base in `src/components/ui/` so dashboard and legal pages inherit the
language: `input.tsx`, `checkbox.tsx`, `label.tsx`, `dialog.tsx` (overlay `--vx-overlay`, no blur,
radius 12, `bg-s2`, `shadow-pop`), `drawer.tsx`, `sheet.tsx`, `popover.tsx`, `tooltip.tsx`,
`tabs.tsx`, `table.tsx`, `badge.tsx` (maps to the `Tag` look), `select.tsx`.

### 2.1 Search dropdown (`src/components/landing/VortexSearch.tsx` lines ~700–1000 + `VortexSearch.module.css`)

Owner: the hero engineer (file is theirs), Phase 5. The underline field, the cyan segment and
"Analizează ↗" do not change. Shared by the hero and the /scan find stage.

- **Surface:** `bg-s2`, 1 px `line-2`, `rounded-menu` (10), padding 6, `shadow-pop`, no
  `backdrop-blur`. Top edge 8 px under the underline, same width as the field.
- **Group heading:** `type-label` 12 px variant (`text-xs font-medium`), `fg-3`, padding 8 10 4,
  sentence case: "Exemple", "Firme", "Analiză directă". Right side: an honest count in `fg-3`
  `type-num` ("4 din 128") only when the API returns a total.
- **Example rows (empty field):** 36 px (44 under 768 px), radius 6, padding 0 10, one line. Value
  14 px `fg` (domain and CUI in `type-code`). Right-aligned hint 13 px `fg-3`: "caută în ONRC",
  "analiză de site", "date ANAF". No icons, no subtitles, no FIRMĂ/SITE/CUI column.
- **Company rows (typed):** one line on ≥ 640 px: name 14 px with the matched part in `font-medium fg`
  and the rest `fg-2`; city 13 px `fg-3` in a 120 px column; CUI `type-code` 13 `fg-3` right-aligned
  in a 96 px column. Under 640 px: name on line 1, "city, CUI" on line 2 (13 `fg-3`), row 52 px.
  Inactive company: `Status tone="warn"` "inactivă" after the name (replaces the amber mono badge at
  line 917).
- **Fallback row** (typed, always last in the company group): "Scanează după nume: „clinica”" with
  hint "fără registru".
- **Active row:** `bg-fill-2`, plus a 20 px `Kbd` "↵" at the far right on `(pointer: fine)` only. No
  left bar, no `layoutId` spring; highlight moves instantly.
- **Footer:** 1 px `line-1` top border, padding 8 10, 12 px `fg-3`. Empty state: "Firme din datele
  deschise ONRC și ANAF". Typed, no good match: "Nu e aici? Scrie CUI-ul sau adresa site-ului."
  On desktop only, a right-aligned "↑ ↓ pentru a alege" with two 18 px `Kbd`. No ESC/NAVIGHEAZĂ hints.
- **Loading:** two 36 px skeleton rows at `fill-2`, no shimmer gradient; the travelling violet line
  is removed.
- **Motion:** open 140 ms; nothing else animates.
- **Type styles in the box:** 3 (14 value, 13 meta, 12 heading/footer).
- Removes: `type-label` at 757, `type-tech` at 802/917/968/991, `backdrop-blur-xl` at 726.

### 2.2 Tags and small buttons (replaces the NO-NO pills)

`src/components/system/marker.tsx`. Rule: **at most one marker per card or row**, and only when
the data makes it true. Never an icon inside a marker; never uppercase.

| Treatment | Anatomy | Use |
|---|---|---|
| `Status` (default) | 6×6 px square (radius 1) in `ok`/`warn`/`bad`/`fg-3`, hollow 1 px `fg-3` square for "Neverificat"; gap 6; DM 500 13 px `fg-2`; no border, no fill | Există, Lipsește, Neverificat, Urgent, Finalizat, În lucru, Omis, Bun, Acceptabil, Slab, online |
| `Priority` | three 2 px bars, 4/7/10 px tall, 2 px apart, lit `fg-2`, unlit `fg-4`; then DM 500 13 `fg-2` "Prioritate mare / medie / mică" | findings, website actions |
| `Tag variant="outline"` | 20 px tall, padding 0 6, 1 px `line-3`, radius 4 (`rounded-sm`), DM 500 12 px `fg-2` | categories in lists and filters only: Automatizare, Site, Asistent AI, Recenzii, Opțional |
| `Tag variant="dashed"` | as outline, 1 px dashed `line-3`, `fg-3` | assumptions: "De confirmat", "Date de exemplu" |
| `Tag variant="start"` | 20 px, padding 0 6, radius 4, `bg-brand-tint`, `text-brand-fg`, no border | "Începem aici", **once per page**, always followed by its reason sentence |
| `Count` | 18 px, padding 0 5, radius 4, `bg-fill-3`, `type-num` 12 `fg-2` | "Probleme 3", filter counts |
| `Kbd` | 18–20 px, padding 0 5, radius 4, 1 px `line-3` with 1.5 px bottom border, 11 px DM, lowercase | search menu, desktop only |
| Small button | 28 px, radius 6, DM 500 13, secondary or ghost; icon 14 px only when it acts | Editează, Copiază linkul, Detalii |
| Filter chip | 28 px, radius 6, 1 px `line-3`; pressed: `bg-fill-3`, no border, plus `Count` | Toate 9, Lipsă 8 |

**Vocabulary.** Allowed (only when true): Începem aici, Se plătește repede (central payback ≤ 6
months), Cel mai mult timp câștigat (one card only), După luna N, Opțional, De confirmat, Urgent
(site down, no HTTPS, GDPR), Rapid, Există / Lipsește / Neverificat. **Banned in any form:** Esențial,
Impact mare, Creștere as a badge, Recomandat (ribbon, tag or "pentru tine"), Oportunitate, Prioritar,
Potențial ridicat, "Bun" on automation potential, €/€€/€€€ meters, any icon + uppercase pill.

**The three owner examples:**
- "↗ CREȘTERE" → nothing. The period goes in the date column ("Lunile 4–6"), the title says the
  work ("Recenzii și evidența solicitărilor").
- "⚡ IMPACT MARE" → the number itself in the meta line: "cam 35 de ore pe lună".
- "AUTOMATIZARE · LUNI … ⚡ IMPACT MARE" → date column "Lunile 2–3" + title; if this phase saves the
  most time, `Status`-style square in `brand-line` + "Cel mai mult timp câștigat".

**Every badge/pill usage to replace:**

| File:line (today) | Now | Becomes |
|---|---|---|
| `scan/report/Tag.tsx` | the NO-NO pill | shim to `marker.tsx`, deleted Phase 7 |
| `scan/steps/ResultsStep.tsx:239` `PHASE_TAGS`, `:382` | ESENȚIAL / IMPACT MARE / CREȘTERE | removed; `Tag start` on the starting phase only |
| `ResultsStep.tsx:598` (OfferCard eyebrow) | sparkle "RECOMANDAT PENTRU TINE · PLANUL…" | plain label "Abonamentul potrivit pentru acest plan" |
| `scan/steps/OverviewStep.tsx:455/481/486/491` (CompanyCard) | violet activity pill, CAEN, city, "inactive" pills | label/value rows in the company strip; inactive → `Status bad` "Inactivă la ANAF" |
| `OverviewStep.tsx:1098/1099` (FindingRow) | PRIORITATE MARE + wrench EFORT MEDIU | `Priority` + effort as plain 13 px `fg-3` text ("efort mediu") |
| `OverviewStep.tsx:1355` (MarketPanel) | violet "TU" pill | row label "Tu" in DM 500 + `bg-brand-tint` row |
| `StrategyStep.tsx:205` | "1 AUTOMATIZARE" count pill | removed (the facts list says it) |
| `StrategyStep.tsx:343` | solid violet sparkle RECOMANDAT ribbon over the card edge | `Tag start` inside the card's top line + reason sentence |
| `StrategyStep.tsx:403` (Plan pe luni) | "Recomandat" tag | `Tag start` on the starting row |
| `report/ScoreRing.tsx` | "ACCEPTABIL" status pill | `Status warn` "Acceptabil" |
| `steps/AnalyseStep.tsx:302/308` | target chips | one text line (§2.10) |
| `AnalyseStep.tsx:314` | mint "DATE DE EXEMPLU · CLINICĂ FICTIVĂ" | `Tag dashed` "Date de exemplu" |
| `OverviewStep.tsx` JourneyPanel | dashed-circle "De îmbunătățit" | `Status warn` "De îmbunătățit" |
| `OverviewStep.tsx` TechnologiesPanel | gradient pills; 8 grey dashed "nedetectat" chips | comma lists (§2.11) |
| `report/PresenceTile.tsx` | "Lipsește, merită adăugat" + dashed tiles | list row + `Status warn` "Lipsește" |
| `globe/ScanGlobe.tsx` DataCardView chips | pill chips, glowing mint dot | plain text + `Status` |
| `scan/ScanShell.tsx:107` | floating blurred "Actualizăm analiza…" pill | inline status line in the step bar (§2.8) |
| `landing/WorkSection.tsx` | glass "LIVE" / "Acces privat" pills | `Status ok` "online" / text "acces privat" in the caption |
| `landing/ProjectPreview.tsx` | mono category pill, pulsing LIVE, chip pills | plain text, comma list |
| `home/PricingSection.tsx` | animated "CEL MAI POPULAR" pill | 2 px `brand-line` top rule on the recommended column, no badge (D5) |
| `landing/LandingNav.tsx:41/182` | EN/RO pill toggle, "RO⌄" mono dropdown | text toggle "RO / EN" |
| `components/ui/badge.tsx` | shadcn pill | `Tag` look (radius 4, sentence case) |

### 2.3 Buttons (`system/button.tsx`)

| Size | Height | Padding | Radius | Text | Icon |
|---|---|---|---|---|---|
| `lg` | 40 | 0 16 | 8 | DM 500 14 | 16 |
| `md` (default) | 36 | 0 14 | 8 | DM 500 14 | 16 |
| `sm` | 28 | 0 10 | 6 | DM 500 13 | 14 |
| `icon` | 28 / 36 square | – | 6 / 8 | – | 14 / 16 |

- **primary:** `bg-brand` white text, 1 px top inner highlight `rgb(255 255 255 / .12)`, hover
  `bg-brand-hover`. One per viewport.
- **secondary:** `bg-fill-1`, 1 px `line-3`, `fg` text, hover `bg-fill-2` + `line-3` → 24% white.
- **ghost:** `fg-2` text, hover `bg-fill-2` + `fg`.
- **link:** `fg` text, 1 px underline at 4 px offset in `rgb(255 255 255 / .28)`, hover underline `fg`.
- **States:** focus-visible 2 px gap + 2 px ring `brand-line` at 55%; disabled 42% opacity, no
  pointer; loading: 14 px spinner (1.5 px stroke) replaces the icon, label stays ("Se generează…").
  Active: no scale. No gradient ring, no hover scale, no arrow nudge.
- **Full width** only on < 640 px in dialogs and sheets.
- **Labels:** verb + noun matching the context ("Descarcă PDF-ul", "Analizează afacerea",
  "Programează o discuție"). The arrow "↗" is allowed only on the hero "Analizează" and on external
  links.
- **Migration:** `RingButton` (15+ homepage uses) → `ButtonLink` (`solid` → primary or secondary by
  context, `outline` → secondary, `pill` → secondary); nav CTA → primary `md`; pricing → per §2.15;
  `scanButton` callers keep working through the shim until Phase 7.

### 2.4 Segmented control (`system/segmented-control.tsx`)

- Shell 30 px, padding 2, radius 8, 1 px `line-2`, `bg-fill-1`. Segments 26 px, padding 0 10,
  radius 6, DM 500 13, equal width.
- Active: `bg-fill-3` + `fg` + 1 px `rgb(0 0 0 / .3)` shadow. Inactive `fg-3`, hover `fg-2`.
  **Never violet, never icons.** No sliding spring (instant), keep the radio-group keyboard model and
  `aria-label` of today's component.
- Uses: 6 luni / 12 luni / 24 de luni; Comparație / Plan pe luni; Română / English (dialog);
  desktop / mobil (ProjectPreview).

### 2.5 Inputs, checkbox, select (`ui/input.tsx`, `ui/checkbox.tsx`, `ui/select.tsx`, `system/field.tsx`)

- **Input:** 36 px (40 in dialogs and forms), radius 8, `bg-fill-1`, 1 px `line-3`, padding 0 12,
  DM 14 `fg`, placeholder `fg-3`. Focus: border `brand-line` at 75% + 3 px ring at 18%. Error: border
  `bad` at 60% + help line 13 px `bad` saying how to fix ("Adaugă domeniul complet, de exemplu
  dentalsmile.ro."). Verified status (right inside the field, 12 px): `Status ok` "găsit la ANAF".
- **Label:** DM 500 13 `fg-2`, 6 px above the field; "(opțional)" inline in `fg-3`.
- **Checkbox:** 16 px, radius 4, 1.5 px border at 42% white; checked `bg-brand` with a 2 px white
  check; error: 1 px `bad` ring. Label text 13 / 1.45 `fg-2`, 10 px gap.
- **Select:** same box as input, chevron 14 px `fg-3`, menu per §2.1 surface.
- Fields 16 px apart, groups 24 px.

### 2.6 Section header and kicker (`system/section-header.tsx`)

- **Homepage, stacked:** optional kicker (`type-label`, `fg-3`, sentence case, no rule line, used on
  at most 3 sections), title `type-h2` (no gradient word; emphasis = second clause in `fg-3`), lead
  `type-lead` `fg-2` max 56ch, actions right-aligned on md+ (secondary `md`). Kicker → title 8,
  title → lead 12, header → content 32 / 40.
- **Homepage, split:** title column 5/12 + content 7/12 on lg (used by Services and Consultation for
  variety; never the same template 8 times).
- **Scan step header (variant `step`, replaces `report/StepHeader.tsx`):** company line (DM 500 13
  `fg-2`: name, then `fg-3` city; plus `Tag dashed` "Date de exemplu" in demo), title `type-title`,
  one-line lead 15 px `fg-2` max 72ch, actions right. No eyebrow (the step bar already says the
  step), no gradient word. Height ≤ 110 px desktop, ≤ 140 px mobile. Appears without the 0.7 s
  fade-up (160 ms opacity at most).
- `Em` / `GradientText` / `text-gradient-hero` are not used below the hero.

### 2.7 Panels and cards (`system/panel.tsx`, content card pattern)

- **Panel:** `bg-s1`, 1 px `line-2`, radius 12, no shadow, no blur, no inset highlight.
  `PanelHeader`: title `type-h3` (17–20) + optional 13 px `fg-3` sub-line + actions (small buttons,
  segmented control). `PanelBody` padding 16 20. `PanelFooter` 1 px `line-1` top border, padding
  12 20, 13 px `fg-3` text + link. `PanelDivider` = 1 px `line-1`. Max 2 panels side by side.
- **Content card** (strategy cards, consultation offers): Panel padding 16 18 14, gap 10. Top line:
  `Tag outline` category left, at most one marker right. Title `type-h4` (16–17), description 14
  `fg-2` (max 2 lines), then a **facts list**: label/value rows, 13 px, 36 px rows, hairlines, label
  `fg-3` left, value `fg` right in `type-pnum` (Implementare "2 luni", Primele rezultate "din luna 3",
  Investiție "≈ 8.000 lei + 600 lei pe lună", Timp câștigat "cam 35 de ore pe lună"). Footer link
  "Detalii" (ghost `sm`, chevron). No hover lift.
- **Recommended card:** border `brand-line` at 42% + `Tag start` "Începem aici" + one reason line
  14 px `fg-2`. No gradient border, halo, ribbon or sparkle.
- **List row** (findings, presence, journey): padding 11 16, hairline between rows, 14 px marker
  column, title DM 500 14 `fg`, detail 13 `fg-3`, meta right 12.5 `fg-3`.
- **Table:** header DM 500 12 `fg-3` with 1 px `rule` bottom border; rows 36 px with `line-1`;
  numbers right-aligned `type-num`; minus sign "−" (U+2212); highlighted row flat `bg-brand-tint`.

### 2.8 Scan shell, step bar, step header (`scan/ScanShell.tsx`, `scan/ScanStepper.tsx`, `report/StepHeader.tsx`)

- **ScanShell:** `container-vx`; padding-top = nav height (64, mobile 56) + 16 (was 108); content
  starts 24 px under the step bar (was mt-48 + pb-20). The floating blurred "Actualizăm analiza…"
  pill is replaced by an inline status in the step bar: 12 px spinner + "Actualizăm analiza…" 13 `fg-2`
  + ghost `sm` "Anulează".
- **Step bar (ScanStepper rewritten):** 48 px row, sticky under the nav with `bg-background/92`
  and a 1 px `line-1` bottom border (no blur). Steps are text: number `type-pnum` 13 + label DM 500
  14, 24 px apart: "1 Firma", "2 Analiză", "3 Strategie", "4 Rezultate". Current: `fg` + 2 px
  `echo` underline flush with the bar's bottom border (the hero indicator echo). Done: `fg-2`,
  number replaced by a 12 px check glyph in `fg-3`, clickable. Future: `fg-4`, `aria-disabled`.
  Right side: step actions (results: ghost `sm` "Copiază linkul" + primary `md` "Descarcă raportul")
  and the 28 px ghost pause `IconButton` (motion pause, aria-label "Oprește animația").
  No 36 px circles, conic ring, glow, gradient connectors or mint rings.
- **Mobile (< 640):** past steps show numbers only, current shows number + label; actions collapse
  to the primary as a 36 px icon+text button "Raport"; the duplicate "PASUL X DIN 4" line is deleted.
- **Step header:** §2.6 `step` variant. Titles and leads per §3.8.

### 2.9 Find stage (`routes/scan.tsx` `FindStage`, line 306)

- Title `type-title` "Analizează o afacere", lead "Scrie numele firmei, CUI-ul sau adresa site-ului."
- VortexSearch at 640 px max width, left-aligned with the title on ≥ 1024 (centred on mobile).
- Under it (fills the empty 400 px with something useful): a 3-column list, each a `type-h4` line
  + one 14 px `fg-2` sentence: "Analiza site-ului și a prezenței online" / "Trei direcții și planul pe
  6 luni" / "Raportul complet, în PDF"; then a link button "Vezi un exemplu" → `?demo=results`.

### 2.10 Analyse step (`steps/AnalyseStep.tsx`, `globe/ScanGlobe.tsx`)

- **Target line:** "Analizăm Dental Smile Clinic, dentalsmile.ro" as 14 px text (domain in
  `type-code`), plus `Tag dashed` "Date de exemplu" in demo. No chips.
- **Checklist (Panel, 400 px column on ≥ 1024):** header title "Analiza" + sub-line "6 din 8 gata"
  (`type-pnum`); a 2 px progress bar at `fg-2` on `line-1` (never violet; on a failed run the bar
  stops and the rest of the track shows `bad` at 40%). Rows 36 px (`ChecklistItem` line 116): number
  `type-num` 12 `fg-4`, status (done `Status ok` square, running 12 px spinner in `brand-line`,
  pending hollow square, skipped `fg-3` text "omis"), title DM 14 `fg`, timing `type-num` 12 `fg-3`
  lowercase "0,3 s". A skipped row shows one 13 px `fg-3` reason line under the title, no info icon.
  Removes: mint check rings, mono numbers and timings, glow on the running dot, the gradient bar.
- **Globe (D7, keep restyled by default):** remove the blue rim glow. `DataCardView` (line 140):
  `bg-s2`, 1 px `line-2`, radius 8, padding 10 12, width 200; title DM 500 13 `fg-2` sentence case
  ("Date despre firmă"), value 14 `fg` (max 2 lines), status square; no icon tile, no blur, no glow,
  no chips. Under 768 px the globe is hidden and each step's found value prints under its checklist
  row (13 `fg-3`), so mobile drops from 2.9 to about 1.5 screens.
- **Error state:** lead rewritten from the failure ("Nu am putut deschide site-ul. Verifică adresa
  sau încearcă cu CUI-ul."), primary "Încearcă din nou" and secondary "Caută după CUI" directly under
  the header (inside the first viewport at 1280×720), checklist below.

### 2.11 Overview step (`steps/OverviewStep.tsx`, 1.598 lines)

Split while restyling (B2): `steps/overview/CompanyStrip.tsx`, `PresencePanel.tsx`,
`TechnologiesPanel.tsx`, `MarketPanel.tsx`, `JourneyPanel.tsx`, `EditBusinessDialog.tsx`;
`OverviewStep.tsx` keeps orchestration.

- **Company strip (replaces CompanyCard, line 245, and its 620 px dead column):** one full-width
  Panel. Left: the company's own first-screen screenshot from Lighthouse
  (`types.ts:187 screenshot`) at 128×80, radius 6, 1 px `line-2` (omitted when absent; no swirl art,
  no monogram). Then name `type-h3` + legal name 13 `fg-3` (as registered, ANAF cedillas fixed with
  the comma-below helper, no uppercase transform). Then a wrapping `dl` row, 24 px gaps, label 12
  `fg-3` over value 14 `fg`: Activitate ("Asistență stomatologică, CAEN 8623"), Oraș, CUI
  (`type-code`), Site (`type-code` link), Stare (`Status`). Right: secondary `sm` "Editează".
  Footer line 12 `fg-3` "Surse: ANAF, site-ul firmei". The "92% încredere" figure and the classification
  InfoTip are removed from the screen; the reason lives in the Edit dialog ("Am ales acest tip după
  codul CAEN și cuvintele de pe site.").
- **Tabs (line 170):** underline tabs on a 1 px `line-1` baseline: DM 500 14, `fg-3` → active `fg`
  + 2 px `echo` underline. No icons, no gradient pill, no glow. Labels: "Prezență online",
  "Tehnologii", "Piață", "Parcursul clientului".
- **PresencePanel (line 806), one Panel, two columns on ≥ 1024:**
  - Score block: "Scorul site-ului" label, `type-figure` 40 px "62" + "/100" 15 `fg-3`, `Status`
    "Acceptabil" (one tier word set everywhere, Bun / Acceptabil / Slab, on the thresholds already in
    `report/tiers.ts`), then 5 metric
    rows (`MetricBar.tsx`): label 13 `fg-2`, 2 px bar (`fg-2` fill on `line-1`), value `type-num` 13.
    No ring, no blurred disc, no gradient, no glow.
  - Speed (`VitalsRow`, line 999): heading "Viteza pe mobil" + right meta "Lighthouse, mobil" (13
    `fg-3`); `StatStrip` of 3 (LCP "4,6 s", etc.) with `Status` and sub-line "ținta: sub 2,5 s".
  - Presence (`PresenceTile.tsx` → list rows): platform name, `Status` Există / Lipsește /
    Neverificat, value or one action line. Only platforms the business-type playbook marks relevant
    (no YouTube for a dental clinic).
  - Scores (`ScoreStat`, line 981): two `Stat` cells in the same strip. Automation potential shows
    "82 din 100" and the sentence "Multe sarcini repetitive: merită automatizate.", no tier word, no
    check.
  - Findings (`FindingRow`, line 1081), full width under the columns: list "Ce am găsit" sorted by
    priority; `Priority` + title + detail; evidence localised with the PDF's `localizeEvidence`
    ("4,6 s (Lighthouse, mobil). Ținta e sub 2,5 s."); effort right ("efort mediu").
- **TechnologiesPanel (line 1147):** two-column `dl`: category label 13 `fg-3` → detected names as a
  comma list 14 `fg`. "Ce poate face site-ul" becomes two lines: "Are: formular de contact, hartă" and
  "Nu are: programare online, chat, plată online…" (14 `fg-2`). No pills, no 9 grey chips.
- **MarketPanel (line 1287):** `StatStrip` of 3 on top; comparison rows keep their layout (audit
  baseline) with a 2 px neutral bar, no gradient, no info icon; "Tu" row = DM 500 label +
  `bg-brand-tint`. Missing values show "fără date", not "—".
- **JourneyPanel (line 1479):** list of 5 stages; each stage: question as `type-h4` ("Te găsesc
  clienții?"), `Status` (Bine / De îmbunătățit), 2–3 en-dash bullets 14 `fg-2`, then "Soluție:" +
  one sentence inline (no inner box). Remove the 40 px icon circles and the gradient line. Target
  ≤ 1.000 px tall at 1440 (was 1.806).
- **EmptyState (line 726):** title `type-h4` + one sentence + action; no 56 px icon tile, solid
  1 px `line-2` border (not dashed).
- **EditBusinessDialog (line 575):** the audit's baseline; apply dialog tokens (radius 12, inputs
  40/8, labels 13, footer buttons right-aligned `md`).
- **InfoTip:** the 7 call sites (Overview 459/991, Analyse 168, Results 450/551, Strategy 254/615)
  become visible sub-lines or `NoteRef`s; `report/InfoTip.tsx` is deleted in Phase 7.

### 2.12 Strategy step (`steps/StrategyStep.tsx`)

- Header: "Trei direcții, fiecare cu cost și câștig" / "Le poți face pe rând sau împreună." Actions:
  segmented "Comparație / Plan pe luni".
- **StrategyCard ×3 (line 182) = content cards (§2.7)**, equal height, ≤ 420 px (was 555):
  category tag, title, 2-line summary, max 3 en-dash tactics (not mint check circles), facts list
  (Implementare, Primele rezultate, Investiție, Rezultat). "Rezultat" is a statement from the selector:
  "cam 35 de ore pe lună" / "Un site cu programare online" / "Cam jumătate din întrebări" + `Tag
  dashed` "De confirmat". Starting card: recommended variant with the reason from `recommend()`.
  Removed: sparkline (`report/Sparkline.tsx` deleted), €-meter, 3-segment gradient meter, count pill,
  gradient border, blurred halo, sparkle ribbon, info icon.
- **Plan pe luni (StrategyTimeline, line 357):** the shared `Gantt` (§2.13) in `density="compact"`,
  one row per strategy, plus the month axis "luna 1 … 6". Removes hatched/glowing gradient bars and
  the mono L0–L6 axis.
- **SimulationPanel (line 481) → Panel "Ajustează estimarea"**, sub-line "Schimbă volumul și costul
  orei; cifrele de mai sus se recalculează." Sliders (`report/BrandSlider.tsx`): 2 px track `line-3`,
  filled part `brand-line`, 14 px white thumb with 1 px `rgb(0 0 0 / .4)` border, focus ring per
  buttons; label row "Cât de aglomerați sunteți" + value "tipic (100%)" right (`type-pnum`); end
  ticks 12 `fg-3` "jumătate" / "dublu" (no "×0,5 MAI PUȚIN"). Results: `StatStrip` of 4 single
  values. The orb, the mono eyebrow and the duplicated "ESTIMĂRI, NU GARANȚII" box are removed (the
  disclaimer appears once, in "Cum am calculat").

### 2.13 Results step (`steps/ResultsStep.tsx`, `report/ImpactChart.tsx`, new `report/Gantt.tsx`)

**Layout (≥ 1280, 12-column grid, 24 px gap):**
1. Step header (cols 1–7): company line, title "Planul pe 6 luni: ce facem și cât costă", lead
   "Estimarea de bază pentru o clinică stomatologică de 3–7 persoane. Intervalele și ipotezele sunt
   în note."
2. "Pe scurt" (cols 8–12, same row): label "Pe scurt" (`type-label` `fg-3`), then 3 numbered lines
   (number `type-pnum` `fg-3`, text 15 `fg`), from `copy.ts` (§3.8). A 1 px `line-1`
   left border separates it on desktop; on mobile it sits under the lead.
3. Left (cols 1–7): Plan panel. Right (cols 8–12): Impact panel, then "Ce se schimbă" (on a rule).
4. Full width: Offer row, Keep row, "Cum am calculat" notes, footer.

At 1024–1279 the columns become 6/6; under 1024 one column in this order: header, Pe scurt, Plan,
Impact, Ce se schimbă, Offer, Notes. Targets in §5.4.

**Roadmap (replaces `RoadmapTimeline` line 248 and `PhaseItem` line 313), one Panel:**
- Header: title "Patru etape în șase luni" (from the selector: count + span), sub-line "Începem
  cu site-ul. Primele ore câștigate apar din luna 3.", action ghost `sm` "Vezi ca listă" on mobile only.
- **Gantt table (`report/Gantt.tsx`, props `rows`, `months`, `density`):** CSS grid
  `minmax(180px,1fr) repeat(6, minmax(40px, 88px)) 64px 88px` (compact: month columns 32–44 px).
  Header row 12 px DM 500 `fg-3`: "Etapă", "Luna 1", "2" … "6", "Ore / lună", "Cost unic, lei"; 1 px
  `rule` under it. Rows 36 px with `line-1` between, month gridlines `rgb(255 255 255 / .045)`.
  Name cell 14 `fg` (number `type-pnum` `fg-3` before it). Bar 8 px, radius 2: starting phase
  `brand-line`, others white 30%; after the bar a 1 px dashed `fg-4` line runs to the end of month 6
  ("în funcțiune"); an 8 px white diamond marks "site online" at the end of the site phase. Hours and
  cost `type-num` right-aligned ("≈ 35", "8.000"; site hours "–"). **Total row:** 1 px `rule` top,
  "Total" DM 500, middle cell 13 `fg-3` "Apoi cam 1.100 lei pe lună pentru instrumente.", totals
  `type-num` 600 ("≈ 50", "30.500"). Legend line 12 `fg-3`: bar "implementare", dashed "în
  funcțiune", diamond "site online".
- **Phase rows** (under the table, `rule` between table and list, `line-1` between phases): grid
  96 px date column + body. Date `type-pnum` 13 `fg-3` ("Luna 1", "Lunile 2–3"). Body: title
  `type-h4` (same string as the Gantt name) + `Tag start` on the starting phase; meta line 13 px with
  two spans 16 px apart: "cam 35 de ore pe lună" (number `fg-2`, unit `fg-3`) and "≈ 8.000 lei, apoi
  600 lei pe lună"; site phase meta: "≈ 11.500 lei o singură dată" + "aduce solicitări, nu ore";
  2–4 items 14 `fg-2` with a 6×1 px `fg-3` dash marker; tools line 13 `fg-3` "Instrumente: calendar
  de programări, SMS, sincronizare cu Google Calendar" (English tool names mapped with the PDF's
  `localizeTool`); for the site phase one sentence "Ce aduce: pacienții noi te găsesc pe Google și
  pot programa online."
- **Footer:** "Implementare ≈ 30.500 lei în total, din care site-ul ≈ 11.500 lei." + link "Cum am
  calculat" (anchors to the notes).
- **Mobile (< 640):** each Gantt row stacks: name left + hours right on line 1, full-width bar track
  on line 2 (month ticks only in the header), cost as 13 `fg-3` line 3 with units written out
  ("≈ 8.000 lei o singură dată"). Phase rows: date above title.
- **Removed:** glowing number circles, gradient rail, `PHASE_ART` thumbnails (`report/brand-art.ts`),
  duplicated numbers, kicker "BAZELE · LUNA 1", tags, mint checks, the "Ce aduce" accordion, English
  tech chips, per-row info icons.

**Impact panel (`report/ImpactChart.tsx`, rewritten):**
- Header title = the conclusion from the selector: "Se recuperează în luna 14" (or "Nu se recuperează
  în primele 24 de luni"); sub-line "Valoarea orelor câștigate față de cost, cumulat." Action:
  segmented 6 luni / 12 luni / 24 de luni. Default horizon: the smallest one that contains the
  break-even (12 if N ≤ 12, otherwise 24).
- **Plot:** SVG drawn at container width (labels never scale), height 240 (mobile 200), margins
  left 36, right 104 (mobile 76), top 20, bottom 28. Horizontal gridlines 1 px
  `rgb(255 255 255 / .06)` at nice steps (0/20/40/60); y ticks `type-num` 11 `fg-3`; unit "mii lei"
  11 `fg-3` inside the plot top-left; x ticks 6 → 1…6, 12 → 1, 3, 6, 9, 12, 24 → 1, 6, 12, 18, 24,
  first tick written "luna 1", axis title "luna" after the last tick.
- **Series:** value of hours `brand-line` 2 px; cost white 45% 1.5 px. Direct end labels, name only,
  12 px in the line colour: "Valoarea orelor", "Cost" (values live in the KPI strip, so no collision
  logic). No legend, no bands, no min/max shading.
- **Areas:** where cost > value (before the crossing): hatch (SVG `<pattern>` 45°, 1 px lines at
  `rgb(255 255 255 / .14)`, 5 px apart) clipped to the gap polygon, label "Încă nerecuperat" 12 `fg-2`
  at the polygon centroid only if the gap there is ≥ 28 px tall. After the crossing: fill
  `brand-line` at 10%, label "Câștig net ≈ 21.000 lei" 12 `brand-fg` inside the area near the right
  end, only if ≥ 28 px tall.
- **Break-even:** 1 px dashed `fg-3` vertical line at the interpolated crossing x (from
  `report/projection.ts findPayback`), 6 px ring dot (`bg-s1`, 1.5 px `fg` stroke), label "luna 14"
  12 `fg` above the plot. If N > horizon: no line; plain note top-right inside the plot "Se
  recuperează în luna 14, după perioada afișată." 12 `fg-3`.
- **Motion:** no line draw-on; 200 ms opacity on horizon change; none under reduced motion.
- Removes: `SAVINGS #1fa898` / `COST #6c63ff` constants, the 9 `type-tech` uses, the floating
  "RECUPERARE ≈ L7,4" pill, "ECONOMII/COST" mono end labels, "50K" ticks.
- **Table toggle:** link "Vezi cifrele într-un tabel" under the KPI strip. Table (§2.7): Luna |
  Valoarea orelor | Cost | Net | Stare (≥ 640 only: "Implementare" / "În funcțiune" / "Recuperat").
  Months 3, 6, 9, 12, N, 18, 24 within the horizon; values rounded to 1.000; break-even row
  `bg-brand-tint` with "se recuperează" in `brand-fg`. Same numbers as the KPI strip by construction.

**KPI strip (`system/stat.tsx`, replaces `ImpactFigure` line 210), inside the Impact panel under the plot:**
- 4 cells in a grid with 1 px `line-1` dividers (grid on `bg-line-1` with `gap-px`), cell padding
  12 16. Label 13 `fg-3` (the two series labels carry a 10×2 px swatch in their line colour, so the
  strip is the legend). Value `type-figure` + unit 13 `fg-3` inline (non-breaking space) +
  `NoteRef`. Sub-line 12 `fg-3`, wraps, never truncates.
- 24-month example (dental base case, §3.9): Valoarea orelor "63.000 lei"¹ / "cam 2.900 lei pe
  lună, după lansare"; Cost "42.000 lei"² / "19.000 lei la început, apoi instrumente"; Câștig net
  "+21.000 lei" / "la luna 12: −2.000 lei"; Se recuperează "luna 14"¹ / "luna în care valoarea
  depășește costul".
- Mobile: 2×2.

**"Ce se schimbă" stat row (replaces `EstimatedResults` line 521):** not a panel: 1 px `rule` on
top, title `type-h3` "Ce se schimbă" + sub-line "Pentru o clinică cu 3–7 oameni." Three cells split
by 1 px `line-1`: label 13 `fg-3` ("Solicitări noi", "Timp câștigat", "Întrebări preluate"),
statement SG 600 17 (a figure inside it at 22 `type-figure`), support 14 `fg-2`, strategy name 12
`fg-3` at the bottom. The starting cell gets a 2 px `brand-line` top rule instead of the 1 px rule.
"Cam jumătate" carries `Tag dashed` "De confirmat" + note ⁴. Copy in §3.8. No tiles, icons, info icons
or glow. Mobile: definition-list rows (label left 112 px, statement right).

**Offer row (replaces `OfferCard` line 574):** full width between two `line-1` rules, two columns.
Left: label "Abonamentul potrivit pentru acest plan" 13 `fg-3`, title `type-h3` "Pro", the "why"
sentence 15 `fg-2`, 3 en-dash includes. Right: price line "De la 1.000 lei pe lună, plus implementarea
(preț fix după discuție)" (amount `type-pnum` 600), primary `lg` "Programează o discuție", secondary
"Vezi abonamentele". No gradient border, violet shadow, orb, gradient price text or sparkle eyebrow.

**Keep row (`KeepPanel` line 634):** a quiet line "Păstrează planul" + secondary `sm` "Copiază
linkul" (swaps to "Link copiat" with a check for 2 s) + secondary `sm` "Descarcă PDF-ul". No panel.

**Notes, "Cum am calculat" (`system/notes.tsx`):** full width, `rule` on top, title `type-h3`,
numbered list 13 / 1.5 `fg-2`, two columns ≥ 1024, in this fixed order:
¹ payback and its range ("Luna 14 e estimarea de bază. Cu volume cu 20% mai mari, luna 11; cu 20%
mai mici, luna 18."), ² cost scope ("Costul cuprinde implementarea automatizărilor și instrumentele.
Nu cuprinde site-ul nou (≈ 11.500 lei), care aduce pacienți, nu ore, și nici abonamentul Vortex."),
³ value of an hour ("9.709 lei salariul mediu brut (INS, iulie 2026) + 2,25% contribuție, împărțit la
168 de ore = 59 lei pe oră."), ⁴ assumptions ("Cam jumătate din întrebări e o ipoteză de lucru; o
verificăm în prima lună."), then the disclaimer once: "Estimări, nu garanții. Le confirmăm împreună
la prima discuție." `NoteRef` superscripts link here (`id="nota-1"` …).

**Footer:** ghost "Înapoi la strategii" (left). The repeated mono disclaimer and "Construit pe
modelele noastre de lucru…" are removed.

### 2.14 PDF dialog (`scan/LeadGateDialog.tsx`)

- **Shell:** 440 px, `bg-s2`, 1 px `line-2`, radius 12, `shadow-pop`, overlay `--vx-overlay` (no
  blur), opens 180 ms. Remove the gradient hairline (line 192), the blurred orb (line 196), the 44 px
  gradient icon tile, `backdrop-blur`.
- **Header** (padding 20 20 0): title "Raportul complet, în PDF" SG 600 18, left-aligned;
  description 14 `fg-2`, max 2 lines: "Analiza, cele trei direcții, planul pe 6 luni și impactul
  estimat, într-un singur fișier."; close = 28 px ghost `IconButton`.
- **Body** (padding 16 20 20, 16 px gaps): one row "Limba raportului" (13 `fg-2`) + segmented
  Română / English right (no translate icon); fields Nume (opțional) and E-mail, 40 px, side by side
  on ≥ 640, stacked below; consent checkbox with the honest sentence (§3.8) + "Politica de
  confidențialitate" link. Error: checkbox `bad` ring + 13 px `bad` line "Bifează acordul ca să
  descarci raportul." The download stays enabled until the request is in flight.
- **Footer bar:** 1 px `line-1`, padding 12 20: ghost "Anulează" + primary "Descarcă PDF-ul" with
  the download icon; the label follows the chosen language ("Download the PDF"). Loading: spinner +
  "Se generează…", and the existing brand generating animation (`GeneratingArt`, brand media plan)
  shows inline at 160 px wide in the body, no orb, no frame.
- **Mobile (< 640):** bottom sheet with `ui/drawer.tsx`: same content, buttons stacked full width,
  primary on top, safe-area padding.
- **Target:** ≤ 460 px tall at 1440 (was 661).

### 2.15 Homepage below the hero (`src/routes/index.tsx` + `src/components/landing/**`, `src/components/home/**`)

Shared rules: `container-vx` and `section-y` on every section; `SectionHeader` (§2.6); no `Em`,
gradient words, fade-up per section, hover scale, halftone or blur. Sections stay in today's order
minus the removed ones: Work, Services, Process, Consultation, Pricing, Contact.

- **Nav (`landing/LandingNav.tsx`, after the hero engineer hands it over):** height 64 (mobile 56),
  `container-vx` (logo and content share the left edge). Links 14 `fg-2`, active `fg` with
  `aria-current` (no dot). Language: text toggle "RO / EN" (13 px; active `fg`, inactive `fg-3`,
  slash `fg-4`). "Autentificare" 14 `fg-2`. CTA primary `md` "Programează o discuție" (secondary on
  /scan, where the report's download is the primary). Scrolled: `bg-background/92` + 1 px `line-1`
  bottom, no blur. Logo: no hover glow. Mobile sheet: right side, 88vw max 360, `bg-s2`; one link
  list (48 px rows, hairlines, no duplicated Servicii/Contact, no mono "PAGINI"), active = `fg` +
  weight 500; footer: RO / EN, Autentificare, primary `lg` full width.
- **Work (`landing/WorkSection.tsx`, `projects.ts`):** grid 12 cols, gap 24 (mobile 16), spans as
  today. Card = image frame (radius 12, 1 px `line-2`, aspect 16:10, real screenshot, no halftone)
  + caption **below** the image: title `type-h4` 17, line 2 13 `fg-3` category, domain `type-code`
  right-aligned; status `Status ok` "online" or "acces privat" text. Hover/focus: image
  `brightness(1.04)` and title underline; no blur overlay, no scale, no "Vezi" pill; click opens
  ProjectPreview. `projects.ts:50` drops the em dash: the title is the project name, the variant moves
  to the category line. Target ≈ 1.400 px (was 1.869).
- **ProjectPreview (`landing/ProjectPreview.tsx`):** keep the 1.5fr / 1fr structure. Stage chrome:
  URL 12 `type-code` + segmented desktop / mobil + 28 px ghost pause; no traffic lights, no pulsing
  LIVE, no blurred hint pill. Right panel: category 13 `fg-3`, counter "1 din 7" `type-pnum` `fg-3`,
  title `type-h3`, tagline 15 `fg-2`, summary clamped to 4 lines + link "Mai mult", "Ce am
  construit" (`type-label` `fg-3`) + en-dash list, technologies as one comma line 13 `fg-2`. Footer:
  primary `md` "Deschide site-ul" (external icon) + prev/next 36 px secondary `IconButton`s.
- **Services (`landing/ServicesSection.tsx`):** split header (title "Cu ce te putem ajuta"); a
  hairline list (1 px `line-1` between rows, `rule` on top), rows ≈ 88 px: number `type-num` 13
  `fg-3` (48 px column) | title SG 600 20 + description 15 `fg-2` max 60ch | deliverables as one comma
  line 13 `fg-3` (280 px column) | link "Detalii" (no arrow circle). Mobile stacks. No circular stock
  thumbnails, no pill rows, no mono tag strings. Target ≈ 600 px (was 947).
- **Process (`landing/ProcessSection.tsx`, stops using `ui/features-with-panel.tsx`):** 5 columns
  on ≥ 1024, each with a 1 px `rule` on top, number `type-pnum` 13 `fg-3`, title `type-h4`, 2 lines
  14 `fg-2`; vertical list with hairlines on mobile. No photos, autoplay, gradient number circles or
  blur crossfade. Copy folds in the facts the Stats section showed ("în română și engleză"). Target
  ≈ 420 px (was 958).
- **Explorations (`landing/ExplorationsSection.tsx`) and Stats (`landing/StatsSection.tsx`):**
  removed from `routes/index.tsx` (owner decision D1). Optional replacement for Explorations: one
  static row of 3 real UI details from shipped projects (image frames per Work, one factual caption
  each). Saves ≈ 3.160 px desktop.
- **Consultation (`home/ConsultationSection.tsx`, stops using `features-with-panel.tsx`):** split
  header + 3 content cards (§2.7) or 3 hairline rows: title, "Pentru cine" line, facts "45 de minute,
  online" / "Gratuit", link "Programează"; one section-level primary "Programează o discuție". Title
  case fixed ("Evaluarea automatizărilor cu AI"). Target ≈ 520 px (was 840).
- **Pricing (`home/PricingSection.tsx`):** ≥ 1280: 4-column plan sheet on 1 px `line-1` column
  dividers, no card fills. Each column: plan name SG 600 17; price `type-pnum` SG 600 32 + "lei pe
  lună" 14 `fg-3` on the same baseline ("1.000 lei pe lună", free plan "0 lei"); one-line descriptor
  14 `fg-2`; one button (secondary; the recommended plan primary); features 14 / 1.45 en-dash list,
  max 6, rest under "Toate detaliile". Recommended: 2 px `brand-line` top rule and no badge
  (D5). 768–1279: 2×2. Mobile: stacked rows with a "Ce include"
  disclosure, target ≈ 1.100 px (was 2.758). No icon circles, lift, glow, gradient frame, animated
  badge, "BENEFICII" label, check circles. Copy: "lei" not "LEI", "1.000" with the separator.
- **Contact footer (`landing/ContactFooter.tsx`):** two-column contact block: left title `type-h2`
  "Hai să vorbim despre afacerea ta." + one line; right: the e-mail as a large underlined link (SG 500
  24) + secondary "Programează o discuție". Link columns Servicii / Companie / Legal (14 px, 8 px row
  gap). Legal line "Vortex Hub, CUI 54747928" (12 `fg-3`). Bottom bar: `Status ok` "Acceptăm
  proiecte noi" (static), RO / EN, 28 px ghost pause. Remove the marquee and the ping dot. Brand
  sign-off video: 240 px wide or dropped (D2). Target ≤ 640 px (was 1.223).
- **Height target below the hero at 1440×900:** ≤ 5.500 px (was ≈ 10.200).

### 2.16 Other pages (Phase 7)

`components/shared/{SectionHeading,ServiceCard,CtaBand,PageHero,CompanyDetails}.tsx` and
`components/layout/{SiteHeader,SiteFooter,LanguageToggle}.tsx` adopt the same primitives (they serve
services, websites, ai-automation, consultancy, digital-products, portfolio, contact, legal pages).
`routes/portfolio.tsx` drops its uppercase/tracking. Legacy `components/home/{HeroStage,TrustMarquee,
FinalCTA,HeroProofRow,PortfolioPreview,AISpotlight,AudienceSection,ServicesIntro,ProcessSteps,
TrustSection,VortexScene,VortexStage}.tsx`: delete the ones no route imports (verify with grep).
Dashboard pages inherit the restyled `ui/*` base only.

---

## 3. Content and numbers policy

### 3.1 One number per metric, computed once

New `src/lib/scan/blueprint/display.ts` (engineer C) is the **only** place that turns a blueprint into
displayed figures. The web steps, the strategy cards, the chart, the table, the KPI strip, "Pe scurt"
and the PDF all read it, so text and numbers cannot drift.

```ts
export type DisplayPhase = {
  key: PhaseKey; months: [number, number];
  title: Bilingual;              // one name for Gantt, phase row, strategy card, PDF
  hoursPerMonth: number | null;  // null = brings enquiries, not hours (site)
  setupLei: number; toolsLeiPerMonth: number;
  items: Bilingual[]; tools: Bilingual[];
  start?: { reason: Bilingual }; // only on the starting phase
};
export type DisplayPlan = {
  phases: DisplayPhase[];
  totals: { hoursPerMonth: number; setupLei: number; siteLei: number | null; toolsLeiPerMonth: number };
  series: { month: number; value: number; cost: number; net: number }[]; // rounded to 1.000, net = value − cost
  breakEven: { month: number | null; higherVolume: number | null; lowerVolume: number | null; x: number | null };
  strategies: { id: string; result: Bilingual; assumption?: Bilingual; facts: { label: Bilingual; value: Bilingual }[] }[];
  summary: [Bilingual, Bilingual, Bilingual]; // "Pe scurt"
  notes: { payback: Bilingual; scope: Bilingual; hourValue: Bilingual; assumptions: Bilingual[] };
};
export function displayPlan(blueprint: Blueprint): DisplayPlan;
```

### 3.2 Rounding and format (`src/lib/scan/blueprint/format.ts`, shared by web and PDF)

| Quantity | Step | Example RO / EN |
|---|---|---|
| Hours per month | 5 (a value shown alone under 10: whole number) | "cam 35 de ore pe lună" / "about 35 hours a month" |
| Money per month | 100 | "cam 2.900 lei pe lună" / "about 2,900 RON a month" |
| One-off cost | 500 | "≈ 8.000 lei" / "≈ 8,000 RON" |
| Cumulative / yearly money | 1.000 | "63.000 lei" / "63,000 RON" |
| Months | whole | "luna 14" / "month 14" |
| Percentages | whole, and only measured ones | |

- **Groups add up.** `roundGroup(values, step)`: the total is the rounded raw sum; rows are floored to
  the step and the remaining steps go to the largest remainders. Rows and total therefore always add
  up, and every surface shows the same row value (the strategy card reads the row, never re-rounds).
- **Net is derived:** displayed net = displayed value − displayed cost, at every horizon.
- RO units: always "lei" (never RON, LEI, €), "ore" (never "h"), "luna 14" (never "L14"), "mii lei"
  on axes (never "50K"). "de" from 20 up ("36 de luni", "35 de ore"); fix `formatMonthsRange` in
  `report/format.ts` with `roNeedsDe`. EN uses RON.
- Non-breaking space between number and unit; en dash without spaces in ranges ("3–7"); real minus
  "−"; "≈" or "cam" in front of estimates (not both); "…" character.
- No count-up animation on any estimate (`AnimatedNumber`/`AnimatedRange` removed from estimates).
- `report/format.ts` and `pdf/format.ts` re-export these helpers instead of keeping their own.

### 3.3 Ranges and assumptions

- Tiles, KPIs and titles show the base estimate only. The range lives in note ¹ or a
  "Cât de sigur e?" line, expressed as scenarios: volumes ±20% (reuse `simulate.ts simulateBlueprint`
  with `volumeFactor` 0.8 / 1.2), **cost fixed at our central quote** (a range on our own price reads
  as hedging). If a scenario ratio high/low exceeds 2, write "de confirmat la discuție" instead.
- Assumptions are sentences, not big numerals: the hard-coded `{10, 25}` uplift
  (`strategies.ts:65 growthGaps`) and `params.routineShare` (`strategies.ts:262`) never render as
  percentages. Acquire shows "Un site cu programare online" (no site) or "3 lipsuri care te costă
  solicitări: …" (measured count); assist shows "Cam jumătate din întrebări" + "De confirmat".
- Customer-facing automations whose central payback is over 24 months say "Se justifică prin pacienți
  câștigați, nu prin timpul economisit" and are not featured on payback.
- Value vs cash: "Valoarea orelor câștigate", never "Economisit".
- The "92% încredere" classification score never renders.

### 3.4 The payback fix (where the range comes from and how to make it credible)

**Today:** the tile "Recuperare 3,4–36 luni" reads `blueprint.totals.paybackMonths`
(`ResultsStep.tsx:158`, `StrategyStep.tsx:526`, PDF `pages-intro.tsx:418`, `pages-plan.tsx:1244`),
computed by `paybackMonths()` in `src/lib/scan/blueprint/economics.ts:244` and called from
`computeTotals()` (`economics.ts:412–423`). It pairs the extreme corners: low = setup.low ÷
(savings.high − tools.low) = 12.600 ÷ (4.200 − 540) = 3,4; high = setup.high ÷ (savings.low −
tools.high) = 94 months, clamped to `PAYBACK_CAP_MONTHS = 36` (`economics.ts:80`). So "36" is the cap,
not a result, and the tile contradicts the chart beside it, which already uses the honest crossing
(`report/projection.ts findPayback`, midpoints of `computeProjection`, `economics.ts:438`).

**Fix (engineer C, Phase 2):**
1. In `economics.ts`, add a central value to every estimate: `rawHours` returns `mid` = count ×
   mid(minutes) × mid(automatable) ÷ 60 (product of driver midpoints, not the midpoint of the corner
   product); propagate `mid` through `monthlySavingsRon`, `setupCostRon` (central price-book quote),
   `monthlyToolCostRon`, and the projection's cumulative series. Type: `Range & { mid?: number }`
   so stored blueprints stay valid (`midOf(r) = r.mid ?? (r.low + r.high) / 2`).
2. Add `breakEvenMonth(series)` next to `computeProjection`: the **first plan month whose
   cumulative central value ≥ cumulative central cost** (months where both are 0 are skipped);
   `null` if none within 24. Keep `findPayback`'s interpolated x for drawing the chart line only.
   Store as `totals.breakEven = { month, higherVolume, lowerVolume }` (optional field), where the
   scenarios re-run the projection at `volumeFactor` 1.2 / 0.8 with cost at central.
3. Stop displaying `paybackMonths` anywhere (web, PDF, per-automation payback on the web). Keep the
   function only for `recommend()`'s internal ranking until it is switched to central values
   (`typicalPayback` already uses midpoints), then delete `PAYBACK_CAP_MONTHS` from display code.
4. Display: "Se recuperează în luna N" (title, KPI, "Pe scurt", PDF). Over 24: "Nu se recuperează în
   primele 24 de luni" and the item is not featured on payback. Never print the cap.
5. **The base case today is luna 14, not 13.** The engine's interpolated crossing is 13,1; at the end
   of month 13 the value is still below the cost, so the first month-end in profit is 14. The design
   sheets used 13 for illustration; implement the rule, never a hard-coded month. Scenarios (±20%
   volume, cost central): luna 11 / luna 18.

### 3.5 Honest scope

- The chart's cost covers what the projection schedules: automations and their tools. It excludes the
  new site and Google profile (≈ 11.500 lei, month 1) and the Vortex subscription; note ² and the Cost
  KPI sub-line say so in one visible line. Including the site moves central break-even to ≈ luna 19
  (owner decision D3).
- `offer.ts:51 PRO_FROM_RON = 20000` picks Pro because the acquire one-off can reach 25.000 lei. With
  the site plus Pro (1.000 lei/month), the base case never breaks even within 24 months. Change
  (D4): choose the tier from the scope of automations and channels, not the one-off; add a check that
  central monthly value − tools − plan fee > 0, otherwise step down a tier or show "abonamentul se
  stabilește la discuție".
- `offer.ts priceNote`: "De la 1.000 lei pe lună, plus implementarea (preț fix după discuție)" with
  thousands grouping.

### 3.6 Groupings aligned (one set of work per name)

Today the "Automatizează recepția" strategy (reminders, booking, recall: 21–46 h) and the roadmap's
"Automatizare" phase (reminders, booking, CRM: 19–45 h) group different automations under the same
word, and the headline says a third figure (51 h). Fix in `roadmap.ts phaseOf()` (line 68): derive
the phase from `strategyOf(id)` (automate → automation, assist → assistant, acquire → growth), keeping
the template `phase` only as an explicit override. Then each phase equals its strategy and the same
row value appears on the strategy card, the Gantt and the phase row. Drop `tag` from `PHASES`
(`roadmap.ts:21–54`) and from `RoadmapPhase` (`types.ts`) once Phase 3 stops reading it; add a short
title per phase built from its items (playbook `short` names):

| Phase | Months | Title RO | Title EN |
|---|---|---|---|
| foundation | 1 | Site nou și profil Google | New website and Google profile |
| automation | 2–3 | Programări și reamintiri automate | Automatic booking and reminders |
| assistant | 3–4 | Asistent pe site și WhatsApp | Website and WhatsApp assistant |
| growth | 4–6 | Recenzii și evidența solicitărilor | Reviews and one list of enquiries |

### 3.7 Vocabulary and glossary (update `src/lib/scan/blueprint/GLOSSARY.md`)

| Concept | Use | Not |
|---|---|---|
| tools | instrumente | aplicații |
| hours | ore câștigate | ore economisite, timp câștigat (as label) |
| money value | valoarea orelor câștigate | economisit, economii (for time value) |
| payback | Se recuperează în luna N | Recuperare, Recuperarea investiției, Pragul de rentabilitate |
| currency | lei (EN: RON) | RON, LEI, € |
| deliverables | raport (PDF), plan pe luni (roadmap), abonament (subscription) | blueprint, plan digital |
| severity | Prioritate mare / medie / mică | Ridicat, Prioritar |
| score tiers | Bun / Acceptabil / Slab | Bine, Mediu, Solid |
| e-mail | e-mail | email, emailul |
| customers | `type.customers` (pacienți for dental) | client in universal templates |
| first phase | from the engine (regenerate the fixture) | Fundație vs Bazele |

### 3.8 Copy rewrites (RO is the source; EN in brackets)

| Where | Now | New |
|---|---|---|
| Search group | ÎNCEARCĂ UN EXEMPLU | Exemple (Examples); Firme (Companies); Analiză directă (Direct scan) |
| Search hints | O afacere și orașul ei / Orice site / Un cod fiscal (CUI) | caută în ONRC / analiză de site / date ANAF (search the trade register / website check / ANAF record) |
| Search footer | ↑↓ NAVIGHEAZĂ ↵ ALEGE ESC ÎNCHIDE | Firme din datele deschise ONRC și ANAF; typed: Nu e aici? Scrie CUI-ul sau adresa site-ului. |
| Find step | | Analizează o afacere / Scrie numele firmei, CUI-ul sau adresa site-ului. |
| Analyse lead | colectează și analizează date publice pentru a înțelege… | Citim datele firmei de la ANAF, verificăm site-ul și căutăm firme asemănătoare din zonă. (We read the company record from ANAF, check the website and look for similar local businesses.) |
| Overview | Iată ce am descoperit despre afacerea ta. | Ce am găsit despre {Nume} / Date publice, nimic estimat. |
| Strategy | cele mai eficiente strategii pentru afacerea ta | Trei direcții, fiecare cu cost și câștig / Le poți face pe rând sau împreună. |
| Results | Planul tău personalizat… cele mai bune rezultate | Planul pe 6 luni: ce facem și cât costă |
| Pe scurt 1 (start reason, from `recommend()`) | | Începem cu un site cu programare online. Fără el, restul nu are unde să ducă pacienții. |
| Pe scurt 2 | | Automatizările câștigă cam 50 de ore pe lună, mai ales la programări. |
| Pe scurt 3 | | Investiția în automatizări se recuperează în luna 14, cu estimarea de bază.¹ |
| Start reasons (`recommend()` returns a reason key) | Recomandat | no site / health < 45: "Aici am începe: fără un site care funcționează, celelalte nu au unde să ducă oamenii."; automate: "…timpul câștigat o plătește în cam {n} luni."; assist: "…preia cele mai multe întrebări repetitive și se plătește în cam {n} luni."; fallback: "…cel mai bun raport între cost și timp câștigat." |
| Headline (`copy.ts`) | poate economisi aproximativ 51 de ore pe lună | {Nume} poate câștiga cam 50 de ore pe lună. |
| KPI tiles | Economisit până în luna 12 · 16.340–37.350 RON / Cheltuit… / Recuperare 3,4–36 luni | Valoarea orelor 27.000 lei / Cost 29.000 lei / Câștig net −2.000 lei / Se recuperează luna 14 (12-month view) |
| Rezultate estimate | 10–25% mai multe solicitări / 21–46 h ore economisite / 40–60% din întrebări… | Solicitări noi: Un site cu programare online (Azi pacienții noi nu te pot găsi sau programa online.) / Timp câștigat: cam 35 de ore pe lună (luate de pe recepție: programări, confirmări, reamintiri) / Întrebări preluate: Cam jumătate (prețuri, program, locație primesc răspuns fără să intervină cineva) |
| Phase "Ce aduce" | Ce aduce · 19–45 ore economisite pe lună | meta line: cam 35 de ore pe lună |
| Simulation | Volumul de lucru ×1, ×0,5 MAI PUȚIN | Cât de aglomerați sunteți: tipic (100%); jumătate / dublu |
| Team-size note | ajustată în funcție de fără site, deci probabil mai mică | 3–7 persoane; am redus puțin estimarea pentru că firma nu are site. |
| Hourly basis | 70-word popover | inline note ³ |
| Offer | De la 1000 LEI / lună + implementare unică | De la 1.000 lei pe lună, plus implementarea (preț fix după discuție) |
| Lead dialog | Descarcă planul digital / …ca să îmi trimită planul… / …ca să putem trimite și păstra planul | Raportul complet, în PDF / Vortex Hub poate păstra numele, e-mailul și rezumatul scanării și mă poate contacta despre acest plan. / Bifează acordul ca să descarci raportul. (No e-mail is sent: `saveScanLead` only stores a row.) |
| Disclaimer | ESTIMĂRI, NU GARANȚII + DISCLAIMER "Estimări, nu garanții." | once, in the notes |
| Evidence strings | LCP 4.6 S (LIGHTHOUSE, MOBILE) | 4,6 s (Lighthouse, mobil). Ținta e sub 2,5 s. (`localizeEvidence` on the web too) |
| ANAF names | Timiş, Revoluţiei | Timiș, Revoluției (comma-below helper `pdf/format.ts:139 withCommaBelow`, moved to `src/lib/scan/localize.ts`) |
| Demo fixture | Generare de recenzii; Fundație | Cereri de recenzii după vizită; regenerate `fixtures/sample-blueprint.ts` from the engine |
| PDF cover | Plan digital personalizat | Analiză și plan pe 6 luni pentru {Nume} |
| PDF projection | Estimarea medie se recuperează după luna 24 | Cu estimarea de bază, investiția nu se recuperează în primele 24 de luni. |
| PDF net row | −23.870 până la +19.700 | ≈ −2.000 lei la luna 12, ≈ +21.000 lei la luna 24 |
| PDF FTE | Cam 0,2–0,4 dintr-un post cu normă întreagă | cam o treime dintr-o normă întreagă |
| PDF back cover | Construit cu AI · Pentru rezultate reale | removed; contact line instead |
| Homepage services | Patru moduri de a merge înainte | Cu ce te putem ajuta |
| Homepage contact | Transformă următoarea idee în progres. | Hai să vorbim despre afacerea ta. |
| Pricing | Pentru cei care construiesc avânt; LEI; 1000 | one plain line on who the plan is for; lei; 1.000 |
| Consultation | Evaluare Automatizare AI | Evaluarea automatizărilor cu AI |
| Work card | Bridge Gateway Consulting — Site corporativ | Bridge Gateway Consulting (category line: Site corporativ) |

Em dashes: none in UI strings (the only one, the empty-value placeholder in competitor stats, becomes
"fără date"). Middle-dot meta strings ("BAZELE · LUNA 1", "4 etape · 6 luni") become sentences or
columns.

### 3.9 Base case reference (dental clinic, no site, no Google profile; engine run 2026-10-03)

Use these to check the build; the UI must render whatever `displayPlan` returns.

| Figure | Raw (range midpoints, today's engine) | Displayed |
|---|---|---|
| Hours per month | 51,3 (49,1 with driver midpoints) | cam 50 de ore pe lună |
| Per strategy/phase hours | automate 33,5 · assist 6,7 · acquire 11,2 | 35 · 5 · 10 (group-rounded to 50) |
| Setup (automations) | 19.050 | 19.000 lei (8.000 + 4.500 + 6.500) |
| Site + Google profile | 6.500–16.500 | ≈ 11.500 lei; plan total 30.500 lei |
| Tools per month | 1.060 | cam 1.100 lei pe lună (600 + 200 + 300, group-rounded) |
| Month 6 value / cost / net | 8.695 / 22.570 | 9.000 / 23.000 / −14.000 lei |
| Month 12 | 26.845 / 28.930 | 27.000 / 29.000 / −2.000 lei |
| Month 24 | 63.145 / 41.650 | 63.000 / 42.000 / +21.000 lei |
| Break-even (first month-end in profit) | interpolated 13,1 | luna 14 |
| Volume +20% / −20% (cost central) | | luna 11 / luna 18 |
| Including the site | interpolated 18,9 | luna 19 (D3) |
| Hourly value | 9.709 × 1,0225 ÷ 168 | 59 lei pe oră |

Probe: `scratchpad/ui-refresh/plan/probe-plan.ts` (run from the repo with
`./node_modules/.bin/tsx --tsconfig tsconfig.json <file>`).

---

## 4. Imagery policy

- **Allowed:** (1) real screenshots of shipped Vortex projects (`projects.ts`), in plain image frames;
  (2) the analysed company's own first-screen screenshot from Lighthouse (`types.ts:187`), labelled as
  theirs; (3) brand assets from the brand media plan (ASCII vortex, swirl, wordmark, intro and
  generating animations) in their assigned places; (4) data drawings made from the data: Gantt bars,
  the impact chart, the priority glyph, status squares.
- **Removed:** `PHASE_ART` in `scan/report/brand-art.ts` (stock "AI network" art, including the mock
  with garbled AI text) and the roadmap thumbnails; the swirl + glowing monogram on the company card
  (`SWIRL_ART` fallback: show no image instead); Unsplash stock in `features-with-panel.tsx` (process,
  consultation); circular service thumbnails; all Explorations imagery; halftone overlays; the blurred
  orbs and halos on /scan.
- **Rules:** no image that does not show the actual product, the client's own site or the brand
  asset itself; no colour grading or violet soft-light overlays on screenshots; radius 12 for large
  frames, 6–8 for thumbnails; `alt` text says what the screenshot is ("Prima pagină a site-ului
  dentalsmile.ro").
- **The icons that stay:** functional only (download, copy, edit, close, external link, chevron,
  spinner, check in the step bar). No icon-in-tile, icon-in-circle or decorative icon before a label.

---

## 5. Implementation phases

Engineers: **A** = system and homepage, **B** = scan UI (B1 results/strategy/dialog, B2
overview/analyse/shell; B2 can be A after Phase 1 or a third engineer), **C** = numbers, copy and
PDF. **H** = the hero engineer (owns `HeroSection`, `HeroCosmos`, `VortexSearch`, `LoadingScreen`,
`LandingNav` until handover, `routes/__root.tsx`). **P** = the PDF engineer currently in `pdf/**`.

| # | Phase | Owner | Days | Depends on | Ships on its own as |
|---|---|---|---|---|---|
| 0 | Prep: land or rebase the in-flight hero/ASCII/PDF/homepage edits (22 modified files today); owner decisions D1–D8; baseline screenshots at the 5 viewports | lead + H + P | 0.5 | – | nothing visible |
| 1 | Tokens and primitives: §1.2–1.3 in `styles.css`, `src/components/system/*`, `ui/*` restyle, shims for `buttons.ts`, `GlassCard.tsx`, `SegmentedControl.tsx`, `Tag.tsx`, `RingButton.tsx` | A (+ H one-line eyebrow swap first) | 2 | 0 | Site-wide: no tracked caps, de-rounded panels (12 px), new buttons via shims |
| 2 | Numbers, copy, vocabulary: `display.ts`, `economics.ts` mid + `breakEven`, `roadmap.ts` alignment and titles, `strategies.ts` qualitative outcomes + reason keys, `offer.ts`, `copy.ts` headline + summary, shared `format.ts` and `src/lib/scan/localize.ts`, fixture regeneration, `GLOSSARY.md` | C | 2.5 | 0 (parallel with 1) | Engine and data only; current UI keeps working (deprecated `tag` and `paybackMonths` still populated) |
| 3a | Scan results + strategy + dialog: `ResultsStep.tsx`, new `report/Gantt.tsx`, `ImpactChart.tsx`, `StrategyStep.tsx`, `BrandSlider.tsx`, `LeadGateDialog.tsx`, delete `Sparkline.tsx`, `brand-art.ts PHASE_ART` | B1 | 3 | 1, 2 | Steps 3 (strategy view) and 4 + dialog in the new language with honest numbers |
| 3b | Scan shell + overview + analyse: `ScanShell.tsx`, `ScanStepper.tsx`, `report/StepHeader.tsx`, `routes/scan.tsx` (FindStage only), `OverviewStep.tsx` split, `ScoreRing.tsx`, `MetricBar.tsx`, `PresenceTile.tsx`, `journey.ts`, `tiers.ts`, `AnalyseStep.tsx`, `globe/ScanGlobe.tsx` | B2 | 2.5 | 1 (2 for evidence/localize) | Steps 1–3 (overview) in the new language |
| 4 | Homepage below the hero: `SectionHeader.tsx`, `WorkSection.tsx`, `projects.ts`, `ProjectPreview.tsx`, `ServicesSection.tsx`, `ProcessSection.tsx`, `home/ConsultationSection.tsx`, `home/PricingSection.tsx`, `ContactFooter.tsx`, `routes/index.tsx` (section list), then `LandingNav.tsx` after H hands over | A | 3.5 | 1, D1/D2/D5 | Homepage ≈ half as long, one button system |
| 5 | Search dropdown: `VortexSearch.tsx` dropdown part + `VortexSearch.module.css` | H | 1 | 1 | Hero and /scan search menu |
| 6 | PDF carry-over (§6): `src/components/scan/pdf/**` reading `display.ts` | P (or C) | 2 | 2, P's current work landed | PDF matches the screen |
| 7 | Secondary pages, cleanup, QA: §2.16; delete shims (`Tag.tsx`, `GlassCard.tsx`, `RingButton.tsx`, `InfoTip.tsx`, `features-with-panel.tsx`, `AnimatedNumber` for estimates), delete `type-tech`, retired utilities, deprecated `tag`/`paybackMonths` display, hard-coded hex; JetBrains Mono 400 only; run §5.4 | A + B + C | 2 | 3–6 | Grep gates green; acceptance shots signed off |

**Total ≈ 19 engineer-days; ≈ 8 working days on the calendar with A, B, C in parallel**
(day 1–2: phases 1 + 2; days 3–5: 3a + 3b + 4 start; days 5–6: 4 + 5 + 6; days 7–8: 7).

### 5.1 File ownership (no two engineers touch the same file in the same phase)

| Files | Owner | Phase |
|---|---|---|
| `src/styles.css`, `src/components/system/**`, `src/components/ui/**` | A | 1, 7 |
| `scan/report/{buttons.ts,GlassCard.tsx,SegmentedControl.tsx,Tag.tsx}` (shims) | A | 1, 7 |
| `src/lib/scan/blueprint/**`, `src/lib/scan/types.ts`, `src/lib/scan/localize.ts` (new), `src/lib/scan/fixtures/**`, `scan/report/{format.ts,projection.ts}` | C | 2 |
| `scan/steps/{ResultsStep,StrategyStep}.tsx`, `scan/report/{ImpactChart,Gantt,BrandSlider,Sparkline,brand-art,AnimatedNumber}.*`, `scan/LeadGateDialog.tsx` | B1 | 3a |
| `scan/{ScanShell,ScanStepper}.tsx`, `scan/report/{StepHeader,ScoreRing,MetricBar,PresenceTile,InfoTip,journey,tiers}.*`, `scan/steps/{OverviewStep,AnalyseStep}.tsx`, `scan/steps/overview/**` (new), `scan/globe/**`, `routes/scan.tsx` (FindStage) | B2 | 3b |
| `landing/{SectionHeader,WorkSection,projects,ProjectPreview,ServicesSection,ProcessSection,ExplorationsSection,StatsSection,ContactFooter,RingButton}.*`, `home/{ConsultationSection,PricingSection}.tsx`, `ui/features-with-panel.tsx`, `routes/index.tsx` | A | 4 |
| `landing/LandingNav.tsx` | H → A after handover | 4 |
| `landing/{HeroSection,HeroCosmos,HeroProof,VortexSearch,LoadingScreen}.*`, `landing/ascii/**`, `landing/hero/**`, `routes/__root.tsx` | H | 1 (eyebrow), 5, 7 (font weights) |
| `scan/pdf/**` | P | 6 |
| `components/shared/**`, `components/layout/**`, `routes/portfolio.tsx`, legacy `components/home/*` | A | 7 |

Interfaces agreed on day 1 so B1 can start before C finishes: the `DisplayPlan` type (§3.1) and the
`system/*` component props (§2.0). B1 builds against a fixture of `DisplayPlan`.

### 5.2 Owner decisions (Phase 0)

| # | Decision | Recommendation |
|---|---|---|
| D1 | Remove Explorations and Stats from the homepage | Yes (≈ 3.160 px, pure decoration and vanity numbers) |
| D2 | Brand sign-off video in the footer | Keep at 240 px wide, plays once |
| D3 | Include the new site in the chart's cost (break-even ≈ luna 19 instead of 14) | No, but state the exclusion visibly (note ² + KPI sub-line) |
| D4 | Offer tier picked from scope, with a "fee must not cancel the payback" check | Yes |
| D5 | Plan names (Starter / Growth / Pro) and the recommended-plan label | Keep the names, sentence case. The recommended column gets only the 2 px rule: no badge, no "Recomandat" (banned) |
| D6 | Hero placeholder "Firmă sau site" vs today's text | Hero engineer and owner; out of this plan's scope |
| D7 | Globe on the analyse step | Keep, restyled (§2.10) |
| D8 | Consent required to download the PDF (GDPR "freely given") | Legal check; the copy is honest either way |

### 5.3 Effort risks

- `type-label` redefinition changes 44 places at once: strings authored in capitals ("LIVE",
  "CAEN") must be rewritten in the same PR (grep the `type-label` lines).
- `type-body` 16 → 15 px affects legal and dashboard pages; check `/privacy` and `/dashboard` at 390.
- The working tree has uncommitted edits in 22 files by other engineers; Phase 0 must land them or
  Phase 1/4 will conflict.
- Changing `Blueprint` types: add fields as optional; shared scan links must still render.

### 5.4 Acceptance checklist

Capture with headless Chrome at deviceScaleFactor 2 (sessionStorage `vortex-intro-seen=1`, cookie
banner "Respinge neesențiale"), RO and EN, and **look at every shot**.

**Viewports:** 1920×1080, 1440×900, 1280×720, 768×1024, 390×844.

**States:** `/` (every section; nav scrolled; mobile menu; ProjectPreview), `/scan` find (empty,
dropdown, typed "clinica", no-match), `?demo=analyse` (running, done, error), `?demo=1` (4 tabs, Edit
dialog), `?demo=strategy` (Comparație, Plan pe luni, simulation moved), `?demo=results` (6 / 12 / 24,
table open, copy link), lead gate (default, consent error, loading; bottom sheet at 390), generated
PDF (RO and EN).

**Layout and density**

- [ ] No horizontal scroll at any viewport (`scrollWidth ≤ innerWidth`).
- [ ] Nav logo and content left edges align within 1 px at 1440 and 1920.
- [ ] Results at 1440×900: "Pe scurt" visible; Plan table header top ≤ 400 px; KPI strip fully in
      the first viewport at 1920×1080 and 1440×900.
- [ ] Results at 1280×720: Plan table header top ≤ 420 px. At 768×1024: "Pe scurt" and the Gantt
      header in the first viewport. At 390×844: first "Pe scurt" line ≤ 400 px, Gantt header ≤ 844 px.
- [ ] At ≥ 1280 the two results columns end within 120 px of each other; Overview has no empty column
      area taller than 120 px.
- [ ] Every step header ≤ 110 px (desktop) / 140 px (mobile); no duplicated step label on mobile.
- [ ] Homepage below the hero ≤ 5.500 px at 1440×900 and ≤ 8.000 px at 390×844; section gaps 96–128 px
      at desktop.
- [ ] PDF dialog ≤ 460 px tall at 1440×900; at 390×844 the sheet's primary button is visible without
      scrolling the sheet.
- [ ] Search menu rows 36 px (44 under 768); no keyboard hints on touch; company rows show city and CUI.
- [ ] Components checked over the ASCII backdrop on /scan: no glyph shows through any panel, menu or
      dialog; text over the bare backdrop (step header, "Pe scurt") stays ≥ 4.5:1.

**Grep gates** (zero matches in `src/components/{scan,landing,home,system,shared,layout}` and
`src/routes`, allowlist noted):

- [ ] `type-tech`, `tracking-\[0\.`, `tracking-widest`, `tracking-wider`
- [ ] `\buppercase\b` and `type-caps` (allow: the hero eyebrow only)
- [ ] `backdrop-blur`, `blur-2xl`, `blur-3xl`, `shadow-\[0_0_`, `drop-shadow-\[`
- [ ] `text-gradient`, `gradient-travel`, `accent-gradient`, `glow-soft`, `glow-teal`, `glass-panel`,
      `bento-panel`, `halftone`, `animate-ping`, `animate-pulse-dot`, `flow-orb`, `bg-aurora`
- [ ] `rounded-2xl`, `rounded-3xl`; `rounded-full` only on lines carrying a `/* dot */` comment
- [ ] `hover:scale`, `active:scale`, `<InfoTip`, `PHASE_ART`, `<Sparkline`, `AnimatedRange`
- [ ] hard-coded `#5b52f0|#6c63ff|#5b8cf0|#89cbf6|#5fe3d0|#1fa898|#c4b5fd|#67e8f9|#070a1c|#070a1f|#04061a`

**Copy gates** (rendered RO page text of every state above):

- [ ] none of: RON, LEI, €, "50K", `L\d+`, " h " as a unit, Esențial, Impact mare, Recomandat,
      Oportunitate, Prioritar, Potențial ridicat, Economisit, Pragul de rentabilitate, aplicații
- [ ] no cedilla letters ş ţ Ş Ţ; no em dash; no middle-dot meta strings; no English words in RO
      screens (evidence, tool names, tooltips)

**Numbers gates** (dental fixture and one live scan):

- [ ] For 6 / 12 / 24: KPI value, cost and net equal the table row of that month; net = value − cost.
- [ ] Payback month is the same in the chart title, the KPI, "Pe scurt", the table highlight, note ¹
      and the PDF; it equals the first month-end where cumulative value ≥ cost.
- [ ] Gantt rows add up to the Total; the headline hours, "Pe scurt" hours and Total hours match; each
      strategy card's figure equals its Gantt row.
- [ ] Phase titles are identical in the Gantt, phase rows, strategy cards and PDF.
- [ ] No percentage renders that the scan did not measure.

**Accessibility and motion**

- [ ] `fg-3` on `s1` and on the background ≥ 4.5:1; focus ring visible on every control.
- [ ] Segmented controls keep radio semantics and arrow keys; search keeps combobox/listbox roles and
      `aria-activedescendant`; tabs keep tab roles; the chart has a text summary and the table toggle.
- [ ] `prefers-reduced-motion`: no animation except instant state changes; pause switch stops the
      ASCII backdrop and the generating animation.

---

## 6. The PDF (`src/components/scan/pdf/**`, Phase 6)

The PDF keeps its own structure (night cover/offer/back pages, light working pages for print; see
`theme.ts`). What carries over:

- **Numbers:** every figure from `display.ts` (§3.1–3.4). One payback definition, "Se recuperează în
  luna N"; delete the second concept ("Pragul de rentabilitate", `pages-plan.tsx:897/946/1575`) and the
  corner-pairing net row; replace per-automation payback bars (`pages-findings.tsx:1583–1635`) with
  hours and central cost, featuring payback only when ≤ 24 months.
- **Labels:** sentence case, 0 tracking. `theme.ts` `text.eyebrow` (uppercase, letterSpacing 1.5) and
  the `letterSpacing` 0.4–2.4 overrides in `layout.tsx`, `charts.tsx`, `pages-*.tsx` go to 0 and no
  transform.
- **Markers:** status squares and the three-bar priority glyph drawn with react-pdf `View`s; no pill
  tags; at most one marker per block; same vocabulary (§2.2, §3.7).
- **Plan page:** the same Gantt (hours and cost columns, Total row, start bar in violet, others ink
  30%, dashed "în funcțiune" tail) and phase rows with the date column and identical titles.
- **Impact page:** conclusion title, direct end labels, hatch for "Încă nerecuperat" (react-pdf SVG has
  no `<pattern>`: draw diagonal `Line`s inside a `ClipPath` of the gap polygon), net area tint, dashed
  break-even line; remove the min–max bands. KPI row as plain figures with notes.
- **Colour:** one accent (violet) for the value series, the start phase and the primary link; status
  colours only in squares; no gradients, no mint as decoration.
- **Type:** Space Grotesk for figures (react-pdf ignores OpenType features, so right-align numeric
  columns rather than relying on tabular figures; add `SpaceGrotesk-SemiBold.ttf` to `public/fonts` or
  use 700), DM Sans for text, no mono.
- **Radii and surfaces:** 4 / 8 max, hairlines instead of boxed cards, no shadows.
- **Copy:** §3.8 PDF rows (cover title, projection sentence, net row, FTE, "instrumente", no "Construit
  cu AI" tagline; contact line on the back cover).
- **Notes:** the same four notes in the same order on the method page; no icon callouts.

---

## Appendix: screenshots

Under `/private/tmp/claude-501/-Users-dandeamihai-Desktop/98201317-c5fd-4bed-b3dd-e616a5f40dda/scratchpad/ui-refresh/final/`:

| File | Shows | Note |
|---|---|---|
| `precision-01-search-menu.png` | search menu, empty and typed, over the ASCII backdrop | drop the row icons and the mobile "Analizează" change |
| `precision-02-tags-and-small-buttons.png` | marker set, small buttons, filter chips | replace dots and tint tags with squares (graft 03) |
| `precision-03-roadmap-gantt-phase-rows.png` | Gantt + phase rows | add cost column + Total (graft 02); unify names |
| `precision-04-impact-24-luni.png` | chart, KPI strip as legend, notes | replace the band with hatch + net label (graft 02, 05) |
| `precision-05-impact-6-luni-out-of-window-note.png` | out-of-window note | keep |
| `precision-06-ce-se-schimba.png` | stat row | no panel; rule on top; "De confirmat" on the third cell |
| `precision-07-pdf-dialog.png` | dialog default + consent error | add side-by-side fields on desktop, bottom sheet on mobile |
| `precision-08-results-composed-1280.png` | results composition | add the step bar + "Pe scurt" header (graft 01) |
| `precision-09-foundation-buttons-cards-inputs.png` | buttons, content cards, list rows, inputs, segmented | base for §2.3–2.7 |
| `precision-10-mobile-390-plan.png` | mobile plan | base for mobile Gantt |
| `graft-editorial-01-step-bar-and-pe-scurt.png` | text step bar with underline, "Pe scurt" | grafted |
| `graft-editorial-02-gantt-cost-total-and-annotated-chart.png` | Gantt cost column, Total row, hatch, net label | grafted; its numbers disagree with its table, ignore them |
| `graft-editorial-03-square-markers-and-dashed-assumption-tag.png` | square status, priority, dashed tag, start tag | grafted |
| `graft-editorial-04-search-typed-footer.png` | typed footer copy | copy grafted; not the cyan row bar |
| `graft-editorial-05-kpi-sublines-hatch-notes-column.png` | KPI sub-lines, labelled areas, notes | grafted; not the gradient table row |
