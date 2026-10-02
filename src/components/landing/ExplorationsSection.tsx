import { useEffect, useRef, useState, type Ref } from "react";
import { MotionConfig, motion } from "motion/react";
import { Expand } from "lucide-react";

import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { ScrollTrigger, gsap, prefersReducedMotion, useGsap } from "@/components/landing/gsap";
import { SWIRL_VIDEO } from "@/components/landing/media";
import { RingButton } from "@/components/landing/RingButton";
import { Em, Eyebrow } from "@/components/landing/SectionHeader";
import { useI18n } from "@/i18n";
import { cn } from "@/lib/utils";
import heroBg from "@/assets/home/hero-bg.jpg";
import aiSpotlight from "@/assets/home/ai-spotlight.jpg";
import audienceBusiness from "@/assets/home/audience-business.jpg";
import audienceIndividuals from "@/assets/home/audience-individuals.jpg";
import orbisGlobe from "@/assets/home/orbisgrid-globe.webp";
import heroBgThumb from "@/assets/home/thumbs/hero-bg-640.webp";
import aiSpotlightThumb from "@/assets/home/thumbs/ai-spotlight-640.webp";
import audienceBusinessThumb from "@/assets/home/thumbs/audience-business-640.webp";
import audienceIndividualsThumb from "@/assets/home/thumbs/audience-individuals-640.webp";
import orbisGlobeThumb from "@/assets/home/thumbs/orbisgrid-globe-640.webp";

type Exploration = {
  id: string;
  /** Full image for the lightbox. */
  src: string;
  /** 640px square for the card. */
  thumb: string;
  width: number;
  height: number;
  caption: string;
  alt: string;
};

/** Resting tilt per card (left column, then right); cards straighten on hover/focus. */
const LEFT_TILT = ["rotate-[-6deg]", "rotate-[4deg]", "rotate-[-3deg]"];
const RIGHT_TILT = ["rotate-[5deg]", "rotate-[-4deg]", "rotate-[3deg]"];

/**
 * Explorations (#explorations): a pinned centre heading with two columns of
 * image cards scrolling past it at different speeds, each opening a lightbox.
 * Reduced-motion visitors get a normal-height section with a plain grid.
 */
