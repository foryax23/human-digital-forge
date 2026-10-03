import {
  Component,
  Suspense,
  lazy,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { AnimatePresence, motion } from "motion/react";
import { Building2, Globe2, Layers, Share2, Star, Users, type LucideIcon } from "lucide-react";

import { useMotionPause } from "@/components/landing/motion-pause";
import type { ScanState } from "@/components/scan/scan-state";
import { useI18n } from "@/i18n";
import { cn } from "@/lib/utils";
import { buildDataCards, type DataCard, type DataCardId } from "./data-cards";
import { locatePlace } from "./geo";
import { GLOBE_RADIUS_RATIO, StaticGlobe } from "./StaticGlobe";

// The server build never renders the 3D scene; the SSR branch keeps three.js
// out of the Worker bundle.
type GlobeSceneComponent = (typeof import("./GlobeScene"))["default"];
const GlobeScene = lazy(() =>
  import.meta.env.SSR
    ? Promise.resolve({ default: (() => null) as unknown as GlobeSceneComponent })
    : import("./GlobeScene"),
);

type GlobeMode = "pending" | "3d" | "static";

let webglSupport: boolean | undefined;
function hasWebGL() {
  if (webglSupport === undefined) {
    try {
      const canvas = document.createElement("canvas");
      webglSupport = !!(canvas.getContext("webgl2") ?? canvas.getContext("webgl"));
    } catch {
      webglSupport = false;
    }
  }
  return webglSupport;
}

/**
 * "3d" on desktops with WebGL and motion allowed; "static" (SVG) on phones,
 * for reduced motion and without WebGL; "pending" during SSR and hydration.
 */
function useGlobeMode(): GlobeMode {
  const [mode, setMode] = useState<GlobeMode>("pending");
  useEffect(() => {
    const desktop = window.matchMedia("(min-width: 1024px)");
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () =>
      setMode(desktop.matches && !reduce.matches && hasWebGL() ? "3d" : "static");
    update();
    desktop.addEventListener("change", update);
    reduce.addEventListener("change", update);
    return () => {
      desktop.removeEventListener("change", update);
      reduce.removeEventListener("change", update);
    };
  }, []);
  return mode;
}

/** True while the element is on screen. */
function useOnScreen(ref: React.RefObject<HTMLElement | null>) {
  const [onScreen, setOnScreen] = useState(true);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(([entry]) => setOnScreen(entry.isIntersecting));
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref]);
  return onScreen;
}

