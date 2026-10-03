import { Text, View } from "@react-pdf/renderer";

import type { AutomationOpportunity, Severity } from "@/lib/scan/types";

import { Donut, Glow, RangeBar, ScoreBar, SeverityMeter } from "./charts";
import {
  currency,
  formatDate,
  formatDecimal,
  formatInt,
  formatRange,
  fitList,
  midpoint,
  pad2,
  pick,
  roDe,
  truncate,
} from "./format";
import { PdfIcon, type IconName } from "./icons";
import { planOpportunities } from "./estimate";
import { joinClauses, localizeEvidence, localizeMoney, localizeTool } from "./localize";
import {
  BlockTitle,
  Card,
  Chip,
  IconBadge,
  KeyValue,
  Label,
  LightPage,
  Panel,
  SectionTitle,
  type ChipTone,
} from "./layout";
import {
  PLATFORMS,
  SEVERITY_ORDER,
  categoryLabel,
  complexityLabel,
  effortLabel,
  levelLabel,
  platformLabel,
  presenceProfiles,
  priorityFindings,
  severityCounts,
  sectionName,
  severityLabel,
  type PdfContext,
} from "./model";
import {
  BRAND,
  COL2,
  CONTENT_WIDTH,
  FONT,
  GAP,
  INK,
  NIGHT_INK,
  RADIUS,
  SERIES,
  SERIES_OTHER,
  text,
} from "./theme";

/** Severity as a single-hue intensity ramp (darkest = most severe). */
const SEVERITY_COLOR: Record<Severity, string> = {
  critical: BRAND.indigo,
  high: BRAND.violet,
  medium: BRAND.blue,
  low: BRAND.sky,
};

/** Series colour of the n-th opportunity (folded into grey after five). */
const seriesColor = (index: number) => (index < SERIES.length ? SERIES[index] : SERIES_OTHER);

/* --------------------------------------------------------------- snapshot */

type GlanceStat = { value: string; unit: string; note?: string };

/**
 * The record in four numbers, all counted or read from public data: years in
 * business, channels found, what the site offers and how it compares.
 */
function snapshotStats(ctx: PdfContext): GlanceStat[] {
  const { blueprint, lang, t } = ctx;
  const { company, audit, presence } = blueprint;
  const stats: GlanceStat[] = [];

  if (company?.registeredAt) {
    const since = new Date(company.registeredAt).getFullYear();
    const years = new Date(blueprint.generatedAt).getFullYear() - since;
    if (years >= 1) {
      stats.push({
        value: String(years),
        unit: t(
          years === 1 ? "year in business" : "years in business",
          years === 1 ? "an de activitate" : `${roDe(years)}ani de activitate`,
        ),
        note: t(`Registered in ${since}`, `Înființată în ${since}`),
      });
    }
  }

  if (presence?.profiles.length) {
    const found = presence.profiles.filter((p) => p.status !== "missing");
    stats.push({
      value: `${found.length}/${presence.profiles.length}`,
      unit: t("online channels found", "canale online găsite"),
      note: found.length
        ? fitList(
            found.map((p) => platformLabel(p.platform, lang)),
            44,
          )
        : t("None we could verify", "Niciunul verificat"),
    });
  }

  if (audit) {
    const s = audit.signals;
    const checks: Array<[boolean, string]> = [
      [s.hasOnlineBooking, t("online booking", "programare online")],
      [s.hasWhatsApp, "WhatsApp"],
      [s.hasContactForm, t("contact form", "formular de contact")],
      [s.hasLiveChat, t("live chat", "chat pe site")],
      [s.hasCookieConsent, t("cookie consent", "acord cookie")],
      [s.hasStructuredData, t("structured data", "date structurate")],
      [s.hasAnalytics, t("analytics", "statistici")],
      [s.hasPhone, t("phone number", "telefon")],
      [s.hasEmail, "email"],
      [s.hasMarketingPixel, t("ad pixel", "pixel de reclame")],
      [s.hasEcommerce, t("online shop", "magazin online")],
      [s.hasNewsletter, "newsletter"],
      [s.hasBlog, "blog"],
      [Boolean(s.cuiOnSite), t("CUI on site", "CUI pe site")],
    ];
    const missing = checks.filter(([on]) => !on).map(([, label]) => label);
    stats.push({
      value: `${checks.length - missing.length}/${checks.length}`,
      unit: t("site essentials in place", "elemente de bază pe site"),
      note: missing.length
        ? `${t("Missing", "Lipsesc")}: ${fitList(missing, 44 - t("Missing", "Lipsesc").length - 2)}`
        : t("Everything we check for", "Tot ce verificăm"),
    });

    const rivals = (blueprint.competitors ?? [])
      .map((c) => c.websiteScore)
      .filter((score): score is number => score !== undefined);
    const average = rivals.length
      ? Math.round(rivals.reduce((sum, score) => sum + score, 0) / rivals.length)
      : null;
    stats.push({
      value: String(Math.round(audit.scores.overall)),
      unit: t("website score out of 100", "scorul site-ului, din 100"),
      note:
        average !== null
          ? t(
              `Local average ${average} (${rivals.length} site${rivals.length === 1 ? "" : "s"})`,
              `Media locală: ${average} (${rivals.length} ${rivals.length === 1 ? "site" : "site-uri"})`,
            )
          : t(
              `${audit.pages.length} page${audit.pages.length === 1 ? "" : "s"} analysed`,
              `${audit.pages.length} ${audit.pages.length === 1 ? "pagină analizată" : "pagini analizate"}`,
            ),
    });
  } else {
    stats.push({
      value: "–",
      unit: t("no website found", "niciun site găsit"),
      note: t("Nothing to analyse yet", "Încă nu avem ce analiza"),
    });
  }

  const rating = presence?.googleRating;
  if (rating) {
    stats.push({
      value: formatDecimal(rating.rating, lang),
      unit: t("Google rating", "nota pe Google"),
      note: `${formatInt(rating.reviews, lang)} ${t("reviews", `${roDe(rating.reviews)}recenzii`)}`,
    });
  }
  const competitors = blueprint.competitors?.length ?? 0;
  if (competitors) {
    stats.push({
      value: String(competitors),
      unit: t(
        competitors === 1 ? "local competitor" : "local competitors",
        competitors === 1 ? "concurent local" : `${roDe(competitors)}concurenți locali`,
      ),
      note: t("Same activity and area", "Aceeași activitate și zonă"),
    });
  }
  return stats.slice(0, 4);
}

/** Dark strip with the snapshot's key numbers, echoing the summary tiles. */
function GlanceBand({ stats }: { stats: GlanceStat[] }) {
  const h = 58;
  return (
    <View
      wrap={false}
      style={{
        height: h,
        borderRadius: RADIUS.lg,
        backgroundColor: BRAND.night,
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 4,
        marginBottom: 12,
        overflow: "hidden",
        position: "relative",
      }}
    >
      <View style={{ position: "absolute", top: 0, left: 0 }}>
        <Glow
          id="glance-glow"
          width={CONTENT_WIDTH}
          height={h}
          color={BRAND.violet}
          opacity={0.5}
          cx={0.92}
          cy={0}
          r={0.7}
        />
      </View>
      {stats.map((stat, i) => (
        <View
          key={i}
          style={{
            flex: 1,
            paddingHorizontal: 12,
            borderLeftWidth: i ? 0.7 : 0,
            borderLeftColor: NIGHT_INK.hairline,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "baseline" }}>
            <Text style={{ ...text.number, fontSize: 17, color: NIGHT_INK.strong, lineHeight: 1 }}>
              {stat.value}
            </Text>
            <Text
              style={{
                fontFamily: FONT.body,
                fontWeight: 500,
                fontSize: 7,
                color: BRAND.sky,
                marginLeft: 5,
                flex: 1,
              }}
            >
              {stat.unit}
            </Text>
          </View>
          {stat.note ? (
            <Text style={{ ...text.tiny, fontSize: 6.2, color: NIGHT_INK.muted, marginTop: 4 }}>
              {stat.note}
            </Text>
          ) : null}
        </View>
      ))}
    </View>
  );
}

