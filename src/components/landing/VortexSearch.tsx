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
import { ArrowUpRight } from "lucide-react";

import { Kbd, Status } from "@/components/system/marker";
import type { Tone } from "@/components/system/tone";
import { useI18n } from "@/i18n";
import { parseSearchIntent, searchCompanies } from "@/lib/scan/company-search";
import { withCommaBelow } from "@/lib/scan/localize";
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

/** The quiet hint at the right of a row: what choosing it does (the row's kind). */
const HINT = {
  name: ["search the trade register", "caută în ONRC"],
  site: ["website check", "analiză de site"],
  cui: ["ANAF record", "date ANAF"],
  byName: ["without the register", "fără registru"],
} satisfies Record<string, [string, string]>;

type Option =
  | { id: string; kind: "website"; url: string; host: string }
  | { id: string; kind: "cui"; cui: string }
  | { id: string; kind: "company"; company: CompanySuggestion }
  | { id: string; kind: "example"; value: string; code: boolean; hint: [string, string] }
  /** Always last under "Firme": scan the typed name without picking a company. */
  | { id: string; kind: "by-name"; query: string };

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
  /** Domains and CUIs are codes (mono). */
  code: boolean;
  hint: [string, string];
}> = [
  {
    id: "example-name",
    value: ["Dental clinic Bucharest", "Clinică dentară București"],
    code: false,
    hint: HINT.name,
  },
  { id: "example-website", value: ["vortexhub.dev", "vortexhub.dev"], code: true, hint: HINT.site },
  { id: "example-cui", value: ["54747928", "54747928"], code: true, hint: HINT.cui },
];

/** The example searches under the field: they fill it in, they are not results. */
const QUICK_PICKS: Array<[string, string]> = [
  ["Dental clinic", "Clinică dentară"],
  ["Online store", "Magazin online"],
];

const NO_COMPANIES: CompanySuggestion[] = [];

