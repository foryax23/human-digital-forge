import type { Bilingual, DeepReport, Fact } from "./contracts";

/*
 * The company atlas (plan "Company Atlas", stage 1): the report's facts regrouped into one map
 * of the company (identity, people, contacts, assets, presence, money and risk) plus one dated
 * timeline. Client-safe and pure: it only rearranges facts the run already verified, it never
 * adds new ones. Google display-only facts (ephemeral) are left out like everywhere else.
 */

export type AtlasGroupId = "identity" | "people" | "contacts" | "assets" | "presence" | "money";

export type AtlasGroup = { id: AtlasGroupId; title: Bilingual; facts: Fact[] };

export type TimelineItem = {
  date: string;
  text: Bilingual;
  kind: "register" | "money" | "news" | "contract" | "event";
  url?: string;
  tone?: "risk" | "growth";
};

const GROUPS: Array<{ id: AtlasGroupId; title: Bilingual; match: (f: Fact) => boolean }> = [
  {
    id: "identity",
    title: { en: "Identity and legal", ro: "Identitate și date legale" },
    match: (f) => f.predicate.startsWith("identity.") || f.predicate === "profile.tradeNames",
  },
  {
    id: "people",
    title: { en: "People and ownership", ro: "Oameni și proprietari" },
    match: (f) =>
      (f.predicate.startsWith("people.") && f.predicate !== "people.network") ||
      f.predicate === "profile.people",
  },
  {
    id: "contacts",
    title: { en: "Company contacts", ro: "Contactele firmei" },
    match: (f) =>
      f.predicate.startsWith("site.email") ||
      f.predicate === "offers.hours" ||
      f.predicate === "identity.seat",
  },
  {
    id: "assets",
    title: { en: "Assets", ro: "Active" },
    match: (f) =>
      f.predicate === "site.url" ||
      f.predicate === "identity.website_registry" ||
      f.predicate === "site.tech" ||
      f.predicate === "risk.ted.awards" ||
      f.predicate === "offers.services",
  },
  {
    id: "presence",
    title: { en: "Online presence", ro: "Prezență online" },
    match: (f) =>
      (f.predicate.startsWith("presence.") && f.predicate !== "presence.news.item") ||
      ["profile.customers", "profile.reviews", "profile.ads"].includes(f.predicate),
  },
  {
    id: "money",
    title: { en: "Money and risk", ro: "Bani și riscuri" },
    match: (f) =>
      (f.predicate.startsWith("money.") || f.predicate.startsWith("risk.")) &&
      f.predicate !== "risk.ted.awards",
  },
];

/** For yearly figures ("money.turnover.2023"), keep only the latest year in the group view. */
function latestYearOnly(facts: Fact[]): Fact[] {
  const best = new Map<string, Fact>();
  const rest: Fact[] = [];
  for (const f of facts) {
    const y = f.id.match(/\.(\d{4})$/);
    if (!y) {
      rest.push(f);
      continue;
    }
    const cur = best.get(f.predicate);
    if (!cur || cur.id < f.id) best.set(f.predicate, f);
  }
  return [...rest, ...best.values()];
}

export function atlasGroups(report: DeepReport): AtlasGroup[] {
  const facts = report.facts.filter((f) => !f.ephemeral);
  const used = new Set<string>();
  return GROUPS.map((g) => {
    const list = facts.filter((f) => !used.has(f.id) && g.match(f));
    list.forEach((f) => used.add(f.id));
    return { id: g.id, title: g.title, facts: latestYearOnly(list) };
  });
}

const ISO = /^\d{4}-\d{2}-\d{2}/;

export function atlasTimeline(report: DeepReport): TimelineItem[] {
  const out: TimelineItem[] = [];
  for (const f of report.facts) {
    if (f.ephemeral) continue;
    const p = f.predicate;
    if (p === "identity.registered_at" && ISO.test(String(f.value ?? f.asOf))) {
      const date = String(typeof f.value === "string" ? f.value : f.asOf).slice(0, 10);
      out.push({
        date,
        kind: "register",
        text: { en: `Company registered (${f.display.en})`, ro: `Firma înregistrată (${f.display.ro})` },
      });
    } else if (p === "money.turnover") {
      const y = f.id.match(/\.(\d{4})$/)?.[1];
      if (y)
        out.push({
          date: `${y}-12-31`,
          kind: "money",
          text: { en: `Turnover ${y}: ${f.display.en}`, ro: `Cifra de afaceri ${y}: ${f.display.ro}` },
        });
    } else if (p === "presence.news.item") {
      const v = f.value as { title?: string; outlet?: string | null; tone?: string; date?: string };
      out.push({
        date: v.date ?? f.asOf,
        kind: "news",
        url: f.evidence?.url,
        tone: v.tone === "risk" ? "risk" : v.tone === "growth" ? "growth" : undefined,
        text: {
          en: `${v.outlet ? `${v.outlet}: ` : ""}${v.title ?? ""}`,
          ro: `${v.outlet ? `${v.outlet}: ` : ""}${v.title ?? ""}`,
        },
      });
    } else if (p === "profile.events") {
      const d = f.display.en.match(/\b(20\d{2}|19\d{2})(-\d{2}(-\d{2})?)?\b/)?.[0];
      out.push({
        date: d ? (d.length === 4 ? `${d}-01-01` : d.padEnd(10, "-01").slice(0, 10)) : f.asOf,
        kind: "event",
        url: f.evidence?.url,
        text: f.display,
      });
    } else if (p === "risk.ted.awards") {
      const v = f.value as { latest?: string } | number;
      const latest = typeof v === "object" && v ? v.latest : undefined;
      if (latest)
        out.push({
          date: latest,
          kind: "contract",
          url: f.evidence?.url,
          text: { en: `Latest EU public contract: ${f.display.en}`, ro: `Ultimul contract public UE: ${f.display.ro}` },
        });
    }
  }
  return out
    .filter((i) => ISO.test(i.date))
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 60);
}

export type NetworkNode = {
  person: string;
  links: Array<{ company: string; cui?: string; role: string; url: string }>;
};

/** Key people and the other companies they run, grouped by person (people.network facts). */
export function atlasNetwork(report: DeepReport): NetworkNode[] {
  const byPerson = new Map<string, NetworkNode>();
  for (const f of report.facts) {
    if (f.predicate !== "people.network" || f.ephemeral) continue;
    const v = f.value as { person: string; company: string; cui: string | null; role: string; source: string };
    const key = v.person.toLowerCase();
    const node = byPerson.get(key) ?? { person: v.person, links: [] };
    node.links.push({ company: v.company, cui: v.cui ?? undefined, role: v.role, url: v.source });
    byPerson.set(key, node);
  }
  return [...byPerson.values()];
}
