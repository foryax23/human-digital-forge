import {
  Fragment,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type FormEvent,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { useNavigate } from "@tanstack/react-router";
import { MotionConfig, motion } from "motion/react";
import { ArrowUpRight } from "lucide-react";

import { useI18n } from "@/i18n";
import { parseSearchIntent, searchCompanies } from "@/lib/scan/company-search";
import type { CompanyStatus, CompanySuggestion, SearchIntent } from "@/lib/scan/types";
import { cn } from "@/lib/utils";
import { SparkMark } from "./hero/icons";
import { prefersReducedMotion, useIsomorphicLayoutEffect } from "./motion-prefs";
import { NAV_OFFSET } from "./smooth-scroll";
import styles from "./VortexSearch.module.css";

/*
 * The hero's Vortex Scan search: a WAI-ARIA 1.2 combobox over the Romanian
 * company index. It understands a company name, a CUI or a website address,
 * suggests companies as you type and hands the choice to /scan.
 */

const DEBOUNCE_MS = 120;
const SUGGESTION_LIMIT = 6;
const TYPING_IDLE_MS = 650;
/** The cyan segment's resting length on the hairline, in px. */
const SEGMENT_MIN = 44;

/**
 * The /scan route's search params for one choice. The CUI travels as a number,
 * so the address reads /scan?cui=54747928 (a string would be JSON-quoted).
 */
type ScanParams = { cui: number } | { url: string } | { q: string };

const byCui = (cui: string): ScanParams => ({ cui: Number(cui) });

/** The kind tag at the start of every suggestion row. */
const KIND_TAG = {
  company: ["COMPANY", "FIRMĂ"],
  site: ["SITE", "SITE"],
  cui: ["CUI", "CUI"],
} satisfies Record<string, [string, string]>;

type KindTag = (typeof KIND_TAG)[keyof typeof KIND_TAG];

type Option =
  | { id: string; kind: "website"; url: string; host: string }
  | { id: string; kind: "cui"; cui: string }
  | { id: string; kind: "company"; company: CompanySuggestion }
  | { id: string; kind: "example"; value: string; tag: KindTag; hint: [string, string] }
  | { id: string; kind: "website-hint"; failed: boolean };

type Group = { key: string; label: string; options: Array<{ option: Option; index: number }> };

type SearchResult = {
  term: string;
  status: "done" | "error";
  results: CompanySuggestion[];
};

/** Our own site and CUI double as honest examples. */
const EXAMPLES: Array<{
  id: string;
  value: [string, string];
  tag: KindTag;
  hint: [string, string];
}> = [
  {
    id: "example-name",
    value: ["Dental clinic Bucharest", "Clinică dentară București"],
    tag: KIND_TAG.company,
    hint: ["A business and its city", "O afacere și orașul ei"],
  },
  {
    id: "example-website",
    value: ["vortexhub.dev", "vortexhub.dev"],
    tag: KIND_TAG.site,
    hint: ["Any website", "Orice site"],
  },
  {
    id: "example-cui",
    value: ["54747928", "54747928"],
    tag: KIND_TAG.cui,
    hint: ["A fiscal code (CUI)", "Un cod fiscal (CUI)"],
  },
];

/** The example searches under the field: they fill it in, they are not results. */
const QUICK_PICKS: Array<[string, string]> = [
  ["Dental clinic", "Clinică dentară"],
  ["Online store", "Magazin online"],
];

const NO_COMPANIES: CompanySuggestion[] = [];

const STATUS_BADGE: Partial<Record<CompanyStatus, [string, string]>> = {
  inactive: ["Inactive", "Inactivă"],
  dissolved: ["Dissolved", "Radiată"],
};

/** The text sent to the company index for an intent ("" = no lookup). */
function companyTerm(intent: SearchIntent) {
  if (intent.kind === "name") return intent.query.trim();
  if (intent.kind === "cui") return intent.cui;
  return "";
}

const fold = (value: string) => value.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Marks the query's words inside `text`, ignoring case and diacritics. */
function Highlight({ text, query }: { text: string; query: string }) {
  const chars = Array.from(text);
  const folded = chars.map(fold);
  // Index in the folded string → index of the original character.
  const owner = folded.flatMap((part, index) => Array.from(part, () => index));
  const flat = folded.join("");
  const marked = new Array<boolean>(chars.length).fill(false);

  for (const word of fold(query).split(/[^\p{L}\p{N}]+/u)) {
    if (word.length < 2) continue;
    const atWordStart = new RegExp(`(^|[^\\p{L}\\p{N}])${escapeRegExp(word)}`, "u").exec(flat);
    const at = atWordStart ? atWordStart.index + atWordStart[1].length : flat.indexOf(word);
    if (at < 0) continue;
    for (let k = at; k < at + word.length; k += 1) marked[owner[k]] = true;
  }

  const runs: Array<{ text: string; match: boolean }> = [];
  chars.forEach((char, index) => {
    const last = runs[runs.length - 1];
    if (last && last.match === marked[index]) last.text += char;
    else runs.push({ text: char, match: marked[index] });
  });

  return (
    <>
      {runs.map((run, index) =>
        run.match ? (
          <mark key={index} className="bg-transparent font-semibold text-white">
            {run.text}
          </mark>
        ) : (
          <span key={index}>{run.text}</span>
        ),
      )}
    </>
  );
}

/** What the field is doing, for the hero around it. */
export type SearchFieldState = "idle" | "focus" | "typing";

/**
 * An open line, no box: a spark, the field and a text button over one
 * hairline, with a short cyan segment glowing at its left end. On focus the
 * hairline brightens and the segment stretches to follow the typed text;
 * when a scan starts the segment sweeps the whole line and the button says
 * so. Under it (`showHint`) a micro line (`micro` replaces its text) and two
 * example searches that fill the field in; the suggestions popup opens over
 * them. `onActiveChange`
 * reports focus and `onStateChange` idle / focus / typing, so the hero can
 * light up around it; `onInputPulse` fires on every change to the text;
 * `onOpenChange` reports whether the suggestions popup is showing, so the hero
 * can move things out of its way. `onBeforeNavigate` may hold the trip to
 * /scan (the hero's transition) and calls `proceed` when it's done; without
 * it the search navigates at once.
 */
export function VortexSearch({
  className,
  defaultValue = "",
  showHint = true,
  micro,
  onActiveChange,
  onStateChange,
  onInputPulse,
  onOpenChange,
  onBeforeNavigate,
}: {
  className?: string;
  defaultValue?: string;
  /** The micro line and example searches under the field (off where the page already says it). */
  showHint?: boolean;
  /** Replaces the micro line's text (it also describes the field). */
  micro?: ReactNode;
  onActiveChange?: (active: boolean) => void;
  onStateChange?: (state: SearchFieldState) => void;
  onInputPulse?: () => void;
  onOpenChange?: (open: boolean) => void;
  onBeforeNavigate?: (proceed: () => Promise<void>) => void;
}) {
  const { t } = useI18n();
  const navigate = useNavigate();
  const baseId = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const inputId = `${baseId}-input`;
  const listboxId = `${baseId}-listbox`;
  const hintId = `${baseId}-hint`;
  const microId = `${baseId}-micro`;
  const optionId = (option: Option) => `${baseId}-${option.id}`;

  const formRef = useRef<HTMLFormElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const textBoxRef = useRef<HTMLDivElement>(null);
  const mirrorRef = useRef<HTMLSpanElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const typingTimer = useRef<number | undefined>(undefined);

  const [query, setQuery] = useState(defaultValue);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [focused, setFocused] = useState(false);
  const [typing, setTyping] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [found, setFound] = useState<SearchResult | null>(null);
  const [maxHeight, setMaxHeight] = useState(420);
  // Bumped on every open so the rows stagger in again.
  const [generation, setGeneration] = useState(0);
  // Where the typed text ends, from the line's left end (0 = empty field).
  const [textEnd, setTextEnd] = useState(0);

  // Measure the text in an invisible copy of the field's type, so the cyan
  // segment can follow it (capped at the field's right edge once it scrolls).
  useIsomorphicLayoutEffect(() => {
    const box = textBoxRef.current;
    const mirror = mirrorRef.current;
    if (!box || !mirror) return;
    const update = () =>
      setTextEnd(
        query ? Math.round(box.offsetLeft + Math.min(mirror.offsetWidth, box.offsetWidth) + 4) : 0,
      );
    update();
    const resize = new ResizeObserver(update);
    resize.observe(box);
    let cancelled = false;
    void document.fonts?.ready.then(() => {
      if (!cancelled) update();
    });
    return () => {
      cancelled = true;
      resize.disconnect();
    };
  }, [query]);

  const intent = useMemo(() => parseSearchIntent(query), [query]);
  const term = companyTerm(intent);

  // Debounced, cancellable lookup in the company index.
  useEffect(() => {
    if (!term) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      searchCompanies(term, { limit: SUGGESTION_LIMIT, signal: controller.signal })
        .then((results) => {
          if (!controller.signal.aborted) setFound({ term, status: "done", results });
        })
        .catch(() => {
          if (!controller.signal.aborted) setFound({ term, status: "error", results: [] });
        });
    }, DEBOUNCE_MS);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [term]);

  const loading = term !== "" && found?.term !== term;
  // While the next answer loads, the previous companies stay up (dimmed).
  const results = (term && found?.results) || NO_COMPANIES;
  const failed = !loading && found?.term === term && found.status === "error";

  const options = useMemo<Option[]>(() => {
    if (intent.kind === "empty") {
      return EXAMPLES.map(({ id, value, tag, hint }) => ({
        id,
        kind: "example" as const,
        value: t(...value),
        tag,
        hint,
      }));
    }
    const list: Option[] = [];
    if (intent.kind === "website") {
      list.push({ id: "website", kind: "website", url: intent.url, host: intent.host });
    }
    if (intent.kind === "cui") list.push({ id: "cui", kind: "cui", cui: intent.cui });
    for (const company of results) {
      list.push({ id: `company-${company.cui}`, kind: "company", company });
    }
    if (intent.kind === "name" && !loading && results.length === 0) {
      list.push({ id: "website-hint", kind: "website-hint", failed });
    }
    return list;
  }, [intent, results, loading, failed, t]);

  const groups = useMemo<Group[]>(() => {
    const byKey = new Map<string, Group>();
    options.forEach((option, index) => {
      const key =
        option.kind === "example"
          ? "examples"
          : option.kind === "company"
            ? "companies"
            : option.kind === "website-hint"
              ? "empty"
              : "scan";
      const label =
        key === "examples"
          ? t("Try an example", "Încearcă un exemplu")
          : key === "companies"
            ? t("Companies", "Firme")
            : key === "empty"
              ? t("No match", "Niciun rezultat")
              : t("Direct scan", "Scanare directă");
      const group = byKey.get(key) ?? { key, label, options: [] };
      group.options.push({ option, index });
      byKey.set(key, group);
    });
    return [...byKey.values()];
  }, [options, t]);

  const active = activeIndex < options.length ? activeIndex : -1;
  const activeOption = active >= 0 ? options[active] : undefined;
  const showShimmer = loading && results.length === 0;
  const expanded = open && (options.length > 0 || showShimmer);
  const activeId = expanded && activeOption ? optionId(activeOption) : undefined;

  const onOpenChangeRef = useRef(onOpenChange);
  const onStateChangeRef = useRef(onStateChange);
  const onInputPulseRef = useRef(onInputPulse);
  const onBeforeNavigateRef = useRef(onBeforeNavigate);
  useEffect(() => {
    onOpenChangeRef.current = onOpenChange;
    onStateChangeRef.current = onStateChange;
    onInputPulseRef.current = onInputPulse;
    onBeforeNavigateRef.current = onBeforeNavigate;
  }, [onOpenChange, onStateChange, onInputPulse, onBeforeNavigate]);
  useEffect(() => {
    onOpenChangeRef.current?.(expanded);
  }, [expanded]);
  const fieldState: SearchFieldState = focused ? (typing ? "typing" : "focus") : "idle";
  useEffect(() => {
    onStateChangeRef.current?.(fieldState);
  }, [fieldState]);
  // Enter with nothing highlighted takes the first row (except the empty-state hint).
  const enterTarget =
    active < 0 && options[0] && options[0].kind !== "example" && options[0].kind !== "website-hint"
      ? options[0]
      : undefined;

  const go = useCallback(
    (search: ScanParams) => {
      setOpen(false);
      setSubmitting(true);
      inputRef.current?.blur();
      // Reset when the router settles, for pages that keep the search mounted (/scan).
      const proceed = () => navigate({ to: "/scan", search }).finally(() => setSubmitting(false));
      const before = onBeforeNavigateRef.current;
      if (before) before(proceed);
      else void proceed();
    },
    [navigate],
  );

  const pulseTyping = () => {
    onInputPulseRef.current?.();
    setTyping(true);
    window.clearTimeout(typingTimer.current);
    typingTimer.current = window.setTimeout(() => setTyping(false), TYPING_IDLE_MS);
  };
  useEffect(() => () => window.clearTimeout(typingTimer.current), []);

  const fill = (value: string) => {
    setQuery(value);
    setActiveIndex(-1);
    setOpen(true);
    pulseTyping();
    const input = inputRef.current;
    if (input) {
      input.focus();
      // After React writes the value, put the caret at the end.
      requestAnimationFrame(() => input.setSelectionRange(value.length, value.length));
    }
  };

  const choose = (option: Option) => {
    switch (option.kind) {
      case "example":
        return fill(option.value);
      case "website-hint":
        return fill("www.");
      case "website":
        return go({ url: option.url });
      case "cui":
        return go(byCui(option.cui));
      case "company":
        return go(byCui(option.company.cui));
    }
  };

  const openPopup = () => {
    if (!open) setGeneration((n) => n + 1);
    setOpen(true);
  };

  const close = () => {
    setOpen(false);
    setActiveIndex(-1);
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (submitting) return;
    if (expanded && activeOption) return choose(activeOption);

    if (intent.kind === "empty") {
      inputRef.current?.focus();
      openPopup();
      return;
    }
    if (intent.kind === "website") return go({ url: intent.url });
    if (intent.kind === "cui") return go(byCui(intent.cui));

    // Free text: the first suggestion, or the scan page's own search.
    if (!loading && results[0]) return go(byCui(results[0].cui));
    setSubmitting(true);
    try {
      const [first] = await searchCompanies(term, {
        limit: 1,
        signal: AbortSignal.timeout(4000),
      });
      if (first) return go(byCui(first.cui));
    } catch {
      /* fall through to a free-text scan */
    }
    go({ q: intent.query.trim() });
  };

  const move = (delta: 1 | -1) => {
    if (options.length === 0) return;
    const last = options.length - 1;
    const next =
      active < 0 ? (delta > 0 ? 0 : last) : (active + delta + options.length) % options.length;
    setActiveIndex(next);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.nativeEvent.isComposing) return;
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        if (!expanded) {
          openPopup();
          if (event.altKey) return;
        }
        move(1);
        break;
      case "ArrowUp":
        event.preventDefault();
        if (!expanded) openPopup();
        move(-1);
        break;
      case "Home":
      case "End":
        // Only while moving through the list; otherwise they move the caret.
        if (expanded && active >= 0) {
          event.preventDefault();
          setActiveIndex(event.key === "Home" ? 0 : options.length - 1);
        }
        break;
      case "Escape":
        if (expanded) {
          event.preventDefault();
          close();
        } else if (query) {
          event.preventDefault();
          setQuery("");
        }
        break;
      case "Tab":
        close();
        break;
    }
  };

  // Keep the highlighted row in view while arrowing through a long list.
  useEffect(() => {
    if (activeId) document.getElementById(activeId)?.scrollIntoView({ block: "nearest" });
  }, [activeId]);

  // Fit the popup to the visible viewport (phones with the keyboard up), and
  // scroll the page just enough to show it, never past the nav.
  useEffect(() => {
    if (!expanded) return;
    const viewportBottom = () => {
      const viewport = window.visualViewport;
      return viewport ? viewport.offsetTop + viewport.height : window.innerHeight;
    };
    const measure = () => {
      const form = formRef.current;
      if (!form) return;
      const visible = (window.visualViewport?.height ?? window.innerHeight) - NAV_OFFSET;
      const room = visible - form.offsetHeight - 28;
      setMaxHeight(Math.max(200, Math.min(420, Math.round(room))));
    };
    let frame = 0;
    const reveal = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const form = formRef.current;
        const popup = popupRef.current;
        if (!form || !popup) return;
        const overflow = popup.getBoundingClientRect().bottom + 16 - viewportBottom();
        const headroom = form.getBoundingClientRect().top - NAV_OFFSET;
        const by = Math.min(overflow, headroom);
        if (by > 8) {
          window.scrollBy({ top: by, behavior: prefersReducedMotion() ? "auto" : "smooth" });
        }
      });
    };
    measure();
    reveal();
    const resize = new ResizeObserver(reveal);
    if (listRef.current) resize.observe(listRef.current);
    const viewport = window.visualViewport;
    const onViewport = () => {
      measure();
      reveal();
    };
    viewport?.addEventListener("resize", onViewport);
    window.addEventListener("resize", onViewport);
    return () => {
      cancelAnimationFrame(frame);
      resize.disconnect();
      viewport?.removeEventListener("resize", onViewport);
      window.removeEventListener("resize", onViewport);
    };
  }, [expanded]);

  const status = (() => {
    if (submitting) return t("Starting the analysis…", "Pornim analiza…");
    if (!expanded) return "";
    if (intent.kind === "website")
      return t(`Press Enter to scan ${intent.host}`, `Apasă Enter pentru a analiza ${intent.host}`);
    if (loading) return t("Searching companies…", "Caut firme…");
    if (failed)
      return t(
        "Company search is unavailable right now.",
        "Căutarea firmelor nu este disponibilă acum.",
      );
    if (intent.kind === "name" && results.length === 0)
      return t("No company found.", "Nu am găsit nicio firmă.");
    if (results.length > 0) {
      return t(
        `${results.length} ${results.length === 1 ? "company" : "companies"} found.`,
        `${results.length === 1 ? "O firmă găsită" : `${results.length} firme găsite`}.`,
      );
    }
    return "";
  })();

  const empty = query === "";
  // The segment rests at the line's left end and follows the text once there is some.
  const segment = Math.max(SEGMENT_MIN, textEnd);

  return (
    <MotionConfig reducedMotion="user">
      <div className={cn("relative w-full", className)}>
        <form
          ref={formRef}
          role="search"
          aria-label={t("Vortex Scan", "Vortex Scan")}
          onSubmit={submit}
          className="relative w-full"
        >
          <div
            style={{ "--segment": `${segment}px` } as CSSProperties}
            className={cn(
              styles.field,
              "relative flex h-12 items-center gap-3 sm:h-[3.25rem] sm:gap-3.5",
              focused && styles.focused,
              submitting && styles.starting,
            )}
          >
            <SparkMark className={cn(styles.spark, "size-[18px]")} />
            <label htmlFor={inputId} className="sr-only">
              {t("Search a company, CUI or website", "Caută o firmă, un CUI sau un site")}
            </label>
            <span id={hintId} className="sr-only">
              {t(
                "Search by company name, CUI or website address, for example Dental clinic Bucharest or www.your-clinic.ro. Suggestions appear as you type.",
                "Caută după numele firmei, CUI sau adresa unui site, de exemplu Clinică dentară București sau www.clinica-ta.ro. Sugestiile apar pe măsură ce scrii.",
              )}
            </span>

            <div ref={textBoxRef} className="relative h-full min-w-0 flex-1">
              {/* Custom placeholder (the label names the field); shorter on phones. */}
              {empty && (
                <span
                  aria-hidden
                  className="type-body pointer-events-none absolute inset-0 flex items-center truncate text-white/70"
                >
                  <span className="sm:hidden">
                    {t("Business or website", "Afacere sau website")}
                  </span>
                  <span className="hidden sm:inline">
                    {t("Business name or website", "Numele afacerii sau website-ul")}
                  </span>
                </span>
              )}
              {/* Same type as the field: measures where the text ends. */}
              <span
                ref={mirrorRef}
                aria-hidden
                className="type-body pointer-events-none invisible absolute left-0 top-0 whitespace-pre"
              >
                {query}
              </span>
              <input
                ref={inputRef}
                id={inputId}
                type="text"
                role="combobox"
                aria-autocomplete="list"
                aria-expanded={expanded}
                aria-controls={listboxId}
                aria-activedescendant={activeId}
                aria-describedby={showHint ? `${hintId} ${microId}` : hintId}
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setActiveIndex(-1);
                  if (!open) setGeneration((n) => n + 1);
                  setOpen(true);
                  pulseTyping();
                }}
                onKeyDown={onKeyDown}
                onFocus={() => {
                  openPopup();
                  setFocused(true);
                  onActiveChange?.(true);
                }}
                onBlur={() => {
                  close();
                  setFocused(false);
                  onActiveChange?.(false);
                }}
                onClick={() => openPopup()}
                autoComplete="off"
                autoCapitalize="off"
                autoCorrect="off"
                spellCheck={false}
                enterKeyHint="search"
                // 16 px type keeps iOS from zooming in on focus.
                className="type-body absolute inset-0 h-full w-full bg-transparent text-white caret-[#67e8f9] outline-none"
              />
            </div>

            {/* The visible text is the name, so it follows the label while a scan starts. */}
            <button
              type="submit"
              aria-busy={submitting || undefined}
              className="type-button group/go -mr-1.5 flex h-11 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md px-1.5 text-[#d4cbfd] transition-colors duration-200 hover:text-white focus-visible:text-white focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#c4b5fd]/60"
            >
              {submitting ? (
                <>
                  {t("Starting", "Pornim analiza")}
                  <span aria-hidden className="-ml-1.5">
                    <span className={styles.dot}>.</span>
                    <span className={styles.dot}>.</span>
                    <span className={styles.dot}>.</span>
                  </span>
                </>
              ) : (
                <>
                  {t("Analyse", "Analizează")}
                  <ArrowUpRight
                    aria-hidden
                    strokeWidth={1.75}
                    className="size-4 transition-[translate] duration-200 ease-out group-hover/go:-translate-y-0.5 group-hover/go:translate-x-0.5"
                  />
                </>
              )}
            </button>

            {/* The hairline and its cyan segment (see the CSS module). */}
            <span aria-hidden className={styles.line} />
            <span aria-hidden className={styles.segment} />
          </div>

          <span role="status" aria-live="polite" className="sr-only">
            {status}
          </span>

          {/* Suggestions. Always in the DOM so aria-controls resolves; hidden when closed. */}
          <motion.div
            ref={popupRef}
            initial={false}
            animate={expanded ? "open" : "closed"}
            variants={{
              open: {
                display: "block",
                opacity: 1,
                y: 0,
                transition: { duration: 0.2, ease: [0.22, 1, 0.36, 1] },
              },
              closed: {
                opacity: 0,
                y: -4,
                transition: { duration: 0.12, ease: [0.4, 0, 1, 1] },
                transitionEnd: { display: "none" },
              },
            }}
            // Keeps focus in the input when a row (or the scrollbar) is pressed.
            onMouseDown={(event) => event.preventDefault()}
            className="absolute inset-x-0 top-full z-30 mt-3 overflow-hidden rounded-xl border border-white/10 bg-[#070a1c]/95 shadow-[0_24px_60px_-30px_rgb(0_0_0/0.95)] backdrop-blur-xl"
          >
            {/* Thin progress line while a lookup runs over stale rows. */}
            <span
              aria-hidden
              className={cn(
                "pointer-events-none absolute inset-x-4 top-0 h-px overflow-hidden transition-opacity duration-300",
                loading && results.length > 0 ? "opacity-100" : "opacity-0",
              )}
            >
              <span
                className={cn(
                  styles.progress,
                  "absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-[#a78bfa] to-transparent",
                )}
              />
            </span>

            <div
              ref={listRef}
              id={listboxId}
              role="listbox"
              aria-label={t("Suggestions", "Sugestii")}
              style={{ maxHeight }}
              className="overflow-y-auto overscroll-contain pb-1.5 [scrollbar-color:rgb(255_255_255/0.15)_transparent] [scrollbar-width:thin]"
            >
              {groups.map((group) => (
                <div key={group.key} role="group" aria-labelledby={`${baseId}-group-${group.key}`}>
                  <div
                    role="presentation"
                    id={`${baseId}-group-${group.key}`}
                    className="type-label px-4 pb-1 pt-3 text-white/40"
                  >
                    {group.label}
                  </div>
                  {group.options.map(({ option, index }) => (
                    <OptionRow
                      key={`${option.id}-${generation}`}
                      id={optionId(option)}
                      option={option}
                      order={index}
                      query={query}
                      active={index === active}
                      enterHint={option === enterTarget}
                      dimmed={option.kind === "company" && loading}
                      highlightId={`${baseId}-highlight`}
                      onHover={() => setActiveIndex(index)}
                      onChoose={() => choose(option)}
                    />
                  ))}
                </div>
              ))}

              {showShimmer && (
                <div aria-hidden className="pt-2">
                  {[0, 1, 2].map((row) => (
                    <div key={row} className="flex min-h-11 items-center gap-3 px-4 py-2">
                      <span className="flex flex-1 flex-col gap-1.5">
                        <span
                          className={cn(styles.shimmer, "h-2.5 rounded-sm")}
                          style={{ width: `${62 - row * 14}%`, animationDelay: `${row * 0.12}s` }}
                        />
                        <span
                          className={cn(styles.shimmer, "h-2 rounded-sm opacity-70")}
                          style={{
                            width: `${38 - row * 6}%`,
                            animationDelay: `${row * 0.12 + 0.06}s`,
                          }}
                        />
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="type-tech hidden items-center justify-between gap-4 border-t border-white/[0.06] px-4 py-2.5 text-white/35 sm:flex">
              <span className="flex items-center gap-3">
                <span>↑ ↓ {t("move", "navighează")}</span>
                <span>↵ {t("choose", "alege")}</span>
                <span>esc {t("close", "închide")}</span>
              </span>
              {(results.length > 0 || showShimmer) && (
                <span className="truncate">
                  {t("Companies: Trade Register open data", "Firme: date deschise ONRC")}
                </span>
              )}
            </div>
          </motion.div>
        </form>

        {showHint && (
          <div className="relative isolate mt-[clamp(1.125rem,3.4vh,2.25rem)] flex flex-col items-center text-center">
            {/* A soft dark plate: on phones this line sits on the vortex's brightest arm. */}
            <span
              aria-hidden
              className="pointer-events-none absolute -inset-x-6 -inset-y-4 -z-10 bg-[radial-gradient(closest-side,rgb(0_2_15/0.8),rgb(0_2_15/0.6)_65%,transparent)] sm:opacity-60"
            />
            <p id={microId} className="type-body-sm text-[#c9c4ee]/85">
              {micro ??
                t(
                  "Search a business. See what comes next.",
                  "Caută o afacere. Descoperă ce urmează.",
                )}
            </p>
            <div
              role="group"
              aria-label={t("Example searches", "Exemple de căutare")}
              className="mt-1.5 flex items-center justify-center sm:mt-2"
            >
              {QUICK_PICKS.map((pick, index) => (
                <Fragment key={pick[0]}>
                  {index > 0 && <span aria-hidden className="h-4 w-px shrink-0 bg-white/20" />}
                  <button
                    type="button"
                    onClick={() => fill(t(...pick))}
                    className="type-body-sm group/pick flex min-h-11 items-center gap-2 whitespace-nowrap rounded-md px-3 text-[#ddd6fe]/90 transition-colors duration-200 hover:text-white focus-visible:text-white focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#c4b5fd]/60 sm:px-5"
                  >
                    <ArrowUpRight
                      aria-hidden
                      strokeWidth={1.75}
                      className="size-4 text-[#ddd6fe] transition-[translate] duration-200 ease-out group-hover/pick:-translate-y-0.5 group-hover/pick:translate-x-0.5"
                    />
                    {t(...pick)}
                  </button>
                </Fragment>
              ))}
            </div>
          </div>
        )}
      </div>
    </MotionConfig>
  );
}

function OptionRow({
  id,
  option,
  order,
  query,
  active,
  enterHint,
  dimmed,
  highlightId,
  onHover,
  onChoose,
}: {
  id: string;
  option: Option;
  order: number;
  query: string;
  active: boolean;
  enterHint: boolean;
  dimmed: boolean;
  highlightId: string;
  onHover: () => void;
  onChoose: () => void;
}) {
  const { t } = useI18n();

  let tag: KindTag;
  let title: ReactNode;
  let detail: ReactNode;
  let trailing: ReactNode = null;

  switch (option.kind) {
    case "website":
      tag = KIND_TAG.site;
      title = <span className="font-medium text-white">{option.host}</span>;
      detail = t(
        "Scan the website: speed, SEO, conversion, technology",
        "Analizează site-ul: viteză, SEO, conversie, tehnologie",
      );
      break;
    case "cui":
      tag = KIND_TAG.cui;
      title = <span className="font-medium text-white">{option.cui}</span>;
      detail = t("Official company details from ANAF", "Datele oficiale ale firmei, de la ANAF");
      break;
    case "company": {
      const { company } = option;
      const badge = STATUS_BADGE[company.status];
      tag = KIND_TAG.company;
      title = <Highlight text={company.displayName} query={query} />;
      detail = [
        `CUI ${company.cui}`,
        company.city ?? company.county,
        company.website && t("has a website", "are site"),
      ]
        .filter(Boolean)
        .join(" · ");
      trailing = badge && <span className="type-tech text-amber-200/80">{t(...badge)}</span>;
      break;
    }
    case "example":
      tag = option.tag;
      title = option.value;
      detail = t(...option.hint);
      break;
    case "website-hint":
      tag = KIND_TAG.site;
      title = option.failed
        ? t(
            "Company search is unavailable. Scan a website instead",
            "Căutarea firmelor nu este disponibilă. Analizează un site",
          )
        : t(
            "No company found. Scan a website instead",
            "Nu am găsit nicio firmă. Analizează un site",
          );
      detail = t(
        "Type the address, e.g. www.yourbusiness.ro",
        "Scrie adresa, de ex. www.afacerea-ta.ro",
      );
      break;
  }

  return (
    <motion.div
      id={id}
      role="option"
      aria-selected={active}
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: dimmed ? 0.55 : 1, y: 0 }}
      transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1], delay: Math.min(order, 6) * 0.03 }}
      onPointerMove={onHover}
      onClick={onChoose}
      className="relative flex min-h-11 cursor-pointer items-center gap-3 px-4 py-1.5"
    >
      {active && (
        <motion.span
          aria-hidden
          layoutId={highlightId}
          transition={{ type: "spring", stiffness: 560, damping: 44 }}
          className="absolute inset-0 border-l-2 border-[#67e8f9]/80 bg-white/[0.045]"
        />
      )}
      {/* Company rows sit under the "Companies" header, so they skip the repeated tag. */}
      {option.kind !== "company" && (
        <span
          aria-hidden
          className={cn(
            "type-tech relative w-14 shrink-0 transition-colors duration-200",
            active ? "text-[#c4b5fd]" : "text-[#a5b4fc]/60",
          )}
        >
          {t(...tag)}
        </span>
      )}
      <span className="relative flex min-w-0 flex-1 flex-col">
        <span
          className={cn(
            "type-body-sm truncate transition-colors duration-200",
            active ? "text-white" : "text-white/80",
          )}
        >
          {title}
        </span>
        <span className="type-micro truncate text-white/50">{detail}</span>
      </span>
      <span className="relative flex shrink-0 items-center gap-2">
        {trailing}
        {(active || enterHint) && option.kind !== "example" && option.kind !== "website-hint" && (
          <span
            aria-hidden
            className="type-tech hidden h-5 items-center rounded-[5px] border border-white/15 px-1.5 text-white/55 sm:inline-flex"
          >
            ↵
          </span>
        )}
        {active && (
          <span aria-hidden className="font-mono text-sm text-[#c4b5fd] sm:hidden">
            →
          </span>
        )}
      </span>
    </motion.div>
  );
}
