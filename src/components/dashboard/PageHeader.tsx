import type { ReactNode } from "react";

import { Panel, PanelBody, Spinner } from "@/components/system";
import { cn } from "@/lib/utils";

/** The title row of a workspace page: title, one lead line, actions on the right. */
export function PageHeader({
  title,
  lead,
  actions,
  className,
}: {
  title: ReactNode;
  lead?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <header
      className={cn(
        "flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between sm:gap-6",
        className,
      )}
    >
      <div className="min-w-0">
        <h1 className="type-title text-balance text-fg">{title}</h1>
        {lead ? (
          <p className="type-body mt-1.5 max-w-[64ch] text-pretty text-fg-2">{lead}</p>
        ) : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}

/** A quiet loading line (the page's own data, not the whole workspace). */
export function Loading({ label, className }: { label: string; className?: string }) {
  return (
    <p className={cn("type-body-sm flex items-center gap-2 text-fg-3", className)} role="status">
      <Spinner size={14} />
      {label}
    </p>
  );
}

/** A read that failed: one sentence and how to retry. */
export function LoadError({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <p
      role="alert"
      className={cn("type-body-sm rounded-lg border border-bad/30 px-4 py-3 text-fg-2", className)}
    >
      {children}
    </p>
  );
}

/** An empty list: a title, one sentence and at most one action. No icon tile. */
export function EmptyPanel({
  title,
  children,
  action,
  className,
}: {
  title: ReactNode;
  children?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <Panel className={className}>
      <PanelBody className="flex flex-col items-start gap-3 py-6 sm:py-8">
        <div className="min-w-0">
          <h2 className="type-h4 text-fg">{title}</h2>
          {children ? (
            <p className="type-body-sm mt-1 max-w-[60ch] text-pretty text-fg-3">{children}</p>
          ) : null}
        </div>
        {action}
      </PanelBody>
    </Panel>
  );
}
