import { useId, useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";

import { Tag } from "@/components/system";
import type { BriefSection, Fact, Lang, LightState, SourceId } from "@/lib/deep/contracts";
import { useI18n } from "@/i18n";
import { cn } from "@/lib/utils";

import { SAMPLE_TAG } from "../copy";
import { asOfLabel } from "../format";
import { sourceName, TAG_13 } from "./helpers";

/*
 * Small pieces shared by the report's tabs: the line shapes (■ Bine, ◆ Atenție, ● De rezolvat,
 * □ Neverificat; state never rests on colour alone, the word is always there), source lines,
 * section titles and sentences with "corectat de tine".
 */

const SHAPE_COLOR: Record<LightState, string> = {
  bine: "text-ok",
  atentie: "text-warn",
  de_rezolvat: "text-bad",
  neverificat: "text-fg-3",
};

/** The line shape, at least 12 px (plan A10 minimums). */
export function Shape({
  state,
  size = 12,
  className,
}: {
  state: LightState;
  size?: number;
  className?: string;
}) {
  const common = { width: size, height: size, viewBox: "0 0 12 12", "aria-hidden": true as const };
  const color = cn("shrink-0", SHAPE_COLOR[state], className);
  if (state === "bine")
    return (
      <svg {...common} className={color}>
        <rect x="1" y="1" width="10" height="10" rx="1" fill="currentColor" />
      </svg>
    );
  if (state === "atentie")
    return (
      <svg {...common} className={color}>
        <path d="M6 0.6 11.4 6 6 11.4 0.6 6Z" fill="currentColor" />
      </svg>
    );
  if (state === "de_rezolvat")
    return (
      <svg {...common} className={color}>
        <circle cx="6" cy="6" r="5.2" fill="currentColor" />
      </svg>
    );
  return (
    <svg {...common} className={color}>
      <rect
        x="1.6"
        y="1.6"
        width="8.8"
        height="8.8"
        rx="1"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
      />
    </svg>
  );
}

/** "Ministerul Finanțelor · bilanț 2025 · verifică la sursă" under a figure. */
export function SourceLine({
  fact,
  check = true,
  className,
}: {
  fact?: Pick<Fact, "source" | "asOf">;
  check?: boolean;
  className?: string;
}) {
  const { t, lang } = useI18n();
  if (!fact) return null;
  const short: Partial<Record<SourceId, { ro: string; en: string }>> = {
    anaf_bilant: { ro: "Ministerul Finanțelor", en: "Ministry of Finance" },
    mf_bulk: { ro: "Ministerul Finanțelor", en: "Ministry of Finance" },
    anaf_v9: { ro: "ANAF", en: "ANAF" },
  };
  const name = short[fact.source]?.[lang] ?? sourceName(fact.source, lang);
  return (
    <p className={cn("text-[0.8125rem] leading-[1.45] text-fg-3", className)}>
      {name} · {asOfLabel(fact.asOf, lang)}
      {check ? ` · ${t("check at the source", "verifică la sursă")}` : null}
    </p>
  );
}

/** A section title of the report (type-h3, sentence case, the conclusion when it can be). */
export function ReportHeading({
  id,
  children,
  sub,
  as: H = "h2",
  className,
}: {
  id?: string;
  children: ReactNode;
  sub?: ReactNode;
  as?: "h2" | "h3";
  className?: string;
}) {
  return (
    <div className={cn("mb-3", className)}>
      <H id={id} className="type-h3 scroll-mt-28 text-balance text-fg">
        {children}
      </H>
      {sub ? <p className="mt-1 text-[0.875rem] leading-[1.5] text-fg-3">{sub}</p> : null}
    </div>
  );
}

/** The visible sentences of a brief section; hidden ones leave "corectat de tine". */
export function Sentences({
  section,
  className,
  as: P = "p",
}: {
  section?: BriefSection;
  className?: string;
  as?: "p" | "span";
}) {
  const { t } = useI18n();
  if (!section || !section.sentences.length) return null;
  const shown = section.sentences.filter((s) => !s.hiddenBy);
  const hidden = section.sentences.length - shown.length;
  if (!shown.length && !hidden) return null;
  return (
    <P className={className}>
      {shown.map((s) => s.text).join(" ")}
      {hidden ? (
        <span className="text-fg-3">
          {shown.length ? " " : ""}({t("corrected by you", "corectat de tine")})
        </span>
      ) : null}
    </P>
  );
}

/** "Exemplu cu o firmă inventată", on every screen of a sample. */
export function SampleTag({ className }: { className?: string }) {
  const { lang } = useI18n();
  return (
    <Tag variant="dashed" className={cn(TAG_13, className)}>
      {SAMPLE_TAG[lang]}
    </Tag>
  );
}

/**
 * One disclosure style for the whole report (details, footer, admin, evidence sections and
 * action details): a full-width row with a chevron, at least 44 px tall.
 */
export function Disclosure({
  summary,
  meta,
  children,
  defaultOpen = false,
  open: controlled,
  onOpenChange,
  className,
  summaryClassName,
  as: H,
  id,
  label,
}: {
  summary: ReactNode;
  meta?: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  className?: string;
  summaryClassName?: string;
  /** Wraps the button in a heading of this level. */
  as?: "h2" | "h3" | "h4";
  id?: string;
  /** A specific accessible name when the summary repeats across rows. */
  label?: string;
}) {
  const auto = useId();
  const [own, setOwn] = useState(defaultOpen);
  const open = controlled ?? own;
  const toggle = () => {
    const next = !open;
    if (controlled === undefined) setOwn(next);
    onOpenChange?.(next);
  };
  const panel = `${id ?? auto}-panel`;
  const button = (
    <button
      type="button"
      aria-expanded={open}
      aria-controls={panel}
      aria-label={label}
      onClick={toggle}
      className={cn(
        "flex min-h-11 w-full items-center justify-between gap-3 py-2 text-left text-fg focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-brand-line/55",
        summaryClassName,
      )}
    >
      <span className="min-w-0">{summary}</span>
      <span className="flex shrink-0 items-center gap-2 text-[0.8125rem] font-normal text-fg-3">
        {meta}
        <ChevronDown
          aria-hidden
          className={cn(
            "size-4 transition-transform duration-150 motion-reduce:transition-none",
            open && "rotate-180",
          )}
        />
      </span>
    </button>
  );
  return (
    <div id={id} className={cn("scroll-mt-28", className)}>
      {H ? <H className="m-0">{button}</H> : button}
      {open ? (
        <div id={panel} className="pb-3">
          {children}
        </div>
      ) : null}
    </div>
  );
}
