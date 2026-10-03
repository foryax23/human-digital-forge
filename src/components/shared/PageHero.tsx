import type { ReactNode } from "react";

import { keepHyphens } from "@/components/system";

/**
 * Opening block of the pages in SiteLayout: an optional kicker (sentence case), the page
 * title, one lead paragraph and optional actions, on a hairline. Same type roles as the
 * homepage section headers; no eyebrow rule, no gradient word.
 */
export function PageHero({
  kicker,
  title,
  description,
  children,
}: {
  kicker?: string;
  title: ReactNode;
  description?: ReactNode;
  /** Actions under the lead (buttons, links). */
  children?: ReactNode;
}) {
  return (
    <section className="border-b border-line-1">
      <div className="container-vx pb-10 pt-10 md:pb-14 md:pt-16">
        <div className="max-w-3xl">
          {kicker && <p className="type-label mb-2 text-fg-3">{kicker}</p>}
          <h1 className="type-h2 text-balance text-fg">{keepHyphens(title)}</h1>
          {description && (
            <p className="type-lead mt-3 max-w-[60ch] text-pretty text-fg-2">{description}</p>
          )}
          {children && <div className="mt-6 flex flex-wrap items-center gap-3">{children}</div>}
        </div>
      </div>
    </section>
  );
}
