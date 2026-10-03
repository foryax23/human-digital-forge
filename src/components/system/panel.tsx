import { forwardRef, type HTMLAttributes, type ReactNode } from "react";

import { cn } from "@/lib/utils";
import { PANEL, RECOMMENDED_EDGE } from "./tone";

/*
 * Panels: one level only, solid (the ASCII backdrop never shows through data), split
 * inside by 1 px hairlines. Never a card inside a panel; at most 2 side by side.
 * Padding: header 16 20 12, body 16 20, footer 12 20; 16 on phones.
 */

type PanelProps = HTMLAttributes<HTMLElement> & {
  as?: "div" | "section" | "article" | "aside";
  /** The recommended card: violet edge at 42% (pair it with Tag variant="start"). */
  recommended?: boolean;
};

export const Panel = forwardRef<HTMLElement, PanelProps>(
  ({ as: Comp = "div", recommended = false, className, ...props }, ref) => (
    <Comp
      // One ref type for every tag the panel can render as.
      ref={ref as never}
      className={cn(PANEL, recommended && RECOMMENDED_EDGE, className)}
      {...props}
    />
  ),
);
Panel.displayName = "Panel";

export function PanelHeader({
  title,
  sub,
  actions,
  titleAs: Title = "h3",
  titleId,
  className,
  children,
}: {
  title: ReactNode;
  /** One 13 px line under the title. */
  sub?: ReactNode;
  /** Small buttons or a segmented control, right-aligned. */
  actions?: ReactNode;
  titleAs?: "h2" | "h3" | "h4";
  titleId?: string;
  className?: string;
  /** Extra content under the title row (a progress bar, a filter row). */
  children?: ReactNode;
}) {
  return (
    <div data-slot="panel-header" className={cn("px-4 pb-3 pt-4 sm:px-5", className)}>
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">
          <Title id={titleId} className="type-h3 text-balance text-fg">
            {title}
          </Title>
          {sub ? <p className="mt-1 text-[0.8125rem] leading-[1.45] text-fg-3">{sub}</p> : null}
        </div>
        {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
      </div>
      {children}
    </div>
  );
}

export function PanelBody({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      data-slot="panel-body"
      // Right under a header the title-to-content gap stays 16 px (12 + 4).
      className={cn("p-4 sm:px-5 [[data-slot=panel-header]+&]:pt-1", className)}
      {...props}
    />
  );
}

export function PanelFooter({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      data-slot="panel-footer"
      className={cn(
        "flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-line-1 px-4 py-3 text-[0.8125rem] leading-[1.45] text-fg-3 sm:px-5",
        className,
      )}
      {...props}
    />
  );
}

/** A 1 px hairline between parts of a panel. */
export function PanelDivider({ className }: { className?: string }) {
  return <hr className={cn("m-0 h-px border-0 bg-line-1", className)} />;
}
