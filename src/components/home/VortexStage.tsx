import { Component, Suspense, lazy, useEffect, useState, type ReactNode } from "react";

import swirlAsset from "@/assets/brand/vortex-swirl.png.asset.json";

const VortexScene = lazy(() => import("./VortexScene"));

/** A WebGL failure must never take the homepage down. */
class SceneBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
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
 * The hero's cinematic vortex. Client-only and lazy-loaded; SSR, reduced-motion
 * users and unsupported devices see the static swirl instead.
 */
export function VortexStage() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    setReady(true);
  }, []);

  return (
    <div className="pointer-events-none relative isolate aspect-square w-full max-w-[42rem] lg:max-w-none">
      {/* Depth glow behind the vortex */}
      <div
        aria-hidden
        className="absolute inset-[12%] rounded-full bg-gradient-brand opacity-25 blur-[70px] animate-glow-pulse"
      />
      {/* Static fallback / SSR frame */}
      <img
        src={swirlAsset.url}
        alt=""
        aria-hidden
        className="absolute inset-[6%] h-[88%] w-[88%] object-contain opacity-70 mix-blend-screen"
      />
      {ready && (
        <SceneBoundary>
          <Suspense fallback={null}>
            <div className="absolute inset-0">
              <VortexScene />
            </div>
          </Suspense>
        </SceneBoundary>
      )}
    </div>
  );
}
