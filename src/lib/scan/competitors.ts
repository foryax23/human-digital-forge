import {
  findIndexPlaces,
  loadIndexRecords,
  matchNameWord,
  prettifyCompanyName,
  tokenizeName,
  type IndexPlace,
  type IndexRecord,
} from "@/lib/scan/company-search";
import type { Competitor } from "@/lib/scan/types";

/*
 * "Similar businesses nearby (matched by name and city)": companies of the
 * Trade Register index seated in the same locality (else the same county)
 * whose names share an activity word with the business. Name matching only —
 * present them as similar businesses, never as verified competitors.
 */

/** Words too common in company names to say anything about the activity. */
const GENERIC = new Set(
  (
    "srl sa company companie firma grup group impex com prod trading trade international " +
    "romania holding invest services service serv solutions global"
  ).split(" "),
);

/** Drops endings so related forms meet: "stomatologie" → "stomatolog", "clinica" → "clinic". */
const stem = (word: string) =>
  word.length >= 8 ? word.slice(0, -2) : word.length === 7 ? word.slice(0, -1) : word;

const inside = (places: IndexPlace[], id: number) =>
  places.some((p) => id >= p.start && id < p.end);

type Hit = { id: number; hits: number; score: number; near: boolean; lane: number };

export async function findCompetitors(input: {
  /** Activity words, e.g. ["dental", "stomatologie", "clinica"]. */
  keywords: string[];
  city?: string;
  county?: string;
  /** The business itself. */
  excludeCui?: string;
  limit?: number;
  /** Accepted for callers that have it; the open-data index holds no main CAEN code. */
  caen?: string;
}): Promise<Competitor[]> {
  const limit = Math.min(Math.max(input.limit ?? 6, 1), 20);
  const stems = [
    ...new Set(
      input.keywords
        .flatMap((keyword) => tokenizeName(keyword))
        .filter((word) => word.length >= 3 && !GENERIC.has(word))
        .map(stem),
    ),
  ].slice(0, 8);
  if (!stems.length || (!input.city && !input.county)) return [];

  const places = await findIndexPlaces(input.city, input.county);
  const cities = places.cities;
  let counties = places.counties;
  if (!counties.length && cities.length) {
    counties = (await findIndexPlaces(undefined, cities[0].county)).counties;
  }
  if (!cities.length && !counties.length) return [];

  const matches = await Promise.all(stems.map((word) => matchNameWord(word, 4)));
  const byId = new Map<number, Hit>();
  matches.forEach((match, lane) => {
    for (const [id, score] of match.names) {
      const near = inside(cities, id);
      if (!near && !inside(counties, id)) continue;
      const hit = byId.get(id);
      if (hit) {
        hit.hits++;
        hit.score = Math.max(hit.score, score);
      } else byId.set(id, { id, hits: 1, score, near, lane });
    }
  });

  // Each activity word takes its turn, so a short exact word ("bistro") can't
  // crowd out a stemmed one ("restaura…"); same city first, then the county.
  const interleave = (hits: Hit[]) => {
    const lanes = stems.map((_, lane) =>
      hits.filter((h) => h.lane === lane).sort((a, b) => b.hits - a.hits || b.score - a.score),
    );
    const out: Hit[] = [];
    for (let i = 0; out.length < hits.length; i++) {
      for (const list of lanes) if (list[i]) out.push(list[i]);
    }
    return out;
  };
  const all = [...byId.values()];
  const near = interleave(all.filter((h) => h.near));
  // Widen to the county only when the city has too few.
  const pool = near.length >= limit ? near : [...near, ...interleave(all.filter((h) => !h.near))];

  const picked: Array<{ hit: Hit; record: IndexRecord }> = [];
  const batch = limit * 3;
  for (let start = 0; start < pool.length && start < batch * 3; start += batch) {
    const slice = pool.slice(start, start + batch);
    const records = await loadIndexRecords(slice.map((h) => h.id));
    for (const hit of slice) {
      const record = records.get(hit.id);
      if (!record || record.status !== "active" || record.cui === input.excludeCui) continue;
      picked.push({ hit, record });
    }
    if (picked.length >= limit) break;
  }

  // Stable sort: within the same city tier, companies with a website first.
  return picked
    .sort(
      (a, b) =>
        Number(b.hit.near) - Number(a.hit.near) ||
        Number(Boolean(b.record.website)) - Number(Boolean(a.record.website)),
    )
    .slice(0, limit)
    .map(({ record }) => ({
      cui: record.cui,
      name: prettifyCompanyName(record.name),
      city: record.city,
      website: record.website,
    }));
}
