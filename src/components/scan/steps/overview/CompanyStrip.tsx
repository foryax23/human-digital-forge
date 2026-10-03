import { useState, type ReactNode } from "react";
import { ArrowUpRight, Pencil } from "lucide-react";

import { Button, FOCUS_RING, Panel, PanelFooter, Status } from "@/components/system";
import { useI18n } from "@/i18n";
import { formatNumber, roNeedsDe, ucFirst } from "@/lib/scan/blueprint/format";
import { titleCaseAnaf, withCommaBelow } from "@/lib/scan/localize";
import type { Blueprint, CompanyProfile, OnlinePresence, WebsiteAudit } from "@/lib/scan/types";
import { cn } from "@/lib/utils";
import { displayHost, pick, softenCaps } from "../../report/format";
import { EditBusinessDialog } from "./EditBusinessDialog";
import { longDate } from "./names";
import type { EditPatch } from "./shared";

/**
 * A company name with case, dots, diacritics and the legal form left out, so "DENTAL
 * SMILE CLINIC S.R.L." and "Dental Smile Clinic SRL" compare equal.
 */
function nameKey(name: string) {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[.,]/g, " ")
    .replace(/\b(s\s*r\s*l|s\s*a|srl|sa|pfa|ii|if|snc|scs)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** "Asistență stomatologică" from the registry's "Activități de asistență stomatologică". */
function activityName(label: string) {
  return ucFirst(label.replace(/^Activități de /, ""));
}

function ExternalLink({
  href,
  children,
  code = false,
}: {
  href: string;
  children: ReactNode;
  code?: boolean;
}) {
  const { t } = useI18n();
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "inline-flex max-w-full items-center gap-1 rounded-sm text-fg underline decoration-fg/30 underline-offset-4 transition-colors hover:decoration-fg",
        code && "type-code text-sm",
        FOCUS_RING,
      )}
    >
      <span className="truncate">{children}</span>
      <ArrowUpRight aria-hidden className="size-3.5 shrink-0 text-fg-3" />
      <span className="sr-only">
        {t(" (opens in a new tab)", " (se deschide într-o filă nouă)")}
      </span>
    </a>
  );
}

/**
 * The company in one full-width panel: the site's own first screen (when Lighthouse took
 * one), the name as people say it and as registered, then label/value facts in a wrapping
 * row, the edit button on the right and the sources with the date at the bottom.
 */
