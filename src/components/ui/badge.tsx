import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

/*
 * The shadcn badge in the system Tag look: 20 px, 4 px corners, 12 px sentence case, no
 * coloured fills. Prefer Tag / Status / Count from "@/components/system" in new code.
 */
const badgeVariants = cva(
  "inline-flex h-5 max-w-full shrink-0 items-center whitespace-nowrap rounded-sm px-1.5 font-sans text-xs font-medium leading-none",
  {
    variants: {
      variant: {
        default: "border border-line-3 text-fg-2",
        secondary: "bg-fill-3 text-fg-2",
        destructive: "border border-line-3 text-bad",
        outline: "border border-line-3 text-fg-2",
        dashed: "border border-dashed border-line-3 text-fg-3",
        start: "bg-brand-tint text-brand-fg",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
