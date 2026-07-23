import { cn } from "@/lib/utils";

type Tone = "indigo" | "teal" | "magenta";

/**
 * A luminous seam placed between sections so each one melts into the next.
 * Renders a thin gradient line plus a soft glow orb that bridges the boundary.
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
      <div className="section-seam absolute inset-x-0 top-0" />
      <div
        className={cn(
          "flow-orb left-1/2 top-1/2 h-48 w-[36rem] max-w-[80vw] -translate-x-1/2 -translate-y-1/2 animate-glow-pulse",
          tone === "teal" ? "flow-orb-teal" : tone === "magenta" ? "flow-orb-magenta" : "flow-orb-indigo",
        )}
      />
    </div>
  );
}
