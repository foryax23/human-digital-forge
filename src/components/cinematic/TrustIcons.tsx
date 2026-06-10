import { cn } from "@/lib/utils";

/**
 * Layered, always-looping SVG trust icons for the "Why Vortex Hub" section.
 * Each icon is built from several groups — a soft aura, a gradient backing
 * glyph, and small accent details — that animate independently via the
 * `ti-*` utility classes defined in styles.css. Colors come from the brand
 * tokens (--primary indigo → --teal), so they stay on-theme automatically.
 * All motion respects prefers-reduced-motion (handled globally in styles.css).
 */

type IconProps = { className?: string };

const base = "block";

function Defs({ id }: { id: string }) {
  return (
    <defs>
      <linearGradient id={`${id}-stroke`} x1="6" y1="6" x2="42" y2="42" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="var(--primary)" />
        <stop offset="100%" stopColor="var(--teal)" />
      </linearGradient>
      <linearGradient id={`${id}-fill`} x1="10" y1="8" x2="38" y2="40" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.32" />
        <stop offset="100%" stopColor="var(--teal)" stopOpacity="0.18" />
      </linearGradient>
      <radialGradient id={`${id}-aura`} cx="50%" cy="50%" r="50%">
        <stop offset="0%" stopColor="var(--teal)" stopOpacity="0.55" />
        <stop offset="100%" stopColor="var(--teal)" stopOpacity="0" />
      </radialGradient>
    </defs>
  );
}

export function ProposalIcon({ className }: IconProps) {
  const id = "ti-proposal";
  return (
    <svg viewBox="0 0 48 48" fill="none" className={cn(base, className)} aria-hidden>
      <Defs id={id} />
      <circle className="ti-pivot ti-aura" cx="24" cy="24" r="20" fill={`url(#${id}-aura)`} />
      <g className="ti-pivot ti-float" style={{ animationDelay: "-0.5s" }}>
        <path
          d="M15 9.5h12.5L34 16v18.5A2.5 2.5 0 0 1 31.5 37h-16A2.5 2.5 0 0 1 13 34.5v-22A2.5 2.5 0 0 1 15.5 10Z"
          fill={`url(#${id}-fill)`}
          stroke={`url(#${id}-stroke)`}
          strokeWidth="1.8"
          strokeLinejoin="round"
        />
        <path d="M27 9.5V16h6.5" stroke={`url(#${id}-stroke)`} strokeWidth="1.8" strokeLinejoin="round" />
        <path className="ti-twinkle" d="M17.5 22h11" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        <path className="ti-twinkle" style={{ animationDelay: "-1.1s" }} d="M17.5 26.5h11" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        <path className="ti-twinkle" style={{ animationDelay: "-1.8s" }} d="M17.5 31h6.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </g>
      <g className="ti-pivot ti-breathe" style={{ transformOrigin: "33px 33px" }}>
        <circle cx="33" cy="33" r="7.5" fill="var(--teal)" fillOpacity="0.95" />
        <path className="ti-draw" d="M29.6 33.2l2.4 2.4 4.4-4.8" stroke="var(--teal-foreground)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </g>
    </svg>
  );
}

export function PrivacyIcon({ className }: IconProps) {
  const id = "ti-privacy";
  return (
    <svg viewBox="0 0 48 48" fill="none" className={cn(base, className)} aria-hidden>
      <Defs id={id} />
      <circle className="ti-pivot ti-aura" cx="24" cy="24" r="20" fill={`url(#${id}-aura)`} />
      <g className="ti-pivot ti-breathe">
        <path
          d="M24 7l13 4.4v9.1c0 8.4-5.4 14.4-13 17-7.6-2.6-13-8.6-13-17v-9.1Z"
          fill={`url(#${id}-fill)`}
          stroke={`url(#${id}-stroke)`}
          strokeWidth="1.8"
          strokeLinejoin="round"
        />
      </g>
      <g className="ti-pivot ti-float" style={{ animationDelay: "-1s" }}>
        <rect x="18" y="22.5" width="12" height="9.5" rx="2.2" fill="currentColor" fillOpacity="0.18" stroke="currentColor" strokeWidth="1.7" />
        <path d="M20.5 22.5v-2.6a3.5 3.5 0 0 1 7 0v2.6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
        <circle className="ti-pivot ti-twinkle" style={{ transformOrigin: "24px 26.6px" }} cx="24" cy="26.6" r="1.7" fill="var(--teal)" />
      </g>
      <g className="ti-pivot ti-orbit">
        <circle cx="24" cy="8.5" r="1.6" fill="var(--teal)" />
      </g>
    </svg>
  );
}

export function DeliveryIcon({ className }: IconProps) {
  const id = "ti-delivery";
  return (
    <svg viewBox="0 0 48 48" fill="none" className={cn(base, className)} aria-hidden>
      <Defs id={id} />
      <circle className="ti-pivot ti-aura" cx="24" cy="24" r="20" fill={`url(#${id}-aura)`} />
      <g className="ti-pivot ti-breathe">
        <path
          d="M24 6.5l13.5 4.6v8.8c0 8.8-5.6 15.2-13.5 18.1-7.9-2.9-13.5-9.3-13.5-18.1v-8.8Z"
          fill={`url(#${id}-fill)`}
          stroke={`url(#${id}-stroke)`}
          strokeWidth="1.8"
          strokeLinejoin="round"
        />
      </g>
      <g className="ti-pivot ti-float" style={{ animationDelay: "-0.8s" }}>
        <rect x="17" y="16" width="14" height="16.5" rx="2.4" fill="currentColor" fillOpacity="0.16" stroke="currentColor" strokeWidth="1.7" />
        <path d="M20.5 21h7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        <path d="M20.5 24.5h7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        <path d="M20.5 28h4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </g>
      <g className="ti-spark">
        <path d="M24 25.5l3-3m-3 3l-3-3m3 3v-7" stroke="var(--teal)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </g>
    </svg>
  );
}

export function ReviewIcon({ className }: IconProps) {
  const id = "ti-review";
  return (
    <svg viewBox="0 0 48 48" fill="none" className={cn(base, className)} aria-hidden>
      <Defs id={id} />
      <circle className="ti-pivot ti-aura" cx="24" cy="24" r="20" fill={`url(#${id}-aura)`} />
      <g className="ti-pivot ti-sweep" style={{ transformOrigin: "24px 24px" }}>
        <circle cx="24" cy="24" r="16.5" stroke={`url(#${id}-stroke)`} strokeWidth="1.6" strokeLinecap="round" strokeDasharray="18 70" fill="none" />
      </g>
      <g className="ti-pivot ti-float" style={{ animationDelay: "-0.6s" }}>
        <circle cx="22" cy="19" r="5" fill={`url(#${id}-fill)`} stroke={`url(#${id}-stroke)`} strokeWidth="1.8" />
        <path
          d="M12.5 33c0-5.4 4.3-9 9.5-9 2.1 0 4 .6 5.6 1.6"
          fill="none"
          stroke={`url(#${id}-stroke)`}
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      </g>
      <g className="ti-pivot ti-breathe" style={{ transformOrigin: "32px 31px" }}>
        <circle cx="32" cy="31" r="7" fill="var(--teal)" fillOpacity="0.95" />
        <path className="ti-draw" d="M28.8 31.2l2.2 2.2 4-4.4" stroke="var(--teal-foreground)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </g>
    </svg>
  );
}
