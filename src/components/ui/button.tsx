import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

/*
 * The shadcn button in the Vortex look (same scale as system/button: lg 40, default 36,
 * sm 28; 8 px corners; no glow, lift or press offset). New code uses
 * "@/components/system" Button / ButtonLink; this keeps the dashboard and legal pages in step.
 */
const buttonVariants = cva(
  "inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 whitespace-nowrap font-sans font-medium leading-none transition-[background-color,border-color,color,text-decoration-color] duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-line/55 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-[0.42] [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "bg-brand text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.12)] hover:bg-brand-hover",
        // Red stays a word colour, never a fill.
        destructive: "border border-line-3 bg-fill-1 text-bad hover:border-bad/60 hover:bg-fill-2",
        outline: "border border-line-3 bg-fill-1 text-fg hover:border-fg/25 hover:bg-fill-2",
        secondary: "bg-fill-2 text-fg hover:bg-fill-3",
        // Kept for older call sites; the cyan accent is reserved for the hero underline.
        teal: "border border-line-3 bg-fill-1 text-fg hover:border-fg/25 hover:bg-fill-2",
        ghost: "text-fg-2 hover:bg-fill-2 hover:text-fg",
        link: "text-fg underline decoration-fg/30 decoration-1 underline-offset-4 hover:decoration-fg",
      },
      size: {
        default: "h-9 rounded-lg px-3.5 text-sm",
        sm: "h-7 rounded-md px-2.5 text-[0.8125rem] [&_svg]:size-3.5",
        lg: "h-10 rounded-lg px-4 text-sm",
        icon: "size-9 rounded-lg",
      },
    },
    // A text link keeps the type size but has no box.
    compoundVariants: [{ variant: "link", class: "h-auto rounded-sm px-0" }],
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
