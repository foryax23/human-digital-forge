import type { ReactNode } from "react";

/**
 * Previously a magnetic cursor-follow wrapper. The studio redesign dropped that
 * effect, so this is now a transparent pass-through kept for call-site
 * compatibility.
 */
export function Magnetic({ children }: { children: ReactNode; strength?: number }) {
  return <>{children}</>;
}
