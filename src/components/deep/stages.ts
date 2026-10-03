import type { Bilingual, Fact, Lang, StepResult, WebsiteStatus } from "@/lib/deep/contracts";
import { bi } from "@/lib/deep/parse/format";
import { roCount } from "@/lib/deep/report/read";

import { STAGE_LABEL, type StageId } from "./copy";
import { duration } from "./format";
import type { RunSnapshot, SlotKey, SlotState } from "./journal";

/*
 * The honest timeline (plan A10): only real stages, each with the counts the server returned
 * ("5 din 7 ani cu bilanț", "pagina 7 din aproximativ 15"), skips with their reason, "4 din 9
 * pași" and a time left from the medians measured in the engine's golden runs. No percentages.
 */

export type StageStatus = "pending" | "running" | "waiting" | "done" | "skipped" | "failed";

export type Stage = {
  id: StageId;
  label: Bilingual;
  status: StageStatus;
  detail?: Bilingual;
};

/** Median step times from the golden runs (handover, wave 2a), in ms. */
const MEDIAN: Record<string, number> = {
  start: 1200,
  money: 8000,
  site: 2500,
  site2: 2500,
  signals: 3000,
  peers: 2500,
  audit: 8000,
  crawl: 8000,
  pagespeed: 20000,
  competitor: 4000,
  synthesisAi: 45000,
  finishAi: 9000,
  finishRules: 2000,
};

const factOf = (r: StepResult | undefined, id: string): Fact | undefined =>
  r?.facts.find((f) => f.id === id);

const settled = (s?: SlotState) => Boolean(s && s.status !== "running");

