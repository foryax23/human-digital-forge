import { Defs, Image, LinearGradient, Rect, Stop, Svg, Text, View } from "@react-pdf/renderer";

import { LOGO_RATIO } from "./assets";
import { displayHost, formatDate, hoursPerMonth, monthsQty, pick } from "./format";
import {
  BlockTitle,
  DarkPage,
  Label,
  Layer,
  LightPage,
  Logo,
  NoteRef,
  SectionTitle,
  StatRow,
  Status,
  Tag,
  type StatCell,
} from "./layout";
import {
  effortLabel,
  hasImpact,
  kpiStat,
  planSpan,
  priorityFindings,
  scoreTier,
  type PdfContext,
} from "./model";
import { BRAND, COL2, COL3, CONTACT, FONT, GAP, INK, NIGHT_INK, PAGE, SPACE, text } from "./theme";

/* ------------------------------------------------------------------- cover */

/** Night fade over the cover art so the text block always reads. */
function CoverShade() {
  return (
    <Svg width={PAGE.width} height={PAGE.height} viewBox={`0 0 ${PAGE.width} ${PAGE.height}`}>
      <Defs>
        <LinearGradient id="cover-shade" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={BRAND.night} stopOpacity={0.35} />
          <Stop offset="0.1" stopColor={BRAND.night} stopOpacity={0} />
          <Stop offset="0.5" stopColor={BRAND.night} stopOpacity={0} />
          <Stop offset="0.74" stopColor={BRAND.night} stopOpacity={0.85} />
          <Stop offset="1" stopColor={BRAND.night} stopOpacity={0.97} />
        </LinearGradient>
      </Defs>
      <Rect x={0} y={0} width={PAGE.width} height={PAGE.height} fill="url(#cover-shade)" />
    </Svg>
  );
}

const COUNT_RO: Record<number, string> = {
  1: "o direcție",
  2: "două direcții",
  3: "trei direcții",
};
const COUNT_EN: Record<number, string> = {
  1: "one direction",
  2: "two directions",
  3: "three directions",
};