export function CompanyStrip({
  blueprint,
  company,
  audit,
  presence,
  onEdit,
}: {
  blueprint: Blueprint;
  company?: CompanyProfile;
  audit?: WebsiteAudit;
  presence?: OnlinePresence;
  onEdit: (patch: EditPatch) => void;
}) {
  const { t, lang } = useI18n();
  const [imageFailed, setImageFailed] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  const website = company?.website ?? audit?.finalUrl ?? blueprint.target.url;
  const host = displayHost(audit?.finalUrl ?? website);
  const titleName = audit?.meta.title?.split(/\s[|–—-]\s/)[0]?.trim();
  const name = withCommaBelow(
    company?.displayName ??
      titleName ??
      host ??
      blueprint.target.query ??
      t("Your business", "Afacerea ta"),
  );
  // The registered name only when it says something the trade name doesn't (not the
  // same words again in capitals).
  const legalName =
    company?.name && nameKey(company.name) !== nameKey(company.displayName ?? name)
      ? titleCaseAnaf(company.name)
      : undefined;
  const city = company?.city ? withCommaBelow(softenCaps(company.city)) : undefined;
  const rating = presence?.googleRating;
  const screenshot = audit?.reachable ? audit.screenshot : undefined;

  const facts: Array<{ label: string; value: ReactNode }> = [];
  facts.push({
    label: t("Business type", "Tip de afacere"),
    value: pick(blueprint.businessType.label, lang),
  });
  if (company?.caenLabel || company?.caen) {
    const activity = company.caenLabel ? pick(company.caenLabel, lang) : "";
    facts.push({
      label: t("Activity", "Activitate"),
      value: [
        lang === "ro" && activity ? activityName(activity) : activity,
        company.caen ? `CAEN ${company.caen}` : "",
      ]
        .filter(Boolean)
        .join(", "),
    });
  }
  if (city) facts.push({ label: t("City", "Oraș"), value: city });
  if (company?.cui) {
    facts.push({ label: "CUI", value: <span className="type-code text-sm">{company.cui}</span> });
  }
  if (website && host) {
    facts.push({
      label: t("Website", "Site"),
      value: (
        <ExternalLink href={/^https?:\/\//i.test(website) ? website : `https://${website}`} code>
          {host}
        </ExternalLink>
      ),
    });
  }
  if (rating) {
    const reviews = t(
      `${formatNumber(rating.reviews, "en")} reviews`,
      `${formatNumber(rating.reviews, "ro")} ${roNeedsDe(rating.reviews) ? "de " : ""}recenzii`,
    );
    const text = t(
      `${formatNumber(rating.rating, "en", 1)} from ${reviews}`,
      `Nota ${formatNumber(rating.rating, "ro", 1)} din ${reviews}`,
    );
    facts.push({
      label: "Google",
      value: rating.mapsUrl ? <ExternalLink href={rating.mapsUrl}>{text}</ExternalLink> : text,
    });
  }
  if (company?.inactive) {
    facts.push({
      label: t("Status", "Stare"),
      value: <Status tone="bad">{t("Inactive at ANAF", "Inactivă la ANAF")}</Status>,
    });
  } else if (company?.sources.includes("anaf")) {
    facts.push({
      label: t("Status", "Stare"),
      value: <Status tone="ok">{t("Active at ANAF", "Activă la ANAF")}</Status>,
    });
  }

  const sources = [
    company?.sources.includes("anaf") ? "ANAF" : null,
    company?.sources.includes("index")
      ? t("Trade Register open data", "datele deschise ONRC")
      : null,
    audit?.reachable ? t("the company's website", "site-ul firmei") : null,
    audit?.pagespeed ? "Lighthouse" : null,
    rating ? "Google" : null,
  ].filter(Boolean);
  const checked = longDate(audit?.fetchedAt ?? blueprint.generatedAt, lang);

  return (
    <Panel as="section" aria-label={t("The company", "Firma")}>
      <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-start sm:gap-5 sm:p-5">
        {screenshot && !imageFailed ? (
          <img
            src={screenshot}
            alt={t(`Home page of ${host ?? name}`, `Prima pagină a site-ului ${host ?? name}`)}
            width={128}
            height={80}
            onError={() => setImageFailed(true)}
            decoding="async"
            className="h-20 w-32 shrink-0 rounded-md border border-line-2 object-cover object-top"
          />
        ) : null}
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h3 className="type-h3 text-balance text-fg">{name}</h3>
              {legalName ? (
                <p className="mt-0.5 text-[0.8125rem] leading-[1.35] text-fg-3">{legalName}</p>
              ) : null}
            </div>
            <Button
              variant="secondary"
              size="sm"
              icon={<Pencil aria-hidden />}
              onClick={() => setEditOpen(true)}
            >
              {t("Edit", "Editează")}
            </Button>
          </div>
          <dl className="mt-3 flex flex-wrap gap-x-6 gap-y-3">
            {facts.map((fact) => (
              <div key={fact.label} className="min-w-0 max-w-full">
                <dt className="text-xs leading-[1.45] text-fg-3">{fact.label}</dt>
                <dd className="text-sm leading-[1.45] text-fg">{fact.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
      {sources.length || checked ? (
        <PanelFooter className="text-xs">
          <p>
            {sources.length ? `${t("Sources", "Surse")}: ${sources.join(", ")}.` : null}
            {checked ? ` ${t(`Checked on ${checked}.`, `Verificat pe ${checked}.`)}` : null}
          </p>
        </PanelFooter>
      ) : null}

      <EditBusinessDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        initial={{
          businessTypeId: blueprint.businessType.id,
          businessTypeLabel: blueprint.businessType.label,
          city: company?.city ?? "",
          website: website ?? "",
        }}
        basis={blueprint.businessType.basis}
        company={company}
        onSave={onEdit}
      />
    </Panel>
  );
}
