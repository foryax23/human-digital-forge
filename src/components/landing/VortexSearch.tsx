import { useId, useState, type FormEvent } from "react";
import { ArrowRight, Search } from "lucide-react";

import { useI18n } from "@/i18n";
import { cn } from "@/lib/utils";

/**
 * The glass search pill from the hero mockup: a breathing violet rim with a
 * light streak along its top edge, a search icon and a round blue-violet
 * submit button. Vortex Scan's autocomplete will attach to this input.
 */
export function VortexSearch({
  onSubmit,
  className,
}: {
  onSubmit: (query: string) => void;
  className?: string;
}) {
  const { t } = useI18n();
  const inputId = useId();
  const [query, setQuery] = useState("");

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const value = query.trim();
    if (value) onSubmit(value);
  };

  return (
    <form role="search" onSubmit={submit} className={cn("group/search relative w-full", className)}>
      {/* Rim: a gradient ring behind the glass, glowing more on focus. */}
      <div className="vortex-search-rim rounded-full p-[1.5px] transition-[filter] duration-300 group-focus-within/search:brightness-125">
        <div className="relative flex h-16 items-center gap-3 rounded-full bg-[#04061a]/90 pl-5 pr-2 backdrop-blur-xl sm:h-[4.5rem] sm:gap-4 sm:pl-7">
          {/* Light catching the top edge. */}
          <span
            aria-hidden
            className="pointer-events-none absolute -top-px left-1/2 h-px w-1/3 -translate-x-1/2 bg-gradient-to-r from-transparent via-white/90 to-transparent"
          />
          <span
            aria-hidden
            className="pointer-events-none absolute -top-3 left-1/2 h-6 w-1/4 -translate-x-1/2 rounded-full bg-[#9b8cff]/25 blur-xl"
          />

          <Search aria-hidden className="h-5 w-5 shrink-0 text-foreground/80" />
          <label htmlFor={inputId} className="sr-only">
            {t("Search a company or website", "Caută o firmă sau un site")}
          </label>
          <input
            id={inputId}
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t("Search a company or website…", "Caută o firmă sau un site…")}
            autoComplete="off"
            spellCheck={false}
            enterKeyHint="search"
            className="h-full min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-foreground/45 sm:text-base [&::-webkit-search-cancel-button]:hidden"
          />
          <button
            type="submit"
            aria-label={t("Analyse", "Analizează")}
            className="bg-gradient-hero-button grid h-11 w-11 shrink-0 place-items-center rounded-full text-[#0a0b1e] shadow-[0_0_24px_rgb(137_203_246/0.35)] transition-transform duration-200 hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80 focus-visible:ring-offset-2 focus-visible:ring-offset-[#04061a] motion-reduce:hover:scale-100 sm:h-12 sm:w-12"
          >
            <ArrowRight aria-hidden className="h-5 w-5" />
          </button>
        </div>
      </div>
    </form>
  );
}
