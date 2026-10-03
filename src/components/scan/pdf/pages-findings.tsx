import { Text, View } from "@react-pdf/renderer";

import type { DisplayAutomation } from "@/lib/scan/blueprint/display";
import { getBusinessType } from "@/lib/scan/blueprint/taxonomy";
import type { AuditFinding, AutomationOpportunity, PresencePlatform } from "@/lib/scan/types";

import { ScoreBar } from "./charts";
import {
  approxLei,
  formatDate,
  formatNumber,
  hoursPerMonth,
  leiPerMonth,
  listOf,
  monthsQty,
  NBSP,
  pick,
  roDe,
  truncate,
} from "./format";
import {
  joinClauses,
  localizeEvidence,
  localizeMoney,
  localizeTool,
  titleCaseAnaf,
} from "./localize";
import {
  BlockTitle,
  KeyValue,
  Label,
  LightPage,
  Priority,
  SectionTitle,
  StatRow,
  Status,
  type StatCell,
} from "./layout";
import {
  PRIORITY_OF,
  effortLabel,
  platformLabel,
  channelViews,
  priorityFindings,
  priorityLabel,
  scoreTier,
  type PdfContext,
} from "./model";
import { COL2, CONTENT_WIDTH, FONT, GAP, INK, text } from "./theme";

/* --------------------------------------------------------------- snapshot */

/**
 * The record in a few numbers, all counted or read from public data: years in
 * business, channels found, what the site offers and how it compares.
 */
function snapshotStats(ctx: PdfContext): StatCell[] {
  const { blueprint, lang, t } = ctx;
  const { company, audit, presence } = blueprint;
  const stats: StatCell[] = [];

  if (company?.registeredAt) {
    const since = new Date(company.registeredAt).getFullYear();
    const years = new Date(blueprint.generatedAt).getFullYear() - since;
    if (years >= 1) {
      stats.push({
        label: t("In business", "Vechime"),
        value: String(years),
        unit: t(years === 1 ? "year" : "years", years === 1 ? "an" : `${roDe(years)}ani`),
        sub: t(`Registered in ${since}`, `Înființată în ${since}`),
      });
    }
  }

  const channels = channelViews(blueprint).filter((p) => p.status !== "unchecked");
  if (channels.length) {
    const found = channels.filter((p) => p.status !== "missing");
    stats.push({
      label: t("Online channels", "Canale online"),
      value: `${found.length}`,
      unit: t(`of ${channels.length} checked`, `din ${channels.length} verificate`),
      sub: found.length
        ? listOf(
            found.map((p) => platformLabel(p.platform, lang)),
            lang,
            3,
          )
        : t("None found", "Niciunul găsit"),
    });
  }

  if (audit?.reachable) {
    const rivals = (blueprint.competitors ?? [])
      .map((c) => c.websiteScore)
      .filter((score): score is number => score !== undefined);
    const average = rivals.length
      ? Math.round(rivals.reduce((sum, score) => sum + score, 0) / rivals.length)
      : null;
    const tier = scoreTier(audit.scores.overall, lang);
    stats.push({
      label: t("Website score", "Scorul site-ului"),
      value: String(Math.round(audit.scores.overall)),
      unit: t("of 100", "din 100"),
      status: <Status tone={tier.tone}>{tier.label}</Status>,
      sub:
        average !== null
          ? t(
              `Local average ${average} (${rivals.length} site${rivals.length === 1 ? "" : "s"})`,
              `Media locală ${average} (${rivals.length} ${rivals.length === 1 ? "site" : "site-uri"})`,
            )
          : t(
              `${audit.pages.length} page${audit.pages.length === 1 ? "" : "s"} checked`,
              `${audit.pages.length} ${audit.pages.length === 1 ? "pagină verificată" : "pagini verificate"}`,
            ),
    });
  } else {
    stats.push({
      label: t("Website", "Site"),
      value: "–",
      sub: audit
        ? t("It didn't respond when we checked", "Nu a răspuns la verificare")
        : t("No website found", "Niciun site găsit"),
    });
  }

  const rating = presence?.googleRating;
  if (rating) {
    stats.push({
      label: t("Google rating", "Nota pe Google"),
      value: formatNumber(rating.rating, lang, 1),
      unit: t("of 5", "din 5"),
      sub: `${formatNumber(rating.reviews, lang)} ${t("reviews", `${roDe(rating.reviews)}recenzii`)}`,
    });
  }
  const competitors = blueprint.competitors?.length ?? 0;
  if (competitors) {
    stats.push({
      label: t("Local competitors", "Concurenți locali"),
      value: String(competitors),
      sub: t("Same activity and area", "Aceeași activitate și zonă"),
    });
  }
  return stats.slice(0, 4);
}

/** What a missing channel costs, in one line (as on the overview screen). */
const MISSING_LINE: Partial<Record<PresencePlatform, { en: string; ro: string }>> = {
  "google-business": {
    en: "Without it the business doesn't show on Google Maps.",
    ro: "Fără el, firma nu apare în Google Maps.",
  },
  facebook: {
    en: "A page with hours and contact details is enough to start.",
    ro: "O pagină cu programul și datele de contact e de ajuns la început.",
  },
  instagram: { en: "Useful for showing your work.", ro: "Util ca să-ți arăți munca." },
  linkedin: {
    en: "Useful with business clients and hiring.",
    ro: "Util pentru clienți firme și angajări.",
  },
};

