import type { AuditFinding, Bilingual, PageSpeedResult, WebsiteAudit } from "@/lib/scan/types";

import { sortFindings } from "./checks";
import { scoreAudit } from "./scoring";

/**
 * Folds a PageSpeed Insights result into a finished audit: Lighthouse becomes
 * the performance score, measured Core Web Vitals become findings, and the
 * Lighthouse screenshot becomes the overview image. Pure, so the browser can
 * call it when the audit and PageSpeed calls return separately.
 */

const bi = (en: string, ro: string): Bilingual => ({ en, ro });
const secs = (ms: number) => ({
  en: `${(ms / 1000).toFixed(1)} s`,
  ro: `${(ms / 1000).toFixed(1).replace(".", ",")} s`,
});

function pageSpeedFindings(psi: PageSpeedResult): AuditFinding[] {
  const device =
    psi.strategy === "mobile" ? { en: "mobile", ro: "mobil" } : { en: "desktop", ro: "desktop" };
  const findings: AuditFinding[] = [];

  if (psi.lcpMs && psi.lcpMs > 2500) {
    const time = secs(psi.lcpMs);
    findings.push({
      id: "performance.slow-lcp",
      category: "performance",
      severity: psi.lcpMs > 4000 ? "high" : "medium",
      effort: "quick",
      title: bi(
        `Slow first screen on ${device.en}`,
        `Primul ecran se încarcă greu pe ${device.ro}`,
      ),
      detail: bi(
        `The largest element appears after ${time.en} in Google's ${device.en} test (good is under 2.5 s).`,
        `Elementul principal apare după ${time.ro} în testul Google pe ${device.ro} (ideal sub 2,5 s).`,
      ),
      recommendation: bi(
        "We shrink the main image and load what's visible first; the other scripts wait until after.",
        "Micșorăm poza principală și încărcăm întâi ce se vede; restul scripturilor vin după.",
      ),
      evidence: `LCP ${time.en} (Lighthouse, ${psi.strategy})`,
    });
  }
  if (typeof psi.cls === "number" && psi.cls > 0.1) {
    findings.push({
      id: "performance.layout-shift",
      category: "performance",
      severity: psi.cls > 0.25 ? "high" : "medium",
      effort: "quick",
      title: bi("Page jumps while loading", "Pagina „sare” în timpul încărcării"),
      detail: bi(
        "Content moves around as the page loads, so visitors tap the wrong thing.",
        "Conținutul se mută în timpul încărcării, deci vizitatorii apasă pe altceva decât voiau.",
      ),
      recommendation: bi(
        "We reserve room for images, maps and banners in advance, so nothing pushes the page while it loads.",
        "Rezervăm dinainte loc pentru poze, hărți și bannere, ca nimic să nu împingă pagina cât se încarcă.",
      ),
      evidence: `CLS ${psi.cls.toFixed(3)} (Lighthouse, ${psi.strategy})`,
    });
  }
  if (psi.tbtMs && psi.tbtMs > 300) {
    findings.push({
      id: "performance.blocking-time",
      category: "performance",
      severity: psi.tbtMs > 600 ? "high" : "medium",
      effort: "medium",
      title: bi("Page is slow to respond to taps", "Pagina reacționează greu la atingeri"),
      detail: bi(
        `Scripts keep the browser busy for ${secs(psi.tbtMs).en} while loading (good is under 0.2 s), so the first taps feel ignored.`,
        `Scripturile țin browserul ocupat ${secs(psi.tbtMs).ro} în timpul încărcării (ideal sub 0,2 s), deci primele atingeri par ignorate.`,
      ),
      recommendation: bi(
        "We remove unused code and plugins and start the chat and tracking only after the first tap.",
        "Scoatem codul și modulele nefolosite și pornim chatul și urmărirea abia după prima atingere.",
      ),
      evidence: `TBT ${Math.round(psi.tbtMs)} ms (Lighthouse, ${psi.strategy})`,
    });
  }
  if (psi.fieldLcpMs && psi.fieldLcpMs > 2500) {
    const time = secs(psi.fieldLcpMs);
    findings.push({
      id: "performance.field-lcp",
      category: "performance",
      severity: psi.fieldLcpMs > 4000 ? "high" : "medium",
      effort: "medium",
      title: bi("Real visitors wait for the page", "Vizitatorii reali așteaptă pagina"),
      detail: bi(
        `Chrome users' data shows the main content appearing after ${time.en} for 1 in 4 visits (good is under 2.5 s).`,
        `Datele de la utilizatorii Chrome arată că, la 1 din 4 vizite, conținutul principal apare după ${time.ro} (ideal sub 2,5 s).`,
      ),
      recommendation: bi(
        "We start with the main image and the server's speed, then check the real visitors' data again after 28 days.",
        "Începem cu poza principală și viteza serverului, apoi verificăm din nou datele vizitatorilor reali după 28 de zile.",
      ),
      evidence: `CrUX LCP p75 ${time.en}`,
    });
  }
  if (psi.fieldInpMs && psi.fieldInpMs > 200) {
    findings.push({
      id: "performance.field-inp",
      category: "performance",
      severity: psi.fieldInpMs > 500 ? "high" : "medium",
      effort: "medium",
      title: bi("Real visitors see slow reactions", "Vizitatorii reali văd reacții lente"),
      detail: bi(
        `Chrome users' data shows clicks and taps taking ${Math.round(psi.fieldInpMs)} ms to respond (good is under 200 ms).`,
        `Datele de la utilizatorii Chrome arată că un click sau o atingere primește răspuns după ${Math.round(psi.fieldInpMs)} ms (ideal sub 200 ms).`,
      ),
      recommendation: bi(
        "We cut the heavy scripts and outside widgets that run on every tap.",
        "Reducem scripturile grele și modulele externe care rulează la fiecare atingere.",
      ),
      evidence: `CrUX INP p75 ${Math.round(psi.fieldInpMs)} ms`,
    });
  }
  if (psi.accessibility < 80) {
    findings.push({
      id: "accessibility.lighthouse",
      category: "accessibility",
      severity: psi.accessibility < 60 ? "high" : "medium",
      effort: "medium",
      title: bi(
        "Accessibility issues found by Lighthouse",
        "Probleme de accesibilitate găsite de Lighthouse",
      ),
      detail: bi(
        `Google Lighthouse scores the page's accessibility ${psi.accessibility}/100 (issues such as low text contrast, missing names or labels).`,
        `Google Lighthouse acordă accesibilității paginii ${psi.accessibility}/100 (probleme precum contrast slab al textului, nume sau etichete lipsă).`,
      ),
      recommendation: bi(
        "We fix the accessibility problems Google's test lists, starting with text contrast and form labels.",
        "Rezolvăm problemele de accesibilitate din testul Google, începând cu contrastul textului și etichetele formularelor.",
      ),
      evidence: `Lighthouse accessibility ${psi.accessibility}`,
    });
  }
  return findings;
}

export function applyPageSpeed(
  audit: WebsiteAudit,
  pagespeed: (PageSpeedResult & { screenshot?: string }) | null | undefined,
): WebsiteAudit {
  if (!pagespeed || !audit.reachable) return audit;
  const { screenshot, ...result } = pagespeed;
  const added = pageSpeedFindings(result);
  const ids = new Set(added.map((finding) => finding.id));
  const findings = sortFindings([
    ...audit.findings.filter((finding) => !ids.has(finding.id)),
    ...added,
  ]);
  const scores = scoreAudit(findings, result);
  return {
    ...audit,
    pagespeed: result,
    screenshot: screenshot ?? audit.screenshot,
    findings,
    scores,
  };
}
