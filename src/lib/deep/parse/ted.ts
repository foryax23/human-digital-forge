/*
 * EU tenders won (TED v3 search, winner identifier = the CUI), client-safe.
 * Above-threshold contracts only; buyers are public bodies.
 */

export type TedSummary = { awards: number; buyers: string[]; latest?: string };

function buyerName(value: unknown): string | undefined {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return buyerName(value[0]);
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return buyerName(
      record.ron ?? record.ro ?? record.eng ?? record.en ?? Object.values(record)[0],
    );
  }
  return undefined;
}

export function tedQuery(cui: string): string {
  return `winner-identifier IN (${cui} "RO${cui}" "RO ${cui}")`;
}

export function parseTed(json: unknown): TedSummary {
  const data = (json ?? {}) as {
    notices?: Array<Record<string, unknown>>;
    totalNoticeCount?: number;
  };
  const notices = Array.isArray(data.notices) ? data.notices : [];
  const buyers = new Set<string>();
  let latest: string | undefined;
  for (const notice of notices) {
    const name = buyerName(notice["buyer-name"]);
    if (name) buyers.add(name.replace(/\s+/g, " ").trim().slice(0, 120));
    const date = String(notice["publication-date"] ?? "").slice(0, 10);
    if (/^\d{4}-\d{2}-\d{2}$/.test(date) && (!latest || date > latest)) latest = date;
  }
  return {
    awards: typeof data.totalNoticeCount === "number" ? data.totalNoticeCount : notices.length,
    buyers: [...buyers].slice(0, 5),
    latest,
  };
}
