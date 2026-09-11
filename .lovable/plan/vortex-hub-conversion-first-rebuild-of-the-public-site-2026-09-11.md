# Vortex Hub — conversion-first rebuild of the public site

Rebuild the public website using the structure that makes afacere.ai convert, but positioned for what we actually do: we run the digital infrastructure of businesses — websites, systems, automation, AI — as an agency, not a "start your own business" course.

## What that site does well (and we take)

- One dominant promise in the hero, huge type, two buttons, then instant credibility (avatar row + three stat cards).
- A single named method broken into 5 numbered stages, each with a "what you walk away with" line.
- A before/after contrast block: the mess without us vs. the calm with us.
- A free interactive lead magnet (short quiz returning a personalised plan) as the low-friction entry point.
- Wall of proof: named results, repeated, scrolling.
- Sharp light/dark alternation between bands so the page has rhythm instead of one long dark scroll.
- Sticky bottom/top call-to-action and one repeated action verb everywhere.

## Where we go 10x further

- Live 3D vortex stays as the hero backdrop (their hero is a static dotted grid) with the stat cards and avatar row layered over it.
- Our method is about the client's infrastructure, not their career: Audit → Blueprint → Build → Automate → Operate.
- The quiz returns a real infrastructure recommendation (which systems they're missing, what to fix first, rough investment band), saved as a lead, emailed-ready.
- Every band gets its own composition and a designed figure — no repeated card grids.
- Fully bilingual RO/EN, existing four pricing plans and Stripe checkout kept, our own logo/swirl/app-icon assets kept everywhere.

## Page plan

**Home** — new order: hero (vortex + promise + stat cards + partner row) → proof marquee → "the problem" before/after → how we work (5-stage interactive rail) → what we build (services bento) → free infrastructure audit quiz teaser → what a month with us looks like (week/timeline figure) → results wall → plans → FAQ → final call to action + sticky bar.

**New: /audit** — the quiz. 7 questions (business type, team size, current tools, what breaks most, budget band, timeline, contact). Result screen: your infrastructure gaps, first three moves, recommended plan, book-a-call button.

**Services, Websites, AI automation, Digital products, Portfolio, Consultancy, Contact** — restyled to the same rhythm: shared hero band, alternating light/dark sections, one figure per section, consistent call-to-action band. Content stays ours, structure gets the new template.

**Legal, auth, dashboard** — untouched.

## Proof placeholders

Testimonials and stat numbers are built as real components but filled with clearly-marked placeholder names and figures (`— your client name`, `xx clients`), so you can drop in real ones later without layout work. Nothing invented will read as a real client claim.

## Technical notes

- Design tokens stay Midnight Indigo in `src/styles.css`; add light-band tokens so alternating sections work without hardcoded colors. Sora headings + Manrope body kept.
- New `src/components/site/` primitives: `Band` (light/dark/ink variants), `StatCard`, `StageRail`, `BeforeAfter`, `ProofWall`, `FaqAccordion`, `StickyCta`.
- Quiz is client-side state in `src/routes/audit.tsx` with scoring logic in `src/lib/audit.ts`; submission via a `createServerFn` in `src/lib/audit.functions.ts`.
- New table `public.audit_leads` (answers jsonb, recommendation, contact fields) with GRANTs, RLS enabled, insert through the server function only and no client read — same PII posture as `contact_enquiries`.
- Section figures generated as dark cinematic images into `src/assets/site/`.
- Motion via `motion/react` with reduced-motion fallbacks; head metadata refreshed per route.

## Order of work

1. Tokens, band primitives, light/dark rhythm.
2. Home rebuild section by section.
3. Audit quiz page + table + server function.
4. Inner pages restyled.
5. Typecheck plus a browser pass on every public route.
