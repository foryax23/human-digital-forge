import { Font } from "@react-pdf/renderer";

import { FONT } from "./theme";

/** Static TTFs in /public/fonts (Google Fonts, SIL OFL: see public/fonts/OFL.txt). */
export const PDF_FONT_FILES = {
  display: [
    { file: "SpaceGrotesk-Medium.ttf", fontWeight: 500 },
    { file: "SpaceGrotesk-Bold.ttf", fontWeight: 700 },
  ],
  body: [
    { file: "DMSans-Regular.ttf", fontWeight: 400 },
    { file: "DMSans-Medium.ttf", fontWeight: 500 },
    { file: "DMSans-Bold.ttf", fontWeight: 700 },
  ],
} as const;

let registeredBase: string | null = null;

/**
 * Registers the brand fonts with react-pdf. `base` is the folder holding the
 * TTFs: `${origin}/fonts` in the browser, an absolute path in Node scripts.
 * Both families cover Romanian (ă â î ș ț and the legacy ş ţ).
 */
export function registerPdfFonts(base: string): void {
  const root = base.replace(/\/+$/, "");
  if (registeredBase === root) return;
  registeredBase = root;

  Font.register({
    family: FONT.display,
    fonts: PDF_FONT_FILES.display.map(({ file, fontWeight }) => ({
      src: `${root}/${file}`,
      fontWeight,
    })),
  });
  Font.register({
    family: FONT.body,
    fonts: PDF_FONT_FILES.body.map(({ file, fontWeight }) => ({
      src: `${root}/${file}`,
      fontWeight,
    })),
  });

  // The built-in hyphenator uses English patterns, which split Romanian words
  // in the wrong places; only very long tokens (URLs, codes) may break.
  Font.registerHyphenationCallback((word) =>
    word.length > 28 ? (word.match(/.{1,14}/g) ?? [word]) : [word],
  );
}
