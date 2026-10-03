import * as React from "react";

import { cn } from "@/lib/utils";

/** Multi-line field in the input's look (8 px corners, quiet fill, violet focus). */
const Textarea = React.forwardRef<HTMLTextAreaElement, React.ComponentProps<"textarea">>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        className={cn(
          "flex min-h-[80px] w-full min-w-0 rounded-lg border border-line-3 bg-fill-1 px-3 py-2 text-base leading-[1.5] text-fg outline-none transition-[border-color,box-shadow] duration-150 placeholder:text-fg-3 sm:text-sm",
          "focus-visible:border-brand-line/75 focus-visible:ring-3 focus-visible:ring-brand-line/18",
          "aria-invalid:border-bad/60 aria-invalid:focus-visible:ring-bad/18",
          "disabled:cursor-not-allowed disabled:opacity-[0.42]",
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Textarea.displayName = "Textarea";

export { Textarea };
