import type { MouseEventHandler, ReactNode } from "react";
import { Link, type LinkProps } from "@tanstack/react-router";
import { ArrowRight, ArrowUpRight } from "lucide-react";

import { useI18n } from "@/i18n";
import { cn } from "@/lib/utils";

type Variant = "solid" | "outline" | "pill";
type Size = "md" | "sm";

type RingButtonProps = {
  children: ReactNode;
  variant?: Variant;
  size?: Size;
  arrow?: "up-right" | "right";
  className?: string;
  /** Classes for the inner face (overrides variant colours when needed). */
  innerClassName?: string;
  onClick?: MouseEventHandler<HTMLElement>;
  "aria-label"?: string;
} & (
  | { to: LinkProps["to"]; href?: never; hash?: string }
  | { href: string; to?: never; hash?: never }
  | { to?: never; href?: never; hash?: never }
);

const faces: Record<Variant, string> = {
  // The site's one primary: solid brand violet (as the nav's CTA), lifting on hover
  // as the gradient ring shows.
  solid: "bg-[#5b52f0] text-white group-hover:bg-[#6a62f6] group-focus-visible:bg-[#6a62f6]",
  // Dark pill with a stroke that gives way to the gradient ring on hover.
  outline:
    "border-2 border-border bg-background text-foreground group-hover:border-transparent group-focus-visible:border-transparent",
  // Frosted pill used in the nav.
  pill: "bg-card text-foreground backdrop-blur-md",
};

const sizes: Record<Size, string> = {
  md: "px-7 py-3.5",
  sm: "px-3 py-1.5 sm:px-4 sm:py-2",
};

/**
 * Rounded button whose hover state reveals the animated brand-gradient ring
 * (an absolutely positioned layer at inset -2px behind the face).
 * Renders a router Link for `to`, an anchor for `href`, else a button.
 */
export function RingButton(props: RingButtonProps) {
  const { t } = useI18n();
  const {
    children,
    variant = "solid",
    size = "md",
    arrow,
    className,
    innerClassName,
    onClick,
    "aria-label": ariaLabel,
  } = props;

  const outer = cn(
    "group relative inline-flex shrink-0 rounded-full outline-none transition-transform duration-300",
    size === "md" && "hover:scale-105 motion-reduce:hover:scale-100",
    className,
  );

  const content = (
    <>
      <span
        aria-hidden
        className="accent-gradient-animated pointer-events-none absolute -inset-[2px] rounded-full opacity-0 transition-opacity duration-300 group-hover:opacity-100 group-focus-visible:opacity-100"
      />
      <span
        className={cn(
          "type-button relative z-10 inline-flex items-center justify-center gap-2 rounded-full transition-colors duration-300",
          sizes[size],
          faces[variant],
          innerClassName,
        )}
      >
        {children}
        {arrow === "up-right" && (
          <ArrowUpRight className="h-4 w-4 transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
        )}
        {arrow === "right" && (
          <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5" />
        )}
      </span>
    </>
  );

  if (props.to !== undefined) {
    return (
      <Link
        to={props.to}
        hash={props.hash}
        className={outer}
        onClick={onClick}
        aria-label={ariaLabel}
      >
        {content}
      </Link>
    );
  }
  if (props.href !== undefined) {
    const external = /^https?:\/\//.test(props.href);
    return (
      <a
        href={props.href}
        className={outer}
        onClick={onClick}
        aria-label={ariaLabel}
        {...(external ? { target: "_blank", rel: "noreferrer" } : {})}
      >
        {content}
        {external && (
          <span className="sr-only">
            {t(" (opens in a new tab)", " (se deschide într-o filă nouă)")}
          </span>
        )}
      </a>
    );
  }
  return (
    <button type="button" className={outer} onClick={onClick} aria-label={ariaLabel}>
      {content}
    </button>
  );
}