/** Registry capitals in sentence case for labels like the legal form. */
function sentenceCase(value: string): string {
  if (value !== value.toUpperCase()) return value;
  const lower = value.toLocaleLowerCase("ro");
  return lower.charAt(0).toLocaleUpperCase("ro") + lower.slice(1);
}

export function SnapshotPage({ ctx }: { ctx: PdfContext }) {
  const { blueprint, lang, t } = ctx;
  const company = blueprint.company;
  const audit = blueprint.audit;
  const yes = t("yes", "da");
  const no = t("no", "nu");
  const stats = snapshotStats(ctx);

  const registry: Array<[string, string | undefined]> = company
    ? [
        // Registry capitals in normal case ("Dental Smile Clinic S.R.L.", "jud. Timiș, …").
        [t("Legal name", "Denumire"), truncate(titleCaseAnaf(company.name), 64)],
        ["CUI", company.cui],
        [t("Trade Register", "Nr. Reg. Com."), company.regNo],
        [
          t("Legal form", "Formă juridică"),
          company.legalForm && truncate(sentenceCase(company.legalForm), 56),
        ],
        [
          t("Registered", "Înființată"),
          company.registeredAt ? formatDate(company.registeredAt, lang) : undefined,
        ],
        [
          t("Activity", "Activitate"),
          company.caen
            ? `CAEN ${company.caen}${company.caenLabel ? `, ${pick(company.caenLabel, lang).toLowerCase()}` : ""}`
            : undefined,
        ],
        [
          t("Registered office", "Sediul social"),
          company.address && truncate(titleCaseAnaf(company.address), 84),
        ],
        [t("Phone", "Telefon"), company.phone],
        [
          t("VAT payer", "Plătitor de TVA"),
          company.vatPayer !== undefined ? (company.vatPayer ? yes : no) : undefined,
        ],
      ]
    : [];
  const registryRows = registry.filter((row): row is [string, string] => Boolean(row[1]));
  const sources = (company?.sources ?? []).map((s) =>
    s === "anaf"
      ? t("ANAF public data", "datele publice ANAF")
      : t("Trade Register open data", "datele deschise ONRC"),
  );

  const profiles = channelViews(blueprint);
  const rating = blueprint.presence?.googleRating;
  const competitors = (blueprint.competitors ?? []).slice(0, 5);

  // What the site offers, as two plain lists instead of a grid of ticks.
  const signals = audit?.reachable ? audit.signals : undefined;
  // Essentials are listed as missing; extras (shop, blog, ad pixel…) only when present.
  const bookings = getBusinessType(blueprint.businessType.id).bookings;
  const checks: Array<[boolean, string, boolean]> = signals
    ? [
        [signals.hasContactForm, t("contact form", "formular de contact"), true],
        [signals.hasPhone, t("phone number", "telefon"), true],
        [signals.hasEmail, t("e-mail address", "adresă de e-mail"), true],
        [signals.hasWhatsApp, "WhatsApp", true],
        [signals.hasOnlineBooking, t("online booking", "programare online"), Boolean(bookings)],
        [signals.hasCookieConsent, t("cookie consent", "acord pentru cookie-uri"), true],
        [
          signals.hasStructuredData,
          t("structured data for Google", "date structurate pentru Google"),
          true,
        ],
        [Boolean(signals.cuiOnSite), t("CUI shown on the site", "CUI afișat pe site"), true],
        [signals.hasLiveChat, t("live chat", "chat pe site"), false],
        [signals.hasEcommerce, t("online shop", "magazin online"), false],
        [signals.hasAnalytics, t("visitor statistics", "statistici de trafic"), false],
        [signals.hasMarketingPixel, t("ad pixel", "pixel de reclame"), false],
        [signals.hasNewsletter, "newsletter", false],
        [signals.hasBlog, "blog", false],
      ]
    : [];
  const present = checks.filter(([on]) => on).map(([, label]) => label);
  const missing = checks.filter(([on, , essential]) => !on && essential).map(([, label]) => label);

  return (
    <LightPage ctx={ctx} label={t("Company", "Compania")}>
      <SectionTitle
        title={t("What the public record shows", "Ce arată datele publice")}
        intro={t(
          "Official registry data, your website as a visitor sees it and the channels we could verify. Nothing on this page is estimated.",
          "Datele oficiale din registru, site-ul tău așa cum îl vede un vizitator și canalele pe care le-am putut verifica. Nimic de pe această pagină nu este estimat.",
        )}
      />

      {stats.length >= 3 ? <StatRow cells={stats} style={{ marginBottom: 14 }} /> : null}

      <View style={{ flexDirection: "row", justifyContent: "space-between" }} wrap={false}>
        <View style={{ width: COL2 }}>
          <BlockTitle rule>{t("Registry data", "Date din registru")}</BlockTitle>
          {company ? (
            <View>
              {company.inactive !== undefined ? (
                <Status tone={company.inactive ? "bad" : "ok"} style={{ marginBottom: 4 }}>
                  {company.inactive
                    ? t("Inactive at ANAF", "Inactivă la ANAF")
                    : t("Active at ANAF", "Activă la ANAF")}
                </Status>
              ) : null}
              {registryRows.map(([label, value], i) => (
                <KeyValue
                  key={label}
                  label={label}
                  value={value}
                  last={i === registryRows.length - 1}
                />
              ))}
              {sources.length ? (
                <Text style={{ ...text.tiny, marginTop: 4 }}>
                  {t("Source", "Sursa")}: {listOf(sources, lang)}.
                </Text>
              ) : null}
            </View>
          ) : (
            <Text style={{ ...text.small }}>
              {t(
                "This scan started from a website, so no registry record is attached. Add the CUI in the online report to include the legal name, legal form, years in business, activity, registered office, VAT status and local competitors.",
                "Scanarea a pornit de la un site, deci nu are atașate datele din registru. Adaugă CUI-ul în raportul online ca să includem denumirea oficială, forma juridică, vechimea, activitatea, sediul social, plata TVA și concurenții locali.",
              )}
            </Text>
          )}
        </View>

        <View style={{ width: COL2 }}>
          <BlockTitle rule>{t("Website", "Site")}</BlockTitle>
          {audit ? (
            <View>
              <Status
                tone={audit.reachable ? (audit.https ? "ok" : "warn") : "bad"}
                style={{ marginBottom: 4 }}
              >
                {audit.reachable
                  ? audit.https
                    ? t(
                        "Online, secure connection (HTTPS)",
                        "Funcțional, conexiune securizată (HTTPS)",
                      )
                    : t("Online, no secure connection", "Funcțional, fără conexiune securizată")
                  : t("Not reachable when we checked", "Nu a răspuns la verificare")}
              </Status>
              <KeyValue
                label={t("Address", "Adresa site-ului")}
                value={truncate(audit.finalUrl || audit.url, 56)}
              />
              {audit.responseMs !== undefined ? (
                <KeyValue
                  label={t("Response", "Răspuns")}
                  value={t(
                    `${formatNumber(audit.responseMs / 1000, lang, 1)} s for the first byte`,
                    `${formatNumber(audit.responseMs / 1000, lang, 1)} s până la primul răspuns`,
                  )}
                />
              ) : null}
              <KeyValue
                label={t("Pages checked", "Pagini verificate")}
                value={String(audit.pages.length)}
              />
              {audit.meta.title ? (
                <KeyValue
                  label={t("Page title", "Titlul paginii")}
                  value={truncate(audit.meta.title, 90)}
                />
              ) : null}
              {audit.signals.languages.length ? (
                <KeyValue
                  label={t("Languages", "Limbi")}
                  value={audit.signals.languages.map((l) => l.toUpperCase()).join(", ")}
                />
              ) : null}
              {audit.signals.cuiOnSite ? (
                <KeyValue
                  label={t("CUI on the site", "CUI pe site")}
                  value={
                    company?.cui && company.cui === audit.signals.cuiOnSite
                      ? t(
                          `${audit.signals.cuiOnSite}, matches the registry`,
                          `${audit.signals.cuiOnSite}, același ca în registru`,
                        )
                      : audit.signals.cuiOnSite
                  }
                />
              ) : null}
              <KeyValue
                label={t("Technologies", "Tehnologii")}
                value={
                  audit.technologies.length
                    ? listOf(
                        audit.technologies.map((tech) => tech.name),
                        lang,
                        8,
                      )
                    : t("none we could recognise", "niciuna pe care să o recunoaștem")
                }
                last
              />
            </View>
          ) : (
            <Text style={{ ...text.small }}>
              {t(
                "We couldn't find or reach a website for this business. Customers who search for it online find nothing it controls.",
                "Nu am găsit un site pentru această afacere sau nu am putut să-l accesăm. Cine o caută online nu găsește nimic administrat de ea.",
              )}
            </Text>
          )}
        </View>
      </View>

      <View
        style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 14 }}
        wrap={false}
      >
        <View style={{ width: COL2 }}>
          <BlockTitle rule note={t("Only what we verified", "Doar ce am verificat")}>
            {t("Where customers find you", "Unde te găsesc clienții")}
          </BlockTitle>
          {profiles.length ? (
            profiles.slice(0, 6).map((profile, i) => {
              const status =
                profile.status === "missing"
                  ? { tone: "warn" as const, label: t("Missing", "Lipsește") }
                  : profile.status === "unchecked"
                    ? {
                        tone: "neutral" as const,
                        label: t("Unchecked", "Neverificat"),
                        hollow: true,
                      }
                    : { tone: "ok" as const, label: t("Exists", "Există") };
              const detail =
                profile.platform === "google-business" && rating
                  ? t(
                      `Rating ${formatNumber(rating.rating, "en", 1)} from ${formatNumber(rating.reviews, "en")} reviews`,
                      `Nota ${formatNumber(rating.rating, "ro", 1)} din ${formatNumber(rating.reviews, "ro")} ${roDe(rating.reviews)}recenzii`,
                    )
                  : profile.metric
                    ? `${pick(profile.metric.label, lang)}: ${profile.metric.value}`
                    : profile.status === "missing"
                      ? (MISSING_LINE[profile.platform]?.[lang] ?? "")
                      : profile.status === "unchecked"
                        ? t(
                            "We couldn't check it this time.",
                            "Nu l-am putut verifica de data aceasta.",
                          )
                        : "";
              return (
                <View
                  key={profile.platform}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    paddingVertical: 3.4,
                    borderBottomWidth: i === Math.min(profiles.length, 6) - 1 ? 0 : 0.5,
                    borderBottomColor: INK.hairline,
                  }}
                >
                  <Text
                    style={{
                      fontFamily: FONT.body,
                      fontWeight: 500,
                      fontSize: 7.6,
                      color: INK.strong,
                      width: 98,
                    }}
                  >
                    {platformLabel(profile.platform, lang)}
                  </Text>
                  <View style={{ width: 62 }}>
                    <Status tone={status.tone} hollow={"hollow" in status}>
                      {status.label}
                    </Status>
                  </View>
                  <Text style={{ ...text.tiny, flex: 1 }}>{detail}</Text>
                </View>
              );
            })
          ) : (
            <Text style={{ ...text.small }}>
              {t(
                "Presence wasn't checked in this scan.",
                "Prezența online nu a fost verificată în această scanare.",
              )}
            </Text>
          )}
        </View>

        <View style={{ width: COL2 }}>
          <BlockTitle rule note={t("Same activity and area", "Aceeași activitate și zonă")}>
            {t("Local competitors", "Concurenți locali")}
          </BlockTitle>
          {audit?.reachable ? (
            <CompetitorRow
              name={t("Your website", "Site-ul tău")}
              sub={audit.host}
              score={audit.scores.overall}
              own
            />
          ) : null}
          {competitors.length ? (
            competitors.map((c) => (
              <CompetitorRow
                key={c.cui}
                name={c.name}
                sub={[
                  c.city,
                  c.website
                    ? c.website.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "")
                    : t("no website found", "fără site"),
                ]
                  .filter(Boolean)
                  .join(", ")}
                score={c.websiteScore}
                missing={c.website ? t("not checked", "neverificat") : "–"}
              />
            ))
          ) : (
            <Text style={{ ...text.small }}>
              {t(
                "No local competitors found in the company index.",
                "Nu am găsit concurenți locali în registrul firmelor.",
              )}
            </Text>
          )}
          <Text style={{ ...text.tiny, marginTop: 4 }}>
            {t(
              "From the Trade Register index. Scores are overall website scores, out of 100.",
              "Din registrul ONRC. Scorurile sunt scorurile generale ale site-urilor, din 100.",
            )}
          </Text>
        </View>
      </View>

      {checks.length ? (
        <View wrap={false} style={{ marginTop: 14 }}>
          <BlockTitle rule>{t("What the website has", "Ce are site-ul")}</BlockTitle>
          <View style={{ flexDirection: "row", marginBottom: 3 }}>
            <View style={{ width: 70 }}>
              <Status tone="ok">{t("Exists", "Există")}</Status>
            </View>
            <Text style={{ ...text.small, color: INK.body, flex: 1 }}>
              {present.length
                ? `${listOf(present, lang)}.`
                : t("none of what we check for.", "nimic din ce verificăm.")}
            </Text>
          </View>
          <View style={{ flexDirection: "row" }}>
            <View style={{ width: 70 }}>
              <Status tone="warn">{t("Missing", "Lipsește")}</Status>
            </View>
            <Text style={{ ...text.small, color: INK.body, flex: 1 }}>
              {missing.length
                ? `${listOf(missing, lang)}.`
                : t("nothing we check for.", "nimic din ce verificăm.")}
            </Text>
          </View>
        </View>
      ) : null}
    </LightPage>
  );
}

