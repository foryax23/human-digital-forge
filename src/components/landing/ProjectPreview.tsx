import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  ArrowLeft,
  LogIn,
  ArrowRight,
  Check,
  Lock,
  Monitor,
  Pause,
  Play,
  Smartphone,
} from "lucide-react";

import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { useI18n } from "@/i18n";
import { cn } from "@/lib/utils";
import { prefersReducedMotion } from "./motion-prefs";
import { useMotionPause } from "./motion-pause";
import { projectImages, projectTitle, type Project } from "./projects";
import { RingButton } from "./RingButton";

type ProjectPreviewProps = {
  projects: Project[];
  /** Index of the open project in `projects`, or null when closed. */
  index: number | null;
  onIndexChange: (index: number | null) => void;
};

/**
 * Sneak-peek popup for a published project: the live landing page in a
 * browser frame that slowly scrolls itself (until the visitor takes over),
 * a phone view, and the project details. Always dark, on any page.
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
        className="cinematic w-[calc(100vw-1.5rem)] max-w-6xl gap-0 overflow-hidden rounded-3xl border-white/10 bg-card p-0 text-foreground shadow-2xl shadow-black/60 sm:rounded-3xl"
        onKeyDown={(event) => {
          if (event.key === "ArrowRight") step(1);
          if (event.key === "ArrowLeft") step(-1);
        }}
      >
        {current && (
          <div className="grid max-h-[92svh] grid-cols-1 overflow-y-auto lg:h-[min(660px,88svh)] lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] lg:overflow-hidden">
            <PreviewStage project={current} title={projectTitle(current, lang)} />

            <div className="flex min-w-0 flex-col lg:min-h-0">
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={current.slug}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.25, ease: [0.25, 0.1, 0.25, 1] }}
                  className="flex flex-col gap-5 p-6 sm:p-8 lg:min-h-0 lg:flex-1 lg:overflow-y-auto lg:pr-14"
                >
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="type-label inline-flex items-center gap-2 rounded-full border border-white/10 px-3 py-1 text-muted-foreground">
                      <span
                        aria-hidden
                        className="h-2 w-2 rounded-full"
                        style={{ backgroundColor: current.accent }}
                      />
                      {pick(current.category)}
                    </span>
                    <span className="type-label tabular-nums text-muted-foreground">
                      {String(position + 1).padStart(2, "0")} /{" "}
                      {String(projects.length).padStart(2, "0")}
                    </span>
                  </div>

                  <div>
                    {/* Roles on inner spans: the dialog primitives' own sizes would win. */}
                    <DialogTitle className="break-words">
                      <span className="type-h3 block">{projectTitle(current, lang)}</span>
                    </DialogTitle>
                    <DialogDescription className="mt-2">
                      <span className="type-body-sm">{pick(current.tagline)}</span>
                    </DialogDescription>
                  </div>

                  <p className="type-body-sm text-foreground/85">{pick(current.summary)}</p>

                  <div>
                    <p className="type-label text-muted-foreground">
                      {t("What we built", "Ce am construit")}
                    </p>
                    <ul className="mt-3 space-y-2.5">
                      {pickList(current.built).map((item) => (
                        <li
                          key={item}
                          className="type-body-sm flex items-start gap-3 text-foreground/85"
                        >
                          <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-teal/15 text-teal">
                            <Check className="h-3 w-3" strokeWidth={3} />
                          </span>
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <ul className="flex flex-wrap gap-2" aria-label={t("Highlights", "Repere")}>
                    {pickList(current.highlights).map((chip) => (
                      <li
                        key={chip}
                        className="type-micro rounded-full bg-white/[0.06] px-3 py-1.5 text-foreground/90"
                      >
                        {chip}
                      </li>
                    ))}
                  </ul>

                  <p className="type-micro text-muted-foreground">
                    {t("Languages", "Limbi")}: {current.languages.join(" · ")}
                  </p>
                </motion.div>
              </AnimatePresence>

              {/* Controls live outside the keyed block so focus stays put when paging. */}
              {related >= 0 && (
                <div className="px-6 pb-4 sm:px-8">
                  <button
                    type="button"
                    onClick={() => onIndexChange(related)}
                    className="type-micro group inline-flex items-center gap-2 rounded-full text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {t("Same client:", "Același client:")}{" "}
                    <span className="text-foreground underline-offset-4 group-hover:underline">
                      {projectTitle(projects[related], lang)}
                    </span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 px-6 py-4 sm:px-8">
                <RingButton href={current.url} variant="solid" arrow="up-right">
                  {t("Visit live site", "Vezi site-ul live")}
                </RingButton>
                <div className="flex items-center gap-2">
                  <NavButton
                    label={t("Previous project", "Proiectul anterior")}
                    onClick={() => step(-1)}
                  >
                    <ArrowLeft className="h-4 w-4" />
                  </NavButton>
                  <NavButton label={t("Next project", "Proiectul următor")} onClick={() => step(1)}>
                    <ArrowRight className="h-4 w-4" />
                  </NavButton>
                </div>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function NavButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="grid h-11 w-11 place-items-center rounded-full border border-white/10 text-foreground transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      {children}
    </button>
  );
}

/** Browser-framed live preview: auto-scrolling desktop page or a phone view. */
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
  const autoActive = view === "desktop" && autoScroll && !reduced;

  // Paint the first screen instantly (the card already loaded hero.webp);
  // full.webp starts with the same frame and covers it once loaded.
  const heroBackdrop: CSSProperties = {
    backgroundImage: `url(${images.hero})`,
    backgroundSize: "100% auto",
    backgroundRepeat: "no-repeat",
  };

  return (
    <div className="flex min-w-0 flex-col border-b border-white/10 bg-black/30 lg:min-h-0 lg:border-b-0 lg:border-r">
      {/* Browser chrome */}
      {/* Right padding on small screens clears the dialog's close button. */}
      <div className="flex items-center gap-3 border-b border-white/10 py-3 pl-4 pr-12 lg:pr-4">
        <div aria-hidden className="hidden gap-1.5 sm:flex">
          <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]/80" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#febc2e]/80" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]/80" />
        </div>
        <div className="type-micro flex min-w-0 flex-1 items-center gap-2 rounded-full bg-white/[0.06] px-3 py-1.5 text-muted-foreground">
          <Lock aria-hidden className="h-3 w-3 shrink-0" />
          <span className="truncate">{project.domain}</span>
          <span className="type-label ml-auto hidden shrink-0 items-center gap-1.5 text-emerald-400 sm:inline-flex">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse-dot" />
            {t("Live", "Live")}
          </span>
        </div>
        {view === "desktop" && !reduced && (
          <button
            type="button"
            onClick={() => {
              setUserPaused(autoScroll);
              setAutoScroll(!autoScroll);
            }}
            aria-label={
              autoScroll
                ? t("Pause the preview", "Oprește previzualizarea")
                : t("Play the preview", "Pornește previzualizarea")
            }
            className="grid h-8 w-8 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-white/10 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {autoScroll ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
          </button>
        )}
        <div
          role="group"
          aria-label={t("Preview size", "Dimensiune previzualizare")}
          className="flex rounded-full bg-white/[0.06] p-0.5"
        >
          {(
            [
              ["desktop", Monitor, t("Desktop view", "Vizualizare desktop")],
              ["mobile", Smartphone, t("Mobile view", "Vizualizare mobil")],
            ] as const
          ).map(([value, Icon, label]) => (
            <button
              key={value}
              type="button"
              aria-pressed={view === value}
              aria-label={label}
              onClick={() => setView(value)}
              className={cn(
                "grid h-7 w-8 place-items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                view === value
                  ? "bg-white/15 text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className="h-3.5 w-3.5" />
            </button>
          ))}
        </div>
      </div>

      {/* Viewport */}
      <div
        className={cn(
          "relative lg:aspect-auto lg:min-h-0 lg:flex-1",
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
            className="absolute inset-0 overflow-y-auto overscroll-contain bg-background [scrollbar-color:rgb(255_255_255/0.2)_transparent] [scrollbar-width:thin] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
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
                "block h-auto w-full transition-opacity duration-300",
                loaded ? "opacity-100" : "opacity-0",
              )}
            />
          </div>
        ) : (
          <div className="absolute inset-0 grid place-items-center overflow-hidden bg-[radial-gradient(60%_60%_at_50%_45%,oklch(0.585_0.225_282/0.18),transparent_70%)] py-5">
            <div className="relative aspect-[390/844] h-full overflow-hidden rounded-[2rem] border-[6px] border-black bg-black shadow-2xl shadow-black/60">
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

        {project.access !== "public" && (
          <span className="pointer-events-none absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-black/70 px-3 py-1.5 type-micro text-foreground backdrop-blur">
            {project.access === "private" ? (
              <>
                <Lock aria-hidden className="h-3 w-3" />
                {t(
                  "Members-only app · sign-in screen",
                  "Aplicație cu acces privat · ecran de autentificare",
                )}
              </>
            ) : (
              <>
                <LogIn aria-hidden className="h-3 w-3" />
                {t("Opens on a sign-in screen", "Se deschide cu ecranul de autentificare")}
              </>
            )}
          </span>
        )}

        <AnimatePresence>
          {autoActive && loaded && (
            <motion.span
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 6 }}
              className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-black/70 px-3 py-1.5 type-micro text-foreground/90 backdrop-blur"
            >
              {t(
                "Auto-preview · scroll to explore",
                "Previzualizare automată · derulează pentru a explora",
              )}
            </motion.span>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