export function CoverPage({ ctx }: { ctx: PdfContext }) {
  const { blueprint, lang, t, name, assets, plan } = ctx;
  const span = monthsQty(planSpan(plan));
  const nameSize = name.length <= 18 ? 38 : name.length <= 28 ? 32 : name.length <= 42 ? 26 : 21;
  const host = displayHost(blueprint.company?.website || blueprint.audit?.finalUrl);
  const logoH = 280 / LOGO_RATIO.wordmark;
  const count = plan.strategies.length;
  const place = [pick(blueprint.businessType.label, lang), blueprint.company?.city]
    .filter(Boolean)
    .join(", ");
  const meta = [
    {
      label: t("Business type", "Tip de afacere"),
      value: pick(blueprint.businessType.label, lang),
    },
    host ? { label: t("Website", "Site"), value: host } : null,
    blueprint.company?.cui
      ? { label: t("Tax code (CUI)", "Cod fiscal (CUI)"), value: blueprint.company.cui }
      : null,
    { label: t("Date", "Data"), value: formatDate(blueprint.generatedAt, lang) },
  ].filter((item): item is { label: string; value: string } => item !== null);

  return (
    <DarkPage ctx={ctx} chrome={false}>
      <Layer>
        <Image
          src={assets.coverArt}
          style={{ width: PAGE.width, height: PAGE.height, objectFit: "cover" }}
        />
      </Layer>
      <Layer>
        <CoverShade />
      </Layer>

      {/* Both on the left: the swirl fills the top right and would swallow the e-mail. */}
      <View style={{ position: "absolute", top: 32, left: SPACE.gutter, flexDirection: "row" }}>
        <Text
          style={{ fontFamily: FONT.body, fontWeight: 500, fontSize: 7.5, color: NIGHT_INK.body }}
        >
          {CONTACT.site}
        </Text>
        <Text
          style={{ fontFamily: FONT.body, fontSize: 7.5, color: NIGHT_INK.muted, marginLeft: 14 }}
        >
          {CONTACT.email}
        </Text>
      </View>

      {/* The wordmark sits in the dark space under the swirl, aligned with the text block. */}
      <View style={{ position: "absolute", left: SPACE.gutter - 4, top: 400 }}>
        <Logo src={assets.wordmark} ratio={LOGO_RATIO.wordmark} height={logoH} />
      </View>

      <View style={{ position: "absolute", left: SPACE.gutter, right: SPACE.gutter, bottom: 44 }}>
        <Text
          style={{ fontFamily: FONT.display, fontWeight: 500, fontSize: 12, color: NIGHT_INK.body }}
        >
          {t(`Analysis and ${span.en} plan for`, `Analiză și plan pe ${span.ro} pentru`)}
        </Text>
        <Text
          style={{
            fontFamily: FONT.display,
            fontWeight: 700,
            fontSize: nameSize,
            lineHeight: 1.06,
            color: NIGHT_INK.strong,
            maxWidth: 480,
            marginTop: 6,
          }}
        >
          {name}
        </Text>
        {place ? (
          <Text
            style={{ fontFamily: FONT.body, fontSize: 10, color: NIGHT_INK.body, marginTop: 8 }}
          >
            {place}
          </Text>
        ) : null}
        <Text style={{ ...text.lead, color: NIGHT_INK.muted, marginTop: 8, maxWidth: 380 }}>
          {t(
            `What the public data shows, ${COUNT_EN[count] ?? `${count} directions`} and the plan month by month, with the hours won back and the cost of each stage.`,
            `Ce arată datele publice, ${COUNT_RO[count] ?? `${count} direcții`} de lucru și planul lună de lună, cu orele câștigate și costul fiecărei etape.`,
          )}
        </Text>
        {ctx.sample ? (
          <Tag variant="dashed" dark style={{ marginTop: 10 }}>
            {t("Sample data", "Date de exemplu")}
          </Tag>
        ) : null}
        <View
          style={{
            marginTop: 20,
            paddingTop: 10,
            borderTopWidth: 0.6,
            borderTopColor: NIGHT_INK.faint,
            flexDirection: "row",
          }}
        >
          {meta.map((item) => (
            <View key={item.label} style={{ flex: 1, paddingRight: 10 }}>
              <Label color={NIGHT_INK.muted}>{item.label}</Label>
              <Text
                style={{
                  fontFamily: FONT.body,
                  fontWeight: 500,
                  fontSize: 8.2,
                  color: NIGHT_INK.strong,
                  marginTop: 3,
                }}
              >
                {item.value}
              </Text>
            </View>
          ))}
        </View>
      </View>
    </DarkPage>
  );
}

/* --------------------------------------------------------- summary page */

/** "Pe scurt": the three numbered conclusions, the same lines as the results screen. */
export function InShort({ ctx, width }: { ctx: PdfContext; width: number }) {
  const { plan, lang, t } = ctx;
  return (
    <View style={{ width }}>
      <Label style={{ marginBottom: 4 }}>{t("In short", "Pe scurt")}</Label>
      {plan.summary.map((line, i) => (
        <View key={i} style={{ flexDirection: "row", marginBottom: 4 }}>
          <Text style={{ fontFamily: FONT.display, fontSize: 8.8, color: INK.muted, width: 11 }}>
            {i + 1}
          </Text>
          <Text
            style={{
              fontFamily: FONT.body,
              fontSize: 8.8,
              lineHeight: 1.42,
              color: INK.strong,
              flex: 1,
            }}
          >
            {pick(line, lang)}
            {i === 2 && hasImpact(ctx) ? <NoteRef n={1} /> : null}
          </Text>
        </View>
      ))}
    </View>
  );
}

/** "Începem aici": the starting stage, its reason and what it costs. */
function StartBlock({ ctx, width }: { ctx: PdfContext; width: number }) {
  const { plan, lang, t } = ctx;
  const phase = plan.phases.find((p) => p.start);
  if (!phase?.start) return <View style={{ width }} />;
  return (
    <View style={{ width, borderLeftWidth: 0.6, borderLeftColor: INK.hairline, paddingLeft: 12 }}>
      <Tag variant="start">{t("We start here", "Începem aici")}</Tag>
      <Text style={{ ...text.h3, marginTop: 5 }}>{pick(phase.title, lang)}</Text>
      <Text style={{ ...text.body, marginTop: 2 }}>{pick(phase.start.reason, lang)}</Text>
      <Text style={{ ...text.small, marginTop: 4 }}>
        {pick(phase.dateLabel, lang)}
        {"   "}
        {pick(phase.hoursText, lang)}
        {"   "}
        {pick(phase.costText, lang)}
      </Text>
    </View>
  );
}

