import { useId } from "react";
import { useReducedMotion } from "motion/react";
import {
  Compass,
  PenTool,
  Workflow,
  Globe,
  Sparkles,
  Zap,
  MessageSquareDot,
} from "lucide-react";

import { useI18n } from "@/i18n";

type NodeDef = {
  x: number;
  y: number;
  icon: typeof Compass;
  label: string;
  tone: "primary" | "teal";
};

const CX = 300;
const CY = 260;

/**
 * Animated automation diagram: a glowing core feeding data packets through
 * curved circuits to the service nodes. Pure SVG + SMIL, SSR-safe.
 */
export function AutomationCore() {
  const { t } = useI18n();
  const reduce = useReducedMotion();
  const uid = useId().replace(/[:]/g, "");

  const nodes: NodeDef[] = [
    { x: 520, y: 150, icon: Compass, label: t("Strategy", "Strategie"), tone: "primary" },
    { x: 540, y: 300, icon: PenTool, label: t("Design", "Design"), tone: "teal" },
    { x: 470, y: 440, icon: Workflow, label: t("Automation", "Automatizare"), tone: "primary" },
    { x: 150, y: 430, icon: Globe, label: t("Websites", "Website-uri"), tone: "teal" },
    { x: 70, y: 290, icon: Sparkles, label: t("AI", "AI"), tone: "primary" },
    { x: 120, y: 140, icon: MessageSquareDot, label: t("Fast response", "Răspuns rapid"), tone: "teal" },
  ];

  // Build a gently curved path from the core to a node.
  const pathFor = (n: NodeDef) => {
    const mx = (CX + n.x) / 2;
    const my = (CY + n.y) / 2;
    // perpendicular offset for a soft bend
    const dx = n.x - CX;
    const dy = n.y - CY;
    const len = Math.hypot(dx, dy) || 1;
    const off = 36;
    const cx = mx + (-dy / len) * off;
    const cy = my + (dx / len) * off;
    return `M ${CX} ${CY} Q ${cx} ${cy} ${n.x} ${n.y}`;
  };

  return (
    <div className="relative animate-float-slow">
      <div
        aria-hidden
        className="absolute -inset-8 rounded-[2.5rem] bg-gradient-brand opacity-25 blur-3xl animate-glow-pulse"
      />
      <div className="relative rounded-3xl border border-border bg-card/75 backdrop-blur-xl p-5 glow-soft sm:p-6">
        <div className="flex items-center justify-between gap-3 px-1">
          <span className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            {t("Automation core", "Nucleu de automatizare")}
          </span>
          <span className="inline-flex items-center gap-2 rounded-full border border-border bg-background/40 px-3 py-1 text-xs font-medium text-muted-foreground">
            <span className="relative flex h-2 w-2">
              {!reduce && (
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-teal opacity-70" />
              )}
              <span className="relative inline-flex h-2 w-2 rounded-full bg-teal" />
            </span>
            {t("Live data flow", "Flux de date live")}
          </span>
        </div>

        <svg
          viewBox="0 0 600 520"
          className="mt-2 w-full"
          role="img"
          aria-label={t(
            "Diagram of an automation core connected to services",
            "Diagramă a unui nucleu de automatizare conectat la servicii",
          )}
        >
          <defs>
            <radialGradient id={`core-${uid}`} cx="42%" cy="38%" r="65%">
              <stop offset="0%" stopColor="oklch(0.92 0.06 270)" />
              <stop offset="40%" stopColor="oklch(0.66 0.22 277)" />
              <stop offset="100%" stopColor="oklch(0.42 0.19 290)" />
            </radialGradient>
            <radialGradient id={`coreGlow-${uid}`} cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="oklch(0.62 0.22 277 / 0.55)" />
              <stop offset="100%" stopColor="oklch(0.62 0.22 277 / 0)" />
            </radialGradient>
            <linearGradient id={`wire-${uid}`} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="oklch(0.585 0.225 277)" />
              <stop offset="100%" stopColor="oklch(0.74 0.11 200)" />
            </linearGradient>
            <radialGradient id={`packet-${uid}`} cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="oklch(0.98 0.04 200)" />
              <stop offset="100%" stopColor="oklch(0.74 0.13 200 / 0)" />
            </radialGradient>
          </defs>

          {/* Circuits */}
          {nodes.map((n, i) => {
            const d = pathFor(n);
            return (
              <g key={`wire-${i}`}>
                <path id={`p-${uid}-${i}`} d={d} fill="none" stroke="oklch(1 0 0 / 0.08)" strokeWidth={2} />
                <path
                  d={d}
                  fill="none"
                  stroke={`url(#wire-${uid})`}
                  strokeWidth={1.6}
                  strokeLinecap="round"
                  strokeDasharray="6 12"
                  opacity={0.7}
                >
                  {!reduce && (
                    <animate
                      attributeName="stroke-dashoffset"
                      from="36"
                      to="0"
                      dur="1.4s"
                      repeatCount="indefinite"
                    />
                  )}
                </path>
              </g>
            );
          })}

          {/* Traveling data packets */}
          {!reduce &&
            nodes.map((n, i) => (
              <circle key={`pkt-out-${i}`} r={7} fill={`url(#packet-${uid})`}>
                <animateMotion dur={`${2.6 + (i % 3) * 0.5}s`} begin={`${i * 0.35}s`} repeatCount="indefinite">
                  <mpath href={`#p-${uid}-${i}`} />
                </animateMotion>
              </circle>
            ))}
          {!reduce &&
            nodes.map((n, i) => (
              <circle key={`pkt-core-${i}`} r={4.5} fill="oklch(0.92 0.05 270)">
                <animateMotion
                  dur={`${3 + (i % 2) * 0.6}s`}
                  begin={`${i * 0.5 + 1}s`}
                  repeatCount="indefinite"
                  keyPoints="1;0"
                  keyTimes="0;1"
                  calcMode="linear"
                >
                  <mpath href={`#p-${uid}-${i}`} />
                </animateMotion>
              </circle>
            ))}

          {/* Service nodes */}
          {nodes.map((n, i) => {
            const Icon = n.icon;
            const tone =
              n.tone === "teal"
                ? { ring: "oklch(0.74 0.11 200 / 0.5)", fill: "oklch(0.74 0.11 200 / 0.16)" }
                : { ring: "oklch(0.585 0.225 277 / 0.55)", fill: "oklch(0.585 0.225 277 / 0.18)" };
            return (
              <g key={`node-${i}`}>
                <circle cx={n.x} cy={n.y} r={26} fill={tone.fill} stroke={tone.ring} strokeWidth={1.5} />
                <foreignObject x={n.x - 20} y={n.y - 20} width={40} height={40}>
                  <div className="grid h-10 w-10 place-items-center">
                    <Icon
                      className={n.tone === "teal" ? "h-5 w-5 text-teal" : "h-5 w-5 text-primary"}
                      strokeWidth={1.8}
                    />
                  </div>
                </foreignObject>
                <foreignObject x={n.x - 60} y={n.y + 26} width={120} height={26}>
                  <div className="text-center text-[11px] font-medium leading-tight text-foreground/85">
                    {n.label}
                  </div>
                </foreignObject>
              </g>
            );
          })}

          {/* Core */}
          <circle cx={CX} cy={CY} r={96} fill={`url(#coreGlow-${uid})`}>
            {!reduce && (
              <animate attributeName="r" values="88;100;88" dur="6s" repeatCount="indefinite" />
            )}
          </circle>
          <circle
            cx={CX}
            cy={CY}
            r={52}
            fill="none"
            stroke="oklch(0.74 0.11 200 / 0.4)"
            strokeWidth={1.2}
            strokeDasharray="3 7"
          >
            {!reduce && (
              <animateTransform
                attributeName="transform"
                type="rotate"
                from={`0 ${CX} ${CY}`}
                to={`360 ${CX} ${CY}`}
                dur="28s"
                repeatCount="indefinite"
              />
            )}
          </circle>
          <circle cx={CX} cy={CY} r={40} fill={`url(#core-${uid})`} />
          <foreignObject x={CX - 22} y={CY - 22} width={44} height={44}>
            <div className="grid h-11 w-11 place-items-center">
              <Zap className="h-6 w-6 text-primary-foreground" fill="currentColor" strokeWidth={1.4} />
            </div>
          </foreignObject>
        </svg>

        <p className="mt-1 px-1 text-center text-xs leading-relaxed text-muted-foreground">
          {t(
            "Strategy, design and automation orbit a single intelligent core.",
            "Strategie, design și automatizare orbitează un singur nucleu inteligent.",
          )}
        </p>
      </div>
    </div>
  );
}