function CompetitorRow({
  name,
  sub,
  score,
  own,
  missing = "–",
}: {
  name: string;
  sub?: string;
  score?: number;
  own?: boolean;
  missing?: string;
}) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        paddingVertical: 3,
        borderBottomWidth: 0.5,
        borderBottomColor: INK.hairline,
      }}
    >
      <View style={{ width: 126, paddingRight: 6 }}>
        <Text
          style={{
            fontFamily: FONT.body,
            fontWeight: own ? 700 : 500,
            fontSize: 7.4,
            color: INK.strong,
          }}
        >
          {truncate(name, 34)}
        </Text>
        {sub ? <Text style={{ ...text.tiny, fontSize: 6.2 }}>{truncate(sub, 40)}</Text> : null}
      </View>
      <View style={{ flex: 1 }}>
        {score !== undefined ? (
          <ScoreBar value={score} width={78} color={own ? INK.strong : INK.bar} />
        ) : null}
      </View>
      <Text
        style={{
          ...text.num,
          fontWeight: score !== undefined ? 700 : 400,
          fontSize: score !== undefined ? 8 : 6.6,
          color: score !== undefined ? INK.strong : INK.muted,
          width: 44,
          textAlign: "right",
        }}
      >
        {score !== undefined ? Math.round(score) : missing}
      </Text>
    </View>
  );
}

