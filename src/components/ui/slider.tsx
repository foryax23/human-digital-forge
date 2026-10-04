import * as React from "react";
import * as SliderPrimitive from "@radix-ui/react-slider";

import { cn } from "@/lib/utils";

const Slider = React.forwardRef<
  React.ElementRef<typeof SliderPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SliderPrimitive.Root>
>(({ className, ...props }, ref) => (
  <SliderPrimitive.Root
    ref={ref}
    className={cn("relative flex w-full touch-none select-none items-center", className)}
    {...props}
  >
    <SliderPrimitive.Track className="relative h-0.5 w-full grow overflow-hidden rounded-full bg-line-3">
      <SliderPrimitive.Range className="absolute h-full bg-brand-line" />
    </SliderPrimitive.Track>
    <SliderPrimitive.Thumb className="block size-3.5 cursor-pointer rounded-full border border-black/40 bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-line disabled:pointer-events-none disabled:opacity-[0.42]" />
  </SliderPrimitive.Root>
));
Slider.displayName = SliderPrimitive.Root.displayName;

export { Slider };
