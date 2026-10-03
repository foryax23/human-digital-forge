import type { ReactNode } from "react";
import { motion } from "motion/react";

import { cn } from "@/lib/utils";
import { EASE_OUT } from "./motion";

/** Title block of a scan step: eyebrow (optional), accented title, intro line. */
export function StepHeader({
  id,
  eyebrow,
  title,
  description,
  aside,
  className,
}: {
  id: string;
  /** Left out where the stepper above already names the step. */
  eyebrow?: string;
  title: ReactNode;
  description: ReactNode;
  aside?: ReactNode;
  className?: string;
}) {
  return (
    <motion.header
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.7, ease: EASE_OUT }}
      className={cn("flex flex-col gap-5 md:flex-row md:items-end md:justify-between", className)}
    >
      <div className="max-w-2xl">
        {eyebrow && (
          <p className="type-label mb-3 flex items-center gap-3 text-white/55">
            <span aria-hidden className="h-px w-8 bg-border" />
            {eyebrow}
          </p>
        )}
        <h2 id={id} className="type-h2 text-balance text-white">
          {title}
        </h2>
        <p className="type-lead mt-3 text-white/65">{description}</p>
      </div>
      {aside ? <div className="shrink-0">{aside}</div> : null}
    </motion.header>
  );
}
