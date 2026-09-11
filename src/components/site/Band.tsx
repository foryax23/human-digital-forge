import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type Tone = "dark" | "light" | "ink";

/**
 * A full-width page band. Alternating tones give the page rhythm instead of one
 * long dark scroll. Tones are token overrides, so children keep using semantic
 * classes (bg-card, text-muted-foreground, ...).
 */
export function Band({
  tone = "dark",
  className,
  innerClassName,
  children,
  id,
}: {
  tone?: Tone;
  className?: string;
  innerClassName?: string;
  children: ReactNode;
  id?: string;
}) {
  return (
    <section
      id={id}
      className={cn(
        "relative isolate overflow-hidden",
        tone === "light" && "band-light",
        tone === "ink" && "band-ink",
        className,
      )}
    >
      <div
        className={cn(
          "mx-auto max-w-7xl px-4 py-20 sm:px-6 sm:py-24 lg:px-8",
          innerClassName,
        )}
      >
        {children}
      </div>
    </section>
  );
}