function CardHeader({ icon, title, tag }: { icon: IconName; title: string; tag?: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 5 }}>
      <IconBadge name={icon} size={18} />
      <Text style={{ ...text.h3, marginLeft: 6, flex: 1 }}>{title}</Text>
      {tag ? <Chip label={tag} tone="outline" /> : null}
    </View>
  );
}

export function SnapshotPage({ ctx }: { ctx: PdfContext }) {
  const { blueprint, lang, t } = ctx;
  const company = blueprint.company;
  const audit = blueprint.audit;
  const yes = t("Yes", "Da");
  const no = t("No", "Nu");

  const registry: Array<[string, string | undefined]> = company
    ? [
        [t("Legal name", "Denumire"), truncate(company.name, 64)],
        ["CUI", company.cui],
        [t("Trade Register", "Nr. Reg. Com."), company.regNo],
        [t("Legal form", "Formă juridică"), company.legalForm && truncate(company.legalForm, 48)],
        [
          t("Registered", "Înființată"),
          company.registeredAt
            ? (() => {
                const years =
                  new Date(blueprint.generatedAt).getFullYear() -
                  new Date(company.registeredAt).getFullYear();
                return `${formatDate(company.registeredAt, lang)}${years > 0 ? ` (${years} ${t(years === 1 ? "year" : "years", years === 1 ? "an" : "ani")})` : ""}`;
              })()
            : undefined,
        ],
        [
          t("Activity", "Activitate"),
          company.caen
            ? `CAEN ${company.caen}${company.caenLabel ? `: ${pick(company.caenLabel, lang)}` : ""}`
            : undefined,
        ],
        [t("Address", "Adresă"), company.address && truncate(company.address, 84)],
        [t("Phone", "Telefon"), company.phone],
        [
          t("Status", "Stare"),
          [
            company.inactive === undefined
              ? null
              : company.inactive
                ? t("Inactive", "Inactivă")
                : t("Active", "Activă"),
            company.vatPayer !== undefined
              ? `${t("VAT payer", "Plătitor de TVA")}: ${company.vatPayer ? yes : no}`
              : null,
            company.eInvoice !== undefined ? `e-Factura: ${company.eInvoice ? yes : no}` : null,
          ]
            .filter(Boolean)
            .join(" · ") || undefined,
        ],
      ]
    : [];

  const sources = (company?.sources ?? []).map((s) =>
    s === "anaf"
      ? t("ANAF public API", "API-ul public ANAF")
      : t("Trade Register open data", "Date deschise ONRC"),
  );

  // Without a website the same checks are listed unmarked, as what we'd look for.
  const signals = audit?.signals;
  const signalRows: Array<[string, boolean | undefined]> = [
    [t("Contact form", "Formular de contact"), signals?.hasContactForm],
    [t("Phone number", "Număr de telefon"), signals?.hasPhone],
    [t("Email address", "Adresă de email"), signals?.hasEmail],
    ["WhatsApp", signals?.hasWhatsApp],
    [t("Live chat", "Chat pe site"), signals?.hasLiveChat],
    [t("Online booking", "Programare online"), signals?.hasOnlineBooking],
    [t("Online shop", "Magazin online"), signals?.hasEcommerce],
    [t("Cookie consent", "Acord pentru cookie-uri"), signals?.hasCookieConsent],
    [t("Visitor analytics", "Statistici de trafic"), signals?.hasAnalytics],
    [t("Ad pixel", "Pixel de reclame"), signals?.hasMarketingPixel],
    [t("Structured data", "Date structurate"), signals?.hasStructuredData],
    ["Newsletter", signals?.hasNewsletter],
    ["Blog", signals?.hasBlog],
    [t("CUI shown on site", "CUI afișat pe site"), signals && Boolean(signals.cuiOnSite)],
  ];

  const profiles = presenceProfiles(blueprint);
  const rating = blueprint.presence?.googleRating;
  const competitors = (blueprint.competitors ?? []).slice(0, 4);
  const tileGap = 6;
  const tileW = (CONTENT_WIDTH - tileGap * 5) / 6;
  const glance = snapshotStats(ctx);

  return (
    <LightPage ctx={ctx} label={t("Company", "Compania")}>
      <SectionTitle
        index={ctx.section("snapshot")}
        eyebrow={sectionName("snapshot", lang)}
        title={t("What the public record shows", "Ce arată datele publice")}
        intro={t(
          "Official registry data, your website as a visitor sees it and the channels we could verify. Nothing on this page is estimated.",
          "Datele oficiale din registru, site-ul tău așa cum îl vede un vizitator și canalele pe care le-am putut verifica. Nimic de pe această pagină nu este estimat.",
        )}
      />

      {glance.length >= 3 ? <GlanceBand stats={glance} /> : null}

      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
        <Card style={{ width: COL2 }}>
          <CardHeader
            icon="building"
            title={t("Company registry", "Date din registru")}
            tag={company?.inactive === false ? t("Active", "Activă") : undefined}
          />
          {company ? (
            <View>
              {registry
                .filter((row): row is [string, string] => Boolean(row[1]))
                .map(([label, value]) => (
                  <KeyValue key={label} label={label} value={value} />
                ))}
              {sources.length ? (
                <Text style={{ ...text.tiny, marginTop: 5 }}>
                  {t("Source", "Sursă")}: {sources.join(" · ")}
                </Text>
              ) : null}
            </View>
          ) : (
            <View>
              <Text style={{ ...text.small }}>
                {t(
                  "This scan started from a website, so no registry record is attached. Add your CUI in the online report to include it.",
                  "Scanarea a pornit de la un site, deci nu are atașate datele din registru. Adaugă CUI-ul în raportul online ca să le includem.",
                )}
              </Text>
              <Label style={{ marginTop: 8, marginBottom: 4 }}>
                {t("What the CUI adds", "Ce adaugă CUI-ul")}
              </Label>
              <SignalList
                rows={[
                  [t("Legal name", "Denumirea oficială"), undefined],
                  [t("Legal form", "Forma juridică"), undefined],
                  [t("Years in business", "Vechimea firmei"), undefined],
                  [t("Main activity (CAEN)", "Activitatea (CAEN)"), undefined],
                  [t("Registered address", "Adresa sediului"), undefined],
                  [t("VAT and e-Factura status", "TVA și e-Factura"), undefined],
                  [t("Local competitors", "Concurenți locali"), undefined],
                  [t("Registered phone", "Telefonul din registru"), undefined],
                ]}
              />
            </View>
          )}
        </Card>

        <Card style={{ width: COL2 }}>
          <CardHeader
            icon="globe"
            title={t("Website", "Site")}
            tag={audit ? (audit.https ? "HTTPS" : t("No HTTPS", "Fără HTTPS")) : undefined}
          />
          {audit ? (
            <View>
              <KeyValue
                label={t("Address", "Adresă")}
                value={truncate(audit.finalUrl || audit.url, 56)}
              />
              <KeyValue
                label={t("Status", "Stare")}
                value={
                  audit.reachable
                    ? [
                        t("Online", "Funcțional"),
                        audit.statusCode ? `HTTP ${audit.statusCode}` : null,
                        audit.responseMs !== undefined
                          ? t(
                              `${formatDecimal(audit.responseMs / 1000, lang)} s response`,
                              `răspunde în ${formatDecimal(audit.responseMs / 1000, lang)} s`,
                            )
                          : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")
                    : t("Not reachable when we checked", "Nu a răspuns la verificare")
                }
              />
              <KeyValue
                label={t("Pages analysed", "Pagini analizate")}
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
                  label={t("CUI on site", "CUI pe site")}
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
              <Label style={{ marginTop: 8, marginBottom: 4 }}>
                {t("Technologies detected", "Tehnologii detectate")}
              </Label>
              {audit.technologies.length ? (
                <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
                  {audit.technologies.slice(0, 10).map((tech) => (
                    <Chip
                      key={tech.name}
                      label={tech.name}
                      tone="violet"
                      style={{ marginRight: 4, marginBottom: 4 }}
                    />
                  ))}
                </View>
              ) : (
                <Text style={{ ...text.small }}>
                  {t("None we could recognise.", "Niciuna pe care să o recunoaștem.")}
                </Text>
              )}
            </View>
          ) : (
            <View>
              <Text style={{ ...text.small }}>
                {t(
                  "We couldn't find or reach a website for this business.",
                  "Nu am găsit un site pentru această afacere sau nu am putut să-l accesăm.",
                )}
              </Text>
              <Label style={{ marginTop: 8, marginBottom: 4 }}>
                {t("What we check on a website", "Ce verificăm pe un site")}
              </Label>
              <SignalList rows={signalRows} />
            </View>
          )}
        </Card>
      </View>

      <View style={{ marginTop: 12 }} wrap={false}>
        <BlockTitle
          note={t(
            "Only what we verified. No follower counts we didn't measure.",
            "Doar ce am verificat. Nu afișăm urmăritori pe care nu i-am numărat.",
          )}
        >
          {t("Online presence", "Prezența online")}
        </BlockTitle>
        {profiles.length ? (
          <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
            {profiles.slice(0, 6).map((profile, index) => {
              const meta = PLATFORMS[profile.platform];
              const tone: ChipTone =
                profile.status === "active"
                  ? "mint"
                  : profile.status === "detected"
                    ? "blue"
                    : "outline";
              const status =
                profile.status === "active"
                  ? t("Active", "Activ")
                  : profile.status === "detected"
                    ? t("Detected", "Găsit")
                    : t("Not found", "Lipsă");
              const missing = profile.status === "missing";
              return (
                <View
                  key={profile.platform}
                  style={{
                    width: tileW,
                    marginRight: index % 6 === 5 ? 0 : tileGap,
                    borderRadius: RADIUS.md,
                    backgroundColor: missing ? INK.white : INK.panel,
                    borderWidth: 0.7,
                    borderColor: missing ? INK.hairline : INK.panel,
                    borderStyle: missing ? "dashed" : "solid",
                    padding: 7,
                  }}
                >
                  <View style={{ flexDirection: "row", alignItems: "center" }}>
                    <PdfIcon
                      name={meta.icon}
                      size={8.5}
                      color={missing ? INK.faint : INK.violetText}
                    />
                    <Text
                      style={{
                        fontFamily: FONT.body,
                        fontWeight: 500,
                        fontSize: 7,
                        color: INK.strong,
                        marginLeft: 4,
                        flex: 1,
                      }}
                    >
                      {platformLabel(profile.platform, lang)}
                    </Text>
                  </View>
                  <Chip
                    label={status}
                    tone={tone}
                    style={{ alignSelf: "flex-start", marginTop: 4 }}
                  />
                  {profile.metric ? (
                    <Text style={{ ...text.tiny, marginTop: 3 }}>
                      {pick(profile.metric.label, lang)}: {profile.metric.value}
                    </Text>
                  ) : null}
                </View>
              );
            })}
          </View>
        ) : (
          <Text style={{ ...text.small }}>
            {t(
              "Presence wasn't checked in this scan.",
              "Prezența online nu a fost verificată în această scanare.",
            )}
          </Text>
        )}
        {rating ? (
          <Text style={{ ...text.small, marginTop: 5 }}>
            {t("Google rating", "Nota pe Google")}: {formatDecimal(rating.rating, lang)} ·{" "}
            {formatInt(rating.reviews, lang)} {t("reviews", "recenzii")}
          </Text>
        ) : null}
      </View>

      <View
        style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 12 }}
        wrap={false}
      >
        {audit ? (
          <Card style={{ width: COL2 }}>
            <CardHeader icon="scan" title={t("On-site signals", "Ce are site-ul")} />
            <SignalList rows={signalRows} />
          </Card>
        ) : null}

        <Card style={{ width: audit ? COL2 : CONTENT_WIDTH }}>
          <CardHeader icon="users" title={t("Local competitors", "Concurenți locali")} />
          {audit?.reachable ? (
            <CompetitorRow
              name={t("Your website", "Site-ul tău")}
              sub={audit.host}
              score={audit.scores.overall}
              highlight
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
                  .join(" · ")}
                score={c.websiteScore}
                missing={c.website ? t("not checked", "neverificat") : "–"}
                wide={!audit}
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
          <Text style={{ ...text.tiny, marginTop: 5 }}>
            {t(
              "Same activity and area, from the Trade Register index. Scores are overall website scores.",
              "Aceeași activitate și zonă, din registrul ONRC. Scorurile sunt scorurile generale ale site-urilor.",
            )}
          </Text>
        </Card>
      </View>
    </LightPage>
  );
}

