# Remove the homepage intro loading screen

The user's Lighthouse run shows Performance 62 on mobile (FCP 5.0 s, LCP 5.1 s). The first-visit intro (swirl video + counter) covers the page and streams an 8.7 MB `/media/brand/intro` video on Slow 4G before the visitor sees anything. The request: drop that video intro so the page loads immediately.

## Scope

Remove the intro loader entirely — video, counter, skip button, and the curtain logic. Everything else (hero entrance animation, ASCII vortex, footer sign-off video) stays.

## Changes

1. **`src/routes/index.tsx`**
   - Remove imports of `IntroProvider`, `INTRO_HEAD_SCRIPT`, `LoadingScreen`.
   - Remove the `INTRO_HEAD_SCRIPT` entry from `head().scripts`.
   - Render `<LandingNav />`, `<main>`, `<ContactFooter />` directly (no `IntroProvider` wrapper). `MotionPauseProvider` stays.

2. **`src/components/landing/HeroSection.tsx`**
   - Remove `useIntroDone` and `HERO_REVEAL_ATTR` imports and the `reveal` spread (elements no longer pre-hidden).
   - Keep the GSAP entrance but run it on mount instead of waiting for the intro (the reduced-motion branch stays).

3. **Delete files**
   - `src/components/landing/LoadingScreen.tsx`
   - `src/components/landing/intro.tsx`
   - `src/components/landing/intro-script.ts`

4. **`src/styles.css`**
   - Remove the `intro-failsafe` animation rule and its `@keyframes` (lines ~561–577) — nothing references them once the loader is gone.

5. **`src/components/landing/media.ts`**
   - Remove the `INTRO_VIDEO` export and drop it from `BRAND_MEDIA`. (`SIGNOFF_VIDEO` stays: the footer uses it. `PDF_GENERATING_VIDEO` stays: the PDF screen uses it.)

6. **Unused media files**
   - Delete `public/media/brand/intro/assemble-1080.mp4`, `assemble-720.mp4`, `assemble.webm`, `assemble-poster.jpg` (intro-only, ~7.7 MB out of the deploy). Keep `assemble-alt-*` (PDF generating).

## Notes

- The head script's other job (pre-hiding hero copy until the entrance) disappears with it; hero copy will simply animate in on load — no flash, since nothing hides it.
- The swirling ASCII vortex background is untouched — it only loads once near the viewport.

## Verification

- Build log clean.
- Playwright: open `http://localhost:8080` (and in a fresh browser context, i.e. no session storage) — page renders immediately, no loader, hero entrance plays, no console errors; screenshot desktop + mobile.
