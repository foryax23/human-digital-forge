import { useId } from "react";
import * as SliderPrimitive from "@radix-ui/react-slider";

import { cn } from "@/lib/utils";

// The round thumb is the one circle here.
const THUMB =
  "block size-3.5 rounded-full border border-black/40 bg-white transition-[outline-color] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-line"; /* dot */

/**
 * Single-thumb slider: label and readout on one row, a 2 px track with the
 * filled part in the brand line colour, a 14 px white thumb, plain words at
 * the ends ("jumătate" / "dublu") and an optional 12 px hint.
 */
export function BrandSlider({
  label,
  value,
  min,
  max,
  step,
  onChange,
  display,
  valueText,
  hint,
  bounds,
  className,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
  /** Readout next to the label, e.g. "8 persoane". */
  display: string;
  /** Spoken value for screen readers (defaults to `display`). */
  valueText?: string;
  hint?: string;
  /** Labels under the track ends (default: min and max). */
  bounds?: [string, string];
  className?: string;
}) {
  const labelId = useId();
  return (
    <div className={cn("min-w-0", className)}>
      <div className="flex items-baseline justify-between gap-3">
        <span id={labelId} className="text-[0.8125rem] font-medium leading-[1.35] text-fg-2">
          {label}
        </span>
        <span className="type-pnum text-right text-[0.8125rem] leading-[1.35] text-fg">
          {display}
        </span>
      </div>
      <SliderPrimitive.Root
        value={[value]}
        min={min}
        max={max}
        step={step}
        onValueChange={(next) => onChange(next[0] ?? value)}
        className="relative mt-2 flex h-5 w-full cursor-pointer touch-none select-none items-center"
      >
        <SliderPrimitive.Track className="relative h-0.5 w-full grow overflow-hidden bg-line-3">
          <SliderPrimitive.Range className="absolute h-full bg-brand-line" />
        </SliderPrimitive.Track>
        <SliderPrimitive.Thumb
          aria-labelledby={labelId}
          aria-valuetext={valueText ?? display}
          className={THUMB}
        />
      </SliderPrimitive.Root>
      <div aria-hidden className="mt-1 flex justify-between text-xs leading-[1.3] text-fg-3">
        <span>{bounds?.[0] ?? min}</span>
        <span>{bounds?.[1] ?? max}</span>
      </div>
      {hint ? <p className="mt-1.5 text-xs leading-[1.45] text-fg-3">{hint}</p> : null}
    </div>
  );
}
