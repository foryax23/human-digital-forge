import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export type EditPatch = { businessTypeId?: string; city?: string; website?: string };

/** A part's heading inside a panel: type-h4 title, optional 13 px meta on the right. */
export function SubHeading({
  children,
  meta,
  id,
  className,
}: {
  children: ReactNode;
  /** The source or a count, e.g. "Lighthouse, mobil". */
  meta?: ReactNode;
  id?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "mb-2 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1",
        className,
      )}
    >
      <h3 id={id} className="type-h4 text-fg">
        {children}
      </h3>
      {meta ? <p className="text-[0.8125rem] leading-[1.35] text-fg-3">{meta}</p> : null}
    </div>
  );
}

/** Nothing to show: a title, one sentence and an optional action, on a plain 1 px frame. */
export function EmptyState({
  title,
  body,
  action,
  className,
}: {
  title: ReactNode;
  body: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("rounded-lg border border-line-2 px-4 py-4 sm:px-5", className)}>
      <p className="type-h4 text-fg">{title}</p>
      <p className="mt-1 max-w-[64ch] text-sm leading-[1.5] text-fg-2">{body}</p>
      {action ? <div className="mt-3">{action}</div> : null}
    </div>
  );
}