/* ------------------------------------------------------------------ audit */

/** Area scores and the speed measurements side by side, above the findings. */
function AuditScores({ ctx }: { ctx: PdfContext }) {
  const { blueprint, lang, t } = ctx;
  const audit = blueprint.audit;
  if (!audit?.reachable) return null;
  const ps = audit.pagespeed;
  const areas = [
    {
      key: "performance",
      label: t("Speed", "Viteză"),
      value: audit.scores.performance ?? ps?.performance,
    },
    {
      key: "seo",
      label: t("Google visibility (SEO)", "Vizibilitate în Google"),
      value: audit.scores.seo,
    },
    {
      key: "conversion",
      label: t("Contact and trust", "Contact și încredere"),
      value: audit.scores.conversion,
    },
    {
      key: "security",
      label: t("Security and GDPR", "Securitate și GDPR"),
      value: audit.scores.security,
    },
    {
      key: "accessibility",
      label: t("Accessibility", "Accesibilitate"),
      value: audit.scores.accessibility,
    },
    { key: "content", label: t("Content", "Conținut"), value: audit.scores.content },
  ].filter(
    (area): area is { key: string; label: string; value: number } => typeof area.value === "number",
  );
  const vitals = ps
    ? [
        ps.lcpMs !== undefined
          ? {
              label: t("First screen", "Primul ecran"),
              value: `${formatNumber(ps.lcpMs / 1000, lang, 1)}${NBSP}s`,
              tier: ps.lcpMs <= 2500 ? "ok" : ps.lcpMs <= 4000 ? "warn" : "bad",
              target: t("target: under 2.5 s", "ținta: sub 2,5 s"),
            }
          : null,
        ps.cls !== undefined
          ? {
              label: t("Layout shift", "Stabilitatea paginii"),
              value: formatNumber(Math.round(ps.cls * 100) / 100, lang, 2),
              tier: ps.cls <= 0.1 ? "ok" : ps.cls <= 0.25 ? "warn" : "bad",
              target: t("target: under 0.1", "ținta: sub 0,1"),
            }
          : null,
        ps.tbtMs !== undefined
          ? {
              label: t("Blocked time", "Timp blocat"),
              value: `${formatNumber(Math.round(ps.tbtMs), lang)}${NBSP}ms`,
              tier: ps.tbtMs <= 200 ? "ok" : ps.tbtMs <= 600 ? "warn" : "bad",
              target: t("target: under 200 ms", "ținta: sub 200 ms"),
            }
          : null,
      ].filter((v): v is NonNullable<typeof v> => v !== null)
    : [];
  const tierWord = (tier: string) =>
    tier === "ok"
      ? t("Good", "Bun")
      : tier === "warn"
        ? t("Fair", "Acceptabil")
        : t("Poor", "Slab");
  const overall = scoreTier(audit.scores.overall, lang);
  const barW = COL2 - 104 - 26;

  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between" }} wrap={false}>
      <View style={{ width: COL2 }}>
        <BlockTitle
          rule
          note={t(
            `checked on ${formatDate(audit.fetchedAt, lang)}`,
            `verificat pe ${formatDate(audit.fetchedAt, lang)}`,
          )}
        >
          {t("Website score", "Scorul site-ului")}
        </BlockTitle>
        <View style={{ flexDirection: "row", alignItems: "baseline", marginBottom: 5 }}>
          <Text style={{ ...text.figure, fontSize: 20 }}>
            {Math.round(audit.scores.overall)}
            <Text style={{ fontFamily: FONT.body, fontWeight: 400, fontSize: 8, color: INK.muted }}>
              {` ${t("of 100", "din 100")}`}
            </Text>
          </Text>
          <View style={{ marginLeft: 8 }}>
            <Status tone={overall.tone}>{overall.label}</Status>
          </View>
        </View>
        {areas.map((area) => (
          <View
            key={area.key}
            style={{ flexDirection: "row", alignItems: "center", paddingVertical: 2.6 }}
          >
            <Text style={{ fontFamily: FONT.body, fontSize: 7.4, color: INK.body, width: 104 }}>
              {area.label}
            </Text>
            <ScoreBar value={area.value} width={barW} />
            <Text style={{ ...text.num, fontWeight: 700, width: 26, textAlign: "right" }}>
              {Math.round(area.value)}
            </Text>
          </View>
        ))}
      </View>

      <View style={{ width: COL2 }}>
        <BlockTitle
          rule
          note={
            ps
              ? ps.strategy === "desktop"
                ? "Lighthouse, desktop"
                : t("Lighthouse, mobile", "Lighthouse, mobil")
              : undefined
          }
        >
          {ps?.strategy === "desktop"
            ? t("Speed on a computer", "Viteza pe calculator")
            : t("Speed on a phone", "Viteza pe mobil")}
        </BlockTitle>
        {vitals.length ? (
          vitals.map((v, i) => (
            <View
              key={v.label}
              style={{
                flexDirection: "row",
                alignItems: "center",
                paddingVertical: 4,
                borderBottomWidth: i === vitals.length - 1 ? 0 : 0.5,
                borderBottomColor: INK.hairline,
              }}
            >
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    fontFamily: FONT.body,
                    fontWeight: 500,
                    fontSize: 7.6,
                    color: INK.strong,
                  }}
                >
                  {v.label}
                </Text>
                <Text style={{ ...text.tiny }}>{v.target}</Text>
              </View>
              <Text style={{ ...text.figure, fontSize: 11, width: 56, textAlign: "right" }}>
                {v.value}
              </Text>
              <View style={{ width: 62, paddingLeft: 10 }}>
                <Status tone={v.tier as "ok" | "warn" | "bad"}>{tierWord(v.tier)}</Status>
              </View>
            </View>
          ))
        ) : (
          <Text style={{ ...text.small }}>
            {t(
              "Lighthouse data wasn't available for this scan, so speed is judged from our own checks.",
              "Datele Lighthouse nu au fost disponibile pentru această scanare, așa că viteza e evaluată din verificările noastre.",
            )}
          </Text>
        )}
      </View>
    </View>
  );
}