/** Two columns of site checks; an unknown value (no site) gets a neutral marker. */
function SignalList({ rows }: { rows: Array<[string, boolean | undefined]> }) {
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
      {rows.map(([label, on]) => (
        <View
          key={label}
          style={{
            width: "50%",
            flexDirection: "row",
            alignItems: "center",
            paddingVertical: 1.8,
          }}
        >
          <View
            style={{
              width: 10,
              height: 10,
              borderRadius: 5,
              backgroundColor: on ? INK.mintTint : INK.panel,
              alignItems: "center",
              justifyContent: "center",
              marginRight: 5,
            }}
          >
            {on === undefined ? (
              <View
                style={{ width: 3, height: 3, borderRadius: 1.5, backgroundColor: INK.violetText }}
              />
            ) : (
              <PdfIcon
                name={on ? "check" : "x"}
                size={6.5}
                color={on ? INK.mintText : INK.faint}
                strokeWidth={2.6}
              />
            )}
          </View>
          <Text
            style={{
              fontFamily: FONT.body,
              fontSize: 7.2,
              color: on === false ? INK.muted : INK.strong,
            }}
          >
            {label}
          </Text>
        </View>
      ))}
    </View>
  );
}

function CompetitorRow({
  name,
  sub,
  score,
  highlight,
  missing = "–",
  wide,
}: {
  name: string;
  sub?: string;
  score?: number;
  highlight?: boolean;
  missing?: string;
  /** Full-width card: a wider name column and a longer bar. */
  wide?: boolean;
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
      <View style={{ width: wide ? 230 : 118 }}>
        <Text
          style={{
            fontFamily: FONT.body,
            fontWeight: highlight ? 700 : 500,
            fontSize: 7.4,
            color: highlight ? INK.violetText : INK.strong,
          }}
        >
          {truncate(name, wide ? 64 : 32)}
        </Text>
        {sub ? (
          <Text style={{ ...text.tiny, fontSize: 6 }}>{truncate(sub, wide ? 72 : 40)}</Text>
        ) : null}
      </View>
      <View style={{ flex: 1, marginLeft: 6 }}>
        {score !== undefined ? (
          <ScoreBar id={`cmp-${name}`} value={score} width={wide ? 180 : 70} height={5} />
        ) : null}
      </View>
      <Text
        style={{
          fontFamily: FONT.display,
          fontWeight: 700,
          fontSize: score !== undefined ? 8.2 : 6.4,
          color: score !== undefined ? INK.strong : INK.faint,
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

/** Area scores and Core Web Vitals side by side, above the findings. */
function AuditScores({ ctx }: { ctx: PdfContext }) {
  const { blueprint, lang, t } = ctx;
  const audit = blueprint.audit;
  if (!audit) return null;
  const ps = audit.pagespeed;
  const areas: Array<{ key: string; label: string; value: number | undefined }> = [
    { key: "performance", label: t("Performance", "Performanță"), value: audit.scores.performance },
    { key: "seo", label: "SEO", value: audit.scores.seo },
    {
      key: "accessibility",
      label: t("Accessibility", "Accesibilitate"),
      value: audit.scores.accessibility,
    },
    { key: "security", label: t("Security", "Securitate"), value: audit.scores.security },
    { key: "conversion", label: t("Conversion", "Conversie"), value: audit.scores.conversion },
  ];
  const decimals = new Intl.NumberFormat(lang === "ro" ? "ro-RO" : "en-GB", {
    maximumFractionDigits: 2,
  });
  const vitals = ps
    ? [
        ps.lcpMs !== undefined
          ? {
              label: t("Main content shown", "Afișarea conținutului principal"),
              code: "LCP",
              value: `${formatDecimal(ps.lcpMs / 1000, lang)} s`,
              target: t("good: 2.5 s or less", "bine: maximum 2,5 s"),
              good: ps.lcpMs <= 2500,
            }
          : null,
        ps.cls !== undefined
          ? {
              label: t("Layout stability", "Stabilitatea paginii"),
              code: "CLS",
              value: decimals.format(ps.cls),
              target: t("good: 0.1 or less", "bine: maximum 0,1"),
              good: ps.cls <= 0.1,
            }
          : null,
        ps.tbtMs !== undefined
          ? {
              label: t("Blocking time", "Timp de blocare"),
              code: "TBT",
              value: `${Math.round(ps.tbtMs)} ms`,
              target: t("good: 200 ms or less", "bine: maximum 200 ms"),
              good: ps.tbtMs <= 200,
            }
          : null,
      ].filter((v): v is NonNullable<typeof v> => v !== null)
    : [];
  const device = ps?.strategy === "desktop" ? "desktop" : t("mobile", "mobil");
  const leftW = 290;
  const barW = leftW - 24 - 92 - 30;

  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between" }} wrap={false}>
      <Card style={{ width: leftW }}>
        <BlockTitle
          note={`${audit.host} · ${t("checked", "verificat")} ${formatDate(audit.fetchedAt, lang)}`}
        >
          {t("Area by area", "Pe criterii")}
        </BlockTitle>
        {areas.map((area) => (
          <View
            key={area.key}
            style={{ flexDirection: "row", alignItems: "center", paddingVertical: 3.2 }}
          >
            <Text
              style={{
                fontFamily: FONT.body,
                fontWeight: 500,
                fontSize: 7.6,
                color: INK.strong,
                width: 92,
              }}
            >
              {area.label}
            </Text>
            <ScoreBar id={`area-${area.key}`} value={area.value} width={barW} height={5} />
            <Text
              style={{
                fontFamily: FONT.display,
                fontWeight: 700,
                fontSize: area.value === undefined ? 6.2 : 8.4,
                color: area.value === undefined ? INK.faint : INK.strong,
                width: 30,
                textAlign: "right",
              }}
            >
              {area.value === undefined ? t("n/a", "–") : Math.round(area.value)}
            </Text>
          </View>
        ))}
        <Text style={{ ...text.tiny, marginTop: 4 }}>
          {ps
            ? t(
                `Performance from Google Lighthouse (${device}); other areas from our checks on ${audit.pages.length} page${audit.pages.length === 1 ? "" : "s"}.`,
                `Performanța vine din Google Lighthouse (${device}), restul din verificările noastre pe ${audit.pages.length} ${audit.pages.length === 1 ? "pagină" : "pagini"}.`,
              )
            : t(
                `From our checks on ${audit.pages.length} page${audit.pages.length === 1 ? "" : "s"}. Performance needs Google Lighthouse data, which wasn't available.`,
                `Din verificările noastre pe ${audit.pages.length} ${audit.pages.length === 1 ? "pagină" : "pagini"}. Performanța cere date Google Lighthouse, care nu au fost disponibile.`,
              )}
        </Text>
      </Card>

      <Panel style={{ width: CONTENT_WIDTH - leftW - GAP }}>
        <BlockTitle note={ps ? `Lighthouse · ${device}` : undefined}>Core Web Vitals</BlockTitle>
        {vitals.length ? (
          vitals.map((v) => (
            <View
              key={v.code}
              style={{
                flexDirection: "row",
                alignItems: "center",
                backgroundColor: INK.white,
                borderRadius: RADIUS.md,
                paddingVertical: 5,
                paddingHorizontal: 8,
                marginBottom: 4,
              }}
            >
              <Text
                style={{
                  fontFamily: FONT.display,
                  fontWeight: 700,
                  fontSize: 6.4,
                  letterSpacing: 0.8,
                  color: INK.violetText,
                  width: 24,
                }}
              >
                {v.code}
              </Text>
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    fontFamily: FONT.body,
                    fontWeight: 500,
                    fontSize: 7.2,
                    color: INK.strong,
                  }}
                >
                  {v.label}
                </Text>
                <Text style={{ ...text.tiny, fontSize: 6 }}>{v.target}</Text>
              </View>
              <Text style={{ ...text.number, fontSize: 11, marginRight: 5 }}>{v.value}</Text>
              <PdfIcon
                name={v.good ? "check" : "alert"}
                size={9}
                color={v.good ? INK.mintText : INK.violetText}
                strokeWidth={2.4}
              />
            </View>
          ))
        ) : (
          <Text style={{ ...text.small }}>
            {t(
              "Lighthouse data wasn't available for this scan, so speed is judged from our own checks.",
              "Datele Lighthouse nu au fost disponibile pentru această scanare, așa că viteza este evaluată din verificările noastre.",
            )}
          </Text>
        )}
        {ps ? (
          <View style={{ flexDirection: "row", marginTop: 3 }}>
            {[
              { label: t("Performance", "Performanță"), value: ps.performance },
              { label: t("Accessibility", "Accesibilitate"), value: ps.accessibility },
              { label: t("Best practice", "Bune practici"), value: ps.bestPractices },
              { label: "SEO", value: ps.seo },
            ].map((item) => (
              <View key={item.label} style={{ flex: 1 }}>
                <Text style={{ ...text.number, fontSize: 10.5 }}>{Math.round(item.value)}</Text>
                <Text style={{ ...text.tiny, fontSize: 5.6 }}>{item.label}</Text>
              </View>
            ))}
          </View>
        ) : null}
      </Panel>
    </View>
  );
}

export function AuditPage({ ctx }: { ctx: PdfContext }) {
  const { blueprint, lang, t } = ctx;
  const audit = blueprint.audit;
  const findings = priorityFindings(blueprint);
  const counts = severityCounts(findings);
  const shown = findings.slice(0, 5);
  const total = findings.length;
  if (!audit) return null;

  return (
    <LightPage ctx={ctx} label={t("Website", "Site")}>
      <SectionTitle
        index={ctx.section("audit")}
        eyebrow={sectionName("audit", lang)}
        title={t("What to fix first on your website", "Ce să repari mai întâi pe site")}
        intro={t(
          `We read ${audit.pages.length} page${audit.pages.length === 1 ? "" : "s"} of ${audit.host} on ${formatDate(audit.fetchedAt, lang)} and checked speed, SEO, accessibility, security and conversion. Issues are listed from most to least serious.`,
          `Am analizat ${audit.pages.length} ${audit.pages.length === 1 ? "pagină" : "pagini"} de pe ${audit.host} pe ${formatDate(audit.fetchedAt, lang)} și am verificat viteza, SEO, accesibilitatea, securitatea și conversia. Problemele sunt ordonate de la cea mai gravă.`,
        )}
      />

      <AuditScores ctx={ctx} />

      {!total ? (
        <Panel style={{ marginTop: 12 }}>
          <Text style={{ ...text.h3 }}>
            {t("No issues worth flagging", "Nicio problemă de semnalat")}
          </Text>
          <Text style={{ ...text.body, marginTop: 3 }}>
            {t(
              "Our checks didn't find problems that need attention right now.",
              "Verificările noastre nu au găsit probleme care să ceară atenție acum.",
            )}
          </Text>
        </Panel>
      ) : (
        <View>
          <View
            style={{ flexDirection: "row", alignItems: "center", marginTop: 14, marginBottom: 8 }}
            minPresenceAhead={90}
          >
            <Text style={{ ...text.h3, marginRight: 10 }}>
              {t(`${total} issues found`, `${total} ${total === 1 ? "problemă" : "probleme"}`)}
            </Text>
            <View
              style={{
                flexDirection: "row",
                width: 120,
                height: 7,
                borderRadius: 4,
                overflow: "hidden",
                marginRight: 10,
              }}
            >
              {SEVERITY_ORDER.filter((s) => counts[s] > 0).map((s, i, list) => (
                <View
                  key={s}
                  style={{
                    flexGrow: counts[s],
                    backgroundColor: SEVERITY_COLOR[s],
                    marginRight: i < list.length - 1 ? 1.5 : 0,
                  }}
                />
              ))}
            </View>
            {SEVERITY_ORDER.map((s) => (
              <View key={s} style={{ flexDirection: "row", alignItems: "center", marginRight: 10 }}>
                <SeverityMeter severity={s} color={SEVERITY_COLOR[s]} />
                <Text
                  style={{ fontFamily: FONT.body, fontSize: 7, color: INK.muted, marginLeft: 3 }}
                >
                  {severityLabel(s, lang)}{" "}
                  <Text style={{ fontFamily: FONT.display, fontWeight: 700, color: INK.strong }}>
                    {counts[s]}
                  </Text>
                </Text>
              </View>
            ))}
          </View>

          {shown.map((finding, index) => (
            <View
              key={finding.id}
              wrap={false}
              style={{
                flexDirection: "row",
                borderWidth: 0.7,
                borderColor: INK.hairline,
                borderRadius: RADIUS.lg,
                marginBottom: 6,
              }}
            >
              <View
                style={{
                  width: 92,
                  paddingVertical: 9,
                  paddingHorizontal: 10,
                  borderRightWidth: 0.7,
                  borderRightColor: INK.hairline,
                  backgroundColor: INK.panel,
                  borderTopLeftRadius: RADIUS.lg,
                  borderBottomLeftRadius: RADIUS.lg,
                }}
              >
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  <Text
                    style={{
                      fontFamily: FONT.display,
                      fontWeight: 700,
                      fontSize: 12,
                      color: SEVERITY_COLOR[finding.severity],
                      marginRight: 6,
                    }}
                  >
                    {pad2(index + 1)}
                  </Text>
                  <SeverityMeter
                    severity={finding.severity}
                    color={SEVERITY_COLOR[finding.severity]}
                  />
                </View>
                <Text
                  style={{
                    fontFamily: FONT.body,
                    fontWeight: 700,
                    fontSize: 7.2,
                    color: INK.strong,
                    marginTop: 4,
                  }}
                >
                  {severityLabel(finding.severity, lang)}
                </Text>
                <Text style={{ ...text.tiny, fontSize: 6.2 }}>
                  {categoryLabel(finding.category, lang)}
                </Text>
                <Chip
                  label={effortLabel(finding.effort, lang)}
                  tone={finding.effort === "quick" ? "mint" : "outline"}
                  style={{ alignSelf: "flex-start", marginTop: 4 }}
                />
              </View>
              <View style={{ flex: 1, paddingVertical: 9, paddingHorizontal: 11 }}>
                <Text style={{ ...text.h3, fontSize: 9.6 }}>{pick(finding.title, lang)}</Text>
                <Text style={{ ...text.body, fontSize: 7.8, marginTop: 2 }}>
                  {pick(finding.detail, lang)}
                </Text>
                {finding.evidence ? (
                  <View style={{ flexDirection: "row", alignItems: "center", marginTop: 3 }}>
                    <PdfIcon name="scan" size={7} color={INK.faint} />
                    <Text style={{ ...text.tiny, fontSize: 6.2, marginLeft: 4, color: INK.muted }}>
                      {t("Evidence", "Detaliu tehnic")}:{" "}
                      {truncate(localizeEvidence(finding.evidence, lang), 110)}
                    </Text>
                  </View>
                ) : null}
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "flex-start",
                    marginTop: 5,
                    backgroundColor: INK.violetTint,
                    borderRadius: RADIUS.sm,
                    paddingVertical: 4,
                    paddingHorizontal: 6,
                  }}
                >
                  <View style={{ marginTop: 1.1, marginRight: 5 }}>
                    <PdfIcon
                      name="arrowRight"
                      size={7.5}
                      color={INK.violetText}
                      strokeWidth={2.4}
                    />
                  </View>
                  <Text
                    style={{
                      fontFamily: FONT.body,
                      fontWeight: 500,
                      fontSize: 7.5,
                      lineHeight: 1.38,
                      color: INK.strong,
                      flex: 1,
                    }}
                  >
                    {pick(finding.recommendation, lang)}
                  </Text>
                </View>
              </View>
            </View>
          ))}
          {total > shown.length ? (
            <Text style={{ ...text.small, marginTop: 1 }}>
              {t(
                `+ ${total - shown.length} more finding${total - shown.length === 1 ? "" : "s"} in your online report.`,
                `+ încă ${total - shown.length} ${total - shown.length === 1 ? "problemă" : "probleme"} în raportul online.`,
              )}
            </Text>
          ) : null}
        </View>
      )}
    </LightPage>
  );
}

