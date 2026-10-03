import { FOCUS_RING } from "@/components/system";
import { useI18n, type Language } from "@/i18n";
import { cn } from "@/lib/utils";

const LANGUAGES: { code: Language; label: string; name: string }[] = [
  { code: "ro", label: "RO", name: "Română" },
  { code: "en", label: "EN", name: "English" },
];

/**
 * Language switch as text, "RO / EN": the active code in the primary text colour, the
 * other in the label colour, the slash quieter still. Used by the nav, the phone menu
 * and the footer on every page.
 */
export function LanguageSwitch({ className }: { className?: string }) {
  const { lang, setLang, t } = useI18n();
  return (
    <div
      role="group"
      aria-label={t("Language", "Limba")}
      className={cn("inline-flex items-center text-[0.8125rem] font-medium", className)}
    >
      {LANGUAGES.map(({ code, label, name }, index) => (
        <span key={code} className="inline-flex items-center">
          {index > 0 && (
            <span aria-hidden className="px-0.5 text-fg-4">
              /
            </span>
          )}
          <button
            type="button"
            lang={code}
            aria-pressed={lang === code}
            title={name}
            onClick={() => setLang(code)}
            className={cn(
              "cursor-pointer rounded-sm px-1 py-1 transition-colors",
              FOCUS_RING,
              lang === code ? "text-fg" : "text-fg-3 hover:text-fg-2",
            )}
          >
            {label}
          </button>
        </span>
      ))}
    </div>
  );
}