/** One finding as a table row: priority, the problem with its proof, the fix, the effort. */
function FindingRow({ ctx, finding }: { ctx: PdfContext; finding: AuditFinding }) {
  const { lang, t } = ctx;
  const detail = pick(finding.detail, lang);
  const evidence = finding.evidence ? localizeEvidence(finding.evidence, lang) : null;
  // The proof line only when the detail doesn't already quote the measured value.
  const quoted = evidence?.match(/\d+(?:[.,]\d+)?/)?.[0];
  const showEvidence = Boolean(
    evidence && !(quoted && quoted.length > 1 && detail.includes(quoted)),
  );
  return (
    <View
      wrap={false}
      style={{
        flexDirection: "row",
        paddingVertical: 6,
        borderBottomWidth: 0.5,
        borderBottomColor: INK.hairline,
      }}
    >
      <View style={{ width: 84, paddingTop: 1 }}>
        <Priority level={PRIORITY_OF[finding.severity]}>
          {priorityLabel(finding.severity, lang)}
        </Priority>
      </View>
      <View style={{ flex: 1.15, paddingRight: 12 }}>
        <Text style={{ ...text.h4, fontSize: 8.2 }}>{pick(finding.title, lang)}</Text>
        <Text style={{ ...text.small, marginTop: 1 }}>{detail}</Text>
        {showEvidence && evidence ? (
          <Text style={{ ...text.small, marginTop: 1 }}>
            <Text style={{ color: INK.body }}>{t("What we saw: ", "Ce am văzut: ")}</Text>
            {truncate(evidence, 120)}
          </Text>
        ) : null}
      </View>
      <Text style={{ ...text.small, color: INK.body, flex: 1, paddingRight: 8 }}>
        {pick(finding.recommendation, lang)}
      </Text>
      <Text style={{ ...text.tiny, width: 58, textAlign: "right" }}>
        {effortLabel(finding.effort, lang)}
      </Text>
    </View>
  );
}

