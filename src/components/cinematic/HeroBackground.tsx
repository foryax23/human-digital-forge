import { Component, Suspense, lazy, useEffect, useState, type ReactNode } from "react";

const HeroCanvas = lazy(() => import("./HeroCanvas"));

/** Keeps a WebGL load/runtime failure from crashing the whole homepage. */
class CanvasBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    if (this.state.failed) return null;
    return this.props.children;
  }
}

/**
 * Client-only wrapper for the WebGL hero. The Three.js scene is lazy-loaded
 * and only mounted in the browser, so SSR / build prerender renders the
 * static gradient fallback and never touches `window`.
 */
export function HeroBackground() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return;
    setReady(true);
  }, []);

  return (
    <div className="absolute inset-0 -z-10">
      {/* Static gradient fallback — always rendered as a base layer */}
      <div className="absolute inset-0 bg-aurora opacity-70" aria-hidden />
      {ready && (
        <CanvasBoundary>
          <Suspense fallback={null}>
            <HeroCanvas />
          </Suspense>
        </CanvasBoundary>
      )}
    </div>
  );
}
