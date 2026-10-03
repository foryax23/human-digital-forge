/**
 * The technologies we work with: one list for the band under the hero (TechBand),
 * the block that closes Services (TechGroups) and the footer trademark note.
 *
 * Wording rules (vendors restrict logo use; the owner chose to show them): say
 * "Tehnologii cu care lucrăm" / "Technologies we work with" or "Ce folosim", never
 * partners, "powered by", "certified" or "recommended". Names are exact and never
 * translated or declined ("Google Gemini", never just "Gemini"; "Microsoft Azure").
 * Logos stay unaltered in shape: one-colour white only, no crop, no glow, no colour.
 * List only tools used in client work, and drop a name here when it stops being true.
 *
 * Files: public/media/tech/, made from the owner's files (2026-10-03). Raster marks are
 * white alpha silhouettes at 2x the desktop height (lossless WebP); n8n and Vercel are
 * the source vectors filled white; the Gemini sparkle is the front face of the 3D tile
 * render, fitted as a four-point star; Azure keeps a hairline between its ribbons so
 * it does not merge into a plain "A". All ten files together are about 16 KB.
 */

export type TechGroupId = "ai" | "cloud" | "data" | "automation";

export type TechId =
  | "claude"
  | "openai"
  | "gemini"
  | "n8n"
  | "supabase"
  | "stripe"
  | "vercel"
  | "cloudflare"
  | "aws"
  | "azure";

export type TechLogo = {
  src: string;
  /** Desktop display size in CSS px (phones scale it down); also the img width/height. */
  width: number;
  height: number;
  /**
   * "symbol": a mark without the name in it, so the name is set beside it (most
   * visitors would not know the bare Azure "A" or the Supabase bolt);
   * "wordmark": the logo already spells the name.
   */
  kind: "symbol" | "wordmark";
};

export type Tech = {
  id: TechId;
  /** Exact product name, never translated; the logo's alt text. */
  name: string;
  group: TechGroupId;
  logo: TechLogo;
  /**
   * One-line switch per mark: "name" sets the name in the band's type instead of the
   * logo (when a vendor asks us to stop using its logo). Default "logo".
   */
  display?: "logo" | "name";
  /** Its sentence of the footer attribution, English, word for word (logos plan §3). */
  attribution: string;
};

/** Global switch: false shows every mark as its name, with no logo files loaded. */
export const TECH_LOGOS_ENABLED = true;

/** Whether this mark shows its logo (the global switch, then the mark's own). */
export const showsLogo = (tech: Tech) => TECH_LOGOS_ENABLED && tech.display !== "name";

const logo = (
  id: TechId,
  ext: "webp" | "svg",
  width: number,
  height: number,
  kind: TechLogo["kind"],
): TechLogo => ({ src: `/media/tech/${id}.${ext}`, width, height, kind });

/**
 * Band order. Heights are optical (equal weight, not equal boxes): symbols 18-20 px
 * next to a 15 px name, the heavy Vercel and Stripe wordmarks smaller, n8n at 24 px so
 * its lockup is at least 89 px wide, AWS at most 24 px, and only the stacked Cloudflare
 * lockup at 30 px so its wordmark stays legible. Everything stays below the 32/40 px
 * Vortex Hub logo.
 */