export function AuditPage({ ctx }: { ctx: PdfContext }) {
  const { blueprint, lang, t } = ctx;
  const audit = blueprint.audit;
  const findings = priorityFindings(blueprint);
  const shown = findings.slice(0, 8);
  if (!audit) return null;

  return (
    <LightPage ctx={ctx} label={t("Website", "Site")}>
      <SectionTitle
        title={t("What to fix first on your website", "Ce să repari mai întâi pe site")}
        intro={t(
          `We read ${audit.pages.length} page${audit.pages.length === 1 ? "" : "s"} of ${audit.host} on ${formatDate(audit.fetchedAt, lang)} and checked speed, visibility in Google, contact, security and accessibility. Problems are listed from the most urgent.`,
          `Am citit ${audit.pages.length} ${audit.pages.length === 1 ? "pagină" : "pagini"} de pe ${audit.host} pe ${formatDate(audit.fetchedAt, lang)} și am verificat viteza, vizibilitatea în Google, contactul, securitatea și accesibilitatea. Problemele sunt ordonate de la cea mai urgentă.`,
        )}
      />

      <AuditScores ctx={ctx} />

      <View style={{ marginTop: 16 }}>
        <BlockTitle
          rule
          note={
            findings.length
              ? t(
                  `${findings.length} problems`,
                  `${findings.length} ${findings.length === 1 ? "problemă" : "probleme"}`,
                )
              : undefined
          }
        >
          {t("What we found on the website", "Ce am găsit pe site")}
        </BlockTitle>
        {findings.length ? (
          <View>
            <View
              style={{
                flexDirection: "row",
                paddingBottom: 3,
                borderBottomWidth: 0.75,
                borderBottomColor: INK.rule,
              }}
              minPresenceAhead={60}
            >
              <Label style={{ width: 84 }}>{t("Priority", "Prioritate")}</Label>
              <Label style={{ flex: 1.15 }}>{t("Problem", "Problema")}</Label>
              <Label style={{ flex: 1 }}>{t("What we would do", "Ce facem")}</Label>
              <Label style={{ width: 58, textAlign: "right" }}>{t("Effort", "Efort")}</Label>
            </View>
            {shown.map((finding) => (
              <FindingRow key={finding.id} ctx={ctx} finding={finding} />
            ))}
            {findings.length > shown.length ? (
              <Text style={{ ...text.small, marginTop: 4 }}>
                {t(
                  `${findings.length - shown.length} more in the online report.`,
                  `Încă ${findings.length - shown.length} în raportul online.`,
                )}
              </Text>
            ) : null}
          </View>
        ) : (
          <Text style={{ ...text.body }}>
            {t(
              "Our checks didn't find problems that need attention right now.",
              "Verificările noastre nu au găsit probleme care să ceară atenție acum.",
            )}
          </Text>
        )}
      </View>
    </LightPage>
  );
}

