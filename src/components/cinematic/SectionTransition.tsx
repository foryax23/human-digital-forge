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
    <div aria-hidden className={cn("relative h-px w-full", className)}>
      <div
        className={cn(
          "flow-orb left-1/2 top-1/2 h-40 w-[44rem] max-w-[86vw] -translate-x-1/2 -translate-y-1/2 animate-glow-pulse",
          tone === "teal" ? "flow-orb-teal" : "flow-orb-indigo",
        )}
      />
    </div>
  );
}
