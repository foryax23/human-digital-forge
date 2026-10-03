import type { Lang } from "@/lib/scan/types";

/*
 * The information notice and the optional marketing consent shown in the PDF
 * dialog (LeadGateDialog). The dialog renders these strings and saveScanLead
 * stores the same strings with the lead, looked up by version on the server,
 * so the record always holds exactly what the visitor saw. Changing a word
 * means a new LEAD_NOTICE_VERSION.
 *
 * The report is delivered whatever the visitor ticks (GDPR art. 7(4): consent
 * that is a condition of the service is not freely given). Marketing needs
 * its own unticked box (art. 6(1)(a); Legea 506/2004 art. 12). Leads saved
 * before this version count as "no marketing consent".
 */

export const LEAD_NOTICE_VERSION = "2026-10-03";

/** Where privacy requests go (the address published across the site). */
export const PRIVACY_EMAIL = "hello@vortexhub.ro";

/** Privacy policy section that explains Vortex Scan and the PDF leads. */
export const LEAD_PRIVACY_URL = "/privacy#vortex-scan";

export const LEAD_RETENTION_MONTHS = 24;

type NoticeCopy = {
  /** Plain sentences, no markup: stored verbatim with the lead. */
  notice: string;
  /** "Detalii în" + linked "politica de confidențialitate" + ".". */
  moreBefore: string;
  moreLink: string;
  /** Label of the optional, unticked marketing checkbox. */
  marketing: string;
};

export const LEAD_NOTICE: Record<Lang, NoticeCopy> = {
  ro: {
    notice: `Raportul se descarcă imediat, nu îl trimitem pe e-mail. Operatorul datelor este Vortex Hub S.R.L., reprezentată de Mihai Dandea, Director. Păstrăm e-mailul, numele și rezumatul scanării ${LEAD_RETENTION_MONTHS} de luni, ca evidență a raportului și ca să îți putem răspunde. Pentru acces, corectare sau ștergere, scrie-ne la ${PRIVACY_EMAIL}.`,
    moreBefore: "Detalii în",
    moreLink: "politica de confidențialitate",
    marketing: "Vreau să primesc idei și oferte de la Vortex Hub pe e-mail. Pot renunța oricând.",
  },
  en: {
    notice: `The report downloads right away; we don't email it. The data controller is Vortex Hub S.R.L., represented by Mihai Dandea, Director. We keep your email, name and the scan summary for ${LEAD_RETENTION_MONTHS} months, as a record of the report and so we can reply to you. For access, correction or deletion, write to ${PRIVACY_EMAIL}.`,
    moreBefore: "Details in our",
    moreLink: "privacy policy",
    marketing: "I'd like ideas and offers from Vortex Hub by email. I can opt out at any time.",
  },
};

/** The notice as one plain-text paragraph, the way it is stored. */
export function leadNoticeText(lang: Lang): string {
  const copy = LEAD_NOTICE[lang];
  return `${copy.notice} ${copy.moreBefore} ${copy.moreLink} (${LEAD_PRIVACY_URL}).`;
}

export type LeadConsentRecord = {
  version: string;
  lang: Lang;
  channel: "vortex-scan/pdf-dialog";
  recordedAt: string;
  /** The information notice shown above the download button. */
  notice: string;
  /** The report itself: requested by the visitor; the row is our record of it. */
  reportBasis: string;
  marketing: { granted: boolean; text: string; basis: string };
};

/** What saveScanLead stores next to the lead (server time, server-side text). */
export function leadConsentRecord(
  lang: Lang,
  marketingGranted: boolean,
  at: Date = new Date(),
): LeadConsentRecord {
  return {
    version: LEAD_NOTICE_VERSION,
    lang,
    channel: "vortex-scan/pdf-dialog",
    recordedAt: at.toISOString(),
    notice: leadNoticeText(lang),
    reportBasis: "GDPR art. 6(1)(b) (report requested by the visitor) and 6(1)(f) (record)",
    marketing: {
      granted: marketingGranted,
      text: LEAD_NOTICE[lang].marketing,
      basis: "GDPR art. 6(1)(a); Legea 506/2004 art. 12",
    },
  };
}