export function ExplorationsSection() {
  const { t } = useI18n();
  const sectionRef = useRef<HTMLElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const leftColumnRef = useRef<HTMLDivElement>(null);
  const rightColumnRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<(HTMLButtonElement | null)[]>([]);

  // false on the server and during hydration, so both renders match.
  const [reducedMotion, setReducedMotion] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  useEffect(() => {
    setReducedMotion(prefersReducedMotion());
    if (typeof window.matchMedia !== "function") return;
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = () => setReducedMotion(query.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);

  useGsap(
    () => {
      if (reducedMotion) {
        // The section just lost its 300vh height; triggers further down must re-measure.
        ScrollTrigger.refresh();
        return;
      }
      const section = sectionRef.current;
      const content = contentRef.current;
      const left = leftColumnRef.current;
      const right = rightColumnRef.current;
      if (!section || !content || !left || !right) return;

      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        ScrollTrigger.create({
          trigger: section,
          start: "top top",
          end: "bottom bottom",
          pin: content,
          pinSpacing: false,
        });

        // Distances are in viewport heights so every card crosses the pinned
        // heading while it is held, whatever the screen size.
        const drift = (column: HTMLElement, viewports: number) =>
          gsap.to(column, {
            y: () => -window.innerHeight * viewports,
            ease: "none",
            scrollTrigger: {
              trigger: section,
              start: "top bottom",
              end: "bottom top",
              scrub: true,
              invalidateOnRefresh: true,
            },
          });
        drift(left, 0.5);
        drift(right, 1.2);

        // Triggers measure once; when content above changes height (the process
        // panel switching steps, a language switch) re-measure, or the pin jumps.
        // pinSpacing:false means the pin itself never changes <main>'s height.
        const page = section.parentElement;
        let timer: number | undefined;
        const observer = new ResizeObserver(() => {
          window.clearTimeout(timer);
          timer = window.setTimeout(() => ScrollTrigger.refresh(), 150);
        });
        if (page) observer.observe(page);
        return () => {
          observer.disconnect();
          window.clearTimeout(timer);
        };
      });
      return () => mm.revert();
    },
    sectionRef,
    [reducedMotion],
  );

  const items: Exploration[] = [
    {
      id: "swirl",
      src: SWIRL_VIDEO.poster,
      thumb: SWIRL_VIDEO.poster,
      width: 960,
      height: 960,
      caption: t("The Vortex swirl", "Vârtejul Vortex"),
      alt: t(
        "Glowing violet ribbons of light spiralling around a dark centre",
        "Panglici de lumină violet strălucitoare care se rotesc în jurul unui centru întunecat",
      ),
    },
    {
      id: "network",
      src: aiSpotlight,
      thumb: aiSpotlightThumb,
      width: 1024,
      height: 1024,
      caption: t("A network of light", "O rețea de lumină"),
      alt: t(
        "Glowing teal nodes joined by thin lines into a network on a dark background",
        "Noduri turcoaz strălucitoare, unite prin linii subțiri într-o rețea, pe fundal întunecat",
      ),
    },
    {
      id: "team",
      src: audienceBusiness,
      thumb: audienceBusinessThumb,
      width: 1024,
      height: 1024,
      caption: t("Teamwork around one table", "Lucru în echipă la aceeași masă"),
      alt: t(
        "Four people working with a laptop, a tablet and papers around a lit round table in a dark office",
        "Patru oameni lucrează cu un laptop, o tabletă și documente în jurul unei mese rotunde luminate, într-un birou întunecat",
      ),
    },
    {
      id: "particles",
      src: heroBg,
      thumb: heroBgThumb,
      width: 1920,
      height: 1080,
      caption: t("A particle wave in teal and violet", "Un val de particule turcoaz și violet"),
      alt: t(
        "A wave of teal and violet particle smoke drifting across a dark background",
        "Un val de fum din particule turcoaz și violet care plutește pe un fundal întunecat",
      ),
    },
    {
      id: "globe",
      src: orbisGlobe,
      thumb: orbisGlobeThumb,
      width: 1120,
      height: 1120,
      caption: t("ORBISGRID · animated globe terminal", "ORBISGRID · terminal cu glob animat"),
      alt: t(
        "A glowing blue wireframe globe with signal points, from the ORBISGRID sign-in terminal",
        "Un glob albastru strălucitor, cu puncte de semnal, din terminalul de autentificare ORBISGRID",
      ),
    },
    {
      id: "focus",
      src: audienceIndividuals,
      thumb: audienceIndividualsThumb,
      width: 1024,
      height: 1024,
      caption: t("Focused work at the laptop", "Lucru concentrat la laptop"),
      alt: t(
        "A man with glasses typing on a laptop in a dark room lit by a soft teal glow",
        "Un bărbat cu ochelari scrie la laptop într-o cameră întunecată, luminată de o strălucire turcoaz",
      ),
    },
  ];
  const active = items[activeIndex];
  const openLabel = t("Open image: ", "Deschide imaginea: ");

  const openImage = (index: number) => {
    setActiveIndex(index);
    setLightboxOpen(true);
  };

  const renderCard = (index: number, className?: string) => (
    <ExplorationCard
      key={items[index].id}
      item={items[index]}
      label={openLabel + items[index].caption}
      className={className}
      onOpen={() => openImage(index)}
      buttonRef={(el) => {
        cardRefs.current[index] = el;
      }}
    />
  );

  return (
    <section
      id="explorations"
      ref={sectionRef}
      aria-labelledby="explorations-heading"
      className={cn(
        "relative isolate overflow-x-clip bg-background",
        reducedMotion ? "py-16 md:py-24" : "min-h-[300vh]",
      )}
    >
      {/* Layer 1 — the block that stays pinned while the cards pass over it. */}
      <div
        ref={contentRef}
        className={cn(
          "relative z-10 flex flex-col items-center px-6 text-center",
          !reducedMotion && "h-screen justify-center",
        )}
      >
        <MotionConfig reducedMotion="user">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 1, ease: [0.25, 0.1, 0.25, 1] }}
            className="flex flex-col items-center"
          >
            <Eyebrow>{t("Explorations", "Explorări")}</Eyebrow>
            <h2
              id="explorations-heading"
              className="mt-5 font-display text-5xl font-semibold tracking-tight text-foreground md:text-7xl"
            >
              {t("Ideas in", "Idei în")} <Em>{t("motion", "mișcare")}</Em>
            </h2>
            <p className="mt-5 max-w-md text-sm text-muted-foreground md:text-base">
              {t(
                "A look at the visuals, interfaces and systems we explore — for clients and for ourselves.",
                "O privire asupra imaginilor, interfețelor și sistemelor pe care le explorăm — pentru clienți și pentru noi.",
              )}
            </p>
            <RingButton to="/portfolio" variant="outline" arrow="up-right" className="mt-8">
              {t("See the portfolio", "Vezi portofoliul")}
            </RingButton>
          </motion.div>
        </MotionConfig>
      </div>

      {reducedMotion ? (
        <div className="mx-auto mt-12 grid max-w-[1200px] grid-cols-2 gap-5 px-6 md:mt-16 md:grid-cols-3 md:gap-6 md:px-10 lg:px-16">
          {items.map((_, index) => renderCard(index))}
        </div>
      ) : (
        // Layer 2 — two columns, offset and spaced in viewport heights so the
        // cards travel through the screen over the section's 300vh.
        <div className="pointer-events-none absolute inset-0 z-20">
          <div className="mx-auto grid h-full max-w-[1400px] grid-cols-2 gap-12 px-6 md:gap-40">
            <div
              ref={leftColumnRef}
              className="flex flex-col items-start gap-[52vh] pt-[60vh] will-change-transform md:gap-[45vh]"
            >
              {[0, 2, 4].map((index, i) =>
                renderCard(index, cn("max-w-[min(320px,33vh)]", LEFT_TILT[i])),
              )}
            </div>
            <div
              ref={rightColumnRef}
              className="flex flex-col items-end gap-[52vh] pt-[110vh] will-change-transform md:gap-[45vh]"
            >
              {[1, 3, 5].map((index, i) =>
                renderCard(index, cn("max-w-[min(320px,33vh)]", RIGHT_TILT[i])),
              )}
            </div>
          </div>
        </div>
      )}

      <Dialog open={lightboxOpen} onOpenChange={setLightboxOpen}>
        <DialogContent
          closeLabel={t("Close", "Închide")}
          aria-describedby={undefined}
          // Hand focus back to the card without scrolling the parallax layout.
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            cardRefs.current[activeIndex]?.focus({ preventScroll: true });
          }}
          className="cinematic w-max max-w-[min(calc(100vw-2rem),72rem)] gap-4 rounded-3xl border-border p-4 text-foreground shadow-2xl shadow-black/50 sm:rounded-3xl md:p-6"
        >
          <DialogTitle className="pr-10 font-display text-base font-semibold leading-snug md:text-lg">
            {active.caption}
          </DialogTitle>
          <img
            src={active.src}
            alt={active.alt}
            width={active.width}
            height={active.height}
            decoding="async"
            className="mx-auto block h-auto max-h-[min(80vh,calc(100dvh-9rem))] w-auto max-w-full rounded-2xl object-contain"
          />
        </DialogContent>
      </Dialog>
    </section>
  );
}

