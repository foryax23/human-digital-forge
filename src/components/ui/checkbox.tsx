import * as React from "react";
import * as CheckboxPrimitive from "@radix-ui/react-checkbox";
import { Check } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * 16 px box, 4 px corners, 1.5 px edge; checked = solid violet with a 2 px white check.
 * aria-invalid draws a 1 px red ring.
 */
const Checkbox = React.forwardRef<
  React.ElementRef<typeof CheckboxPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>
>(({ className, ...props }, ref) => (
  <CheckboxPrimitive.Root
    ref={ref}
    className={cn(
      "peer grid size-4 shrink-0 cursor-pointer place-content-center rounded-sm border-[1.5px] border-fg/42 bg-transparent text-white transition-colors duration-150",
      "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-line",
      "data-[state=checked]:border-brand data-[state=checked]:bg-brand",
      "aria-invalid:ring-1 aria-invalid:ring-bad",
      "disabled:cursor-not-allowed disabled:opacity-[0.42]",
      className,
    )}
    {...props}
  >
    <CheckboxPrimitive.Indicator className="grid place-content-center text-current">
      <Check className="size-3" strokeWidth={3.5} />
    </CheckboxPrimitive.Indicator>
  </CheckboxPrimitive.Root>
));
Checkbox.displayName = CheckboxPrimitive.Root.displayName;

export { Checkbox };
