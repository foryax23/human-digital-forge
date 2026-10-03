import type { ReactNode } from "react";

import { useI18n } from "@/i18n";
import { cn } from "@/lib/utils";

/*
 * Numbered notes replace info icons and repeated disclaimers: a figure carries a small
 * superscript that jumps to its note in "Cum am calculat". Fixed order per step:
 * ¹ payback range, ² cost scope, ³ value of an hour, ⁴ assumptions.
 */

/** Superscript link to note `n` (target id `${idPrefix}-${n}`). */
export function NoteRef({
  n,
  idPrefix = "nota",
  className,
}: {
  n: number;
  idPrefix?: string;
  className?: string;
}) {
  const { t } = useI18n();
  return (
    <sup className={cn("ml-0.5 align-super text-[0.7em] leading-none", className)}>
      <a
        href={`#${idPrefix}-${n}`}
        aria-label={t(`Note ${n}`, `Nota ${n}`)}
        className="type-pnum rounded-sm px-px text-fg-3 no-underline transition-colors hover:text-fg focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand-line/55"
      >
        {n}
      </a>
    </sup>
  );
}

/**
 * The notes block: 1 px rule on top, title (type-h3), numbered 13 / 1.5 lines in two
 * columns from 1024 px, then the disclaimer once.
 */
export function NoteList({
  title,
  items,
  footer,
  idPrefix = "nota",
  headingId,
  className,
}: {
  title?: ReactNode;
  /** Note texts in order; note 1 is items[0]. */
  items: ReactNode[];
  /** The single disclaimer line under the notes. */
  footer?: ReactNode;
  idPrefix?: string;
  headingId?: string;
  className?: string;
}) {
  return (
    <section
      aria-labelledby={title && headingId ? headingId : undefined}
      className={cn("border-t border-rule pt-4", className)}
    >
      {title ? (
        <h3 id={headingId} className="type-h3 text-fg">
          {title}
        </h3>
      ) : null}
      <ol className={cn("grid gap-x-8 gap-y-2 lg:grid-cols-2", title ? "mt-3" : null)}>
        {items.map((item, index) => (
          <li
            key={index}
            id={`${idPrefix}-${index + 1}`}
            className="flex scroll-mt-28 gap-2 text-[0.8125rem] leading-[1.5] text-fg-2"
          >
            <span className="type-pnum w-3 shrink-0 text-fg-3">{index + 1}</span>
            <span className="min-w-0">{item}</span>
          </li>
        ))}
      </ol>
      {footer ? <p className="mt-3 text-[0.8125rem] leading-[1.5] text-fg-3">{footer}</p> : null}
    </section>
  );
}
