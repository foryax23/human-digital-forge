
# Vortex Hub — Phase 1 Build Plan

A polished, clickable front-end prototype. No backend, auth, payments, booking, or file uploads in this phase — all data is mock/static. Built on the existing TanStack Start + Tailwind v4 stack.

## Visual design choices

**Palette** (mapped to semantic tokens in `src/styles.css`, all in oklch):
- Ink navy `#0D1117` (dark backgrounds / primary)
- Warm off-white `#F7F5F0` (light sections / background)
- Soft white `#F5F5F2` (text on dark)
- Charcoal `#15181D` (text on light)
- Indigo `#5147E5` (main accent / primary buttons)
- Blue-teal `#3B9EAE` (secondary accent)
- Warm grey `#DDD8D0` (borders)

A single gentle indigo→teal gradient reserved for small highlights (button, icon, one hero detail). No neon, no glassmorphism, restrained motion with reduced-motion support.

**Typography:**
- Headings: Instrument Serif (editorial, confident) via Google Fonts
- Body / UI: Inter

**Buttons:** Primary = filled indigo, white text, medium radius ("Start a project"). Secondary = bordered/transparent ("Book a consultation"). Implemented as `button.tsx` variants.

**Cards:** Minimal — title, short paragraph, small icon, one link, gentle hover.

## Pages created (routes)

Public (TanStack file-based routes in `src/routes/`):
- `/` — fully designed homepage (all 10 sections, exact copy)
- `/services`, `/digital-products`, `/websites`, `/ai-automation`, `/consultancy`, `/portfolio`, `/contact` — polished, consistent page structures with the provided initial copy
- `/login`, `/register` — fully designed UI-only auth pages
- `/privacy`, `/terms` — placeholder legal pages
- `/dashboard` — full visual client dashboard with mock data

Each route gets its own `head()` metadata (title, description, og:title/description). Homepage uses the suggested SEO title/description.

## Component structure

```text
src/components/
  layout/
    SiteHeader.tsx        sticky nav, EN/RO selector, mobile drawer (Sheet)
    SiteFooter.tsx        nav + legal links + language + email
    LanguageToggle.tsx    EN/RO (UI only, structure ready for i18n)
  home/
    Hero.tsx              + HeroVisual.tsx (project card, consultation, file, workflow line)
    ServicesIntro.tsx     3 service cards
    AudienceSection.tsx   Individuals / Businesses split
    ProcessSteps.tsx      5 numbered steps
    AISpotlight.tsx       dark section + 4 use-case cards
    PortfolioPreview.tsx  4 "Example Project" cards
    ConsultationSection.tsx 3 session cards + booking placeholder
    TrustSection.tsx      4 trust points + reserved feedback area
    FinalCTA.tsx
  shared/
    ServiceCard.tsx, SectionHeading.tsx, PageHero.tsx, FeatureCard.tsx
  dashboard/
    DashboardLayout.tsx   sidebar + top header (greeting, notifications, account)
    DashboardSidebar.tsx  Overview, New Request, My Projects, Messages, Files,
                          Consultations, Billing, Settings, Log out
    ActiveProjectCard.tsx, ConsultationCard.tsx, RecentFileCard.tsx,
    MessageCard.tsx, ProjectTimeline.tsx (6-step tracker at "Client review")
  forms/
    ContactForm.tsx       all specified fields, consent checkbox, file placeholder
    AuthForm.tsx          shared login/register fields
```

Reused shadcn/ui primitives already in the project: button, card, input, label, textarea, select, checkbox, sheet, separator, avatar, badge, progress, dropdown-menu.

## Content & data

- All copy used verbatim from the brief (hero, services, process, AI spotlight, dashboard greeting "Good afternoon, Elena…", etc.).
- Portfolio and dashboard use clearly-labeled mock data ("Example Project"); no fake client names, logos, testimonials, or fake analytics charts.
- Dashboard is a workspace feel, not a finance dashboard. The 6-step timeline highlights "Client review".

## Imagery

Generate a small number of tasteful, realistic assets (no robots/holograms): the hero interface composition is built as real DOM (project request card, consultation card, file delivery card, workflow line) rather than a stock image. Portfolio preview cards use clean abstract/placeholder visuals. Generated assets saved to `src/assets/` and imported.

## Accessibility & responsive

- Mobile drawer nav, large tap targets, visible focus states, proper form labels, strong contrast, `prefers-reduced-motion` respected. Desktop / tablet / mobile layouts for every page and the dashboard sidebar→drawer.

## Explicitly NOT in this phase

No Lovable Cloud / Supabase, no authentication wiring, no payments, no booking integration, no live file uploads, no working contact submission. Buttons and forms are visual; the architecture leaves clean seams (auth pages, dashboard, contact form, booking placeholders) for later backend connection.

## Assumptions

1. Romanian (RO) is structural only this phase — EN is the live content; the language toggle is present but doesn't translate yet.
2. `/dashboard` is publicly reachable in this prototype (no auth guard yet) so it can be demoed.
3. Forms validate basic input client-side but don't submit anywhere.
4. Fonts loaded via Google Fonts (Instrument Serif + Inter).
5. `/services` acts as an overview linking to the three detailed category pages.
