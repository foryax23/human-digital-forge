import { useId, useRef, type KeyboardEvent, type ReactNode } from "react";
import { motion } from "motion/react";

import { cn } from "@/lib/utils";

export type SegmentOption<T extends string> = { value: T; label: string; icon?: ReactNode };

/**
 * Pill toggle with a sliding highlight, exposed as a radio group (arrow keys
 * move and select, Home/End jump) so it reads as "one of N" to assistive tech.
 */
export function SegmentedControl<T extends string>({
  value,
  onChange,
  options,
  label,
  size = "md",
  className,
}: {
  value: T;
  onChange: (value: T) => void;
  options: SegmentOption<T>[];
  /** Accessible name of the group. */
  label: string;
  size?: "sm" | "md";
  className?: string;
}) {
  const layoutId = `segment-${useId()}`;
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
        "relative inline-flex max-w-full items-center rounded-full border border-white/10 bg-[#04061a]/80 p-1 backdrop-blur",
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
              "relative inline-flex min-w-0 items-center justify-center gap-2 whitespace-nowrap rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#89cbf6]/80 [&_svg]:h-4 [&_svg]:w-4 [&_svg]:shrink-0",
              size === "sm" ? "type-body-sm h-8 px-3 font-medium" : "type-button h-9 px-4",
              active ? "text-white" : "text-white/55 hover:text-white/85",
            )}
          >
            {active && (
              <motion.span
                layoutId={layoutId}
                aria-hidden
                className="absolute inset-0 rounded-full bg-primary"
                transition={{ type: "spring", stiffness: 420, damping: 36 }}
              />
            )}
            <span className="relative z-10 inline-flex items-center gap-2">
              {option.icon}
              {option.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
