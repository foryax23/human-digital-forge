import { forwardRef, type HTMLAttributes } from "react";

import { cn } from "@/lib/utils";

/** The scan report's frosted glass surface (night #070a1f, hairline border). */
export const GLASS =
  "rounded-3xl border border-white/10 bg-[#070a1f]/70 shadow-[inset_0_1px_0_rgb(255_255_255/0.06),0_30px_80px_-40px_rgb(0_0_0/0.85)] backdrop-blur-xl";

/** Inner, lighter tile inside a glass panel. */
export const TILE = "rounded-2xl border border-white/[0.08] bg-white/[0.03]";

export const GlassCard = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => <div ref={ref} className={cn(GLASS, className)} {...props} />,
);
GlassCard.displayName = "GlassCard";

/** Small uppercase label above a panel's title. */
export function PanelEyebrow({ className, ...props }: HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn("type-label text-white/50", className)} {...props} />;
}
