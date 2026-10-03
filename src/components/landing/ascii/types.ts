/** What the hero (or /scan) is doing; the renderer eases between looks. */
export type AsciiVortexState = "idle" | "focus" | "typing" | "scanning" | "analysis" | "result";

/** The hero's four pillars (hero/HeroPillars.tsx `PILLARS` keys), one per screen quadrant. */
export type OrbitSector = "analyse" | "automate" | "growth" | "strategy";

/**
 * Screen quadrant of each sector: 0 = right, 90 = down. The pillars sit in one row (analyse,
 * automate, growth, strategy, left to right), so the two left ones stir the left quarters and
 * the two right ones the right quarters.
 */
export const SECTOR_ANGLES: Record<OrbitSector, { from: number; to: number }> = {
  growth: { from: 0, to: 90 },
  automate: { from: 90, to: 180 },
  analyse: { from: 180, to: 270 },
  strategy: { from: 270, to: 360 },
};

export type AsciiVortexVariant = "hero" | "backdrop" | "footer";

export type AsciiVortexBackgroundProps = {
  state?: AsciiVortexState;
  /** The pillar being hovered, focused or walked to: that quadrant's glyphs organise slightly. */
  sector?: OrbitSector | null;
  /** Bumped on every keystroke in the search: a few cells near the search flip to technical glyphs. */
  typingPulse?: number;
  /** 0..1, real scan progress on /scan (state "analysis"): how much of the ring shows data structures. */
  progress?: number;
  /**
   * `hero`: the ring sits on the inherited `--vortex-x` / `--vortex-y` variables (HeroCosmos
   * `VORTEX_CENTRE`), sized like the hero's video ring; `backdrop`: centred and dimmer, behind /scan;
   * `footer`: the quiet band behind the homepage footer (VortexBand): a wide, flattened ring, one
   * dim look, half-speed, and it yields to the other two whenever one of them is drawing.
   */
  variant?: AsciiVortexVariant;
  className?: string;
};
