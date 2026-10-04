import * as React from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";

import { cn } from "@/lib/utils";

const Tabs = TabsPrimitive.Root;

/*
 * Underline tabs on a 1 px baseline: DM 500 14 in the label colour, the active tab in the
 * text colour with a 2 px cyan underline (the hero indicator's echo). No pill, icon or glow.
 * The baseline is an inset shadow so the active underline covers it inside the list.
 */
const TabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.List
    ref={ref}
    className={cn(
      "flex h-10 w-full items-stretch gap-6 overflow-x-auto text-fg-3 shadow-[inset_0_-1px_0_var(--vx-line-1)] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
      className,
    )}
    {...props}
  />
));
TabsList.displayName = TabsPrimitive.List.displayName;

const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(
      "inline-flex shrink-0 cursor-pointer items-center whitespace-nowrap border-b-2 border-transparent font-sans text-sm font-medium text-fg-3 transition-colors duration-150 hover:text-fg-2",
      "focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-brand-line",
      "disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-[0.42]",
      "data-[state=active]:border-echo data-[state=active]:text-fg",
      className,
    )}
    {...props}
  />
));
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName;

const TabsContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn(
      "mt-4 rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-line",
      className,
    )}
    {...props}
  />
));
TabsContent.displayName = TabsPrimitive.Content.displayName;

export { Tabs, TabsList, TabsTrigger, TabsContent };
