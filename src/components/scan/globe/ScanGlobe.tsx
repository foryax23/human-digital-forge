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
import { AnimatePresence, motion, useReducedMotion } from "motion/react";

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

/**
 * One data source: a small solid card (title 13 px with a status square, the value in
 * 14 px, one plain detail line). No icon tile, blur, glow or chips.
 */
function DataCardView({ card, className }: { card: DataCard; className?: string }) {
  return (
    <div className={cn("rounded-lg border border-line-2 bg-s2 px-3 py-2.5", className)}>
      <p className="flex items-center gap-1.5 text-[0.8125rem] font-medium leading-[1.35] text-fg-2">
        <span
          aria-hidden
          className={cn("size-1.5 shrink-0 rounded-[1px]", card.muted ? "bg-warn" : "bg-ok")}
        />
        <span className="min-w-0 truncate">{card.label}</span>
      </p>
      <p
        className={cn(
          "mt-1 line-clamp-2 break-words text-sm leading-[1.4]",
          card.muted ? "text-fg-2" : "text-fg",
        )}
        title={card.value}
      >
        {card.value}
      </p>
      {card.detail ? (
        <p className="mt-0.5 line-clamp-2 text-xs leading-[1.45] text-fg-3">{card.detail}</p>
      ) : null}
    </div>
  );
}

/** Cards and traces appear with a 200 ms fade (nothing slides, scales or floats); instantly
    under reduced motion. */
function useCardMotion() {
  const reduce = Boolean(useReducedMotion());
  return {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
    transition: { duration: reduce ? 0 : 0.2, ease: "easeOut" },
  } as const;
}

/**
 * The right half of the analysis screen: the globe (3D on desktop, SVG
 * elsewhere) with a card for every data source as its result lands. Cards only
 * ever show values the scan has measured. Phones (< 768 px) don't render it: the
 * checklist prints each finding under its row instead.
 */
export function ScanGlobe({ state, className }: { state: ScanState; className?: string }) {
  const { t, lang } = useI18n();
  const { paused } = useMotionPause();
  const mode = useGlobeMode();
  const stageRef = useRef<HTMLDivElement>(null);
  const onScreen = useOnScreen(stageRef);
  const [sceneReady, setSceneReady] = useState(false);
  const cardMotion = useCardMotion();

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
          {cards.map((card) => {
            const path = connectorPath(card.id);
            if (!path || card.muted) return null;
            return (
              <motion.g key={card.id} {...cardMotion}>
                <path
                  d={path.d}
                  fill="none"
                  className="stroke-line-3"
                  strokeWidth={1}
                  vectorEffect="non-scaling-stroke"
                />
                <circle cx={path.start.x} cy={path.start.y} r={0.6} className="fill-fg-3" />
              </motion.g>
            );
          })}
        </svg>

        <ul className="hidden lg:block" aria-label={t("What we found", "Ce am găsit")}>
          <AnimatePresence>
            {cards.map((card) => {
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
                  <DataCardView card={card} />
                </motion.li>
              );
            })}
          </AnimatePresence>
        </ul>
      </div>

      {/* Tablets: the same cards, in a grid under the globe. */}
      <ul
        className="mt-4 grid grid-cols-2 gap-2 lg:hidden"
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