/* ---------------------------------------------------------- opportunities */

/** One line of an opportunity's numbers: label left, value and unit right. */
function Metric({
  label,
  value,
  unit,
  accent,
  last,
}: {
  label: string;
  value: string;
  unit: string;
  accent?: boolean;
  last?: boolean;
}) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "baseline",
        paddingVertical: 2.2,
        borderBottomWidth: last ? 0 : 0.5,
        borderBottomColor: INK.hairline,
      }}
    >
      <Label style={{ flex: 1, letterSpacing: 0.5 }}>{label}</Label>
      <Text
        style={{
          ...text.number,
          fontSize: 8.8,
          color: accent ? INK.violetText : INK.strong,
        }}
      >
        {value}
      </Text>
      <Text style={{ ...text.tiny, fontSize: 5.8, width: 33, marginLeft: 3 }}>{unit}</Text>
    </View>
  );
}

export function OpportunityCard({
  ctx,
  opportunity,
  index,
  breakBefore,
}: {
  ctx: PdfContext;
  opportunity: AutomationOpportunity;
  index: number;
  breakBefore?: boolean;
}) {
  const { lang, t } = ctx;
  const o = opportunity;
  const money = currency(lang);
  const impactTone: ChipTone =
    o.impact === "high" ? "violet" : o.impact === "medium" ? "blue" : "neutral";
  const color = seriesColor(index);
  return (
    <View
      wrap={false}
      break={breakBefore}
      style={{
        borderWidth: 0.7,
        borderColor: INK.hairline,
        borderRadius: RADIUS.lg,
        paddingVertical: 9,
        paddingHorizontal: 10,
        marginBottom: 6,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        <View
          style={{
            width: 18,
            height: 18,
            borderRadius: 9,
            borderWidth: 2,
            borderColor: color,
            alignItems: "center",
            justifyContent: "center",
            marginRight: 7,
          }}
        >
          <Text
            style={{ fontFamily: FONT.display, fontWeight: 700, fontSize: 6.4, color: INK.strong }}
          >
            {pad2(index + 1)}
          </Text>
        </View>
        <Text style={{ ...text.h2, fontSize: 10.5, flex: 1 }}>{pick(o.title, lang)}</Text>
        <Chip
          label={t(
            `${levelLabel(o.impact, "en")} impact`,
            `Impact ${levelLabel(o.impact, "ro").toLowerCase()}`,
          )}
          tone={impactTone}
          style={{ marginLeft: 6 }}
        />
        <Chip
          label={t(
            `${complexityLabel(o.complexity, "en")} complexity`,
            `Complexitate ${complexityLabel(o.complexity, "ro").toLowerCase()}`,
          )}
          tone="outline"
          style={{ marginLeft: 4 }}
        />
      </View>

      <View style={{ flexDirection: "row", marginTop: 6 }}>
        <View style={{ flex: 1, paddingRight: 12 }}>
          <View style={{ flexDirection: "row" }}>
            <View style={{ flex: 1 }}>
              <Label>{t("Today", "Acum")}</Label>
              <Text style={{ ...text.body, fontSize: 7.4, lineHeight: 1.38, marginTop: 1 }}>
                {pick(o.problem, lang)}
              </Text>
            </View>
            <View style={{ width: 18, alignItems: "center", paddingTop: 8 }}>
              <PdfIcon name="arrowRight" size={8.5} color={BRAND.violet} />
            </View>
            <View style={{ flex: 1.25 }}>
              <Label color={INK.violetText}>{t("With automation", "Cu automatizare")}</Label>
              <Text
                style={{
                  ...text.body,
                  fontSize: 7.4,
                  lineHeight: 1.38,
                  marginTop: 1,
                  color: INK.strong,
                }}
              >
                {pick(o.solution, lang)}
              </Text>
            </View>
          </View>
          <Text style={{ ...text.tiny, fontSize: 6.2, marginTop: 4 }}>
            {o.tools.length ? (
              <Text style={{ color: INK.body }}>
                {o.tools
                  .slice(0, 5)
                  .map((tool) => localizeTool(tool, lang))
                  .join(" · ")}
                {t(
                  ` (tools ${formatRange(o.monthlyToolCostRon, lang)} RON / month). `,
                  ` (aplicații: ${formatRange(o.monthlyToolCostRon, lang)} lei / lună). `,
                )}
              </Text>
            ) : null}
            {o.assumptions.length ? (
              <>
                <Text style={{ fontFamily: FONT.body, fontWeight: 700, color: INK.muted }}>
                  {t("Assumptions", "Ipoteze")}:{" "}
                </Text>
                {joinClauses(o.assumptions.map((a) => localizeMoney(pick(a, lang), lang)))}
              </>
            ) : null}
          </Text>
        </View>

        <View
          style={{
            width: 176,
            backgroundColor: INK.panel,
            borderRadius: RADIUS.md,
            paddingVertical: 2,
            paddingHorizontal: 8,
            alignSelf: "flex-start",
          }}
        >
          <Metric
            label={t("Time back", "Timp câștigat")}
            value={formatRange(o.hoursSavedPerMonth, lang)}
            unit={t("h / month", "ore / lună")}
            accent
          />
          <Metric
            label={t("Savings", "Economii")}
            value={formatRange(o.monthlySavingsRon, lang)}
            unit={`${money} / ${t("mo", "lună")}`}
            accent
          />
          <Metric
            label={t("Setup", "Implementare")}
            value={formatRange(o.setupCostRon, lang)}
            unit={t("RON once", "lei, o dată")}
          />
          <Metric
            label={t("Payback", "Recuperare")}
            value={formatRange(o.paybackMonths, lang, formatDecimal)}
            unit={t("months", "luni")}
            last
          />
        </View>
      </View>
    </View>
  );
}

/** Donut of hours per opportunity, with the total in the hole and a numbered key. */
function HoursDonut({ ctx, width }: { ctx: PdfContext; width: number }) {
  const { blueprint, lang, t } = ctx;
  const opportunities = blueprint.opportunities;
  const sliceCount = Math.min(opportunities.length, SERIES.length);
  const folded = opportunities.slice(sliceCount);
  const slices = [
    ...opportunities
      .slice(0, sliceCount)
      .map((o, i) => ({ value: midpoint(o.hoursSavedPerMonth), color: SERIES[i] })),
    ...(folded.length
      ? [
          {
            value: folded.reduce((sum, o) => sum + midpoint(o.hoursSavedPerMonth), 0),
            color: SERIES_OTHER,
          },
        ]
      : []),
  ];
  return (
    <Panel style={{ width, alignItems: "center" }}>
      <Text style={{ ...text.h3, alignSelf: "flex-start" }}>
        {t("Hours back", "Ore câștigate")}
      </Text>
      <Text style={{ ...text.tiny, alignSelf: "flex-start", marginTop: 1, marginBottom: 6 }}>
        {t("Per month, by opportunity", "Pe lună, pe procese")}
      </Text>
      <Donut slices={slices} size={78} thickness={11}>
        <Text style={{ ...text.number, fontSize: 12.5 }}>
          {formatRange(blueprint.totals.hoursSavedPerMonth, lang)}
        </Text>
        <Text style={{ ...text.tiny, fontSize: 6 }}>{t("hours / month", "ore / lună")}</Text>
      </Donut>
      <View
        style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "center", marginTop: 7 }}
      >
        {opportunities.map((o, i) => (
          <View
            key={o.id}
            style={{
              flexDirection: "row",
              alignItems: "center",
              marginHorizontal: 3,
              marginBottom: 2,
            }}
          >
            <View
              style={{
                width: 6,
                height: 6,
                borderRadius: 1.5,
                backgroundColor: seriesColor(i),
                marginRight: 2.5,
              }}
            />
            <Text
              style={{ fontFamily: FONT.display, fontWeight: 500, fontSize: 6, color: INK.muted }}
            >
              {pad2(i + 1)}
            </Text>
          </View>
        ))}
      </View>
    </Panel>
  );
}

