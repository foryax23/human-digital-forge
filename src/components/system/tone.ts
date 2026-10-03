/*
 * Shared class names for the UI refresh language (tokens live in src/styles.css).
 * Plain strings so screens, shims and the ui/* base can share them without a
 * component boundary.
 */

/** Keyboard focus: a 2 px violet ring with a 2 px gap, on every control. */
export const FOCUS_RING =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-line/55";

/** Status tones. Green, amber and red appear only as these 6 px squares. */
export type Tone = "ok" | "warn" | "bad" | "neutral" | "unverified" | "brand";

/** Fill of the status square per tone ("unverified" is a hollow square). */
export const TONE_FILL: Record<Tone, string> = {
  ok: "bg-ok",
  warn: "bg-warn",
  bad: "bg-bad",
  neutral: "bg-fg-3",
  unverified: "border border-fg-3 bg-transparent",
  // "Cel mai mult timp câștigat" and other brand facts: the one violet square.
  brand: "bg-brand-line",
};

/** Text colour when the word itself must carry the tone (errors use bad, never violet). */
export const TONE_TEXT: Record<Tone, string> = {
  ok: "text-ok",
  warn: "text-warn",
  bad: "text-bad",
  neutral: "text-fg-3",
  unverified: "text-fg-3",
  brand: "text-brand-fg",
};

/** The one tinted surface: the "Începem aici" tag and the break-even table row. */
export const TINT = "bg-brand-tint";

/** Edge of the recommended card or plan column (with Tag variant="start" and one reason line). */
export const RECOMMENDED_EDGE = "border-brand-line/42";

/** The 2 px top rule that marks the recommended pricing column or the starting cell. */
export const RECOMMENDED_RULE = "border-t-2 border-brand-line";

/** Panel surface: solid night, 1 px edge, 12 px corners, no shadow or blur (min-w-0 so a wide
    table scrolls inside the panel instead of stretching its grid column). */
export const PANEL = "min-w-0 rounded-xl border border-line-2 bg-s1";

/** Menus, popovers, dialogs and sheets: the only surfaces with a shadow. */
export const POPOVER_SURFACE = "border border-line-2 bg-s2 text-fg shadow-pop";
