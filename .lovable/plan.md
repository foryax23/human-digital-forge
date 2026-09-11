# Full site redesign — "Plan table" direction

A complete visual rebuild of the public website in the chosen direction: left-anchored, off-grid composition, technical monospace headings, hairline rules and squared blocks instead of glowing glass cards. Same colours as today, no invented numbers, all English/Romanian text kept.

## Locked design decisions

- Colours: current midnight indigo palette stays exactly as is.
- Headings and small labels: JetBrains Mono. Body text: Work Sans.
- Layout: asymmetric — content anchored left, blocks offset at different heights, thin border lines exposed.
- Corners: squared / near-square, not the current soft pills.
- Motion: restrained — slow drift on the vortex, single-pass reveals on scroll. No pulsing glows, no floating cards, no magnetic cursor pull.

## What gets removed (the "AI slop")

- Glass stat cards, gradient pill badges, glow rings and blurred orbs.
- The custom glowing cursor and magnetic button effect.
- Section seam orbs and the animated aurora wash.
- Uniform rounded card grids repeated in every section.
- Gradient text on every headline; kept only for one accent word.

## Homepage, section by section

1. Hero — left-anchored headline over the vortex, offset and cropped to the right rather than centred behind the type. Small mono label above, one paragraph, two square buttons (Start a project / Free infrastructure audit). The three facts become a staggered ledger of blocks at unequal heights, labelled 01 / 02 / 03, with only the facts we actually have (5 stages, 2 min audit, EN/RO).
2. Trust strip — plain mono ticker on a hairline rule.
3. The problem — two-column contrast set on the exposed grid, no cards.
4. Method — Audit / Blueprint / Build / Automate / Operate as a numbered plan table with hairline dividers.
5. Services — asymmetric rows, image on one side, mono numbering, alternating offset.
6. Audit invitation — full-width block, one clear action.
7. Audience and AI — split composition, quieter imagery treatment.
8. Results — kept as clearly labelled reserved slots, no fabricated figures.
9. Portfolio and consultation — offset gallery rows.
10. Pricing — four columns kept side by side, restyled as square plan sheets with mono price type and a single highlighted tier; no gradient CTA glow.
11. FAQ — hairline list, no boxed accordion.
12. Final CTA — large mono statement with the looping brand video restrained in the background.

## Rest of the public site

Header, footer, page heroes, Services, Websites, AI Automation, Portfolio, Consultancy, Contact, Audit, and the legal pages all move onto the same primitives so nothing is left on the old look. Login/register pages get the same buttons, fields and type. The client dashboard keeps its current structure but inherits the new fonts, buttons and inputs.

## Technical notes

- Load JetBrains Mono + Work Sans via `<link>` in `src/routes/__root.tsx`; point `--font-display` / `--font-sans` / `--font-body` at them in `src/styles.css`. Keep Sora/Manrope out.
- Tokens: keep existing `oklch` values; add `--rule` hairline, tighten `--radius` toward 2px, replace `glow-soft`/`glass-panel`/`bento-panel`/`bg-aurora`/`flow-orb` usages with new `plan-block`, `rule-x`, `mono-label` utilities. Delete the unused glow keyframes.
- `HeroStage.tsx` recomposed to the prototype's 12-column left/right split; `VortexStage` stays but is offset, masked and dimmed, with the reduced-motion fallback intact.
- `StatCard.tsx` becomes the staggered ledger block; `Band.tsx` gains an exposed-rule variant; `SectionTransition.tsx` reduced to a hairline (orbs removed). `CustomCursor.tsx` and `Magnetic.tsx` are removed from use.
- Section components restyled in place: `ServicesIntro`, `ProcessSteps`/`StageRail`, `BeforeAfter`, `ProofWall`, `AudienceSection`, `AISpotlight`, `PortfolioPreview`, `ConsultationSection`, `PricingSection`, `TrustSection`, `HomeFaq`, `FinalCTA`, `TrustMarquee`, `StickyCta`, plus `SiteHeader`, `SiteFooter`, `PageHero`, `CtaBand`, `ServiceCard`, `SectionHeading`, `FaqAccordion`.
- All existing brand assets, images, pricing logic, checkout, audit submission, i18n strings, legal content, auth and dashboard data stay untouched.
- Verify with a typecheck and Playwright passes over `/`, `/services`, `/pricing` area, `/audit`, `/contact` in both languages, checking for console errors and layout at desktop and mobile widths.
