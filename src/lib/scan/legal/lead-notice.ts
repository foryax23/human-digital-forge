import type { ConsentRecord } from "@/lib/deep/contracts";
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

/**
 * One consent record for both channels (plan B1, D17): the PDF dialog
 * ("vortex-scan/pdf-dialog") and the deep-research start form
 * ("vortex-deep/start", with the accepted report terms). Structurally the
 * shared ConsentRecord of src/lib/deep/contracts.ts. No IP address is stored
 * in any record: a PDF record is tied to the e-mail given, a deep record to
 * the account and the run.
 */
export type LeadConsentRecord = ConsentRecord;

/* ------------------------------------------------- deep research (B1, B7) */

/**
 * The deep-research start form: the notice above the boxes, box 1 (required:
 * "Am citit Nota de informare și accept Termenii de utilizare a raportului",
 * a contract term under art. 6(1)(b), not consent) and box 2 (the same
 * optional marketing box as the PDF dialog). The terms text below is the
 * "Rapoartele Vortex Scan" section of /terms, rendered from this constant, so
 * the page and the stored record can never differ. Changing a word means a
 * new version; the form shows box 1 again for the new version.
 */
export const DEEP_NOTICE_VERSION = "2026-10-03";
export const DEEP_TERMS_VERSION = "2026-10-04";

/** Deep runs, paid-call records and step records are kept this long (A6, B6). */
export const DEEP_RETENTION_DAYS = 90;
export const DEEP_FEEDBACK_RETENTION_MONTHS = 12;

/** Section of /terms with the report terms, and of /privacy with the deep-research notice. */
export const DEEP_TERMS_URL = "/terms#rapoarte-vortex-scan";
export const DEEP_PRIVACY_URL = "/privacy#vortex-scan-deep";

type DeepCopy = {
  /** Plain sentences, stored verbatim with every run. */
  notice: string;
  /** Box 1 (required): accepting the notice and the report terms. */
  termsBox: string;
  /** Box 2 (optional, unticked): marketing, same text as the PDF dialog. */
  marketing: string;
};

export const DEEP_NOTICE: Record<Lang, DeepCopy> = {
  ro: {
    notice: `Cercetarea folosește date publice despre firmă (ANAF, bilanțurile depuse la Ministerul Finanțelor, Registrul Comerțului, portalul instanțelor, licitațiile europene) și cel mult 30 de pagini publice ale site-ului ei. Operatorul datelor este Vortex Hub S.R.L., reprezentată de Mihai Dandea, Director. Păstrăm cercetarea legată de contul tău (ID-ul contului, firma cercetată, relația ta cu ea, raportul și costul cercetării) ${DEEP_RETENTION_DAYS} de zile, ca să ți-o putem arăta din nou și ca evidență. Textul raportului poate fi redactat cu ajutorul inteligenței artificiale: faptele publice despre firmă și textul public al site-ului ei ajung la Anthropic (Claude), care lucrează pentru noi ca persoană împuternicită; e-mailul, numele și telefonul tău nu ajung acolo. Nu facem profiluri despre persoane și nu spunem firmei cine a cercetat-o. Pentru acces, corectare sau ștergere, scrie-ne la ${PRIVACY_EMAIL}.`,
    termsBox: "Am citit Nota de informare și accept Termenii de utilizare a raportului",
    marketing: LEAD_NOTICE.ro.marketing,
  },
  en: {
    notice: `The research uses public data about the company (ANAF, the annual accounts filed with the Ministry of Finance, the Trade Register, the court portal, EU tenders) and at most 30 public pages of its website. The data controller is Vortex Hub S.R.L., represented by Mihai Dandea, Director. We keep the research linked to your account (account ID, the company researched, your relationship to it, the report and its cost) for ${DEEP_RETENTION_DAYS} days, so we can show it to you again and as a record. The report text may be drafted with artificial intelligence: public facts about the company and the public text of its website reach Anthropic (Claude), which works for us as a processor; your email, name and phone never do. We don't build profiles of people and we don't tell the company who researched it. For access, correction or deletion, write to ${PRIVACY_EMAIL}.`,
    termsBox: "I have read the information notice and I accept the report terms of use",
    marketing: LEAD_NOTICE.en.marketing,
  },
};