const LEVELS = ["low", "medium", "high"] as const;

/**
 * Where each numbered marker sits in a matrix cell, so any count fits: up to
 * three in a row (the third overlapping like stacked avatars, numbers still
 * clear), more as two smaller rows.
 */
function markerLayout(count: number, cellW: number, cellH: number) {
  const rows = count > 3 ? 2 : 1;
  const size = rows === 2 ? 8.6 : count === 3 ? 12 : 13;
  const perRow = Math.ceil(count / rows);
  const room = cellW - 2;
  const step = perRow > 1 ? Math.min(size + 1.6, (room - size) / (perRow - 1)) : 0;
  const rowGap = 1;
  const top0 = (cellH - (rows * size + (rows - 1) * rowGap)) / 2;
  return {
    size,
    fontSize: rows === 2 ? 3.9 : count === 3 ? 4.9 : 5.2,
    border: rows === 1 ? 1.5 : 1.1,
    at: (k: number) => {
      const row = Math.floor(k / perRow);
      const inRow = row === rows - 1 ? count - perRow * row : perRow;
      const left0 = (cellW - (size + (inRow - 1) * step)) / 2;
      return { left: left0 + (k % perRow) * step, top: top0 + row * (size + rowGap) };
    },
  };
}

/** Impact × complexity grid with each opportunity's number in its cell. */
function PriorityMatrix({ ctx, width }: { ctx: PdfContext; width: number }) {
  const { blueprint, t } = ctx;
  const axisW = 20;
  const cellW = (width - 24 - axisW) / 3;
  const cellH = 20;
  const impactAxis = { low: t("Low", "Mic"), medium: t("Med", "Mediu"), high: t("High", "Mare") };
  const complexityAxis = {
    low: t("Low", "Mică"),
    medium: t("Med", "Medie"),
    high: t("High", "Mare"),
  };
  return (
    <Panel style={{ width }}>
      <Text style={{ ...text.h3 }}>{t("Where to start", "De unde începi")}</Text>
      <Text style={{ ...text.tiny, marginTop: 1, marginBottom: 6 }}>
        {t("Impact against complexity", "Impact față de complexitate")}
      </Text>
      {[...LEVELS].reverse().map((impact) => (
        <View key={impact} style={{ flexDirection: "row", alignItems: "center" }}>
          <Text style={{ ...text.tiny, fontSize: 5.6, width: axisW }}>{impactAxis[impact]}</Text>
          {LEVELS.map((complexity) => {
            const best = impact === "high" && complexity === "low";
            const items = blueprint.opportunities
              .map((o, i) => ({ o, i }))
              .filter(({ o }) => o.impact === impact && o.complexity === complexity);
            // Absolute offsets start inside the 0.6 pt border.
            const marker = markerLayout(items.length, cellW - 1.2, cellH - 1.2);
            return (
              <View
                key={complexity}
                style={{
                  width: cellW,
                  height: cellH,
                  borderWidth: 0.6,
                  borderColor: INK.hairline,
                  marginLeft: -0.6,
                  marginTop: -0.6,
                  backgroundColor: best ? INK.mintTint : INK.white,
                }}
              >
                {items.map(({ o, i }, k) => (
                  <View
                    key={o.id}
                    style={{
                      position: "absolute",
                      ...marker.at(k),
                      width: marker.size,
                      height: marker.size,
                      borderRadius: marker.size / 2,
                      borderWidth: marker.border,
                      borderColor: seriesColor(i),
                      backgroundColor: INK.white,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Text
                      style={{
                        fontFamily: FONT.display,
                        fontWeight: 700,
                        fontSize: marker.fontSize,
                        color: INK.strong,
                      }}
                    >
                      {pad2(i + 1)}
                    </Text>
                  </View>
                ))}
              </View>
            );
          })}
        </View>
      ))}
      <View style={{ flexDirection: "row", marginLeft: axisW, marginTop: 3 }}>
        {LEVELS.map((level) => (
          <Text
            key={level}
            style={{ ...text.tiny, fontSize: 5.6, width: cellW, textAlign: "center" }}
          >
            {complexityAxis[level]}
          </Text>
        ))}
      </View>
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          marginLeft: axisW,
          marginTop: 3,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <View
            style={{
              width: 6,
              height: 6,
              borderRadius: 1,
              backgroundColor: INK.mintTint,
              borderWidth: 0.6,
              borderColor: INK.mintText,
              marginRight: 3,
            }}
          />
          <Text style={{ ...text.tiny, fontSize: 5.6, color: INK.mintText }}>
            {t("Do first", "Prioritar")}
          </Text>
        </View>
        <Text style={{ ...text.tiny, fontSize: 5.6 }}>{t("Complexity", "Complexitate")} →</Text>
      </View>
      <Text style={{ ...text.tiny, fontSize: 5.6, position: "absolute", top: 12, right: 12 }}>
        ↑ Impact
      </Text>
    </Panel>
  );
}

/** Opportunities ordered by how fast they pay back, on one month scale. */
function PaybackRanking({ ctx, width }: { ctx: PdfContext; width: number }) {
  const { blueprint, lang, t } = ctx;
  const ranked = blueprint.opportunities
    .map((o, i) => ({ o, i, color: seriesColor(i) }))
    .sort((a, b) => midpoint(a.o.paybackMonths) - midpoint(b.o.paybackMonths));
  const max = Math.ceil(Math.max(1, ...ranked.map(({ o }) => o.paybackMonths.high)));
  const valueW = 46;
  const barW = width - 24 - 12 - valueW - 4;
  const step = max <= 8 ? 1 : max <= 16 ? 2 : Math.ceil(max / 8);
  const ticks = Array.from({ length: Math.floor(max / step) + 1 }, (_, i) => i * step);
  return (
    <Panel style={{ width }}>
      <Text style={{ ...text.h3 }}>{t("Fastest to pay back", "Ce se amortizează mai repede")}</Text>
      <Text style={{ ...text.tiny, marginTop: 1, marginBottom: 5 }}>
        {t("Payback in months, on one scale", "Recuperarea investiției în luni, pe aceeași scară")}
      </Text>
      {ranked.slice(0, 6).map(({ o, i, color }) => (
        <View key={o.id} style={{ paddingVertical: 1.4 }}>
          <View style={{ flexDirection: "row", alignItems: "baseline" }}>
            <Text
              style={{
                fontFamily: FONT.display,
                fontWeight: 700,
                fontSize: 6,
                color: INK.faint,
                width: 12,
              }}
            >
              {pad2(i + 1)}
            </Text>
            <Text
              style={{
                fontFamily: FONT.body,
                fontWeight: 500,
                fontSize: 7,
                color: INK.strong,
                flex: 1,
              }}
            >
              {truncate(pick(o.title, lang), 52)}
            </Text>
          </View>
          <View
            style={{ flexDirection: "row", alignItems: "center", marginTop: 1.5, marginLeft: 12 }}
          >
            <RangeBar range={o.paybackMonths} max={max} width={barW} color={color} />
            <Text
              style={{
                fontFamily: FONT.display,
                fontWeight: 500,
                fontSize: 6.8,
                color: INK.strong,
                width: valueW,
                textAlign: "right",
              }}
            >
              {formatRange(o.paybackMonths, lang, formatDecimal)} {t("mo", "luni")}
            </Text>
          </View>
        </View>
      ))}
      <View style={{ marginLeft: 12, width: barW, height: 8, marginTop: 2, position: "relative" }}>
        {ticks.map((tick) => (
          <Text
            key={tick}
            style={{
              ...text.tiny,
              fontSize: 5.6,
              position: "absolute",
              top: 0,
              left: (barW * tick) / max - 8,
              width: 16,
              textAlign: "center",
            }}
          >
            {tick}
          </Text>
        ))}
      </View>
    </Panel>
  );
}

/**
 * Every opportunity's numbers in one table with the plan totals. Shown when
 * the cards run onto a second page and the table fits under the last card,
 * so that page closes with the sum (see planOpportunities).
 */
export function OpportunityTotals({ ctx }: { ctx: PdfContext }) {
  const { blueprint, lang, t } = ctx;
  const { totals } = blueprint;
  const money = currency(lang);
  const cols = [
    { label: t("Time back, h / month", "Timp câștigat, ore / lună"), w: 88 },
    { label: t(`Savings, ${money} / month`, `Economii, ${money} / lună`), w: 88 },
    { label: t(`Setup, ${money} once`, `Implementare, ${money}`), w: 84 },
    { label: t("Payback, months", "Recuperare, luni"), w: 66 },
  ];
  const numberStyle = (bold: boolean) => ({
    fontFamily: FONT.display,
    fontWeight: bold ? 700 : 500,
    fontSize: bold ? 8.4 : 7.6,
    color: INK.strong,
    textAlign: "right" as const,
  });
  const row = (values: string[], bold: boolean) =>
    values.map((value, i) => (
      <Text key={i} style={{ ...numberStyle(bold), width: cols[i].w }}>
        {value}
      </Text>
    ));
  return (
    <View wrap={false} style={{ marginTop: 8 }}>
      <BlockTitle
        note={t(
          "Estimates. Totals add the cautious ends together and the optimistic ends together.",
          "Estimări. Totalurile adună separat valorile prudente și pe cele optimiste.",
        )}
      >
        {t("All opportunities together", "Toate automatizările, la un loc")}
      </BlockTitle>
      <View
        style={{
          flexDirection: "row",
          paddingBottom: 4,
          borderBottomWidth: 0.7,
          borderBottomColor: INK.hairline,
        }}
      >
        <Label style={{ flex: 1 }}>{t("Opportunity", "Automatizare")}</Label>
        {cols.map((col) => (
          <Label key={col.label} style={{ width: col.w, textAlign: "right" }}>
            {col.label}
          </Label>
        ))}
      </View>
      {blueprint.opportunities.map((o, i) => (
        <View
          key={o.id}
          style={{
            flexDirection: "row",
            alignItems: "center",
            paddingVertical: 3.6,
            borderBottomWidth: 0.5,
            borderBottomColor: INK.hairline,
          }}
        >
          <View style={{ flex: 1, flexDirection: "row", alignItems: "center", paddingRight: 8 }}>
            <View
              style={{
                width: 6,
                height: 6,
                borderRadius: 1.5,
                backgroundColor: seriesColor(i),
                marginRight: 5,
              }}
            />
            <Text
              style={{
                fontFamily: FONT.display,
                fontWeight: 700,
                fontSize: 6.4,
                color: INK.faint,
                width: 13,
              }}
            >
              {pad2(i + 1)}
            </Text>
            <Text
              style={{ fontFamily: FONT.body, fontWeight: 500, fontSize: 7.6, color: INK.strong }}
            >
              {truncate(pick(o.title, lang), 58)}
            </Text>
          </View>
          {row(
            [
              formatRange(o.hoursSavedPerMonth, lang),
              formatRange(o.monthlySavingsRon, lang),
              formatRange(o.setupCostRon, lang),
              formatRange(o.paybackMonths, lang, formatDecimal),
            ],
            false,
          )}
        </View>
      ))}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          paddingVertical: 5,
          paddingHorizontal: 6,
          marginTop: 3,
          backgroundColor: INK.violetTint,
          borderRadius: RADIUS.sm,
        }}
      >
        <Text style={{ flex: 1, ...text.h3, fontSize: 8.6 }}>{t("Whole plan", "Tot planul")}</Text>
        {row(
          [
            formatRange(totals.hoursSavedPerMonth, lang),
            formatRange(totals.monthlySavingsRon, lang),
            formatRange(totals.setupCostRon, lang),
            formatRange(totals.paybackMonths, lang, formatDecimal),
          ],
          true,
        )}
      </View>
    </View>
  );
}

