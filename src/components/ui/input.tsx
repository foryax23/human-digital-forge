import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Text field: 36 px (pass h-10 in dialogs and forms), 8 px corners, quiet fill, violet
 * focus edge and ring, red edge when aria-invalid. 16 px text on phones so iOS does not
 * zoom into the field, 14 px from 640 px up.
 */
const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-9 w-full min-w-0 rounded-lg border border-line-3 bg-fill-1 px-3 py-1 text-base text-fg outline-none transition-[border-color,box-shadow] duration-150 placeholder:text-fg-3 sm:text-sm",
          "file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-fg",
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
Input.displayName = "Input";

export { Input };
