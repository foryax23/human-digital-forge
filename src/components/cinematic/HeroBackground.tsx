import { Component, Suspense, lazy, useEffect, useState, type ReactNode } from "react";

import { AsciiEffect } from "@/components/ui/ascii-effect";
import heroAsciiAsset from "@/assets/home/hero-ascii-source.jpg.asset.json";

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

      {/* Subtle ASCII vortex wash — decorative, non-interactive */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 mask-radial-fade opacity-[0.18] mix-blend-screen"
      >
        <AsciiEffect
          variant="flow"
          imageSrc={heroAsciiAsset.url}
          fontSize={12}
          scale={1.2}
          colors={["#2B0E4A", "#6A1B9A", "#9D4EDD", "#C77DFF", "#F5E9FF"]}
          backgroundColor="#0F0620"
          flowSpeed={0.08}
          flowStrength={6}
          flowFrequency={0.015}
          mouseRadius={0}
          mouseStrength={0}
          brightnessBoost={2.2}
          contrast={1.15}
          className="h-full w-full"
        />
      </div>

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

