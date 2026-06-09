import { Suspense, lazy, useEffect, useState } from "react";

const HeroCanvas = lazy(() => import("./HeroCanvas"));

/**
 * Client-only wrapper for the WebGL hero. The Three.js scene is lazy-loaded
 * and only mounted in the browser, so SSR / build prerender renders the
 * static gradient fallback and never touches `window`.
 */
export function HeroBackground() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const fine = window.matchMedia("(pointer: fine)").matches;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    // Skip the heavy 3D scene on reduced-motion preference.
    if (reduce) return;
    // Allow the canvas everywhere, but keep it lightweight on touch.
    setReady(true);
    void fine;
  }, []);

  return (
    <div className="absolute inset-0 -z-10">
      {/* Static gradient fallback — always rendered as a base layer */}
      <div className="absolute inset-0 bg-aurora opacity-70" aria-hidden />
      {ready && (
        <Suspense fallback={null}>
          <HeroCanvas />
        </Suspense>
      )}
    </div>
  );
}