/** Square image card; the accessible name comes from `label`, so the image itself is decorative. */
function ExplorationCard({
  item,
  label,
  className,
  onOpen,
  buttonRef,
}: {
  item: Exploration;
  label: string;
  className?: string;
  onOpen: () => void;
  buttonRef: Ref<HTMLButtonElement>;
}) {
  return (
    <button
      ref={buttonRef}
      type="button"
      onClick={onOpen}
      aria-label={label}
      className={cn(
        "group pointer-events-auto relative block aspect-square w-full cursor-zoom-in overflow-hidden rounded-3xl border border-border bg-card shadow-2xl shadow-black/40 outline-none transition-[rotate,scale] duration-500 ease-out hover:rotate-0 hover:scale-[1.03] focus-visible:rotate-0 focus-visible:scale-[1.03] focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background motion-reduce:transition-none motion-reduce:hover:scale-100 motion-reduce:focus-visible:scale-100",
        className,
      )}
    >
      <img
        src={item.thumb}
        alt=""
        width={item.width}
        height={item.height}
        loading="lazy"
        decoding="async"
        draggable={false}
        className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-105 motion-reduce:transition-none motion-reduce:group-hover:scale-100"
      />
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 bg-gradient-to-t from-background/90 via-background/50 to-transparent p-3 pt-10 text-left text-xs font-medium text-foreground opacity-0 transition-opacity duration-300 group-hover:opacity-100 group-focus-visible:opacity-100 sm:p-4 sm:pt-12 sm:text-sm"
      >
        <span className="line-clamp-2">{item.caption}</span>
        <Expand className="h-4 w-4 shrink-0" />
      </span>
    </button>
  );
}
