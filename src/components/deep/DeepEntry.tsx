import { useEffect, useState } from "react";
import { ArrowRight } from "lucide-react";

import { ButtonLink, Panel, PanelBody } from "@/components/system";
import type { DeepAccess } from "@/lib/deep/contracts";
import type { Blueprint } from "@/lib/scan/types";
import { useAuth } from "@/components/auth/AuthProvider";
import { useI18n } from "@/i18n";
import { cn } from "@/lib/utils";

import { OUTCOME } from "./copy";
import { browserStorage, clearJournal, hasAnyJournal } from "./journal";
import { DEEP_PATH } from "./safe-next";
import { fetchAccess } from "./transport";

/*
 * The way into deep research from /scan (plan A10, D2): a compact line after the company
 * strip in the overview and a full block at the end of the results. It renders only when the
 * server says the entry is visible (access allowed, or DEEP_ENTRY_PUBLIC=on for visitors who
 * would see "Intră în cont" or "Ai un cod de test?"). Never on the search stage.
 */

let cached: { at: number; uid: string | null; value: DeepAccess } | null = null;
const TTL_MS = 5 * 60_000;

/** The access answer for the entry, cached for 5 minutes per account in this tab. */
function useEntryAccess(): DeepAccess | null {
  const { user, loading } = useAuth();
  const uid = user?.id ?? null;
  const [access, setAccess] = useState<DeepAccess | null>(
    cached && cached.uid === uid && Date.now() - cached.at < TTL_MS ? cached.value : null,
  );
  useEffect(() => {
    if (loading) return;
    // A signed-out browser keeps no deep journal (another person may use it next).
    if (!uid && hasAnyJournal(browserStorage())) clearJournal(browserStorage());
    if (cached && cached.uid === uid && Date.now() - cached.at < TTL_MS) {
      setAccess(cached.value);
      return;
    }
    let live = true;
    fetchAccess()
      .then((value) => {
        cached = { at: Date.now(), uid, value };
        if (live) setAccess(value);
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [uid, loading]);
  return access;
}

/** The quick scan's site, only when it proved the company (its CUI on the site). */
function verifiedSite(blueprint?: Blueprint): string | undefined {
  const audit = blueprint?.audit;
  const cui = blueprint?.company?.cui;
  if (!audit?.reachable || !cui || audit.signals?.cuiOnSite?.replace(/\D/g, "") !== cui)
    return undefined;
  return /^https?:\/\//i.test(audit.finalUrl) ? audit.finalUrl.slice(0, 300) : undefined;
}

export function DeepEntry({
  blueprint,
  cui: cuiProp,
  site: siteProp,
  variant,
  preview = false,
  className,
}: {
  /** The quick scan's result: the company's CUI and, when verified, its site. */
  blueprint?: Blueprint;
  cui?: string;
  /** Only when the quick scan verified the site (the server checks it again). */
  site?: string;
  variant: "compact" | "full";
  /** Shown whatever the access (the /scan/deep?demo=intrare preview). */
  preview?: boolean;
  className?: string;
}) {
  const { t } = useI18n();
  const access = useEntryAccess();
  const cui = cuiProp ?? blueprint?.company?.cui;
  const site = siteProp ?? verifiedSite(blueprint);
  const digits = (cui ?? "").replace(/\D/g, "");
  if (!/^\d{2,10}$/.test(digits)) return null;
  if (!preview && !access?.entryVisible) return null;
  const search = { cui: Number(digits), ...(site ? { site } : {}) };
  const outcome = t(OUTCOME.en, OUTCOME.ro);

  if (variant === "compact") {
    return (
      <div
        className={cn(
          "flex flex-col gap-3 border-y border-line-1 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-6",
          className,
        )}
      >
        <p className="min-w-0 text-[0.9375rem] leading-[1.5] text-fg-2">
          <span className="font-medium text-fg">
            {t("Deep research", "Cercetare aprofundată")}:{" "}
          </span>
          {t(
            "how much you keep of every 100 lei, what a customer sees on your site and 3 steps for the next 30 days.",
            "cât păstrezi din 100 de lei, ce vede un client pe site și 3 pași pentru următoarele 30 de zile.",
          )}
        </p>
        <ButtonLink
          to={DEEP_PATH}
          search={search}
          variant="secondary"
          className="h-11 shrink-0 sm:h-9"
          iconEnd={<ArrowRight aria-hidden />}
        >
          {t("Start", "Pornește")}
        </ButtonLink>
      </div>
    );
  }

  return (
    <Panel as="section" aria-labelledby="deep-entry-title" className={className}>
      <PanelBody className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between lg:gap-10">
        <div className="min-w-0 max-w-[60ch]">
          <h2 id="deep-entry-title" className="type-h3 text-fg">
            {t("Deep research", "Cercetare aprofundată")}
          </h2>
          <p className="mt-1.5 text-fg-2">{outcome}</p>
        </div>
        <div className="flex shrink-0 flex-col items-start gap-1.5">
          {/* Secondary: /scan keeps its one violet button for the report download. */}
          <ButtonLink
            to={DEEP_PATH}
            search={search}
            variant="secondary"
            size="lg"
            className="h-11"
            iconEnd={<ArrowRight aria-hidden />}
          >
            {t("Start the deep research", "Pornește cercetarea aprofundată")}
          </ButtonLink>
          <p className="text-[0.8125rem] text-fg-3">
            {t("Free during the test period", "Gratuit în perioada de test")}
          </p>
          <ButtonLink
            to={DEEP_PATH}
            search={{ demo: "exemplu" }}
            variant="link"
            size="sm"
            className="min-h-11 sm:min-h-0"
          >
            {t("See a sample report", "Vezi un exemplu de raport")}
          </ButtonLink>
        </div>
      </PanelBody>
    </Panel>
  );
}
