import { useI18n } from "@/i18n";
import { joinList } from "@/lib/scan/blueprint/format";
import type { Bilingual, DetectedTechnology, WebsiteAudit } from "@/lib/scan/types";
import { pick } from "../../report/format";
import { EmptyState, SubHeading } from "./shared";

const TECH_GROUPS: Array<{ id: DetectedTechnology["category"]; label: Bilingual }> = [
  // "cms" is the platform (WordPress); "builder" the page editor on top of it (Elementor).
  { id: "cms", label: { en: "Website platform", ro: "Platforma site-ului" } },
  { id: "builder", label: { en: "Page editor", ro: "Editor de pagini" } },
  { id: "ecommerce", label: { en: "Online shop", ro: "Magazin online" } },
  { id: "framework", label: { en: "Built with", ro: "Construit cu" } },
  { id: "analytics", label: { en: "Analytics", ro: "Statistici de trafic" } },
  { id: "marketing", label: { en: "Marketing", ro: "Marketing" } },
  { id: "chat", label: { en: "Chat", ro: "Chat" } },
  { id: "booking", label: { en: "Booking", ro: "Programări" } },
  { id: "payments", label: { en: "Payments", ro: "Plăți" } },
  { id: "consent", label: { en: "Cookie consent", ro: "Acord pentru cookie-uri" } },
  { id: "hosting", label: { en: "Hosting and delivery", ro: "Găzduire și livrare" } },
  { id: "other", label: { en: "Other", ro: "Altele" } },
];

/**
 * The "Tehnologii" tab: what the site is built with as label → comma list, and what the
 * site can do as two plain lines ("Are: …" / "Nu are: …"). No pills, no grey chips.
 */
export function TechnologiesPanel({ audit }: { audit?: WebsiteAudit }) {
  const { t, lang } = useI18n();
  if (!audit?.reachable) {
    return (
      <EmptyState
        title={t("No website to inspect", "Niciun site de analizat")}
        body={t(
          "Technologies are read from the website's code, so this needs a site we can open.",
          "Tehnologiile se citesc din codul site-ului, deci avem nevoie de un site pe care să-l putem deschide.",
        )}
      />
    );
  }

  const groups = TECH_GROUPS.map((group) => ({
    ...group,
    items: audit.technologies
      .filter((tech) => tech.category === group.id)
      .sort((a, b) => b.confidence - a.confidence),
  })).filter((group) => group.items.length);

  const s = audit.signals;
  const features: Array<[boolean, string]> = [
    [s.hasContactForm, t("contact form", "formular de contact")],
    [s.hasOnlineBooking, t("online booking", "programare online")],
    [s.hasWhatsApp, "WhatsApp"],
    [s.hasLiveChat, t("chat", "chat")],
    [s.hasEcommerce, t("online payment", "plată online")],
    [s.hasNewsletter, t("newsletter sign-up", "abonare la newsletter")],
    [s.hasBlog, t("articles or a blog", "articole sau blog")],
    [s.hasAnalytics, t("traffic analytics", "statistici de trafic")],
    [s.hasCookieConsent, t("cookie consent", "acord pentru cookie-uri")],
    [s.hasMarketingPixel, t("marketing pixel", "pixel de marketing")],
    [s.hasStructuredData, t("business details for Google", "date structurate pentru Google")],
  ];
  const has = features.filter(([ok]) => ok).map(([, name]) => name);
  const lacks = features.filter(([ok]) => !ok).map(([, name]) => name);
  // Pages that build their text in the browser hide some features from our check.
  const partial = audit.coverage === "client-rendered";

  return (
    <div className="grid gap-x-10 gap-y-8 lg:grid-cols-2">
      <section className="min-w-0">
        <SubHeading
          meta={t(
            `${audit.technologies.length} detected`,
            `${audit.technologies.length} ${audit.technologies.length === 1 ? "detectată" : "detectate"}`,
          )}
        >
          {t("What the site is built with", "Cu ce e făcut site-ul")}
        </SubHeading>
        {groups.length ? (
          <dl className="divide-y divide-line-1 border-y border-line-1">
            {groups.map((group) => (
              <div
                key={group.id}
                className="grid gap-x-4 gap-y-0.5 py-2 sm:grid-cols-[minmax(0,12rem)_minmax(0,1fr)]"
              >
                <dt className="text-[0.8125rem] leading-[1.45] text-fg-3">
                  {pick(group.label, lang)}
                </dt>
                <dd className="text-sm leading-[1.45] text-fg">
                  {group.items
                    .map((tech) =>
                      tech.confidence < 0.7
                        ? `${tech.name} ${t("(likely)", "(probabil)")}`
                        : tech.name,
                    )
                    .join(", ")}
                </dd>
              </div>
            ))}
          </dl>
        ) : (
          <EmptyState
            title={t("Nothing recognisable", "Nicio tehnologie recunoscută")}
            body={t(
              "We didn't recognise a CMS, analytics or marketing tool, so the site may be custom-built.",
              "Nu am recunoscut un CMS, un instrument de statistici sau unul de marketing, deci site-ul poate fi făcut la comandă.",
            )}
          />
        )}
      </section>

      <section className="min-w-0">
        <SubHeading>{t("What the site can do", "Ce poate face site-ul")}</SubHeading>
        <dl className="divide-y divide-line-1 border-y border-line-1 text-sm leading-[1.5]">
          <div className="grid gap-x-4 py-2 sm:grid-cols-[4.5rem_minmax(0,1fr)]">
            <dt className="text-fg-3">{t("Has", "Are")}</dt>
            <dd className="text-fg-2">
              {has.length
                ? `${joinList(has, lang)}.`
                : t("none of these.", "niciuna dintre acestea.")}
            </dd>
          </div>
          <div className="grid gap-x-4 py-2 sm:grid-cols-[4.5rem_minmax(0,1fr)]">
            <dt className="text-fg-3">{t("Lacks", "Nu are")}</dt>
            <dd className="text-fg-2">
              {lacks.length
                ? `${joinList(lacks, lang)}.`
                : t("nothing on this list.", "nimic din listă.")}
            </dd>
          </div>
        </dl>
        {partial ? (
          <p className="mt-2 text-xs leading-[1.45] text-fg-3">
            {t(
              "The site builds its text in the browser, so some of these may exist without us seeing them.",
              "Site-ul își construiește textul în browser, așa că unele dintre acestea pot exista fără să le vedem.",
            )}
          </p>
        ) : null}
      </section>
    </div>
  );
}