/** A company that is not active gets one quiet status after its name. */
const STATUS_MARK: Partial<Record<CompanyStatus, { tone: Tone; label: [string, string] }>> = {
  inactive: { tone: "warn", label: ["inactive", "inactivă"] },
  dissolved: { tone: "bad", label: ["dissolved", "radiată"] },
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
          <mark key={index} className="bg-transparent font-medium text-fg">
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
      return EXAMPLES.map(({ id, value, code, hint }) => ({
        id,
        kind: "example" as const,
        value: t(...value),
        code,
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
    if (intent.kind === "name") {
      list.push({ id: "by-name", kind: "by-name", query: intent.query.trim() });
    }
    return list;
  }, [intent, results, t]);

  const groups = useMemo<Group[]>(() => {
    const byKey = new Map<string, Group>();
    options.forEach((option, index) => {
      const key =
        option.kind === "example"
          ? "examples"
          : option.kind === "company" || option.kind === "by-name"
            ? "companies"
            : "scan";
      const label =
        key === "examples"
          ? t("Examples", "Exemple")
          : key === "companies"
            ? t("Companies", "Firme")
            : t("Direct scan", "Analiză directă");
      const group = byKey.get(key) ?? { key, label, options: [] };
      group.options.push({ option, index });
      byKey.set(key, group);
    });
    return [...byKey.values()];
  }, [options, t]);

  const active = activeIndex < options.length ? activeIndex : -1;
  const activeOption = active >= 0 ? options[active] : undefined;
  const showSkeleton = loading && results.length === 0;
  const expanded = open && (options.length > 0 || showSkeleton);
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
  // Enter with nothing highlighted takes the first row (not an example: those only fill the
  // field). Unmarked while a lookup runs, since the first row may still change.
  const enterTarget =
    !loading && active < 0 && options[0] && options[0].kind !== "example" ? options[0] : undefined;

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
      case "by-name":
        return go({ q: option.query });
      case "website":
        return go({ url: option.url });
      case "cui":
        return go(byCui(option.cui));
      case "company":
        return go(byCui(option.company.cui));
    }
  };

  const openPopup = () => setOpen(true);

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

  // One plain line under the rows: where companies come from, or what to try when the
  // name isn't found. Nothing for a website, whose row says it all.
  const footer = (() => {
    if (intent.kind === "website") return null;
    const source = t(
      "Companies from ONRC and ANAF open data",
      "Firme din datele deschise ONRC și ANAF",
    );
    if (intent.kind !== "name" || loading) return source;
    if (failed)
      return t(
        "Company search isn't responding right now. Type the CUI or the website address.",
        "Căutarea firmelor nu răspunde acum. Scrie CUI-ul sau adresa site-ului.",
      );
    if (results.length === 0)
      return t(
        "Not here? Type the CUI or the website address.",
        "Nu e aici? Scrie CUI-ul sau adresa site-ului.",
      );
    return source;
  })();

  const empty = query === "";
  // The segment rests at the line's left end and follows the text once there is some.
  const segment = Math.max(SEGMENT_MIN, textEnd);

  return (
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
                <span className="sm:hidden">{t("Business or website", "Afacere sau website")}</span>
                <span className="hidden sm:inline">
                  {t("Business name or website", "Numele afacerii sau website-ul")}
                </span>
              </span>
            )}
            {/* Same type as the field: measures where the text ends. */}
            <span
              ref={mirrorRef}
              aria-hidden
              className="type-body pointer-events-none invisible absolute left-0 top-0 whitespace-pre max-sm:text-[1rem]"
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
              // 16 px on phones keeps iOS from zooming in on focus (15 px from 640 px up);
              // the caret mirror above uses the same sizes.
              className="type-body absolute inset-0 h-full w-full bg-transparent text-white caret-echo outline-none max-sm:text-[1rem]"
            />
          </div>

          {/* The visible text is the name, so it follows the label while a scan starts. */}
          <button
            type="submit"
            aria-busy={submitting || undefined}
            className="type-button group/go -mr-1.5 flex h-11 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md px-1.5 text-[#d4cbfd] transition-colors duration-200 hover:text-white focus-visible:text-white focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-hero-lilac/60"
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

        {/* Suggestions: a compact command menu. Always in the DOM so aria-controls
              resolves; hidden when closed. Opens in 140 ms (CSS module), nothing else moves. */}
        <div
          ref={popupRef}
          // Keeps focus in the input when a row (or the scrollbar) is pressed.
          onMouseDown={(event) => event.preventDefault()}
          className={cn(
            styles.popup,
            "absolute inset-x-0 top-full z-30 mt-2 overflow-hidden rounded-menu border border-line-2 bg-s2 text-fg shadow-pop",
            !expanded && "hidden",
          )}
        >
          <div
            ref={listRef}
            id={listboxId}
            role="listbox"
            aria-label={t("Suggestions", "Sugestii")}
            style={{ maxHeight }}
            className="overflow-y-auto overscroll-contain p-1.5 [scrollbar-color:var(--vx-line-3)_transparent] [scrollbar-width:thin]"
          >
            {groups.map((group) => (
              <div key={group.key} role="group" aria-labelledby={`${baseId}-group-${group.key}`}>
                <div
                  role="presentation"
                  id={`${baseId}-group-${group.key}`}
                  className="px-2.5 pb-1 pt-2 text-xs font-medium leading-[1.3] text-fg-3"
                >
                  {group.label}
                </div>
                {/* The first lookup: two quiet placeholder rows above "Scanează după nume",
                    on the company row's columns. */}
                {group.key === "companies" && showSkeleton && (
                  <div aria-hidden>
                    {["w-[70%]", "w-[48%]"].map((width) => (
                      <div key={width} className="flex h-11 items-center gap-3 px-2.5 md:h-9">
                        <span className="min-w-0 flex-1">
                          <span className={cn("block h-2.5 rounded-sm bg-fill-2", width)} />
                        </span>
                        <span className="hidden w-[120px] shrink-0 sm:block">
                          <span className="block h-2.5 w-20 rounded-sm bg-fill-2" />
                        </span>
                        <span className="hidden w-24 shrink-0 justify-end sm:flex">
                          <span className="h-2.5 w-16 rounded-sm bg-fill-2" />
                        </span>
                        <span className="hidden w-5 shrink-0 pointer-fine:block" />
                      </div>
                    ))}
                  </div>
                )}
                {group.options.map(({ option, index }) => (
                  <OptionRow
                    key={option.id}
                    id={optionId(option)}
                    option={option}
                    query={query}
                    active={index === active}
                    enterHint={index === active || option === enterTarget}
                    // The previous companies stay up, dimmed, while the next answer loads.
                    dimmed={option.kind === "company" && loading}
                    onHover={() => setActiveIndex(index)}
                    onChoose={() => choose(option)}
                  />
                ))}
              </div>
            ))}
          </div>

          {footer && (
            <p className="border-t border-line-1 px-4 py-2 text-xs leading-[1.45] text-fg-3">
              {footer}
            </p>
          )}
        </div>
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
                  className="type-body-sm group/pick flex min-h-11 items-center gap-2 whitespace-nowrap rounded-md px-3 text-[#ddd6fe]/90 transition-colors duration-200 hover:text-white focus-visible:text-white focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-hero-lilac/60 sm:px-5"
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
  );
}

