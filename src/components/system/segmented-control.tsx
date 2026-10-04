import { useRef, type KeyboardEvent, type ReactNode } from "react";

import { cn } from "@/lib/utils";

export type SegmentOption<T extends string> = {
  value: T;
  label: string;
  /** Accepted for older call sites and not drawn: segments carry words, never icons. */
  icon?: ReactNode;
};

/**
 * One of N, exposed as a radio group (arrow keys move and select, Home/End jump).
 * Shell 30 px on a quiet fill; the active segment is a neutral raised fill, never violet,
 * and the change is instant (no sliding highlight).
 */
export function SegmentedControl<T extends string>({
  value,
  onChange,
  options,
  label,
  className,
}: {
  value: T;
  onChange: (value: T) => void;
  options: SegmentOption<T>[];
  /** Accessible name of the group. */
  label: string;
  /** Accepted for older call sites; there is one size. */
  size?: "sm" | "md";
  className?: string;
}) {
  const refs = useRef<Array<HTMLButtonElement | null>>([]);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const current = options.findIndex((option) => option.value === value);
    let next = current;
    if (event.key === "ArrowRight" || event.key === "ArrowDown") next = current + 1;
    else if (event.key === "ArrowLeft" || event.key === "ArrowUp") next = current - 1;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = options.length - 1;
    else return;
    event.preventDefault();
    next = (next + options.length) % options.length;
    onChange(options[next].value);
    refs.current[next]?.focus();
  };

  return (
    <div
      role="radiogroup"
      aria-label={label}
      onKeyDown={onKeyDown}
      className={cn(
        // The 1 px edge is an inset shadow so the shell stays 30 px: 26 px segments + 2 px padding.
        "inline-grid h-[30px] max-w-full shrink-0 auto-cols-fr grid-flow-col items-center gap-0.5 rounded-lg bg-fill-1 p-0.5 shadow-[inset_0_0_0_1px_var(--vx-line-2)]",
        className,
      )}
    >
      {options.map((option, index) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            ref={(node) => {
              refs.current[index] = node;
            }}
            type="button"
            role="radio"
            aria-checked={active}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(option.value)}
            className={cn(
              "inline-flex h-[26px] min-w-0 cursor-pointer items-center justify-center whitespace-nowrap rounded-md px-2.5 font-sans text-[0.8125rem] font-medium leading-none",
              "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand-line",
              active
                ? "bg-fill-3 text-fg shadow-[0_1px_0_rgb(0_0_0/0.3)]"
                : "text-fg-3 hover:text-fg-2",
            )}
          >
            <span className="truncate">{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}
