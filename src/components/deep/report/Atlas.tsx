import { ExternalLink } from "lucide-react";

import { Tag } from "@/components/system";
import { atlasGroups, atlasTimeline } from "@/lib/deep/atlas";
import { CONFIDENCE_LABELS, factLabel } from "@/lib/deep/parse/labels";
import { useI18n } from "@/i18n";

import { useReport } from "./context";

/*
 * "Atlas" tab (plan "Company Atlas", stage 1): every verified fact about the company grouped
 * as one map, each with its confidence and source link, and one dated history timeline.
 */

const KIND: Record<string, [string, string]> = {
  register: ["Register", "Registru"],
  money: ["Accounts", "Bilanț"],
  news: ["Press", "Presă"],
  contract: ["Contract", "Contract"],
  event: ["Event", "Eveniment"],
};

export function AtlasTab() {
  const { t, lang } = useI18n();
  const { report } = useReport();
  const groups = atlasGroups(report);
  const timeline = atlasTimeline(report);
  return (
    <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <div className="min-w-0 space-y-8">
        <p className="max-w-[60ch] text-fg-2">
          {t(
            "Everything public we found about the company, in one place. Each item links to its source.",
            "Tot ce am găsit public despre firmă, într-un singur loc. Fiecare element are sursa lui.",
          )}
        </p>
        {groups.map((g) => (
          <section key={g.id} aria-labelledby={`atlas-${g.id}`} className="min-w-0">
            <h3 id={`atlas-${g.id}`} className="type-h4 text-fg">
              {t(g.title.en, g.title.ro)}
              <span className="ml-2 text-[0.875rem] font-normal text-fg-3">{g.facts.length}</span>
            </h3>
            {g.facts.length ? (
              <ul className="mt-2 border-t border-line-1">
                {g.facts.map((f) => (
                  <li
                    key={f.id}
                    className="grid gap-x-4 gap-y-0.5 border-b border-line-1 py-2 sm:grid-cols-[minmax(0,12rem)_minmax(0,1fr)_auto]"
                  >
                    <span className="text-[0.875rem] text-fg-3">{factLabel(f, lang)}</span>
                    <span className="min-w-0 break-words text-fg">{f.display[lang]}</span>
                    <span className="flex items-center gap-2 text-[0.8125rem] text-fg-3">
                      <Tag variant={f.confidence === "confirmat" ? undefined : "dashed"}>
                        {CONFIDENCE_LABELS[f.confidence][lang]}
                      </Tag>
                      {f.evidence?.url ? (
                        <a
                          href={f.evidence.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 underline-offset-2 hover:underline"
                        >
                          {t("Source", "Sursa")}
                          <ExternalLink aria-hidden className="size-3" />
                        </a>
                      ) : null}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-[0.9375rem] text-fg-3">
                {t("Nothing found in public sources yet.", "Nimic găsit încă în surse publice.")}
              </p>
            )}
          </section>
        ))}
      </div>
      <aside aria-labelledby="atlas-timeline" className="min-w-0">
        <h3 id="atlas-timeline" className="type-h4 text-fg">
          {t("History", "Istoric")}
        </h3>
        {timeline.length ? (
          <ol className="mt-3 space-y-3 border-l border-line-1 pl-4">
            {timeline.map((i, n) => (
              <li key={`${i.date}-${n}`} className="relative">
                <span
                  aria-hidden
                  className={`absolute -left-[1.3rem] top-1.5 size-2 rounded-full ${
                    i.tone === "risk" ? "bg-warn" : i.tone === "growth" ? "bg-ok" : "bg-fg-3"
                  }`}
                />
                <div className="text-[0.8125rem] text-fg-3">
                  <span className="type-num">{i.date}</span> · {t(KIND[i.kind][0], KIND[i.kind][1])}
                </div>
                <div className="text-[0.9375rem] text-fg">
                  {i.url ? (
                    <a href={i.url} target="_blank" rel="noopener noreferrer" className="hover:underline">
                      {i.text[lang]}
                    </a>
                  ) : (
                    i.text[lang]
                  )}
                </div>
              </li>
            ))}
          </ol>
        ) : (
          <p className="mt-2 text-[0.9375rem] text-fg-3">
            {t("No dated events yet.", "Niciun eveniment datat încă.")}
          </p>
        )}
      </aside>
    </div>
  );
}