/** A WebGL failure falls back to the SVG globe instead of breaking the page. */
class SceneBoundary extends Component<
  { fallback: ReactNode; children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

const ICONS: Record<DataCardId, LucideIcon> = {
  website: Globe2,
  social: Share2,
  business: Building2,
  technology: Layers,
  reviews: Star,
  competitors: Users,
};

/*
 * Orbit slots on a 120 × 100 grid matching the 6:5 stage. The globe sits in
 * the middle (centre 60,50; radius 30). `x` is the card edge facing the globe
 * and `y` the card's vertical middle, so the connector always meets the card
 * whatever its width.
 */
const STAGE_W = 120;
const STAGE_H = 100;
const GLOBE = { x: 60, y: 50, r: GLOBE_RADIUS_RATIO * STAGE_H };

const SLOTS: Record<DataCardId, { side: "left" | "right"; x: number; y: number }> = {
  website: { side: "left", x: 40, y: 12 },
  social: { side: "right", x: 80, y: 10 },
  business: { side: "left", x: 33, y: 50 },
  technology: { side: "right", x: 88, y: 46 },
  reviews: { side: "left", x: 42, y: 88 },
  competitors: { side: "right", x: 78, y: 90 },
};

/** Curved line from the globe's edge to the card, or null when they touch. */
function connectorPath(id: DataCardId) {
  const slot = SLOTS[id];
  const dx = slot.x - GLOBE.x;
  const dy = slot.y - GLOBE.y;
  const distance = Math.hypot(dx, dy);
  if (distance < GLOBE.r + 3) return null;
  const ux = dx / distance;
  const uy = dy / distance;
  const sx = GLOBE.x + ux * (GLOBE.r + 0.6);
  const sy = GLOBE.y + uy * (GLOBE.r + 0.6);
  // Leaves the globe radially and bows gently into the card's inner edge.
  const reach = Math.hypot(slot.x - sx, slot.y - sy) * 0.6;
  const c = `${sx + ux * reach} ${sy + uy * reach}`;
  return { d: `M${sx} ${sy} Q${c} ${slot.x} ${slot.y}`, start: { x: sx, y: sy } };
}

function DataCardView({ card, className }: { card: DataCard; className?: string }) {
  const Icon = ICONS[card.id];
  return (
    <div
      className={cn(
        "rounded-2xl border border-white/10 bg-[#070a1f]/75 p-3.5 shadow-[0_24px_60px_-30px_rgb(0_0_0/0.9)] backdrop-blur-xl",
        card.muted && "bg-[#070a1f]/55",
        className,
      )}
    >
      <div className="flex items-center gap-2.5">
        <span
          aria-hidden
          className={cn(
            "grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-[#6c63ff]/35 to-[#5b8cf0]/15 ring-1 ring-white/10",
            card.muted && "from-white/10 to-white/5",
          )}
        >
          <Icon className={cn("h-4 w-4 text-[#89cbf6]", card.muted && "text-foreground/45")} />
        </span>
        <span className="type-label line-clamp-2 min-w-0 text-foreground/55">{card.label}</span>
        {!card.muted && (
          <span
            aria-hidden
            className="ml-auto h-1.5 w-1.5 shrink-0 rounded-full bg-[#5fe3d0] shadow-[0_0_10px_#5fe3d0]"
          />
        )}
      </div>
      <p
        className={cn(
          "type-body mt-2.5 line-clamp-2 break-words font-semibold text-foreground",
          card.muted && "text-foreground/65",
        )}
        title={card.value}
      >
        {card.value}
      </p>
      {card.detail && (
        <p className="type-micro mt-0.5 line-clamp-2 text-foreground/55">{card.detail}</p>
      )}
      {card.chips && card.chips.length > 0 && (
        <ul className="mt-2 flex flex-wrap gap-1">
          {card.chips.map((chip) => (
            <li
              key={chip}
              className="type-micro rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-foreground/70"
            >
              {chip}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

const cardMotion = {
  initial: { opacity: 0, scale: 0.9, y: 10, filter: "blur(10px)" },
  animate: { opacity: 1, scale: 1, y: 0, filter: "blur(0px)" },
  transition: { type: "spring", stiffness: 210, damping: 24, mass: 0.9 },
} as const;

/**
 * The right half of the analysis screen: the globe (3D on desktop, SVG
 * elsewhere) with a glass card for every data source as its result lands.
 * Cards only ever show values the scan has measured.
 */
export function ScanGlobe({ state, className }: { state: ScanState; className?: string }) {
  const { t, lang } = useI18n();
  const { paused } = useMotionPause();
  const mode = useGlobeMode();
  const stageRef = useRef<HTMLDivElement>(null);
  const onScreen = useOnScreen(stageRef);
  const [sceneReady, setSceneReady] = useState(false);

  const cards = useMemo(() => buildDataCards(state, t, lang), [state, t, lang]);
  const home = useMemo(
    () => locatePlace(state.company?.city, state.company?.county),
    [state.company?.city, state.company?.county],
  );
  const pulses = state.steps.filter((step) => step.status === "done").length;
  const running = state.status === "running";
  const done = state.status === "done";

  const placeholder = <StaticGlobe home={home} done={done} showDots={false} />;

  return (
    <div className={cn("relative", className)}>
      <div
        ref={stageRef}
        className="relative mx-auto aspect-square w-full max-w-[21rem] sm:max-w-[24rem] lg:aspect-[6/5] lg:max-w-[44rem]"
      >
        {/* The globe: a square as tall as the stage, centred. */}
        <div className="absolute inset-y-0 left-1/2 aspect-square -translate-x-1/2 max-lg:scale-[1.3]">
          {mode === "3d" ? (
            <>
              {/* The SVG globe in the same pose holds the place while three.js loads. */}
              <div
                className={cn(
                  "absolute inset-0 transition-opacity duration-700",
                  sceneReady && "opacity-0",
                )}
              >
                <StaticGlobe home={home} done={done} />
              </div>
              <SceneBoundary fallback={<StaticGlobe home={home} done={done} />}>
                <Suspense fallback={null}>
                  <div className="absolute inset-0">
                    <GlobeScene
                      home={home}
                      pulses={pulses}
                      running={running}
                      done={done}
                      active={onScreen && !paused}
                      onReady={() => setSceneReady(true)}
                    />
                  </div>
                </Suspense>
              </SceneBoundary>
            </>
          ) : mode === "static" ? (
            <StaticGlobe home={home} done={done} />
          ) : (
            placeholder
          )}
        </div>

        {/* Desktop: cards orbit the globe, each tied to it by a light trace. */}
        <svg
          aria-hidden
          viewBox={`0 0 ${STAGE_W} ${STAGE_H}`}
          className="pointer-events-none absolute inset-0 hidden h-full w-full overflow-visible lg:block"
        >
          <defs>
            <linearGradient id="scan-connector" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#89cbf6" stopOpacity="0.9" />
              <stop offset="100%" stopColor="#6c63ff" stopOpacity="0.5" />
            </linearGradient>
          </defs>
          {cards.map((card) => {
            const path = connectorPath(card.id);
            if (!path || card.muted) return null;
            return (
              <g key={card.id}>
                <motion.path
                  d={path.d}
                  fill="none"
                  stroke="url(#scan-connector)"
                  strokeWidth={0.17}
                  initial={{ pathLength: 0, opacity: 0 }}
                  animate={{ pathLength: 1, opacity: 1 }}
                  transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
                />
                <circle cx={path.start.x} cy={path.start.y} r={0.7} fill="#89cbf6" />
              </g>
            );
          })}
        </svg>

        <ul className="hidden lg:block" aria-label={t("What we found", "Ce am găsit")}>
          <AnimatePresence>
            {cards.map((card, index) => {
              const slot = SLOTS[card.id];
              return (
                <motion.li
                  key={card.id}
                  {...cardMotion}
                  className="absolute w-[11rem] -translate-y-1/2 xl:w-[12.5rem]"
                  style={{
                    top: `${(slot.y / STAGE_H) * 100}%`,
                    ...(slot.side === "left"
                      ? { right: `${100 - (slot.x / STAGE_W) * 100}%` }
                      : { left: `${(slot.x / STAGE_W) * 100}%` }),
                  }}
                >
                  <div
                    className="animate-float-slow motion-reduce:animate-none"
                    style={{ animationDelay: `${-index * 1.7}s` }}
                  >
                    <DataCardView card={card} />
                  </div>
                </motion.li>
              );
            })}
          </AnimatePresence>
        </ul>
      </div>

      {/* Phones and tablets: the same cards, stacked under the globe. */}
      <ul
        className="mt-4 grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 lg:hidden"
        aria-label={t("What we found", "Ce am găsit")}
      >
        <AnimatePresence>
          {cards.map((card) => (
            <motion.li key={card.id} {...cardMotion}>
              <DataCardView card={card} className="h-full" />
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>
    </div>
  );
}
