import { FOCUS_RING } from "@/components/system";
import { useI18n, type Language } from "@/i18n";
import { cn } from "@/lib/utils";

type Choice = "ro" | "en" | "uk";

const LANGUAGES: { code: Choice; lang: Language; label: string; name: string }[] = [
  { code: "ro", lang: "ro", label: "RO", name: "Română (lei)" },
  { code: "en", lang: "en", label: "EN", name: "English (RON)" },
  { code: "uk", lang: "en", label: "UK", name: "United Kingdom (GBP)" },
];

/**
 * Language switch as text, "RO / EN": the active code in the primary text colour, the
 * other in the label colour, the slash quieter still. Used by the nav, the phone menu
 * and the footer on every page.
 */
export function LanguageSwitch({ className }: { className?: string }) {
  const { lang, setLang, t, market, setMarket } = useI18n();
  const active: Choice = market === "uk" ? "uk" : lang;
  const choose = (code: Choice) => {
    if (code === "uk") return setMarket("uk");
    if (market === "uk") setMarket("ro");
    setLang(code);
  };
  return (
    <div
      role="group"
      aria-label={t("Language", "Limba")}
      className={cn("inline-flex items-center text-[0.8125rem] font-medium", className)}
    >
      {LANGUAGES.map(({ code, lang: codeLang, label, name }, index) => (
        <span key={code} className="inline-flex items-center">
          {index > 0 && (
            <span aria-hidden className="px-0.5 text-fg-4">
              /
            </span>
          )}
          <button
            type="button"
            lang={code === "uk" ? "en-GB" : codeLang}
            aria-pressed={active === code}
            title={name}
            onClick={() => choose(code)}
            className={cn(
              "cursor-pointer rounded-sm px-1 py-1 transition-colors",
              FOCUS_RING,
              active === code ? "text-fg" : "text-fg-3 hover:text-fg-2",
            )}
          >
            {label}
          </button>
        </span>
      ))}
    </div>
  );
}
