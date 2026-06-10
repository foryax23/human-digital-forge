import { cn } from "@/lib/utils";
import { useI18n, type Language } from "@/i18n";

const languages: Language[] = ["en", "ro"];

export function LanguageToggle({ className }: { className?: string }) {
  const { lang, setLang } = useI18n();

  return (
    <div
      role="group"
      aria-label="Select language"
      className={cn(
        "inline-flex items-center rounded-md border border-border p-0.5 text-xs font-medium",
        className,
      )}
    >
      {languages.map((code) => (
        <button
          key={code}
          type="button"
          aria-pressed={lang === code}
          onClick={() => setLang(code)}
          className={cn(
            "rounded px-2 py-1 uppercase transition-colors",
            lang === code
              ? "bg-foreground text-background"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {code}
        </button>
      ))}
    </div>
  );
}
