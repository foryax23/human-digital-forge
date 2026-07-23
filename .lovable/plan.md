# Cinematic Hero Vortex v3

Swap the current black-hole loop for a proper game-engine-style **spiraling vortex** with internal lightning, slower rotation, and richer purple lighting. Keep everything else on the page as-is.

## 1. Generate a new hero video

Use `videogen--generate_video` with a prompt tuned for:
- A true funnel/tornado **vortex** (spiral arms converging to a bright core), NOT a flat accretion disk / black hole
- **Slow, majestic rotation** (explicitly ask for "slow motion, unhurried swirl")
- **Volumetric lightning bolts** arcing along the inner walls of the vortex, crackling toward the core
- Deep violet + magenta palette matching brand tokens (#2B0E4A → #7B2CBF → #C77DFF), with hot white-blue lightning highlights
- **Unreal Engine 5 / Octane cinematic render** style, high detail, particulate energy, glowing rim light
- Seamless loop-ready, camera locked (`camera_fixed: true`), 1080p, 10s, 16:9

Save to `src/assets/home/vortex-hero-v3.mp4` and upload via `lovable-assets create` to get a CDN pointer. Delete the previous `vortex-hero.mp4` asset pointer.

## 2. Wire into the hero

- Update `src/components/cinematic/VortexVideoBackground.tsx` to point at the new asset URL.
- Regenerate a matching poster still (`imagegen` premium) — same vortex framing for pre-load fallback — and swap the poster reference.
- Slow the CSS `playbackRate` on the `<video>` element to `0.75` (set via a small `useEffect` on the ref) so the perceived rotation is even slower than the source.
- Slightly darken the overlay gradient in the same file so the lightning highlights read cleanly against the headline.

## 3. Verify

- Restart preview, spot-check the hero at `/` visually.
- Confirm the loop is seamless and the headline remains legible.

## Technical notes

- `videogen` supports `camera_fixed`, `duration: 10`, `resolution: "1080p"`, `aspect_ratio: "16:9"` — used for a locked, smooth loop.
- Video assets must go through `lovable-assets` (binary >100KB), producing `.mp4.asset.json`.
- No other components, routes, or copy change in this pass.
