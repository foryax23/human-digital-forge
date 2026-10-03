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
        "Compress and resize the hero image, serve WebP/AVIF, preload it and defer non-critical scripts.",
        "Comprimă și redimensionează imaginea principală, folosește WebP/AVIF, preîncarc-o și amână scripturile neesențiale.",
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
        `Content moves around as the page loads (layout shift ${psi.cls.toFixed(2)}; good is under 0.1), so visitors tap the wrong thing.`,
        `Conținutul se mută în timpul încărcării (layout shift ${psi.cls.toFixed(2).replace(".", ",")}; ideal sub 0,1), deci vizitatorii apasă pe altceva decât voiau.`,
      ),
      recommendation: bi(
        "Reserve space for images, embeds and banners (width/height or aspect-ratio) and avoid inserting content above what's already shown.",
        "Rezervă spațiu pentru imagini, elemente încorporate și bannere (width/height sau aspect-ratio) și nu insera conținut deasupra celui deja afișat.",
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
        `Scripts keep the browser busy for ${Math.round(psi.tbtMs)} ms while loading (good is under 200 ms), so the first taps feel ignored.`,
        `Scripturile țin browserul ocupat ${Math.round(psi.tbtMs)} ms în timpul încărcării (ideal sub 200 ms), deci primele atingeri par ignorate.`,
      ),
      recommendation: bi(
        "Remove unused JavaScript and plugins, delay chat/tracking widgets until interaction, and split large bundles.",
        "Elimină JavaScript-ul și pluginurile nefolosite, întârzie widgeturile de chat/tracking până la prima interacțiune și împarte pachetele mari.",
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
        "Start with the hero image and server response time; re-check the field data after 28 days.",
        "Începe cu imaginea principală și timpul de răspuns al serverului; verifică din nou datele reale după 28 de zile.",
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
        "Reduce heavy scripts and third-party widgets that run on every interaction.",
        "Redu scripturile grele și widgeturile externe care rulează la fiecare interacțiune.",
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
        "Fix the items in Lighthouse's accessibility report, starting with colour contrast and form labels.",
        "Rezolvă punctele din raportul de accesibilitate Lighthouse, începând cu contrastul culorilor și etichetele formularelor.",
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
