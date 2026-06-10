# Make the EN/RO Language Toggle Functional

Turn the currently decorative EN/RO toggle into a real translation system that switches every page of the site (public pages + dashboard) between English and Romanian, auto-detects the visitor's language on first visit, and remembers their choice.

## How it will work

- A global **Language provider** holds the active language (`en` / `ro`) and a `t()` translation function, made available everywhere via a `useI18n()` hook.
- **First visit:** the site reads the browser's preferred language — if it starts with `ro`, it loads in Romanian, otherwise English.
- **Persistence:** the chosen language is saved in the browser (localStorage) and restored on every return visit; a manual toggle always overrides auto-detection.
- The `LanguageToggle` buttons will set the active language instead of only changing their own highlight, and the `<html lang>` attribute updates to match (good for SEO/accessibility).
- Page titles/descriptions (SEO metadata) for major pages will also switch language.

## Scope of translation

Every user-facing string across the site will be translated to Romanian, including:

- Header & footer (nav links, buttons, legal links, tagline)
- Home page (all sections: hero, services, AI spotlight, audience, process, consultation, trust, portfolio preview, final CTA)
- Marketing pages: Services, AI Automation, Websites, Consultancy, Digital Products, Portfolio, Contact, Privacy, Terms
- Auth pages: Login, Register, Reset Password
- Dashboard: overview, projects, messages, files, billing, consultations, new request, settings
- Shared UI: form labels, buttons, empty states, toasts/notifications, the 404 and error pages

I will write the Romanian translations for all of the above.

## Technical approach

```text
src/i18n/
  index.ts          -> exports useI18n, LanguageProvider, types
  LanguageProvider.tsx -> context, detection, persistence, <html lang> sync
  translations/
    en.ts           -> English strings (source of truth)
    ro.ts           -> Romanian strings (same key shape)
```

- **Provider:** wrap the app inside `src/routes/__root.tsx` (around `<Outlet />`, alongside `AuthProvider`). Initialize to `en` for consistent server render, then in a `useEffect` read localStorage → fallback to `navigator.language`, update state, persist, and set `document.documentElement.lang`. This avoids SSR hydration mismatches (English renders first, then swaps to Romanian for RO users on the client).
- **Translation function:** `t("namespace.key")` looks up the key in the active language dictionary, falling back to English if a key is missing. Strings are organized by page/section namespaces.
- **Refactor pattern:** replace hardcoded JSX strings and the module-level content arrays (e.g. the `services`/`navLinks` arrays) with `t()` lookups resolved inside the component render so they react to language changes.
- **LanguageToggle:** read/write the active language from `useI18n()` instead of local `useState`.
- **SEO metadata:** for key routes, derive `head()` title/description from the active language where feasible (note: route `head()` runs outside React context, so metadata localization will use a lightweight shared helper reading the persisted language; the visible page content is fully reactive).

## Notes & trade-offs

- This is a large, content-heavy change touching ~30 files; the bulk of the work is extracting and translating copy, which I'll do carefully section by section.
- No backend/database changes are needed — translation is entirely front-end.
- RO visitors may see a brief English flash on the very first paint before the client swaps language (standard for client-side language detection without cookies). If you'd prefer zero flash, I can later switch detection to a cookie read on the server — out of scope for this pass unless you want it.
