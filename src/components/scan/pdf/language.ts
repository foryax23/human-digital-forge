import type { Blueprint, Lang } from "@/lib/scan/types";

/**
 * The PDF's default language: Romanian when the scanned website is Romanian
 * (its page `lang`, the languages detected on it, or a company from the
 * Romanian registry that has a site), otherwise the visitor's language.
 * `fromSite` says the default came from the website, not the visitor.
 */
export function defaultPdfLang(
  blueprint: Blueprint,
  visitorLang: Lang,
): { lang: Lang; fromSite: boolean } {
  const audit = blueprint.audit;
  const isRo = (code: string | undefined) => Boolean(code?.trim().toLowerCase().startsWith("ro"));
  const romanianSite =
    isRo(audit?.meta.lang) ||
    Boolean(audit?.signals.languages.some(isRo)) ||
    Boolean(blueprint.company && (blueprint.company.website || audit));
  return romanianSite ? { lang: "ro", fromSite: true } : { lang: visitorLang, fromSite: false };
}