/* ---------------------------------------------------------- opportunities */

/** "≈ 2.000 lei, apoi 300 lei pe lună" for one automation. */
function costLine(a: DisplayAutomation, lang: "en" | "ro"): string {
  const once = pick(approxLei(a.setupLei), lang);
  if (!a.toolsLeiPerMonth) return lang === "ro" ? `${once} o singură dată` : `${once} one-off`;
  const monthly = pick(leiPerMonth(a.toolsLeiPerMonth, false), lang);
  return lang === "ro" ? `${once}, apoi ${monthly}` : `${once}, then ${monthly}`;
}

/** "Se plătește în cam 3 luni." when it does within 24 months; the reason otherwise. */
function paybackLine(a: DisplayAutomation, lang: "en" | "ro"): string | null {
  if (a.paybackMonths !== null) {
    const months = monthsQty(a.paybackMonths);
    return lang === "ro"
      ? `Timpul câștigat o plătește în cam ${months.ro}.`
      : `The time won back pays for it in about ${months.en}.`;
  }
  return a.justification ? pick(a.justification, lang) : null;
}

/** Every automation's figures with the totals: the same rows as the plan, never re-rounded. */
function AutomationTable({ ctx }: { ctx: PdfContext }) {
  const { plan, lang, t } = ctx;
  const cols = { phase: 58, hours: 50, setup: 66, tools: 76 };
  const head = { ...text.label, fontSize: 6.8 };
  const tools = plan.automations.reduce((sum, a) => sum + a.toolsLeiPerMonth, 0);
  const setup = plan.automations.reduce((sum, a) => sum + a.setupLei, 0);
  const hours = plan.automations.reduce((sum, a) => sum + a.hoursPerMonth, 0);
  const hoursCell = (value: number) =>
    value === 0 ? "< 5" : `≈${NBSP}${formatNumber(value, lang)}`;
  return (
    <View wrap={false}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "flex-end",
          paddingBottom: 3,
          borderBottomWidth: 0.75,
          borderBottomColor: INK.rule,
        }}
      >
        <Text style={{ ...head, flex: 1 }}>{t("Automation", "Automatizare")}</Text>
        <Text style={{ ...head, width: cols.phase }}>{t("When", "Când")}</Text>
        <Text style={{ ...head, width: cols.hours, textAlign: "right" }}>
          {t("Hours / month", "Ore / lună")}
        </Text>
        <Text style={{ ...head, width: cols.setup, textAlign: "right" }}>
          {t("One-off, RON", "Cost unic, lei")}
        </Text>
        <Text style={{ ...head, width: cols.tools, textAlign: "right" }}>
          {t("Tools / month", "Instrumente / lună")}
        </Text>
      </View>
      {plan.automations.map((a, i) => {
        const phase = plan.phases.find((p) => p.key === a.phase);
        return (
          <View
            key={a.id}
            style={{
              flexDirection: "row",
              alignItems: "center",
              paddingVertical: 3.6,
              borderBottomWidth: 0.5,
              borderBottomColor: INK.hairline,
            }}
          >
            <View style={{ flex: 1, flexDirection: "row", paddingRight: 8 }}>
              <Text
                style={{ fontFamily: FONT.display, fontSize: 7.4, color: INK.muted, width: 11 }}
              >
                {i + 1}
              </Text>
              <Text style={{ fontFamily: FONT.body, fontSize: 7.8, color: INK.strong, flex: 1 }}>
                {pick(a.title, lang)}
              </Text>
            </View>
            <Text style={{ ...text.small, width: cols.phase }}>
              {phase ? pick(phase.dateLabel, lang) : ""}
            </Text>
            <Text style={{ ...text.num, width: cols.hours, textAlign: "right" }}>
              {hoursCell(a.hoursPerMonth)}
            </Text>
            <Text style={{ ...text.num, width: cols.setup, textAlign: "right" }}>
              {formatNumber(a.setupLei, lang)}
            </Text>
            <Text style={{ ...text.num, width: cols.tools, textAlign: "right" }}>
              {a.toolsLeiPerMonth ? formatNumber(a.toolsLeiPerMonth, lang) : "–"}
            </Text>
          </View>
        );
      })}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          paddingVertical: 4,
          borderTopWidth: 0.75,
          borderTopColor: INK.rule,
          marginTop: -0.5,
        }}
      >
        <Text
          style={{
            fontFamily: FONT.body,
            fontWeight: 500,
            fontSize: 7.8,
            color: INK.strong,
            flex: 1,
          }}
        >
          {t("Total", "Total")}
        </Text>
        <Text style={{ width: cols.phase }} />
        <Text style={{ ...text.num, fontWeight: 700, width: cols.hours, textAlign: "right" }}>
          {hoursCell(hours)}
        </Text>
        <Text style={{ ...text.num, fontWeight: 700, width: cols.setup, textAlign: "right" }}>
          {formatNumber(setup, lang)}
        </Text>
        <Text style={{ ...text.num, fontWeight: 700, width: cols.tools, textAlign: "right" }}>
          {formatNumber(tools, lang)}
        </Text>
      </View>
    </View>
  );
}

