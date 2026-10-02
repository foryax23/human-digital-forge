import type { DependencyList, RefObject } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { ScrollToPlugin } from "gsap/ScrollToPlugin";

import { prefersReducedMotion, useIsomorphicLayoutEffect } from "./motion-prefs";

// Plugins touch window/document, so register them only in the browser.
if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger, ScrollToPlugin);
}

export { gsap, ScrollTrigger, prefersReducedMotion, useIsomorphicLayoutEffect };

/**
 * Runs GSAP code inside a gsap.context scoped to `scope`, and reverts every
 * tween/ScrollTrigger it created when deps change or the component unmounts.
 * Selector strings inside `setup` only match descendants of `scope`.
 */
export function useGsap(
  setup: (context: gsap.Context) => void | (() => void),
  scope: RefObject<HTMLElement | null>,
  deps: DependencyList = [],
) {
  useIsomorphicLayoutEffect(() => {
    if (!scope.current) return;
    const ctx = gsap.context(setup, scope.current);
    return () => ctx.revert();
  }, deps);
}
