import { useEffect, useRef, useState, type CSSProperties } from "react";
import { ArrowUpRight, ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";

import { IconButton, SegmentedControl, buttonClass } from "@/components/system";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { useI18n } from "@/i18n";
import { cn } from "@/lib/utils";
import { prefersReducedMotion } from "./motion-prefs";
import { useMotionPause } from "./motion-pause";
import { projectImages, projectTitle, type Project } from "./projects";

type ProjectPreviewProps = {
  projects: Project[];
  /** Index of the open project in `projects`, or null when closed. */
  index: number | null;
  onIndexChange: (index: number | null) => void;
};

/** "Ghid, campus, trilingv": joins list items into one sentence-case comma line. */
function commaLine(items: string[]) {
  return items
    .map((item, i) =>
      // Lower the first letter after the first item, unless it starts an acronym ("AI").
      i > 0 && item[1] && item[1] === item[1].toLowerCase()
        ? item[0].toLowerCase() + item.slice(1)
        : item,
    )
    .join(", ");
}

/**
 * Preview dialog for a published project: the live landing page in a plain frame that
 * slowly scrolls itself (until the visitor takes over), a phone view, and the project
 * details with a short facts list. Always dark, on any page.
 */
export function ProjectPreview({ projects, index, onIndexChange }: ProjectPreviewProps) {
  const { t, lang } = useI18n();
  const open = index !== null;

  // Keep rendering the last project while the dialog animates closed.
  const [shown, setShown] = useState<Project | null>(null);
  useEffect(() => {
    if (index !== null) setShown(projects[index] ?? null);
  }, [index, projects]);

  const current = index !== null ? projects[index] : shown;
  const position = current ? projects.indexOf(current) : 0;
  const pick = (value: { en: string; ro: string }) => (lang === "ro" ? value.ro : value.en);
  const pickList = (value: { en: string[]; ro: string[] }) => (lang === "ro" ? value.ro : value.en);

  const step = (delta: number) => {
    if (index === null) return;
    onIndexChange((index + delta + projects.length) % projects.length);
  };

  const related = current?.related ? projects.findIndex((p) => p.slug === current.related) : -1;

  // The dialog is opened from state, not a Radix Trigger, so remember the card
  // that had focus and hand focus back to it on close.
  const openerRef = useRef<HTMLElement | null>(null);

  const access = current
    ? current.access === "private"
      ? t(
          "Private app: only the sign-in screen is public",
          "Aplicație privată: doar ecranul de autentificare e public",
        )
      : current.access === "sign-in"
        ? t("Opens on a sign-in screen", "Se deschide cu ecranul de autentificare")
        : t("Public", "Public")
    : "";

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onIndexChange(null)}>
      <DialogContent
        closeLabel={t("Close", "Închide")}
        onOpenAutoFocus={() => {
          openerRef.current = document.activeElement as HTMLElement | null;
        }}
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          openerRef.current?.focus({ preventScroll: true });
          openerRef.current = null;
        }}
        className="cinematic w-[calc(100vw-1.5rem)] max-w-6xl gap-0 overflow-hidden p-0 sm:max-w-6xl"
        onKeyDown={(event) => {
          // Arrow keys already handled inside (the desktop / mobile switch) stay there.
          if (event.defaultPrevented) return;
          if (event.key === "ArrowRight") step(1);
          if (event.key === "ArrowLeft") step(-1);
        }}
      >
        {current && (
          <div className="grid max-h-[92svh] grid-cols-1 overflow-y-auto lg:h-[min(640px,88svh)] lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] lg:overflow-hidden">
            <PreviewStage project={current} title={projectTitle(current, lang)} />

            <div className="flex min-w-0 flex-col lg:min-h-0">
              <div className="flex flex-col gap-4 p-5 sm:p-6 lg:min-h-0 lg:flex-1 lg:overflow-y-auto lg:pr-12">
                <p className="flex items-baseline justify-between gap-4 text-[0.8125rem] leading-[1.35] text-fg-3">
                  <span className="min-w-0">{pick(current.category)}</span>
                  <span className="type-pnum shrink-0">
                    {position + 1} {t("of", "din")} {projects.length}
                  </span>
                </p>

                <div>
                  {/* Roles on inner spans: the dialog primitives' own sizes would win. */}
                  <DialogTitle className="break-words">
                    <span className="type-h3 block">{projectTitle(current, lang)}</span>
                  </DialogTitle>
                  <DialogDescription className="mt-1.5">
                    <span className="block text-[0.9375rem] leading-[1.5] text-fg-2">
                      {pick(current.tagline)}
                    </span>
                  </DialogDescription>
                </div>

                <Summary key={current.slug} text={pick(current.summary)} />

                <div>
                  <h3 className="type-label text-fg-3">{t("What we built", "Ce am construit")}</h3>
                  <ul className="mt-2 space-y-1.5">
                    {pickList(current.built).map((item) => (
                      <li key={item} className="type-body-sm flex gap-2 text-fg-2">
                        <span aria-hidden className="text-fg-3">
                          –
                        </span>
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>

                <dl className="border-t border-line-1 text-[0.8125rem] leading-[1.35]">
                  {[
                    [t("Highlights", "Repere"), commaLine(pickList(current.highlights))],
                    [t("Languages", "Limbi"), current.languages.join(", ")],
                    [t("Access", "Acces"), access],
                  ].map(([label, value]) => (
                    <div
                      key={label}
                      className="grid grid-cols-[6.5rem_minmax(0,1fr)] gap-3 border-b border-line-1 py-2.5"
                    >
                      <dt className="text-fg-3">{label}</dt>
                      <dd className="text-pretty text-fg-2">{value}</dd>
                    </div>
                  ))}
                </dl>

                {related >= 0 && (
                  <p className="text-[0.8125rem] text-fg-3">
                    {t("Same client:", "Același client:")}{" "}
                    {/* Controls outside the paged text keep focus when paging. */}
                    <button
                      type="button"
                      onClick={() => onIndexChange(related)}
                      className={buttonClass("link", "sm", "align-baseline")}
                    >
                      {projectTitle(projects[related], lang)}
                    </button>
                  </p>
                )}
              </div>

              {/* Stays in view while the stacked dialog scrolls (below lg). */}
              <div className="sticky bottom-0 flex flex-wrap items-center justify-between gap-3 border-t border-line-1 bg-s2 px-5 py-3 sm:px-6 lg:static">
                <a
                  href={current.url}
                  target="_blank"
                  rel="noreferrer"
                  className={buttonClass("primary", "md")}
                >
                  {t("Open the site", "Deschide site-ul")}
                  <ArrowUpRight aria-hidden />
                  <span className="sr-only">
                    {t(" (opens in a new tab)", " (se deschide într-o filă nouă)")}
                  </span>
                </a>
                <div className="flex items-center gap-2">
                  <IconButton
                    size="md"
                    variant="secondary"
                    label={t("Previous project", "Proiectul anterior")}
                    onClick={() => step(-1)}
                  >
                    <ChevronLeft aria-hidden />
                  </IconButton>
                  <IconButton
                    size="md"
                    variant="secondary"
                    label={t("Next project", "Proiectul următor")}
                    onClick={() => step(1)}
                  >
                    <ChevronRight aria-hidden />
                  </IconButton>
                </div>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

/** Summary clamped to four lines, with "Mai mult" when it runs longer. Keyed per project. */
function Summary({ text }: { text: string }) {
  const { t } = useI18n();
  const ref = useRef<HTMLParagraphElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [overflows, setOverflows] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (el) setOverflows(el.scrollHeight > el.clientHeight + 1);
  }, [text]);

  return (
    <div>
      <p ref={ref} className={cn("type-body-sm text-fg-2", !expanded && "line-clamp-4")}>
        {text}
      </p>
      {(overflows || expanded) && (
        <button
          type="button"
          aria-expanded={expanded}
          onClick={() => setExpanded((value) => !value)}
          className={buttonClass("link", "sm", "mt-1.5")}
        >
          {expanded ? t("Less", "Mai puțin") : t("More", "Mai mult")}
        </button>
      )}
    </div>
  );
}

/** Framed live preview: the auto-scrolling desktop page or a phone view. */
function PreviewStage({ project, title }: { project: Project; title: string }) {
  const { t } = useI18n();
  const { paused: motionPaused } = useMotionPause();
  const images = projectImages(project.slug);
  const viewportRef = useRef<HTMLDivElement>(null);
  const [view, setView] = useState<"desktop" | "mobile">("desktop");
  // An explicit pause carries over to the next project; scrolling by hand
  // only stops the auto-preview for the current one.
  const [userPaused, setUserPaused] = useState(motionPaused);
  const [autoScroll, setAutoScroll] = useState(!motionPaused);
  const [loaded, setLoaded] = useState(false);
  const [reduced, setReduced] = useState(false);

  // Reset per project during render rather than remounting, so focused
  // controls in the chrome survive paging.
  const [slug, setSlug] = useState(project.slug);
  if (slug !== project.slug) {
    setSlug(project.slug);
    setView("desktop");
    setAutoScroll(!userPaused);
    setLoaded(false);
  }

  useEffect(() => setReduced(prefersReducedMotion()), []);

  useEffect(() => {
    if (viewportRef.current) viewportRef.current.scrollTop = 0;
  }, [project.slug]);

  // Glide down the page, rest, glide back to the top, repeat.
  useEffect(() => {
    const el = viewportRef.current;
    if (!el || view !== "desktop" || !autoScroll || !loaded || reduced) return;
    const distance = el.scrollHeight - el.clientHeight;
    if (distance < 8) return;

    const speed = Math.min(420, Math.max(70, distance / 24)); // px per second
    let phase: "rest-top" | "down" | "rest-bottom" | "up" = "rest-top";
    let phaseStart = performance.now();
    let pos = el.scrollTop;
    let last = phaseStart;
    let frame = 0;

    const tick = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      const elapsed = now - phaseStart;
      if (phase === "rest-top" && elapsed > 1200) {
        phase = "down";
        phaseStart = now;
      } else if (phase === "down") {
        pos = Math.min(distance, pos + speed * dt);
        el.scrollTop = pos;
        if (pos >= distance) {
          phase = "rest-bottom";
          phaseStart = now;
        }
      } else if (phase === "rest-bottom" && elapsed > 1600) {
        phase = "up";
        phaseStart = now;
      } else if (phase === "up") {
        pos = Math.max(0, pos - speed * 6 * dt);
        el.scrollTop = pos;
        if (pos <= 0) {
          phase = "rest-top";
          phaseStart = now;
        }
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [view, autoScroll, loaded, reduced, project.slug]);

  const takeOver = () => setAutoScroll(false);

  // Paint the first screen instantly (the card already loaded hero.webp);
  // full.webp starts with the same frame and covers it once loaded.
  const heroBackdrop: CSSProperties = {
    backgroundImage: `url(${images.hero})`,
    backgroundSize: "100% auto",
    backgroundRepeat: "no-repeat",
  };

  return (
    <div className="flex min-w-0 flex-col border-b border-line-1 lg:min-h-0 lg:border-b-0 lg:border-r">
      {/* Chrome: address, pause, desktop / mobile. Right padding on small screens clears
          the dialog's close button. */}
      <div className="flex h-12 items-center gap-2 border-b border-line-1 pl-4 pr-12 lg:pr-3">
        <span className="type-code min-w-0 flex-1 truncate text-xs text-fg-3">
          {project.domain}
        </span>
        {view === "desktop" && !reduced && (
          <IconButton
            label={
              autoScroll
                ? t("Pause the preview", "Oprește previzualizarea")
                : t("Play the preview", "Pornește previzualizarea")
            }
            onClick={() => {
              setUserPaused(autoScroll);
              setAutoScroll(!autoScroll);
            }}
          >
            {autoScroll ? <Pause aria-hidden /> : <Play aria-hidden />}
          </IconButton>
        )}
        <SegmentedControl
          label={t("Preview size", "Dimensiunea previzualizării")}
          value={view}
          onChange={setView}
          options={[
            { value: "desktop", label: "Desktop" },
            { value: "mobile", label: t("Mobile", "Mobil") },
          ]}
        />
      </div>

      {/* Viewport */}
      <div
        className={cn(
          "relative bg-s1 lg:aspect-auto lg:min-h-0 lg:flex-1",
          // A taller stage for the phone frame when the dialog is stacked.
          view === "mobile" ? "aspect-[3/4] sm:aspect-[16/10]" : "aspect-[16/10]",
        )}
      >
        {view === "desktop" ? (
          <div
            ref={viewportRef}
            role="region"
            tabIndex={0}
            aria-label={t(
              `Scrollable preview of the ${title} landing page`,
              `Previzualizare derulabilă a paginii ${title}`,
            )}
            onWheel={takeOver}
            onTouchStart={takeOver}
            onPointerDown={takeOver}
            onKeyDown={(event) => {
              if (
                ["ArrowUp", "ArrowDown", "PageUp", "PageDown", "Home", "End", " "].includes(
                  event.key,
                )
              )
                takeOver();
            }}
            className="absolute inset-0 overflow-y-auto overscroll-contain bg-background outline-none [scrollbar-color:rgb(255_255_255/0.2)_transparent] [scrollbar-width:thin] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand-line/55"
            style={heroBackdrop}
          >
            <img
              key={project.slug}
              src={images.full}
              alt={t(`The full ${title} landing page`, `Pagina de prezentare ${title}, completă`)}
              width={960}
              height={project.fullHeight}
              onLoad={() => setLoaded(true)}
              className={cn(
                "block h-auto w-full transition-opacity duration-200",
                loaded ? "opacity-100" : "opacity-0",
              )}
            />
          </div>
        ) : (
          <div className="absolute inset-0 grid place-items-center overflow-hidden py-5">
            <div className="relative aspect-[390/844] h-full overflow-hidden rounded-xl border border-line-2 bg-background">
              <img
                src={images.mobile}
                alt={t(`The ${title} landing page on a phone`, `Pagina ${title} pe telefon`)}
                width={520}
                height={1126}
                className="h-full w-full object-cover object-top"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
