/*
 * fontkit's subsetter rewrites shared glyph data while it embeds composite
 * glyphs (the Romanian Î, ș, ț, ă, â are composites in DM Sans), so a second
 * PDF rendered in the same page session with the same font instances can print
 * wrong letters: "In this report" came out as "+n this report" after a
 * Romanian render. Dropping the loaded font data before (and after) a render
 * makes react-pdf parse fresh instances; the browser serves the files from its
 * cache. Measured in Node: Romanian then English render, broken without this,
 * correct with it. The blueprint PDF (src/components/scan/pdf/download.ts)
 * shares the registered fonts, so resetting after our render keeps it clean too.
 */

type FontStoreLike = {
  getRegisteredFonts(): Record<
    string,
    { sources: Array<{ data: unknown; loadResultPromise: Promise<void> | null }> }
  >;
};

export function freshPdfFonts(store: FontStoreLike): void {
  for (const family of Object.values(store.getRegisteredFonts())) {
    for (const source of family.sources) {
      source.data = null;
      source.loadResultPromise = null;
    }
  }
}
