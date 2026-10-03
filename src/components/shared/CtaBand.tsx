import type { LinkProps } from "@tanstack/react-router";

import { ButtonLink, keepHyphens } from "@/components/system";

/**
 * Closing call to action of a page: title and one line on a rule, the primary action and
 * an optional secondary one beside it. No dark box, no glow.
 */
export function CtaBand({
  title,
  description,
  primaryLabel,
  primaryTo,
  secondaryLabel,
  secondaryTo,
}: {
  title: string;
  description?: string;
  primaryLabel: string;
  primaryTo: LinkProps["to"];
  secondaryLabel?: string;
  secondaryTo?: LinkProps["to"];
}) {
  return (
    <section className="container-vx section-y">
      <div className="flex flex-col gap-6 border-t border-rule pt-8 md:flex-row md:items-end md:justify-between md:gap-12">
        <div className="min-w-0 max-w-2xl">
          <h2 className="type-h2 text-balance text-fg">{keepHyphens(title)}</h2>
          {description && (
            <p className="type-lead mt-3 max-w-[56ch] text-pretty text-fg-2">{description}</p>
          )}
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <ButtonLink to={primaryTo} size="lg">
            {primaryLabel}
          </ButtonLink>
          {secondaryLabel && secondaryTo && (
            <ButtonLink to={secondaryTo} size="lg" variant="secondary">
              {secondaryLabel}
            </ButtonLink>
          )}
        </div>
      </div>
    </section>
  );
}
