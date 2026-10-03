import { cn } from "@/lib/utils";

/**
 * The one loading glyph: a 1.5 px arc (14 px in buttons, 12 px in status lines).
 * It stops under reduced motion and the page pause switch (global rules).
 */
export function Spinner({ size = 14, className }: { size?: 12 | 14 | 16; className?: string }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 16 16"
      width={size}
      height={size}
      fill="none"
      className={cn("shrink-0 animate-spin", className)}
    >
      <circle cx="8" cy="8" r="6.25" stroke="currentColor" strokeOpacity="0.25" strokeWidth="1.5" />
      <path
        d="M14.25 8A6.25 6.25 0 0 0 8 1.75"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}