function hostOf(url: string): string {
  try {
    return new URL(/^https?:/i.test(url) ? url : `https://${url}`).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function skipText(state: SlotState | undefined, gapText?: Bilingual): Bilingual {
  if (state?.reason === "time") return bi("Skipped: time ran out", "Omis: timpul s-a terminat");
  if (state?.reason === "budget_exhausted")
    return bi("Skipped: this step was already used", "Omis: pasul fusese deja folosit");
  if (gapText) return bi(`Skipped: ${gapText.en}`, `Omis: ${lower(gapText.ro)}`);
  return bi("Skipped", "Omis");
}

const lower = (s: string) => (s ? s.charAt(0).toLowerCase() + s.slice(1) : s);

function statusOf(
  states: Array<SlotState | undefined>,
  results: Array<StepResult | undefined>,
): StageStatus {
  if (states.some((s) => s?.status === "running")) return "running";
  if (results.some((r) => r && (r.status === "done" || r.status === "partial"))) return "done";
  if (states.some((s) => s?.status === "failed")) return "failed";
  if (
    states.some((s) => s?.status === "skipped" || s?.status === "refused") ||
    results.some((r) => r?.status === "skipped")
  )
    return "skipped";
  return "pending";
}

const ms = (r: StepResult | undefined, s: SlotState | undefined) => r?.ms ?? s?.ms ?? 0;

/** The nine stages of a run, from its snapshot. */
export function stagesOf(snap: RunSnapshot, lang: Lang): Stage[] {
  const R = snap.results;
  const S = snap.slots;
  const stages: Stage[] = [];

  // Registers
  stages.push({
    id: "identity",
    label: STAGE_LABEL.identity,
    status: R.start ? "done" : "running",
    detail: R.start
      ? bi(`done in ${duration(R.start.ms, "en")}`, `gata în ${duration(R.start.ms, "ro")}`)
      : undefined,
  });

  // Money
  {
    const r = R.money;
    let detail: Bilingual | undefined;
    if (r) {
      const filed = (factOf(r, "money.filed")?.value as { filed?: boolean | null } | undefined)
        ?.filed;
      const years = r.counters?.yearsFiled ?? 0;
      const unchecked = r.counters?.yearsUnchecked ?? 0;
      if (filed === false) detail = bi("no annual accounts filed yet", "încă nu are bilanț depus");
      else
        detail = bi(
          `${years} of 7 years with accounts${unchecked ? `, ${unchecked} not answered` : ""} · ${duration(r.ms, "en")}`,
          `${years} din 7 ani cu bilanț${unchecked ? `, ${unchecked} fără răspuns` : ""} · ${duration(r.ms, "ro")}`,
        );
    } else if (S.money?.status === "running")
      detail = bi("reading the annual accounts", "citim bilanțurile");
    else if (S.money?.status === "skipped" || S.money?.status === "failed")
      detail = skipText(S.money);
    stages.push({
      id: "money",
      label: STAGE_LABEL.money,
      status: statusOf([S.money], [r]),
      detail,
    });
  }

  // Website
  {
    const r = R.site2 ?? R.site;
    const waiting = snap.askSite && !snap.askSite.answer;
    let detail: Bilingual | undefined;
    const status = factOf(r, "site.status")?.value as WebsiteStatus | undefined;
    const url = factOf(r, "site.url")?.value as string | undefined;
    if (waiting)
      detail = bi(
        `Is ${hostOf(snap.askSite!.url)} the company's website?`,
        `${hostOf(snap.askSite!.url)} e site-ul firmei?`,
      );
    else if (status) {
      const host = url ? hostOf(url) : "";
      const words: Record<WebsiteStatus, Bilingual> = {
        verified: bi(`found: ${host}`, `găsit: ${host}`),
        declared: bi(`declared: ${host}`, `declarat: ${host}`),
        ask_visitor: bi(`not confirmed: ${host}`, `neconfirmat: ${host}`),
        broken_certificate: bi(`${host}: broken certificate`, `${host}: certificat invalid`),
        parked: bi(`${host}: parked or for sale`, `${host}: domeniu parcat sau de vânzare`),
        dead: bi(`${host}: the domain does not work`, `${host}: domeniul nu funcționează`),
        unreachable: bi(`${host}: did not answer`, `${host}: nu a răspuns`),
        blocked: bi(`${host}: blocks automated access`, `${host}: blochează accesul automat`),
        none: bi("no company website found", "nu am găsit un site al firmei"),
      };
      detail = words[status];
    } else if (S.site?.status === "running" || S.site2?.status === "running")
      detail = bi("looking for the company's website", "căutăm site-ul firmei");
    stages.push({
      id: "site",
      label: STAGE_LABEL.site,
      status: waiting ? "waiting" : statusOf([S.site, S.site2], [R.site, R.site2]),
      detail,
    });
  }

  // Courts and tenders
  {
    const r = R.signals;
    let detail: Bilingual | undefined;
    if (r) {
      const courts = factOf(r, "risk.courts.checked");
      const ted = r.facts.find((f) => f.predicate === "risk.ted.awards");
      const parts: Bilingual[] = [];
      parts.push(
        courts
          ? bi("courts checked", "instanțe verificate")
          : bi("courts not checked", "instanțe neverificate"),
      );
      if (ted) parts.push(ted.display);
      detail = { en: parts.map((p) => p.en).join(" · "), ro: parts.map((p) => p.ro).join(" · ") };
    } else if (S.signals?.status === "skipped" || S.signals?.status === "failed")
      detail = skipText(S.signals);
    stages.push({
      id: "signals",
      label: STAGE_LABEL.signals,
      status: statusOf([S.signals], [r]),
      detail,
    });
  }

  // Similar firms
  {
    const r = R.peers;
    let detail: Bilingual | undefined;
    const n = factOf(r, "peers.n")?.value as number | undefined;
    if (r && n) detail = bi(`${n} firms compared`, roCount(n, "firme comparate"));
    else if (r) {
      const gap = r.gaps.find((g) => g.section === "peers" || g.section === "competitors");
      detail = gap
        ? bi(gap.where.en, gap.where.ro)
        : bi("no comparison yet", "fără comparație deocamdată");
    } else if (!R.money && settled(S.money))
      detail = bi("needs the annual accounts", "are nevoie de bilanțuri");
    else if (S.peers)
      detail = S.peers.status === "running" ? bi("comparing", "comparăm") : skipText(S.peers);
    stages.push({
      id: "peers",
      label: STAGE_LABEL.peers,
      status: statusOf([S.peers], [r]),
      detail,
    });
  }

  // Pages read
  {
    const slots: SlotKey[] = ["audit", "crawl1", "crawl2", "crawl3"];
    const read = slots.reduce((n, s) => n + (R[s]?.counters?.pagesRead ?? 0), 0);
    const sitemap = R.audit?.counters?.sitemapUrls ?? 0;
    const about = Math.min(
      30,
      Math.max(read, sitemap + 1, read + (R.audit?.next?.crawlCursor ? 5 : 0)),
    );
    const running = slots.some((s) => S[s]?.status === "running");
    const done = slots.filter((s) => R[s]).length;
    let detail: Bilingual | undefined;
    const auditGap = R.audit?.gaps.find((g) => g.section === "site");
    if (running)
      detail = bi(
        `page ${Math.max(1, read)} of about ${about}`,
        `pagina ${Math.max(1, read)} din aproximativ ${about}`,
      );
    else if (read)
      detail = bi(
        `${read} pages read`,
        `${read === 1 ? "o pagină citită" : `${read} pagini citite`}`,
      );
    else if (R.audit?.status === "skipped") detail = skipText(undefined, auditGap?.where);
    else if (S.audit) detail = skipText(S.audit, auditGap?.where);
    const status: StageStatus = running
      ? "running"
      : done
        ? read
          ? "done"
          : statusOf([S.audit], [R.audit])
        : statusOf([S.audit], [R.audit]);
    stages.push({ id: "pages", label: STAGE_LABEL.pages, status, detail });
  }

  // Speed
  {
    const r = R.pagespeed;
    const fact = r?.facts.find((f) => f.predicate === "site.speed.mobile");
    stages.push({
      id: "speed",
      label: STAGE_LABEL.speed,
      status: statusOf([S.pagespeed], [r]),
      detail: fact
        ? fact.display
        : r?.status === "skipped" || S.pagespeed?.status === "skipped"
          ? skipText(S.pagespeed, r?.gaps[0]?.where)
          : undefined,
    });
  }

  // Rivals
  {
    const keys = Object.keys(S).filter((k) => k.startsWith("competitor:"));
    const done = keys.filter((k) => R[k]).length;
    const running = keys.some((k) => S[k]?.status === "running");
    let detail: Bilingual | undefined;
    if (keys.length)
      detail = bi(
        `${done} of ${keys.length} rivals' websites`,
        `${done} din ${keys.length} site-uri de concurenți`,
      );
    else if (R.peers?.facts.some((f) => f.predicate === "peers.rival"))
      detail = bi("waiting for the company's website", "așteaptă site-ul firmei");
    else if (R.peers)
      detail = bi("no rivals to look at yet", "niciun concurent de comparat deocamdată");
    const status: StageStatus = running
      ? "running"
      : keys.length
        ? done
          ? "done"
          : "skipped"
        : R.peers || settled(S.peers) || (settled(S.money) && !R.money)
          ? "skipped"
          : "pending";
    stages.push({ id: "rivals", label: STAGE_LABEL.rivals, status, detail });
  }

  // Analysis
  {
    const parts = ["warm", "brief", "customer", "rivals", "finish"];
    const running = parts.some((p) => S[p]?.status === "running");
    const status: StageStatus = snap.report
      ? "done"
      : snap.status === "failed"
        ? "failed"
        : running
          ? "running"
          : "pending";
    const detail = snap.report
      ? bi("report ready", "raportul e gata")
      : running
        ? snap.aiMode === "ai"
          ? bi(
              "writing the report and checking every sentence",
              "scriem raportul și verificăm fiecare propoziție",
            )
          : bi("putting the report together", "punem raportul cap la cap")
        : undefined;
    stages.push({ id: "analysis", label: STAGE_LABEL.analysis, status, detail });
  }

  void lang;
  return stages;
}

/** "4 din 9 pași": stages that ended (done, skipped or failed). */
export function stageProgress(stages: Stage[]): { done: number; total: number } {
  return {
    done: stages.filter(
      (s) => s.status === "done" || s.status === "skipped" || s.status === "failed",
    ).length,
    total: stages.length,
  };
}

/** Time left in ms from the measured medians along the longest branch still open. */
export function timeLeftMs(snap: RunSnapshot): number {
  if (snap.report) return 0;
  const R = snap.results;
  const left = (slot: SlotKey, median: number) =>
    R[slot] || snap.slots[slot]?.status === "skipped" ? 0 : median;
  const crawlLeft =
    R.audit && !R.audit.next?.crawlCursor
      ? 0
      : ["crawl1", "crawl2"].reduce((n, s) => n + left(s, MEDIAN.crawl), 0);
  const siteBranch =
    left("site", MEDIAN.site) +
    Math.max(left("audit", MEDIAN.audit) + crawlLeft, left("pagespeed", MEDIAN.pagespeed));
  const rivals = Object.keys(snap.slots).filter((k) => k.startsWith("competitor:"));
  const rivalsLeft = rivals.length
    ? rivals.every((k) => R[k])
      ? 0
      : MEDIAN.competitor
    : R.peers
      ? 0
      : MEDIAN.competitor;
  const moneyBranch = left("money", MEDIAN.money) + left("peers", MEDIAN.peers) + rivalsLeft;
  const collect = Math.max(siteBranch, moneyBranch, left("signals", MEDIAN.signals));
  const analysis =
    snap.aiMode === "ai"
      ? (R.brief && R.customer && R.rivals ? 0 : MEDIAN.synthesisAi) + MEDIAN.finishAi
      : MEDIAN.finishRules;
  return collect + analysis;
}

/** "mai durează aproximativ 2 minute" / "mai puțin de un minut". */
export function timeLeftText(msLeft: number): Bilingual {
  if (msLeft <= 0) return bi("almost done", "aproape gata");
  if (msLeft < 60_000) return bi("less than a minute left", "mai durează mai puțin de un minut");
  const minutes = Math.ceil(msLeft / 60_000);
  return minutes === 1
    ? bi("about a minute left", "mai durează aproximativ un minut")
    : bi(`about ${minutes} minutes left`, `mai durează aproximativ ${minutes} minute`);
}
