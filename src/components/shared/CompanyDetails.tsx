import { useI18n } from "@/i18n";

const rows = [
  { en: "Registered office", ro: "Sediu social", value: "Municipiul Timișoara, Jud. Timiș, Strada Armoniei, Nr. 23A, Ap. B1" },
  { en: "Unique registration code (CUI)", ro: "Cod unic de înregistrare (CUI)", value: "54747928 (22.05.2026)" },
  { en: "Trade Register number", ro: "Număr registrul comerțului", value: "J2026033767000 (22.05.2026)" },
  { en: "European unique identifier (EUID)", ro: "Identificator unic european (EUID)", value: "ROONRC.J2026033767000" },
  { en: "Email", ro: "Email", value: "hello@vortexhub.ro" },
] as const;

export function CompanyDetails() {
  const { t } = useI18n();

  return (
    <div className="rounded-xl border border-border bg-card p-6">
      <h2 className="font-serif text-lg text-foreground">VORTEX HUB S.R.L.</h2>
      <dl className="mt-4 space-y-3">
        {rows.map((row) => (
          <div key={row.en} className="flex flex-col gap-0.5 sm:flex-row sm:gap-3">
            <dt className="w-64 shrink-0 text-sm font-medium text-foreground">{t(row.en, row.ro)}</dt>
            <dd className="text-sm text-muted-foreground">
              {row.en === "Email" ? (
                <a className="text-primary underline-offset-4 hover:underline" href={`mailto:${row.value}`}>
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
