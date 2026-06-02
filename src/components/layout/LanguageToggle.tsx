import { useState } from "react";
import { cn } from "@/lib/utils";

const languages = ["EN", "RO"] as const;
type Language = (typeof languages)[number];

export function LanguageToggle({ className }: { className?: string }) {
  const [active, setActive] = useState<Language>("EN");

  return (
    <div
      role="group"
      aria-label="Select language"
      className={cn(
        "inline-flex items-center rounded-md border border-border p-0.5 text-xs font-medium",
        className,
      )}
    >
      {languages.map((lang) => (
        <button
          key={lang}
          type="button"
          aria-pressed={active === lang}
          onClick={() => setActive(lang)}
          className={cn(
            "rounded px-2 py-1 transition-colors",
            active === lang
              ? "bg-foreground text-background"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {lang}
        </button>
      ))}
    </div>
  );
}