/** Section title and the chart row above the first opportunity card. */
export function OpportunityHead({ ctx }: { ctx: PdfContext }) {
  const { blueprint, lang, t } = ctx;
  const donutW = 128;
  const matrixW = 150;
  const rankW = CONTENT_WIDTH - donutW - matrixW - GAP * 2;
  return (
    <>
      <SectionTitle
        index={ctx.section("opportunities")}
        eyebrow={sectionName("opportunities", lang)}
        title={t("Where the hours come back", "De unde câștigi timp")}
        intro={t(
          `Each opportunity is sized as a range from typical volumes for a ${pick(blueprint.businessType.label, "en").toLowerCase()} and a staff cost of ${blueprint.assumptions.hourlyCostRon} RON an hour. The assumptions sit under each card.`,
          `Fiecare estimare este un interval, calculat din volume obișnuite pentru o afacere ca a ta (${pick(blueprint.businessType.label, "ro").toLowerCase()}) și un cost al muncii de ${blueprint.assumptions.hourlyCostRon} ${roDe(blueprint.assumptions.hourlyCostRon)}lei pe oră. Ipotezele sunt trecute la fiecare proces.`,
        )}
      />

      <View
        wrap={false}
        style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 12 }}
      >
        <HoursDonut ctx={ctx} width={donutW} />
        <PaybackRanking ctx={ctx} width={rankW} />
        <PriorityMatrix ctx={ctx} width={matrixW} />
      </View>
    </>
  );
}

export function OpportunitiesPage({ ctx }: { ctx: PdfContext }) {
  const { blueprint, t } = ctx;
  const opportunities = blueprint.opportunities;
  if (!opportunities.length) return null;
  const plan = planOpportunities(ctx);

  return (
    <LightPage ctx={ctx} label={t("Automation", "Automatizări")}>
      <OpportunityHead ctx={ctx} />

      {opportunities.map((o, i) => (
        <OpportunityCard
          key={o.id}
          ctx={ctx}
          opportunity={o}
          index={i}
          breakBefore={i > 0 && i === plan.breakBefore}
        />
      ))}

      {plan.totals ? <OpportunityTotals ctx={ctx} /> : null}
    </LightPage>
  );
}
