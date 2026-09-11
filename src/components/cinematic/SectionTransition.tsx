import { cn } from "@/lib/utils";

/**
 * Section seam. A single hairline rule with a short indigo tick — the
 * studio-drawing equivalent of a page break. No glows, no orbs.
 */
export function SectionTransition({ className }: { tone?: "indigo" | "teal"; className?: string }) {
  return (
    <div aria-hidden className={cn("relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8", className)}>
      <div className="relative h-px w-full bg-[oklch(1_0_0/10%)]">
        <span className="absolute left-0 top-0 h-px w-24 bg-primary" />
      </div>
    </div>
  );
}
