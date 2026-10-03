import * as React from "react";
import * as SwitchPrimitives from "@radix-ui/react-switch";

import { cn } from "@/lib/utils";

// 20 × 36 track: neutral when off, solid violet when on; flat white thumb, no glow.
const Switch = React.forwardRef<
  React.ElementRef<typeof SwitchPrimitives.Root>,
  React.ComponentPropsWithoutRef<typeof SwitchPrimitives.Root>
>(({ className, ...props }, ref) => (
  <SwitchPrimitives.Root
    className={cn(
      "peer inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-150",
      "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-line/55",
      "disabled:cursor-not-allowed disabled:opacity-[0.42] data-[state=checked]:bg-brand data-[state=unchecked]:bg-fill-3 data-[state=unchecked]:shadow-[inset_0_0_0_1px_var(--vx-line-3)]",
      className,
    )}
    {...props}
    ref={ref}
  >
    <SwitchPrimitives.Thumb
      className={cn(
        "pointer-events-none block size-4 rounded-full bg-white shadow-[0_1px_2px_rgb(0_0_0/0.3)] ring-0 transition-transform duration-150 data-[state=checked]:translate-x-4 data-[state=unchecked]:translate-x-0",
      )}
    />
  </SwitchPrimitives.Root>
));
Switch.displayName = SwitchPrimitives.Root.displayName;

export { Switch };