/** The report terms ("Rapoartele Vortex Scan"), one sentence per point, as stored and shown on /terms. */
export const DEEP_TERMS: Record<Lang, { title: string; points: string[] }> = {
  ro: {
    title: "Rapoartele Vortex Scan",
    points: [
      "Raportul este o informare. Nu este consultanță juridică, fiscală sau financiară și nu certifică datele: cifrele oficiale vin din registre publice și din bilanțurile depuse, la data arătată în raport.",
      "Estimările, marcate «Estimare», sunt calculele noastre, pe ipotezele arătate lângă fiecare cifră; rezultatul real poate fi diferit.",
      "Datele cu caracter personal pe care le vezi într-un raport nu le folosești pentru mesaje comerciale nesolicitate sau pentru profiluri despre persoane.",
      "Când citezi date din raport, menționezi sursa lor (de exemplu: «Sursa: Ministerul Finanțelor, bilanț 2025»).",
      "Raportul este pentru tine și pentru firma ta; îl poți trimite contabilului, unui colaborator sau unei bănci, dar nu îl publici și nu îl revinzi.",
      `Dacă vezi o eroare, folosește «Raportează o eroare» din raport sau scrie-ne la ${PRIVACY_EMAIL}: verificăm în cel mult 5 zile lucrătoare și corectăm ce e greșit.`,
      "Primul raport Deep Research al fiecărui cont e gratuit; rapoartele următoare vin cu abonamentele prin contract. Vortex Hub poate limita sau opri oricând raportul gratuit.",
    ],
  },
  en: {
    title: "Vortex Scan reports",
    points: [
      "A report is information. It is not legal, tax or financial advice and does not certify the data: official figures come from public registers and the filed annual accounts, as of the date shown in the report.",
      'Estimates, marked "Estimate", are our calculations, on the assumptions shown next to each figure; real results may differ.',
      "Personal data you see in a report may not be used for unsolicited commercial messages or for profiling people.",
      'When you quote data from a report, name its source (for example: "Source: Ministry of Finance, 2025 annual accounts").',
      "The report is for you and your company; you may send it to your accountant, a business associate or a bank, but you may not publish or resell it.",
      `If you see an error, use "Report an error" in the report or write to ${PRIVACY_EMAIL}: we review it within 5 working days and correct what is wrong.`,
      "Each account's first Deep Research report is free; further reports come with the plans by contract. Vortex Hub may limit or stop the free report at any time.",
    ],
  },
};

/** The deep notice as one plain-text paragraph, the way it is stored. */
export function deepNoticeText(lang: Lang): string {
  const more =
    lang === "ro" ? "Detalii în politica de confidențialitate" : "Details in our privacy policy";
  return `${DEEP_NOTICE[lang].notice} ${more} (${DEEP_PRIVACY_URL}).`;
}

/** The report terms as stored: title, then the numbered points. */
export function deepTermsText(lang: Lang): string {
  const t = DEEP_TERMS[lang];
  return `${t.title}. ${t.points.map((p, i) => `${i + 1}. ${p}`).join(" ")}`;
}

/**
 * What startDeepRun stores with every run (server time, server-side text for
 * this version; text sent by a client is never used). Every run keeps its own
 * record even when the account accepted this version before.
 */
export function deepConsentRecord(
  lang: Lang,
  marketingGranted: boolean,
  at: Date = new Date(),
): ConsentRecord {
  return {
    version: DEEP_NOTICE_VERSION,
    lang,
    channel: "vortex-deep/start",
    recordedAt: at.toISOString(),
    notice: deepNoticeText(lang),
    reportBasis:
      "GDPR art. 6(1)(b) (report requested by the account holder, under the report terms) and 6(1)(f) (record)",
    terms: { version: DEEP_TERMS_VERSION, text: deepTermsText(lang), accepted: true },
    marketing: {
      granted: marketingGranted,
      text: DEEP_NOTICE[lang].marketing,
      basis: "GDPR art. 6(1)(a); Legea 506/2004 art. 12",
    },
  };
}

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
