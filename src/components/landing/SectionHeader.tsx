import type { ReactNode } from "react";
import type { LinkProps } from "@tanstack/react-router";
import { motion } from "motion/react";

import { GradientText } from "@/components/cinematic/GradientText";
import { cn } from "@/lib/utils";
import { RingButton } from "./RingButton";

/** Emphasised word inside a heading — the brand gradient (no serif in the Vortex type system). */
export function Em({ children }: { children: ReactNode }) {
  return <GradientText>{children}</GradientText>;
}

/** Thin rule + uppercase label used above every section heading. */
export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <span aria-hidden className="h-px w-8 bg-border" />
      <span className="text-xs uppercase tracking-[0.3em] text-muted-foreground">{children}</span>
    </div>
  );
}

/**
 * Section header shared by the homepage sections: eyebrow, heading with an
 * emphasised word (<Em>), supporting line and an optional desktop-only action.
 */
export function SectionHeader({
  eyebrow,
  title,
  description,
  action,
  align = "start",
  className,
  headingId,
}: {
  eyebrow: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  action?: { label: ReactNode; to: LinkProps["to"] };
  align?: "start" | "center";
  className?: string;
  headingId?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-100px" }}
      transition={{ duration: 1, ease: [0.25, 0.1, 0.25, 1] }}
      className={cn(
        "mb-10 flex flex-col gap-6 md:mb-14",
        align === "center"
          ? "items-center text-center"
          : "md:flex-row md:items-end md:justify-between",
        className,
      )}
    >
      <div className={cn("max-w-2xl", align === "center" && "flex flex-col items-center")}>
        <Eyebrow>{eyebrow}</Eyebrow>
        <h2
          id={headingId}
          className="mt-5 font-display text-4xl font-semibold tracking-tight text-foreground md:text-5xl lg:text-6xl"
        >
          {title}
        </h2>
        {description && (
          <p className="mt-4 max-w-xl text-sm text-muted-foreground md:text-base">{description}</p>
        )}
      </div>
      {action && (
        <RingButton
          to={action.to}
          variant="outline"
          arrow="right"
          className="hidden md:inline-flex"
        >
          {action.label}
        </RingButton>
      )}
    </motion.div>
  );
}
