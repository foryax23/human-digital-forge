# Project architecture decisions

- Homepage visual effects use GSAP (ScrollTrigger, ScrollToPlugin) for scroll-driven choreography and Motion for component presence and hover, plus CSS. hls.js streams the homepage background video and is imported on demand in the browser only. Keep off-screen pausing and reduced-motion fallbacks, and don't add further animation runtimes.