/** One automation: what changes, what it takes, what it assumes. No box, a hairline above. */
export function AutomationRow({
  ctx,
  automation,
  opportunity,
  index,
}: {
  ctx: PdfContext;
  automation: DisplayAutomation;
  opportunity: AutomationOpportunity;
  index: number;
}) {
  const { lang, t } = ctx;
  const a = automation;
  const o = opportunity;
  const tools = o.tools.map((tool) => localizeTool(tool, lang));
  const payback = paybackLine(a, lang);
  // The hourly rate is note 3 and the page intro; it isn't repeated on every row.
  const assumptions = joinClauses(
    o.assumptions
      .filter((x) => !/^(Loaded staff cost|Staff cost) /.test(x.en))
      .map((x) => localizeMoney(pick(x, lang), lang)),
  );
  return (
    <View
      wrap={false}
      style={{ paddingTop: 7, paddingBottom: 7, borderTopWidth: 0.5, borderTopColor: INK.hairline }}
    >
      <View style={{ flexDirection: "row", alignItems: "baseline" }}>
        <Text style={{ fontFamily: FONT.display, fontSize: 8.6, color: INK.muted, width: 13 }}>
          {index + 1}
        </Text>
        <Text style={{ ...text.h4, flex: 1 }}>{pick(a.title, lang)}</Text>
        <Text style={{ ...text.small, color: INK.strong, marginLeft: 12 }}>
          {a.hoursPerMonth > 0
            ? pick(hoursPerMonth(a.hoursPerMonth), lang)
            : t("under 5 hours a month", "sub 5 ore pe lună")}
        </Text>
        <Text style={{ ...text.small, marginLeft: 12 }}>{costLine(a, lang)}</Text>
      </View>
      <View style={{ flexDirection: "row", marginTop: 3, marginLeft: 13 }}>
        <View style={{ flex: 1, paddingRight: 12 }}>
          <Label>{t("Today", "Acum")}</Label>
          <Text style={{ ...text.small, color: INK.body, marginTop: 1 }}>
            {pick(o.problem, lang)}
          </Text>
        </View>
        <View style={{ flex: 1.2 }}>
          <Label>{t("With the automation", "Cu automatizarea")}</Label>
          <Text style={{ ...text.small, color: INK.strong, marginTop: 1 }}>
            {pick(o.solution, lang)}
          </Text>
        </View>
      </View>
      <Text style={{ ...text.tiny, marginTop: 3, marginLeft: 13 }}>
        {payback ? `${payback} ` : ""}
        {tools.length ? `${t("Tools", "Instrumente")}: ${listOf(tools, lang, 5)}. ` : ""}
        {assumptions ? `${t("Assumptions", "Ipoteze")}: ${assumptions}` : ""}
      </Text>
    </View>
  );
}

/** What can be automated: the table with the totals, then one row per automation. */
export function OpportunitiesSection({ ctx }: { ctx: PdfContext }) {
  const { blueprint, plan, lang, t } = ctx;
  const byId = new Map(blueprint.opportunities.map((o) => [o.id, o]));
  const rows = plan.automations
    .map((a) => ({ a, o: byId.get(a.id) }))
    .filter((row): row is { a: DisplayAutomation; o: AutomationOpportunity } => Boolean(row.o));
  if (!rows.length) return null;
  const type = pick(blueprint.businessType.label, lang).toLowerCase();
  const hourly = plan.totals.hourlyLei;
  const site = plan.totals.siteLei;
  const customers = getBusinessType(blueprint.businessType.id).customers;

  return (
    <View>
      <SectionTitle
        title={t("Where the hours come back", "De unde câștigi timp")}
        intro={t(
          `Each automation has one base estimate, from typical volumes for a ${type} and ${hourly} RON an hour. The figures are the plan's; the assumptions sit under each one.`,
          `Fiecare automatizare are o estimare de bază, din volume obișnuite pentru o afacere ca a ta (${type}) și ${hourly}${NBSP}${roDe(hourly)}lei pe oră. Cifrele sunt cele din plan; ipotezele sunt trecute la fiecare.`,
        )}
      />
      <AutomationTable ctx={ctx} />
      <Text style={{ ...text.tiny, marginTop: 4, marginBottom: 12 }}>
        {pick(plan.text.footer, lang)}
        {site
          ? t(
              ` The website work isn't in this table: it brings ${customers.en}, not hours.`,
              ` Lucrările la site nu sunt în acest tabel: aduc ${customers.ro}, nu ore.`,
            )
          : ""}
      </Text>
      <View style={{ width: CONTENT_WIDTH }}>
        {rows.map(({ a, o }, i) => (
          <AutomationRow key={a.id} ctx={ctx} automation={a} opportunity={o} index={i} />
        ))}
        <View style={{ borderTopWidth: 0.5, borderTopColor: INK.hairline }} />
      </View>
    </View>
  );
}
