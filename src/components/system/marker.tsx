import type { ReactNode } from "react";

import { useI18n } from "@/i18n";
import { cn } from "@/lib/utils";
import { TONE_FILL, type Tone } from "./tone";

/*
 * Markers: the replacement for every pill. At most one per card or row, only when the
 * data makes it true. Never an icon inside, never in capitals.
 */

/**
 * Status: a 6 px square plus a plain word ("Lipsește", "Există", "Neverificat").
 * `shape="dot"` is kept for the homepage footer's "online" indicator only.
 */
export function Status({
  tone = "neutral",
  shape = "square",
  size = "md",
  children,
  className,
}: {
  tone?: Tone;
  shape?: "square" | "dot";
  /** md 13 px (lists, rows); sm 12 px (inside a field, the search menu). */
  size?: "sm" | "md";
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex min-w-0 items-center gap-1.5 font-medium leading-[1.35] text-fg-2",
        size === "sm" ? "text-xs" : "text-[0.8125rem]",
        className,
      )}
    >
      <span
        aria-hidden
        className={cn(
          "size-1.5 shrink-0",
          shape === "dot" ? "rounded-full" /* dot */ : "rounded-[1px]",
          TONE_FILL[tone],
        )}
      />
      <span className="min-w-0">{children}</span>
    </span>
  );
}

export type PriorityLevel = "high" | "medium" | "low";

const LIT: Record<PriorityLevel, number> = { high: 3, medium: 2, low: 1 };
// Bars 4 / 7 / 10 px tall, 2 px wide, 2 px apart.
const BAR_HEIGHTS = ["h-1", "h-[7px]", "h-2.5"];

/** Priority: a three-bar signal plus "Prioritate mare / medie / mică". */
export function Priority({
  level,
  children,
  className,
}: {
  level: PriorityLevel;
  /** Overrides the default label. */
  children?: ReactNode;
  className?: string;
}) {
  const { t } = useI18n();
  const label =
    children ??
    (level === "high"
      ? t("High priority", "Prioritate mare")
      : level === "medium"
        ? t("Medium priority", "Prioritate medie")
        : t("Low priority", "Prioritate mică"));

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-[0.8125rem] font-medium leading-[1.35] text-fg-2",
        className,
      )}
    >
      <span aria-hidden className="inline-flex h-2.5 shrink-0 items-end gap-0.5">
        {BAR_HEIGHTS.map((height, index) => (
          <span
            key={height}
            className={cn(
              "w-0.5 rounded-[1px]",
              height,
              index < LIT[level] ? "bg-fg-2" : "bg-fg-4",
            )}
          />
        ))}
      </span>
      {label}
    </span>
  );
}

export type TagVariant = "outline" | "dashed" | "start";

const TAG_VARIANTS: Record<TagVariant, string> = {
  // Categories in lists and filters: Automatizare, Site, Asistent AI, Opțional.
  outline: "border border-line-3 text-fg-2",
  // Assumptions: "De confirmat", "Date de exemplu".
  dashed: "border border-dashed border-line-3 text-fg-3",
  // "Începem aici": once per page, always followed by its reason sentence.
  start: "bg-brand-tint text-brand-fg",
};

/** Tag: 20 px, 4 px corners, 12 px sentence-case text. */
export function Tag({
  variant = "outline",
  children,
  className,
}: {
  variant?: TagVariant;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex h-5 max-w-full shrink-0 items-center whitespace-nowrap rounded-sm px-1.5 text-xs font-medium leading-none",
        TAG_VARIANTS[variant],
        className,
      )}
    >
      <span className="truncate">{children}</span>
    </span>
  );
}

/** Count: a quiet number next to a label or filter ("Probleme 3"). */
export function Count({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "type-num inline-flex h-[18px] min-w-[18px] shrink-0 items-center justify-center rounded-sm bg-fill-3 px-[5px] text-xs leading-none text-fg-2",
        className,
      )}
    >
      {children}
    </span>
  );
}

/** Keyboard key, lowercase, for the search menu on desktop pointers only. */
export function Kbd({
  size = "sm",
  children,
  className,
}: {
  /** sm 18 px, md 20 px. */
  size?: "sm" | "md";
  children: ReactNode;
  className?: string;
}) {
  return (
    <kbd
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-sm border border-b-[1.5px] border-line-3 px-[5px] font-sans text-[11px] font-medium lowercase leading-none text-fg-3",
        size === "sm" ? "h-[18px] min-w-[18px]" : "h-5 min-w-5",
        className,
      )}
    >
      {children}
    </kbd>
  );
}
