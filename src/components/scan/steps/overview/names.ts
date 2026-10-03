/* Small text helpers shared by the overview parts. */

/** "Dental Smile Clinic" from "Dental Smile Clinic SRL": the name a person says. */
export function shortName(name: string) {
  return (
    name
      .replace(/[\s,]+(S\.?\s?R\.?\s?L\.?|S\.?\s?A\.?|P\.?F\.?A\.?|I\.?I\.?|I\.?F\.?)\.?$/i, "")
      .trim() || name
  );
}

/** "3 octombrie 2026" / "3 October 2026" for the sources line. */
export function longDate(iso: string | undefined, lang: "en" | "ro") {
  if (!iso) return undefined;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return undefined;
  return date.toLocaleDateString(lang === "ro" ? "ro-RO" : "en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}
