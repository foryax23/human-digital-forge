import type { ReactNode } from "react";

import { LandingNav } from "@/components/landing/LandingNav";
import { MotionPauseProvider } from "@/components/landing/motion-pause";
import { MAIN_ID } from "@/components/system/skip-link";
import { SiteFooter } from "./SiteFooter";

/**
 * Frame for the service, portfolio, contact and legal pages: the same night surface,
 * nav and footer as the homepage and /scan, so the site reads as one. The nav is fixed,
 * so the content starts below its 56 / 64 px bar.
 */
export function SiteLayout({ children }: { children: ReactNode }) {
  return (
    <div className="cinematic flex min-h-screen flex-col bg-background text-foreground">
      <MotionPauseProvider>
        <LandingNav offPage cta="primary" />
        <main id={MAIN_ID} tabIndex={-1} className="flex-1 pt-14 md:pt-16">
          {children}
        </main>
        <SiteFooter />
      </MotionPauseProvider>
    </div>
  );
}