export function SummaryPage({ ctx }: { ctx: PdfContext }) {
  const { blueprint, plan, lang, t, horizon } = ctx;
  const audit = blueprint.audit?.reachable ? blueprint.audit : undefined;
  const findings = priorityFindings(blueprint);
  const quickFixes = findings.filter((f) => f.effort === "quick").slice(0, 3);
  const span = monthsQty(horizon);
  const automation = blueprint.scores.automationPotential;
  const topSavers = [...plan.automations]
    .sort((a, b) => b.hoursPerMonth - a.hoursPerMonth)
    .slice(0, 3);

  const scores: StatCell[] = [
    ...(audit
      ? [
          {
            label: t("Website score", "Scorul site-ului"),
            value: String(Math.round(audit.scores.overall)),
            unit: t("of 100", "din 100"),
            status: (
              <Status tone={scoreTier(audit.scores.overall, lang).tone}>
                {scoreTier(audit.scores.overall, lang).label}
              </Status>
            ),
            sub: t(
              `${findings.length} ${findings.length === 1 ? "problem" : "problems"} worth fixing, ${quickFixes.length} of them quick`,
              `${findings.length} ${findings.length === 1 ? "problemă" : "probleme"} de rezolvat, dintre care ${quickFixes.length} ${quickFixes.length === 1 ? "rapidă" : "rapide"}`,
            ),
          },
        ]
      : []),
    {
      label: t("Digital maturity", "Maturitate digitală"),
      value: String(Math.round(blueprint.scores.digitalMaturity)),
      unit: t("of 100", "din 100"),
      sub: t(
        "Website, channels found and the tools on the site, together.",
        "Site-ul, canalele găsite și instrumentele de pe site, la un loc.",
      ),
    },
    {
      label: t("Automation potential", "Potențial de automatizare"),
      value: String(Math.round(automation)),
      unit: t("of 100", "din 100"),
      sub:
        automation >= 70
          ? t(
              "Many repetitive tasks: worth automating.",
              "Multe sarcini repetitive: merită automatizate.",
            )
          : automation >= 40
            ? t(
                "Some repetitive tasks can be automated.",
                "Câteva sarcini repetitive se pot automatiza.",
              )
            : t(
                "Few tasks to automate; the website matters more.",
                "Puține sarcini de automatizat; contează mai mult site-ul.",
              ),
    },
  ];

  const contents = [
    {
      title: t("Company profile", "Profilul companiei"),
      body: t(
        "Registry data, the website and the channels we could verify.",
        "Datele din registru, site-ul și canalele pe care le-am putut verifica.",
      ),
    },
    audit
      ? {
          title: t("Website audit", "Auditul site-ului"),
          body: t(
            "Scores, speed and the problems to fix first.",
            "Scorurile, viteza și problemele de rezolvat întâi.",
          ),
        }
      : null,
    blueprint.opportunities.length
      ? {
          title: t("What you can automate", "Ce poți automatiza"),
          body: t(
            "Each task with its hours, cost and assumptions.",
            "Fiecare activitate cu orele, costul și ipotezele ei.",
          ),
        }
      : null,
    {
      title: t("Directions and plan", "Direcții și plan"),
      body: t(
        "The directions, then the stages month by month with hours and cost.",
        "Direcțiile, apoi etapele lună de lună, cu ore și cost.",
      ),
    },
    hasImpact(ctx)
      ? {
          title: t("Impact", "Impactul"),
          body: t(
            "When the investment pays back, in a chart and a table.",
            "Când se recuperează investiția, în grafic și în tabel.",
          ),
        }
      : null,
    {
      title: t("How we worked it out", "Cum am calculat"),
      body: t(
        "The notes behind every figure and the data sources.",
        "Notele din spatele fiecărei cifre și sursele de date.",
      ),
    },
  ].filter((item): item is { title: string; body: string } => item !== null);

  return (
    <LightPage ctx={ctx} label={t("Summary", "Rezumat")}>
      <SectionTitle
        title={pick(plan.text.headline, lang)}
        intro={pick(blueprint.summary, lang)}
        aside={
          ctx.sample ? <Tag variant="dashed">{t("Sample data", "Date de exemplu")}</Tag> : undefined
        }
      />

      <View style={{ flexDirection: "row", justifyContent: "space-between" }} wrap={false}>
        <InShort ctx={ctx} width={COL2 + 30} />
        <StartBlock ctx={ctx} width={COL2 - 30} />
      </View>

      {hasImpact(ctx) ? (
        <View wrap={false} style={{ marginTop: 14 }}>
          <BlockTitle rule note={pick(plan.text.chartLead, lang)}>
            {t(`The first ${span.en}`, `În primele ${span.ro}`)}
          </BlockTitle>
          <StatRow cells={kpiStat(ctx)} />
          <Text style={{ ...text.tiny, marginTop: 4 }}>{pick(plan.text.lead, lang)}</Text>
        </View>
      ) : null}

      <View wrap={false} style={{ marginTop: 14 }}>
        <BlockTitle rule>{t("Where you are today", "Unde ești azi")}</BlockTitle>
        <StatRow cells={scores} />
      </View>

      {quickFixes.length ? (
        <View wrap={false} style={{ marginTop: 14 }}>
          <BlockTitle
            rule
            note={t(
              "Website fixes that take hours, not weeks",
              "Remedieri pe site care durează ore, nu săptămâni",
            )}
          >
            {t("To fix this month", "De rezolvat luna aceasta")}
          </BlockTitle>
          <View style={{ flexDirection: "row" }}>
            {quickFixes.map((finding, i) => (
              <View key={finding.id} style={{ width: COL3, marginLeft: i ? GAP : 0 }}>
                <Text style={{ ...text.h4 }}>{pick(finding.title, lang)}</Text>
                <Text style={{ ...text.small, color: INK.body, marginTop: 2 }}>
                  {pick(finding.recommendation, lang)}
                </Text>
                <Text style={{ ...text.tiny, marginTop: 2 }}>
                  {effortLabel(finding.effort, lang)}
                </Text>
              </View>
            ))}
          </View>
        </View>
      ) : topSavers.length ? (
        <View wrap={false} style={{ marginTop: 14 }}>
          <BlockTitle rule>
            {t("Where most time comes back", "Unde câștigi cel mai mult timp")}
          </BlockTitle>
          <View style={{ flexDirection: "row" }}>
            {topSavers.map((a, i) => {
              const phase = plan.phases.find((p) => p.key === a.phase);
              return (
                <View key={a.id} style={{ width: COL3, marginLeft: i ? GAP : 0 }}>
                  <Text style={{ ...text.h4 }}>{pick(a.title, lang)}</Text>
                  <Text style={{ ...text.small, marginTop: 2 }}>
                    {a.hoursPerMonth > 0
                      ? pick(hoursPerMonth(a.hoursPerMonth), lang)
                      : t("under 5 hours a month", "sub 5 ore pe lună")}
                    {phase ? `, ${pick(phase.dateLabel, lang).toLowerCase()}` : ""}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>
      ) : null}

      <View wrap={false} style={{ marginTop: "auto", paddingTop: 14 }}>
        <BlockTitle rule>{t("In this report", "În acest raport")}</BlockTitle>
        <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
          {contents.map((item, i) => (
            <View
              key={item.title}
              style={{ width: COL3, marginLeft: i % 3 ? GAP : 0, marginBottom: 6 }}
            >
              <Text
                style={{ fontFamily: FONT.body, fontWeight: 500, fontSize: 7.6, color: INK.strong }}
              >
                {item.title}
              </Text>
              <Text style={{ ...text.tiny, marginTop: 1 }}>{item.body}</Text>
            </View>
          ))}
        </View>
      </View>
    </LightPage>
  );
}
