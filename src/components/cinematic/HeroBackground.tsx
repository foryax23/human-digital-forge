import { AsciiEffect } from "@/components/ui/ascii-effect";
import heroAsciiAsset from "@/assets/home/hero-ascii-source.jpg.asset.json";
import { usePrefersReducedMotion } from "@/hooks/use-reduced-motion";

/**
 * Hero background: aurora gradient base + a dense, interactive ASCII vortex.
 * The ASCII layer catches pointer events so cursor ripples through it; the
 * hero copy column sits above via `z-10` in Hero.tsx.
 *
 * When the user prefers reduced motion, we skip the ASCII canvas entirely and
 * render a single static gradient — no rAF loop, no pointer ripples, no flow.
 */
export function HeroBackground() {
  const reduce = usePrefersReducedMotion();

  return (
    <div className="absolute inset-0 -z-10">
      {/* Static gradient fallback — always rendered as a base layer */}
      <div
        className={`absolute inset-0 bg-aurora ${reduce ? "opacity-90" : "opacity-70"}`}
        aria-hidden
      />

      {/* Dense, interactive ASCII vortex — omitted for reduced-motion users */}
      {!reduce && (
        <div className="absolute inset-0 mask-radial-fade opacity-[0.55]">
          <AsciiEffect
            variant="flow"
            imageSrc={heroAsciiAsset.url}
            chars=" .·:-=+*#%@█"
            fontSize={6}
            fontWeight={600}
            lineHeight={0.95}
            characterSpacing={0.5}
            scale={1.25}
            colors={["#2B0E4A", "#6A1B9A", "#9D4EDD", "#C77DFF", "#F5E9FF"]}
            backgroundColor="#0F0620"
            flowSpeed={0.12}
            flowStrength={9}
            flowFrequency={0.018}
            mouseRadius={220}
            mouseStrength={38}
            mouseWaveSpeed={1.2}
            brightnessBoost={2.6}
            contrast={1.35}
            posterize={5}
            dither="floyd-steinberg"
            ditherStrength={0.35}
            className="h-full w-full"
          />
        </div>
      )}
    </div>
  );
}
