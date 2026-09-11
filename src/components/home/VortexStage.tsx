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
 * The cinematic vortex. Fills its container edge to edge; client-only and
 * lazy-loaded, so SSR, reduced-motion users and unsupported devices get the
 * static swirl frame instead. Pauses itself when scrolled out of view.
 */
export function VortexStage() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    setReady(true);
  }, []);

  return (
    <div className="pointer-events-none absolute inset-0 isolate overflow-hidden">
      {/* Depth glow behind the vortex */}
      <div
        aria-hidden
        className="absolute left-1/2 top-1/2 h-[70vmin] w-[70vmin] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary opacity-30 blur-[110px] animate-glow-pulse"
      />
      {/* Static fallback / SSR frame */}
      <img
        src={swirlAsset.url}
        alt=""
        aria-hidden
        className="absolute left-1/2 top-1/2 h-[86vmin] w-[86vmin] -translate-x-1/2 -translate-y-1/2 object-contain opacity-25 blur-[2px] mix-blend-screen hero-mask"
      />
      {ready && (
        <SceneBoundary>
          <Suspense fallback={null}>
            <div className="absolute inset-0 hero-mask">
              <VortexScene />
            </div>
          </Suspense>
        </SceneBoundary>
      )}
    </div>
  );
}
