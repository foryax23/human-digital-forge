import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "ghost";
type Size = "md" | "lg" | "sm";

const BASE =
  "type-button inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[10px] transition-[scale,background-color,border-color,color] duration-150 active:scale-[0.97] motion-reduce:active:scale-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#89cbf6]/80 focus-visible:ring-offset-2 focus-visible:ring-offset-[#04061a] disabled:pointer-events-none disabled:opacity-50 [&_svg]:h-4 [&_svg]:w-4 [&_svg]:shrink-0";

const VARIANTS: Record<Variant, string> = {
  // Solid brand violet with 10px corners, no gradient or glow: the same language
  // as the hero's search button and the nav's "Start a project".
  primary: "bg-[#5b52f0] text-white hover:bg-[#6a62f6]",
  secondary:
    "border border-white/15 bg-white/[0.04] text-white/90 backdrop-blur hover:border-white/30 hover:bg-white/[0.08]",
  ghost: "text-white/70 hover:bg-white/[0.06] hover:text-white",
};

const SIZES: Record<Size, string> = {
  sm: "h-9 px-4",
  md: "h-11 px-5",
  lg: "h-12 px-6",
};

/** Class names for the scan report's buttons and button-styled links. */
export function scanButton(variant: Variant = "primary", size: Size = "md", className?: string) {
  return cn(BASE, VARIANTS[variant], SIZES[size], className);
}
