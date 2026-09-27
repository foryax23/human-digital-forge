import { cn } from "@/lib/utils";

type Tone = "indigo" | "teal";

/**
 * A single soft glow that bridges two sections. No hard seam line — the page
 * reads as one continuous scene.
 */
export function SectionTransition({
  tone = "indigo",
  className,
}: {
  tone?: Tone;
  className?: string;
}) {
  return (
    <div aria-hidden className={cn("relative h-16 w-full overflow-hidden", className)}>
      <div
        className={cn(
          "absolute left-1/2 top-1/2 h-px w-[70rem] max-w-[90vw] -translate-x-1/2 -translate-y-1/2",
          tone === "teal" ? "bg-gradient-to-r from-transparent via-teal/50 to-transparent" : "bg-gradient-to-r from-transparent via-primary/50 to-transparent",
        )}
      />
      <div
        className={cn(
          "absolute left-1/2 top-1/2 h-10 w-[26rem] max-w-[60vw] -translate-x-1/2 -translate-y-1/2 blur-3xl",
          tone === "teal" ? "flow-orb-teal" : "flow-orb-indigo",
        )}
      />
    </div>
  );
}
