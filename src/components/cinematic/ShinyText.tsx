import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/** A light sweep travelling across a short piece of text. */
export function ShinyText({
  children,
  className,
  speed = 4,
}: {
  children: ReactNode;
  className?: string;
  speed?: number;
}) {
  return (
    <span
      className={cn("shiny-text", className)}
      style={{ animationDuration: `${speed}s` }}
    >
      {children}
    </span>
  );
}
