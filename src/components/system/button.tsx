import {
  forwardRef,
  type AnchorHTMLAttributes,
  type ButtonHTMLAttributes,
  type ReactNode,
} from "react";
import { createLink } from "@tanstack/react-router";

import { cn } from "@/lib/utils";
import { Spinner } from "./spinner";
import { FOCUS_RING } from "./tone";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "link";
export type ButtonSize = "sm" | "md" | "lg";

const BASE = cn(
  "inline-flex shrink-0 cursor-pointer select-none items-center justify-center gap-2 whitespace-nowrap font-sans font-medium leading-none",
  "transition-[background-color,border-color,color,text-decoration-color] duration-150",
  "disabled:pointer-events-none disabled:opacity-[0.42] aria-disabled:pointer-events-none aria-disabled:opacity-[0.42]",
  "[&_svg]:pointer-events-none [&_svg]:shrink-0",
  FOCUS_RING,
);

// lg 40 / md 36 / sm 28; icons 16 / 16 / 14. On phones lg is 44 (the page's main actions
// and their pairs), and so is a primary md (PRIMARY_PHONE below): touch targets of 44 px.
const SIZES: Record<ButtonSize, string> = {
  sm: "h-7 rounded-md px-2.5 text-[0.8125rem] [&_svg]:size-3.5",
  md: "h-9 rounded-lg px-3.5 text-sm [&_svg]:size-4",
  lg: "h-10 rounded-lg px-4 text-sm max-sm:h-11 [&_svg]:size-4",
};

/** The one primary action per screen is a 44 px target on phones at md size too. */
const PRIMARY_PHONE = "max-sm:h-11";

// A text link keeps the type size but has no box; it is still a 24 px target (WCAG 2.5.8).
const LINK_SIZES: Record<ButtonSize, string> = {
  sm: "min-h-6 rounded-sm text-[0.8125rem] [&_svg]:size-3.5",
  md: "min-h-6 rounded-sm text-sm [&_svg]:size-4",
  lg: "min-h-6 rounded-sm text-sm [&_svg]:size-4",
};

const VARIANTS: Record<ButtonVariant, string> = {
  // One per viewport: solid violet, a 1 px inner highlight on the top edge, no glow.
  primary: "bg-brand text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.12)] hover:bg-brand-hover",
  secondary: "border border-line-3 bg-fill-1 text-fg hover:border-fg/25 hover:bg-fill-2",
  ghost: "text-fg-2 hover:bg-fill-2 hover:text-fg",
  link: "text-fg underline decoration-fg/30 decoration-1 underline-offset-4 hover:decoration-fg",
};

/** Class names for buttons and button-styled links (lg 40, md 36, sm 28; 8 px corners). */
export function buttonClass(
  variant: ButtonVariant = "primary",
  size: ButtonSize = "md",
  className?: string,
) {
  return cn(
    BASE,
    variant === "link" ? LINK_SIZES[size] : SIZES[size],
    variant === "primary" && size === "md" ? PRIMARY_PHONE : null,
    VARIANTS[variant],
    className,
  );
}

type ButtonLookProps = {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Leading icon; shown only when it acts (download, copy, edit, external link). */
  icon?: ReactNode;
  /** Trailing icon (chevron, external link). */
  iconEnd?: ReactNode;
};

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> &
  ButtonLookProps & {
    /** Spinner replaces the icon and the label stays ("Se generează…"); clicks are ignored. */
    loading?: boolean;
  };

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant,
      size,
      icon,
      iconEnd,
      loading = false,
      className,
      type = "button",
      children,
      ...props
    },
    ref,
  ) => (
    <button
      ref={ref}
      type={type}
      aria-busy={loading || undefined}
      className={buttonClass(variant, size, cn(loading && "pointer-events-none", className))}
      {...props}
    >
      {loading ? <Spinner size={size === "sm" ? 12 : 14} /> : icon}
      {children}
      {iconEnd}
    </button>
  ),
);
Button.displayName = "Button";

type ButtonAnchorProps = AnchorHTMLAttributes<HTMLAnchorElement> & ButtonLookProps;

const ButtonAnchor = forwardRef<HTMLAnchorElement, ButtonAnchorProps>(
  ({ variant, size, icon, iconEnd, className, children, ...props }, ref) => (
    <a ref={ref} className={buttonClass(variant, size, className)} {...props}>
      {icon}
      {children}
      {iconEnd}
    </a>
  ),
);
ButtonAnchor.displayName = "ButtonAnchor";

/** A TanStack Router `Link` in the button look (typed `to`, `search`, `params`). */
export const ButtonLink = createLink(ButtonAnchor);

export type IconButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  /** Accessible name; the button shows only its icon. */
  label: string;
  /** sm 28 px (radius 6, icon 14), md 36 px (radius 8, icon 16). */
  size?: "sm" | "md";
  variant?: "ghost" | "secondary";
};

/** Square icon-only button: close, pause, copy, previous / next. */
export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  (
    { label, size = "sm", variant = "ghost", className, type = "button", children, ...props },
    ref,
  ) => (
    <button
      ref={ref}
      type={type}
      aria-label={label}
      className={cn(
        BASE,
        VARIANTS[variant],
        size === "sm" ? "size-7 rounded-md [&_svg]:size-3.5" : "size-9 rounded-lg [&_svg]:size-4",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  ),
);
IconButton.displayName = "IconButton";
