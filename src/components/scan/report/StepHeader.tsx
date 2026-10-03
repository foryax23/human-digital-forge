import type { ReactNode } from "react";

import { StepHeader as SystemStepHeader } from "@/components/system";

/**
 * Title block of a scan step, in the refresh's `step` look (system/section-header.tsx):
 * company line, title, one-line lead, actions on the right, ≤ 110 px tall on desktop.
 * Kept as a thin adapter so the steps not migrated yet keep their props: `description`
 * is the lead, `aside` the actions, and `eyebrow` is ignored (the step bar names the step).
 */
export function StepHeader({
  id,
  title,
  description,
  lead,
  aside,
  actions,
  company,
  place,
  demo,
  className,
}: {
  id: string;
  /** @deprecated Not drawn: the step bar above already names the step. */
  eyebrow?: string;
  title: ReactNode;
  /** @deprecated Use `lead`. */
  description?: ReactNode;
  lead?: ReactNode;
  /** @deprecated Use `actions`. */
  aside?: ReactNode;
  actions?: ReactNode;
  company?: ReactNode;
  place?: ReactNode;
  /** Adds the dashed "Date de exemplu" tag to the company line. */
  demo?: boolean;
  className?: string;
}) {
  return (
    <SystemStepHeader
      id={id}
      title={title}
      lead={lead ?? description}
      actions={actions ?? aside}
      company={company}
      place={place}
      demo={demo}
      className={className}
    />
  );
}
