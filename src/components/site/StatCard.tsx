import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * A single entry in the hero fact ledger. Squared block, monospace index,
 * hairline border — no glass, no glow.
 */
export function StatCard({
  value,
  label,
  icon,
  index,
  className,
}: {
  value: string;
  label: string;
  icon?: ReactNode;
  index?: string;
  className?: string;
}) {
  return (
    <div className={cn("plan-block flex flex-col justify-between gap-6 p-5 text-left", className)}>
      <div className="flex items-center justify-between">
        {index && <span className="mono-label">{index}</span>}
        {icon && <span className="text-primary/70">{icon}</span>}
      </div>
      <div>
        <div className="font-display text-2xl font-bold leading-none tracking-tight sm:text-3xl">
          {value}
        </div>
        <div className="mt-2 text-xs uppercase tracking-[0.14em] text-muted-foreground">{label}</div>
      </div>
    </div>
  );
}
