import type { Bilingual, Correction, Fact, FactValue } from "../contracts";

/*
 * The owner's one-tap corrections ("Am asta: [link]", plan D25, A10) as
 * declared facts, client-safe so the browser applies them at once. Typed
 * values only (a predicate from a fixed list plus a validated URL), never free
 * text. Same rules as the server's merge (steps/merge.server.ts
 * applyCorrectionFacts): the corrected fact IDs are returned so AI sentences
 * citing them are hidden ("corectat de tine").
 */

const bi = (en: string, ro: string): Bilingual => ({ en, ro });

export function correctionFacts(
  facts: Fact[],
  corrections: Correction[] | undefined,
  today: string,
): { facts: Fact[]; hidden: Map<string, string> } {
  const out = new Map(facts.map((f) => [f.id, f]));
  const hidden = new Map<string, string>();
  for (const c of (corrections ?? []).slice(0, 10)) {
    const url = c.url && /^https?:\/\//i.test(c.url) ? c.url.slice(0, 300) : undefined;
    const declared = (
      id: string,
      section: Fact["section"],
      value: FactValue,
      display: Bilingual,
    ) => {
      hidden.set(id, id);
      out.set(id, {
        id,
        section,
        predicate: id,
        value,
        display,
        source: "user",
        asOf: today,
        confidence: "declarat",
        score: 1,
        method: "user",
        gdpr: "G0",
        evidence: url ? { url } : undefined,
      });
    };
    const yes = bi("Yes (declared by you)", "Da (declarat de tine)");
    switch (c.predicate) {
      case "site.booking.present":
        declared("site.booking.present", "site", true, yes);
        break;
      case "site.cui.present":
        declared("site.cui.present", "site", true, yes);
        break;
      case "site.contact.present":
        declared("site.contact.present", "site", true, yes);
        break;
      case "presence.social_only":
        declared(
          "presence.social_only",
          "presence",
          { url },
          bi("Only social pages (declared by you)", "Doar pagini sociale (declarat de tine)"),
        );
        break;
      case "site.url":
        if (url) {
          const shown = url.replace(/^https?:\/\//, "");
          declared("site.url", "site", url, bi(shown, shown));
          hidden.set("site.status", "site.url");
        }
        break;
    }
  }
  return { facts: [...out.values()], hidden };
}