/**
 * One menu row, one line: the value on the left and a quiet hint (what choosing it does)
 * on the right; a company shows its city and CUI in two columns instead, under 640 px on
 * a second line. The active row is a flat fill plus a ↵ key on fine pointers; it moves
 * instantly.
 */
function OptionRow({
  id,
  option,
  query,
  active,
  enterHint,
  dimmed,
  onHover,
  onChoose,
}: {
  id: string;
  option: Option;
  query: string;
  active: boolean;
  /** Shows the ↵ key: the active row, or the row Enter takes when none is active. */
  enterHint: boolean;
  dimmed: boolean;
  onHover: () => void;
  onChoose: () => void;
}) {
  const { t } = useI18n();

  let body: ReactNode;
  let twoLine = false;

  if (option.kind === "company") {
    const { company } = option;
    const mark = STATUS_MARK[company.status];
    const place = withCommaBelow(company.city ?? company.county);
    twoLine = true;
    body = (
      <span className="flex min-w-0 flex-1 flex-col sm:flex-row sm:items-center sm:gap-3">
        <span className="flex min-w-0 flex-1 items-center gap-2">
          <span className="truncate text-sm text-fg-2">
            <Highlight text={company.displayName} query={query} />
          </span>
          {mark && (
            <Status size="sm" tone={mark.tone} className="shrink-0">
              {t(...mark.label)}
            </Status>
          )}
        </span>
        {/* Phones: "city, CUI" under the name. */}
        <span className="truncate text-[0.8125rem] leading-[1.35] text-fg-3 sm:hidden">
          {place && `${place}, `}
          <span className="type-code">{company.cui}</span>
        </span>
        <span className="hidden w-[120px] shrink-0 truncate text-[0.8125rem] leading-[1.35] text-fg-3 sm:block">
          {place}
        </span>
        <span className="type-code hidden w-24 shrink-0 text-right text-fg-3 sm:block">
          {company.cui}
        </span>
      </span>
    );
  } else {
    let value: ReactNode;
    let code = false;
    let hint: [string, string];
    switch (option.kind) {
      case "example":
        value = option.value;
        code = option.code;
        hint = option.hint;
        break;
      case "website":
        value = option.host;
        code = true;
        hint = HINT.site;
        break;
      case "cui":
        value = option.cui;
        code = true;
        hint = HINT.cui;
        break;
      case "by-name":
        value = t(`Scan by name: "${option.query}"`, `Scanează după nume: „${option.query}”`);
        hint = HINT.byName;
        break;
    }
    body = (
      <>
        <span className={cn("min-w-0 flex-1 truncate", code ? "type-code" : "text-sm")}>
          {value}
        </span>
        <span className="shrink-0 text-[0.8125rem] leading-[1.35] text-fg-3">{t(...hint)}</span>
      </>
    );
  }

  return (
    <div
      id={id}
      role="option"
      aria-selected={active}
      onPointerMove={onHover}
      onClick={onChoose}
      className={cn(
        "flex cursor-pointer items-center gap-3 rounded-md px-2.5 text-fg",
        // 36 px rows, 44 under 768 px; a company takes two lines (52 px) under 640 px.
        twoLine ? "min-h-[52px] py-1.5 sm:h-11 sm:min-h-0 sm:py-0 md:h-9" : "h-11 md:h-9",
        active && "bg-fill-2",
        dimmed && "opacity-55",
      )}
    >
      {body}
      {/* Reserved on fine pointers so the columns never shift; empty on touch. */}
      <span aria-hidden className="hidden w-5 shrink-0 justify-end pointer-fine:flex">
        {enterHint && <Kbd size="md">↵</Kbd>}
      </span>
    </div>
  );
}
