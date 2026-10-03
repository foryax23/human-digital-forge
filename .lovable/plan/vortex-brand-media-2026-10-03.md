# Vortex brand media — where each asset goes (plan)

Source: the owner's asset folder (`VortexHub/Assets`): 10 logo PNGs (transparent except the app
icon) and 7 animations (H.264, black backgrounds). Black backgrounds blend into the site's night
palette with `mix-blend-mode: screen`, so no alpha video is needed.

## Assets and their jobs

| Asset | Job on the site | Delivered as |
|---|---|---|
| Purple metallic wordmark (2073×758) | **Nav logo** (replaces the typed "V O R T E X  H U B"), footer, PDF cover and page headers, OG image | `public/media/brand/logo-wordmark.{webp,png}` (trimmed, 1200 w), `logo-wordmark-nav.{webp,png}` (96 px tall = 2× a 48 px nav) |
| Chrome wordmark | Print/monochrome contexts: PDF back cover | `logo-wordmark-chrome.png` |
| Lavender wordmark | Subtle watermark on dark surfaces (PDF section dividers) | `logo-wordmark-lavender.png` |
| Swirl mark (transparent) | Favicon, small brand marks, PDF footer mark, scan loaders | `swirl-icon.{webp,png}` (512), `favicon-32.png`, `apple-touch-icon.png` (180) |
| App icon (opaque) | Web app icon / manifest | `app-icon-512.png` |
| `assemble_6s_hold` (swirl → particles → wordmark, holds) | **Intro loader** on first visit: plays once, skippable (click/Esc), the progress bar tracks the video, the curtain lifts on the hold | `public/media/brand/intro/assemble-{1080,720}.mp4`, `assemble.webm`, `assemble-poster.jpg` (final frame) |
| `assemble_5s_altB` (ribbon variant) | **PDF generating** animation in the download dialog | `public/media/brand/intro/assemble-alt-720.mp4` + `.webm` |
| `logo_5s_16x9` (wordmark with a light sweep) | **Brand sign-off** above the footer bar: plays once when scrolled into view, then holds | `public/media/brand/signoff/logo-reveal-{1080,720}.mp4`, `.webm`, poster |
| `logo_5s_9x16` | Portrait version of the sign-off (and the intro) on phones | `logo-reveal-portrait-720.mp4`, `.webm`, poster |
| `swirl_spin_5s_loop` (seamless, 60 fps) | **Hero vortex** and the scan's analysing centrepiece — replaces the 20 s loop (same art, a quarter of the length) | `public/media/swirl-loop/` HLS ladder (540p/1080p, 30 fps) + `poster.jpg` + `swirl-720.mp4` fallback |
| `swirl_spin_20s_looped` | Already on the site (identical file); retired once the 5 s loop ships | — |
| `assemble_5s` (main) | Not used yet: reserve for social media / ads | — |

Still frames from the logo reveal also become the OG image (`og-image.jpg`, 1200×630) and the
PDF cover art (`cover-art.jpg`). React-PDF only reads PNG/JPEG, so the PDF uses the `.png`/`.jpg`
files.

## Rules
- Every animation respects the page-wide pause switch and `prefers-reduced-motion` (reduced
  motion: show the poster / final frame, no playback).
- Videos are muted, `playsInline`, lazy (load when near the viewport), paused off-screen.
- The intro stays first-visit-only and skippable; it never blocks deep links (`/#section`).

## Hero correction (owner)
- The search bar sits in the **middle** of the hero (centred column: eyebrow, title, pitch,
  search), with the orbiting Analyse / Automate / Growth / Strategy labels around the centred
  vortex on desktop and as a chip row on phones.
- The nav shows the real wordmark image, not typed letters.

## PDF (owner)
- Logos: wordmark on the cover and in a slim page header, swirl mark in the footer.
- Denser layout with less empty space; fewer em dashes (commas, colons and full stops instead).
- Language: defaults to the scanned website's language (Romanian sites → Romanian PDF), with an
  English / Română choice in the download dialog.
- Romanian copy uses common, natural business Romanian (programări, facturare, clienți, ofertă,
  vânzări, recenzii), not literal translations.
