import { useId } from "react";
import * as SliderPrimitive from "@radix-ui/react-slider";

import { cn } from "@/lib/utils";

/** Single-thumb slider in the Vortex palette, with a visible label and readout. */
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
  /** Readout next to the label, e.g. "8 people". */
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
        <span id={labelId} className="type-body-sm text-white/80">
          {label}
        </span>
        <span className="type-body-sm font-semibold tabular-nums text-white">{display}</span>
      </div>
      <SliderPrimitive.Root
        value={[value]}
        min={min}
        max={max}
        step={step}
        onValueChange={(next) => onChange(next[0] ?? value)}
        className="relative mt-3 flex h-5 w-full touch-none select-none items-center"
      >
        <SliderPrimitive.Track className="relative h-1.5 w-full grow overflow-hidden rounded-full bg-white/10">
          <SliderPrimitive.Range className="absolute h-full rounded-full bg-gradient-to-r from-[#6c63ff] via-[#5b8cf0] to-[#89cbf6]" />
        </SliderPrimitive.Track>
        <SliderPrimitive.Thumb
          aria-labelledby={labelId}
          aria-valuetext={valueText ?? display}
          className="block h-5 w-5 rounded-full border-2 border-white bg-[#5b8cf0] shadow-[0_0_0_4px_rgb(108_99_255/0.25),0_0_18px_rgb(137_203_246/0.55)] transition-[box-shadow,transform] hover:scale-110 focus-visible:outline-none focus-visible:shadow-[0_0_0_6px_rgb(137_203_246/0.45),0_0_22px_rgb(137_203_246/0.7)] motion-reduce:hover:scale-100"
        />
      </SliderPrimitive.Root>
      <div aria-hidden className="type-tech mt-1.5 flex justify-between text-white/35">
        <span>{bounds?.[0] ?? min}</span>
        <span>{bounds?.[1] ?? max}</span>
      </div>
      {hint && <p className="type-micro mt-1 text-white/45">{hint}</p>}
    </div>
  );
}