export const TECH_STACK: readonly Tech[] = [
  {
    id: "claude",
    name: "Claude",
    group: "ai",
    logo: logo("claude", "webp", 20, 20, "symbol"),
    // Anthropic is folded into Claude: its sentence travels with this mark.
    attribution: "Anthropic and Claude are trademarks of Anthropic, PBC.",
  },
  {
    id: "openai",
    name: "OpenAI",
    group: "ai",
    logo: logo("openai", "webp", 20, 20, "symbol"),
    attribution: "OpenAI is a trademark of OpenAI.",
  },
  {
    id: "gemini",
    name: "Google Gemini",
    group: "ai",
    logo: logo("gemini", "svg", 18, 18, "symbol"),
    attribution: "Google and Gemini are trademarks of Google LLC.",
  },
  {
    id: "n8n",
    name: "n8n",
    group: "automation",
    logo: logo("n8n", "svg", 89, 24, "wordmark"),
    attribution: "n8n is a trademark of n8n GmbH.",
  },
  {
    id: "supabase",
    name: "Supabase",
    group: "data",
    logo: logo("supabase", "webp", 19, 20, "symbol"),
    attribution: "Supabase is a trademark of Supabase, Inc.",
  },
  {
    id: "stripe",
    name: "Stripe",
    group: "data",
    logo: logo("stripe", "webp", 48, 20, "wordmark"),
    attribution: "Stripe is a trademark of Stripe, Inc.",
  },
  {
    id: "cloudflare",
    name: "Cloudflare",
    group: "cloud",
    logo: logo("cloudflare", "webp", 90, 30, "wordmark"),
    attribution:
      "Cloudflare is a trademark and/or registered trademark of Cloudflare, Inc. in the United States and other jurisdictions.",
  },
  {
    id: "vercel",
    name: "Vercel",
    group: "cloud",
    logo: logo("vercel", "svg", 80, 16, "wordmark"),
    attribution:
      "Vercel, the Vercel design, Next.js and related marks, designs and logos are trademarks or registered trademarks of Vercel, Inc. or its affiliates in the US and other countries.",
  },
  {
    id: "aws",
    name: "AWS",
    group: "cloud",
    logo: logo("aws", "webp", 40, 24, "wordmark"),
    attribution:
      "Amazon Web Services and AWS are trademarks of Amazon.com, Inc. or its affiliates.",
  },
  {
    id: "azure",
    name: "Microsoft Azure",
    group: "cloud",
    logo: logo("azure", "webp", 20, 19, "symbol"),
    attribution: "Microsoft and Azure are trademarks of the Microsoft group of companies.",
  },
];

type Copy = { en: string; ro: string };

/** The Services block: one plain sentence per group on what we use them for. */
export const TECH_GROUPS: readonly { id: TechGroupId; title: Copy; use: Copy }[] = [
  {
    id: "ai",
    title: { en: "AI", ro: "AI" },
    use: {
      en: "We use them for assistants that answer your customers and agents that read documents or take on repetitive work.",
      ro: "Le folosim pentru asistenți care răspund clienților și agenți care citesc documente sau preiau munca repetitivă.",
    },
  },
  {
    id: "cloud",
    title: { en: "Cloud and hosting", ro: "Cloud și găzduire" },
    use: {
      en: "This is where the websites and apps we deliver run.",
      ro: "Aici rulează site-urile și aplicațiile pe care le livrăm.",
    },
  },
  {
    id: "data",
    title: { en: "Data and payments", ro: "Date și plăți" },
    use: {
      en: "They hold the data and user accounts of the apps we build and take the online payments.",
      ro: "Țin datele și conturile de utilizator ale aplicațiilor pe care le construim și încasează plățile online.",
    },
  },
  {
    id: "automation",
    title: { en: "Automation", ro: "Automatizări" },
    use: {
      en: "Connects your forms, email and CRM, so enquiries reach the right place on their own.",
      ro: "Leagă formularele, e-mailul și CRM-ul, ca cererile să ajungă singure unde trebuie.",
    },
  },
];

export const techInGroup = (group: TechGroupId) => TECH_STACK.filter((t) => t.group === group);

/** Footer disclaimer, in the active language (deep plan C5, logo version). */
export const TECH_TRADEMARK_NOTE: Copy = {
  en: "Trademarks and logos shown belong to their respective owners. Their use does not imply partnership or endorsement.",
  ro: "Mărcile și siglele afișate aparțin proprietarilor lor. Folosirea lor nu implică un parteneriat sau o recomandare.",
};

/** The attribution paragraph keeps the logos plan's order (§3), so it diffs clean. */
const ATTRIBUTION_ORDER: readonly TechId[] = [
  "claude",
  "aws",
  "azure",
  "openai",
  "cloudflare",
  "gemini",
  "stripe",
  "supabase",
  "n8n",
  "vercel",
];

/**
 * The footer attribution, English in both languages, built from the listed marks: a
 * mark taken out of TECH_STACK takes its sentence with it.
 */
export const TECH_ATTRIBUTION = ATTRIBUTION_ORDER.flatMap((id) => {
  const tech = TECH_STACK.find((t) => t.id === id);
  return tech ? [tech.attribution] : [];
}).join(" ");
