# Project architecture decisions

- Homepage visual effects use GSAP (ScrollTrigger, ScrollToPlugin) for scroll-driven choreography and Motion for component presence and hover, plus CSS. hls.js streams the homepage background video and is imported on demand in the browser only. Keep off-screen pausing and reduced-motion fallbacks, and don't add further animation runtimes.
- Deep research "signals" step also gathers press news (Google News RSS), social profiles by web search, and one ledger-billed Claude web-search company profile (brands, key people, customers, reviews, ads, events); every AI item must cite a URL the search really returned, and social networks are never fetched directly — keeps budget caps, blocks invented facts, avoids scraping platforms that forbid it.
