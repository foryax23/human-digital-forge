import { useI18n } from "@/i18n";
import { COMPANY } from "@/lib/scan/legal/company";

const rows = [
  { en: "Registered office", ro: "Sediul social", value: COMPANY.seat },
  {
    en: "Represented by",
    ro: "Reprezentată de",
    value: `${COMPANY.signatory}, ${COMPANY.role.ro}`,
  },
  {
    en: "Unique registration code (CUI)",
    ro: "Cod unic de înregistrare (CUI)",
    value: `${COMPANY.cui} (${COMPANY.registeredOn})`,
  },
  {
    en: "Trade Register number",
    ro: "Număr de ordine în registrul comerțului",
    value: `${COMPANY.regNo} (${COMPANY.registeredOn})`,
  },
  {
    en: "European unique identifier (EUID)",
    ro: "Identificator unic european (EUID)",
    value: COMPANY.euid,
  },
  { en: "Email", ro: "E-mail", value: COMPANY.email },
] as const;

/** The company's identity as a label / value list (legal pages). */
export function CompanyDetails() {
  const { t } = useI18n();

  return (
    <div className="rounded-xl border border-line-2 bg-s1 px-5 pb-1.5 pt-4">
      <h2 className="type-h4 text-fg">{COMPANY.legalName}</h2>
      <dl className="mt-3">
        {rows.map((row) => (
          <div
            key={row.en}
            className="grid gap-0.5 border-t border-line-1 py-2.5 text-sm sm:grid-cols-[16rem_minmax(0,1fr)] sm:gap-4"
          >
            <dt className="text-fg-3">{t(row.en, row.ro)}</dt>
            <dd className="text-fg [overflow-wrap:anywhere]">
              {row.en === "Email" ? (
                <a
                  className="underline decoration-fg/30 underline-offset-4 hover:decoration-fg"
                  href={`mailto:${row.value}`}
                >
                  {row.value}
                </a>
              ) : (
                row.value
              )}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
