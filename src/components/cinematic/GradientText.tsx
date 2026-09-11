import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/** Brand gradient text with the gradient slowly travelling through it. */
export function GradientText({
  children,
  className,
  animate = true,
}: {
  children: ReactNode;
  className?: string;
  animate?: boolean;
}) {
  return (
    <span className={cn("text-gradient-brand", animate && "gradient-travel", className)}>
      {children}
    </span>
  );
}
