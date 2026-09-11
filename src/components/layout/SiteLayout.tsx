import type { ReactNode } from "react";

import { SiteHeader } from "./SiteHeader";
import { SiteFooter } from "./SiteFooter";

/**
 * Public-site shell. The whole public site sits on the dark studio surface so
 * every page reads as one continuous scene.
 */
export function SiteLayout({ children }: { children: ReactNode }) {
  return (
    <div className="cinematic cinematic-flow flex min-h-screen flex-col">
      <SiteHeader />
      <main className="flex-1">{children}</main>
      <SiteFooter />
    </div>
  );
}
