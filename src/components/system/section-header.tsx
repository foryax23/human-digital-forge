import type { ReactNode } from "react";

import { useI18n } from "@/i18n";
import { cn } from "@/lib/utils";
import { Tag } from "./marker";
import { keepHyphens } from "./text";

/** The quiet second clause of a title: emphasis by contrast, never a gradient word. */
export function Muted({ children }: { children: ReactNode }) {
  return <span className="text-fg-3">{children}</span>;
}

/**
 * Homepage section header. Kicker (sentence case, on at most 3 sections) 8 px above the
 * title, lead 12 px under it, 32 / 40 px to the content.
 * - `stacked`: title block left, actions right on md+.
 * - `split`: title column 5/12 + content 7/12 on lg; pass the content as children.
 */
export function SectionHeader({
  kicker,
  title,
  lead,
  actions,
  layout = "stacked",
  headingId,
  as: Heading = "h2",
  className,
  children,
}: {
  kicker?: ReactNode;
  title: ReactNode;
  lead?: ReactNode;
  actions?: ReactNode;
  layout?: "stacked" | "split";
  headingId?: string;
  as?: "h1" | "h2";
  className?: string;
  /** Split layout only: the content column. */
  children?: ReactNode;
}) {
  const titleBlock = (
    <div className="min-w-0 max-w-3xl">
      {kicker ? <p className="type-label mb-2 text-fg-3">{kicker}</p> : null}
      <Heading id={headingId} className="type-h2 text-balance text-fg">
        {keepHyphens(title)}
      </Heading>
      {lead ? (
        <p className="type-lead mt-3 max-w-[56ch] text-pretty text-fg-2">{keepHyphens(lead)}</p>
      ) : null}
    </div>
  );

  if (layout === "split") {
    return (
      <div className={cn("grid gap-8 lg:grid-cols-12 lg:gap-12", className)}>
        <header className="flex flex-col gap-5 lg:col-span-5">
          {titleBlock}
          {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
        </header>
        <div className="min-w-0 lg:col-span-7">{children}</div>
      </div>
    );
  }

  return (
    <header
      className={cn(
        "mb-8 flex flex-col gap-4 md:mb-10 md:flex-row md:items-end md:justify-between",
        className,
      )}
    >
      {titleBlock}
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}

/**
 * Scan step header: company line, title (type-title), one-line lead, actions right. No
 * eyebrow (the step bar names the step), no gradient word; ≤ 110 px tall on desktop.
 * Appears with a 160 ms fade at most.
 */
export function StepHeader({
  id,
  company,
  place,
  demo = false,
  title,
  lead,
  actions,
  as: Heading = "h2",
  className,
}: {
  /** Id of the heading, for aria-labelledby on the step. */
  id?: string;
  /** Company name (DM 500 13, secondary text). */
  company?: ReactNode;
  /** City, after the name in the label colour. */
  place?: ReactNode;
  /** Demo data: adds the dashed "Date de exemplu" tag. */
  demo?: boolean;
  title: ReactNode;
  lead?: ReactNode;
  actions?: ReactNode;
  as?: "h1" | "h2";
  className?: string;
}) {
  const { t } = useI18n();
  const hasCompanyLine = Boolean(company || place || demo);

  return (
    <header
      className={cn(
        "flex flex-col gap-3 duration-[160ms] animate-in fade-in-0 md:flex-row md:items-end md:justify-between md:gap-6",
        className,
      )}
    >
      <div className="min-w-0">
        {hasCompanyLine ? (
          <p className="mb-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[0.8125rem] font-medium leading-[1.35] text-fg-2">
            {company ? <span className="min-w-0">{company}</span> : null}
            {/* fg-2, not fg-3: the line sits on the bare backdrop (4.5:1 over its brightest glyphs). */}
            {place ? <span className="text-fg-2">{place}</span> : null}
            {demo ? <Tag variant="dashed">{t("Sample data", "Date de exemplu")}</Tag> : null}
          </p>
        ) : null}
        <Heading id={id} className="type-title text-balance text-fg">
          {keepHyphens(title)}
        </Heading>
        {lead ? (
          <p className="mt-1.5 max-w-[72ch] text-[0.9375rem] leading-[1.5] text-fg-2">{lead}</p>
        ) : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}
