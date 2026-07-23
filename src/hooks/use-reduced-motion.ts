import { useEffect, useState } from "react";

/**
 * Returns true when the user has requested reduced motion at the OS level.
 * SSR-safe: defaults to false, updates after hydration and on media-query changes.
 */
export function usePrefersReducedMotion() {
  const [prefers, setPrefers] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setPrefers(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  return prefers;
}
