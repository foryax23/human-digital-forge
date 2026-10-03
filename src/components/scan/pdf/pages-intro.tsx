import { Defs, Image, LinearGradient, Rect, Stop, Svg, Text, View } from "@react-pdf/renderer";

import { LOGO_RATIO } from "./assets";
import { Gauge, Glow, GradientRule, OrbitLines } from "./charts";
import { estimateLines } from "./estimate";
import {
  displayHost,
  formatDate,
  formatDecimal,
  formatRange,
  pad2,
  pick,
  roDe,
  truncate,
} from "./format";
import { PdfIcon, type IconName } from "./icons";
import {
  BlockTitle,
  Chip,
  DarkPage,
  IconBadge,
  IconRow,
  Label,
  Layer,
  LightPage,
  Logo,
  Panel,
  SectionTitle,
  type ChipTone,
} from "./layout";
import {
  effortLabel,
  priorityFindings,
  recommendedStrategy,
  scoreBand,
  sectionName,
  severityCounts,
  type PdfContext,
} from "./model";
import {
  BRAND,
  COL2,
  COL3,
  CONTACT,
  CONTENT_WIDTH,
  FONT,
  GAP,
  INK,
  NIGHT_INK,
  PAGE,
  RADIUS,
  SPACE,
  text,
} from "./theme";

/* ------------------------------------------------------------------- cover */

/** Night fade over the cover art so the text block always reads. */
function CoverShade() {
  return (
    <Svg width={PAGE.width} height={PAGE.height} viewBox={`0 0 ${PAGE.width} ${PAGE.height}`}>
      <Defs>
        <LinearGradient id="cover-shade" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={BRAND.night} stopOpacity={0.35} />
          <Stop offset="0.1" stopColor={BRAND.night} stopOpacity={0} />
          <Stop offset="0.55" stopColor={BRAND.night} stopOpacity={0} />
          <Stop offset="0.78" stopColor={BRAND.night} stopOpacity={0.8} />
          <Stop offset="1" stopColor={BRAND.night} stopOpacity={0.96} />
        </LinearGradient>
      </Defs>
      <Rect x={0} y={0} width={PAGE.width} height={PAGE.height} fill="url(#cover-shade)" />
    </Svg>
  );
}

export function CoverPage({ ctx }: { ctx: PdfContext }) {
  const { blueprint, lang, t, name, assets } = ctx;
  const nameSize = name.length <= 18 ? 40 : name.length <= 28 ? 34 : name.length <= 42 ? 28 : 22;
  const city = blueprint.company?.city;
  const host = displayHost(blueprint.company?.website || blueprint.audit?.finalUrl);
  const logoH = 300 / LOGO_RATIO.wordmark;
  const meta = [
    {
      label: t("Business type", "Tip de afacere"),
      value: pick(blueprint.businessType.label, lang),
    },
    host ? { label: t("Website", "Site"), value: host } : null,
    blueprint.company?.cui
      ? { label: t("Fiscal code", "Cod fiscal"), value: `CUI ${blueprint.company.cui}` }
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
      <Layer>
        <OrbitLines
          width={PAGE.width}
          height={PAGE.height}
          cx={SWIRL_CENTER.x}
          cy={SWIRL_CENTER.y}
          orbits={[
            { rx: 300, ry: 96, rotate: -16 },
            { rx: 250, ry: 168, rotate: 22, dashed: true },
          ]}
        />
      </Layer>

      <View
        style={{
          position: "absolute",
          top: 32,
          left: SPACE.gutter,
          right: SPACE.gutter,
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        {/* Both on the left: the swirl fills the top right and would swallow the email. */}
        <Text
          style={{ fontFamily: FONT.body, fontWeight: 500, fontSize: 7.5, color: NIGHT_INK.body }}
        >
          {CONTACT.site}
          <Text style={{ fontWeight: 400, color: NIGHT_INK.muted }}>
            {"   ·   "}
            {CONTACT.email}
          </Text>
        </Text>
      </View>

      {/* The wordmark sits in the dark space under the swirl, aligned with the text block. */}
      <View style={{ position: "absolute", left: SPACE.gutter - 4, top: LOGO_TOP }}>
        <Logo src={assets.wordmark} ratio={LOGO_RATIO.wordmark} height={logoH} />
        <View style={{ flexDirection: "row", alignItems: "center", marginTop: 12, marginLeft: 4 }}>
          <View style={{ width: 22, height: 0.9, backgroundColor: BRAND.sky, marginRight: 8 }} />
          <Text style={{ ...text.eyebrow, fontSize: 7.4, letterSpacing: 2.4, color: BRAND.sky }}>
            {t("Digital blueprint", "Plan digital personalizat")}
          </Text>
        </View>
      </View>

      <View style={{ position: "absolute", left: SPACE.gutter, right: SPACE.gutter, bottom: 44 }}>
        <Label color={BRAND.sky} style={{ fontSize: 6.6, letterSpacing: 2 }}>
          {t("Prepared for", "Pregătit pentru")}
        </Label>
        <Text
          style={{
            fontFamily: FONT.display,
            fontWeight: 700,
            fontSize: nameSize,
            lineHeight: 1.04,
            color: NIGHT_INK.strong,
            maxWidth: 480,
            marginTop: 8,
          }}
        >
          {name}
        </Text>
        <Text
          style={{
            fontFamily: FONT.display,
            fontWeight: 500,
            fontSize: 12,
            color: NIGHT_INK.body,
            marginTop: 8,
          }}
        >
          {pick(blueprint.businessType.label, lang)}
          {city ? ` · ${city}` : ""}
        </Text>
        <Text
          style={{
            ...text.body,
            fontSize: 9.2,
            color: NIGHT_INK.muted,
            marginTop: 9,
            maxWidth: 380,
          }}
        >
          {t(
            "A personalised plan to win back time, automate the routine and grow, built from your public data and the way businesses like yours work.",
            "Un plan personalizat ca să câștigi timp, să automatizezi munca repetitivă și să crești afacerea, construit din datele tale publice și din felul în care lucrează afacerile ca a ta.",
          )}
        </Text>
        <View style={{ marginTop: 22, marginBottom: 12 }}>
          <GradientRule id="cover-rule" width={CONTENT_WIDTH} height={0.9} />
        </View>
        <View style={{ flexDirection: "row" }}>
          {meta.map((item) => (
            <View key={item.label} style={{ flex: 1, paddingRight: 10 }}>
              <Label color={NIGHT_INK.faint}>{item.label}</Label>
              <Text
                style={{
                  fontFamily: FONT.body,
                  fontWeight: 500,
                  fontSize: 8.2,
                  color: NIGHT_INK.strong,
                  marginTop: 4,
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

/** Centre of the swirl in the cover art (it sits top right, partly off the page). */
const SWIRL_CENTER = { x: PAGE.width * 0.63, y: PAGE.height * 0.26 };
const LOGO_TOP = 392;

/* ------------------------------------------------------- executive summary */

type Kpi = { icon: IconName; label: string; value: string; unit: string; note: string };

function KpiTile({ tile, index }: { tile: Kpi; index: number }) {
  const h = 96;
  return (
    <View
      style={{
        width: COL3,
        height: h,
        borderRadius: RADIUS.xl,
        backgroundColor: BRAND.night,
        padding: 12,
        position: "relative",
        overflow: "hidden",
      }}
    >
      <View style={{ position: "absolute", top: 0, left: 0 }}>
        <Glow
          id={`kpi-${index}`}
          width={COL3}
          height={h}
          color={index === 1 ? BRAND.blue : BRAND.violet}
          opacity={0.6}
          cx={0.94}
          cy={0.02}
          r={0.8}
        />
      </View>
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        <IconBadge name={tile.icon} size={18} tone="glass" />
        <Text style={{ ...text.eyebrow, fontSize: 6, color: NIGHT_INK.muted, marginLeft: 6 }}>
          {tile.label}
        </Text>
      </View>
      <Text
        style={{
          ...text.number,
          fontSize: tile.value.length <= 7 ? 25 : tile.value.length <= 11 ? 21 : 17,
          color: NIGHT_INK.strong,
          lineHeight: 1,
          marginTop: 10,
        }}
      >
        {tile.value}
      </Text>
      <Text
        style={{
          fontFamily: FONT.body,
          fontWeight: 500,
          fontSize: 7.6,
          color: BRAND.sky,
          marginTop: 3,
        }}
      >
        {tile.unit}
      </Text>
      <Text
        style={{
          ...text.tiny,
          color: NIGHT_INK.muted,
          position: "absolute",
          left: 12,
          right: 12,
          bottom: 10,
        }}
      >
        {tile.note}
      </Text>
    </View>
  );
}

function bandTone(kind: "maturity" | "health" | "automation", value: number | null): ChipTone {
  if (value === null) return "neutral";
  if (kind === "automation") return value >= 40 ? "mint" : "neutral";
  return value >= 70 ? "mint" : value >= 40 ? "blue" : "violet";
}

/** Three gauges in one band: maturity, website health, automation potential. */
function ScoreBand({ ctx }: { ctx: PdfContext }) {
  const { blueprint, lang, t } = ctx;
  const { scores, audit } = blueprint;
  const gauges: Array<{
    id: string;
    kind: "maturity" | "health" | "automation";
    value: number | null;
    title: string;
    detail: string;
  }> = [
    {
      id: "g-maturity",
      kind: "maturity",
      value: scores.digitalMaturity,
      title: t("Digital maturity", "Maturitate digitală"),
      detail: t(
        "How complete your website, channels, tools and tracking are.",
        "Cât de complete sunt site-ul, canalele, aplicațiile și măsurarea.",
      ),
    },
    {
      id: "g-health",
      kind: "health",
      // Without an audited website there is nothing to score.
      value: audit ? scores.websiteHealth : null,
      title: t("Website health", "Starea site-ului"),
      detail: t(
        "Speed, SEO, accessibility, security and conversion.",
        "Viteză, SEO, accesibilitate, securitate și conversie.",
      ),
    },
    {
      id: "g-automation",
      kind: "automation",
      value: scores.automationPotential,
      title: t("Automation potential", "Potențial de automatizare"),
      detail: t(
        "Routine work that could run on its own. Higher means more to gain.",
        "Munca repetitivă care poate merge singură. Mai mare înseamnă mai mult de câștigat.",
      ),
    },
  ];
  return (
    <Panel style={{ flexDirection: "row", paddingVertical: 8, paddingHorizontal: 4 }}>
      {gauges.map((g, i) => (
        <View
          key={g.id}
          style={{
            flex: 1,
            flexDirection: "row",
            alignItems: "center",
            paddingHorizontal: 8,
            borderLeftWidth: i ? 0.6 : 0,
            borderLeftColor: INK.hairline,
          }}
        >
          <Gauge id={g.id} value={g.value} size={66} />
          <View style={{ flex: 1, marginLeft: 6 }}>
            <Text style={{ ...text.h3, fontSize: 9 }}>{g.title}</Text>
            <Chip
              label={
                g.value === null ? t("No website", "Fără site") : scoreBand(g.kind, g.value, lang)
              }
              tone={bandTone(g.kind, g.value)}
              style={{ alignSelf: "flex-start", marginTop: 3 }}
            />
            <Text style={{ ...text.tiny, marginTop: 3 }}>{g.detail}</Text>
          </View>
        </View>
      ))}
    </Panel>
  );
}

export function SummaryPage({ ctx }: { ctx: PdfContext }) {
  const { blueprint, lang, t } = ctx;
  const { totals } = blueprint;
  const fte = {
    low: totals.hoursSavedPerMonth.low / 168,
    high: totals.hoursSavedPerMonth.high / 168,
  };
  // Nothing sized yet: show a dash instead of "0 months" payback.
  const sized = totals.hoursSavedPerMonth.high > 0 || totals.monthlySavingsRon.high > 0;
  const notSized = t("Not sized yet", "Încă neestimat");
  const tiles: Kpi[] = [
    {
      icon: "clock",
      label: t("Time back", "Timp câștigat"),
      value: sized ? formatRange(totals.hoursSavedPerMonth, lang) : "–",
      unit: t("hours / month", "ore / lună"),
      note: sized
        ? t(
            `About ${formatRange(fte, lang, formatDecimal)} of a full-time role`,
            `Cam ${formatRange(fte, lang, formatDecimal)} dintr-un post cu normă întreagă`,
          )
        : notSized,
    },
    {
      icon: "wallet",
      label: t("Savings", "Economii"),
      value: sized ? formatRange(totals.monthlySavingsRon, lang) : "–",
      unit: t("RON / month", "lei / lună"),
      note: sized
        ? t(
            `${formatRange(totals.annualSavingsRon, lang)} RON a year`,
            `${formatRange(totals.annualSavingsRon, lang)} lei pe an`,
          )
        : notSized,
    },
    {
      icon: "hourglass",
      label: t("Payback", "Recuperarea investiției"),
      value: sized ? formatRange(totals.paybackMonths, lang, formatDecimal) : "–",
      unit: t("months", "luni"),
      note: sized
        ? t(
            `One-off setup ${formatRange(totals.setupCostRon, lang)} RON`,
            `Cost unic de implementare: ${formatRange(totals.setupCostRon, lang)} lei`,
          )
        : notSized,
    },
  ];

  const findings = priorityFindings(blueprint);
  const counts = severityCounts(findings);
  const urgent = counts.critical + counts.high;
  const quickFixes = findings.filter((f) => f.effort === "quick");
  const audit = blueprint.audit;
  const strategy = recommendedStrategy(blueprint);
  const firstPhase = blueprint.roadmap[0];
  const activeChannels = (blueprint.presence?.profiles ?? []).filter((p) => p.status !== "missing");
  const typeEn = pick(blueprint.businessType.label, "en").toLowerCase();
  const typeRo = pick(blueprint.businessType.label, "ro").toLowerCase();
  const contents = ctx.sections.filter((key) => key !== "summary");
  // Without website quick fixes, the same slot shows where most hours come back.
  const topSavers = [...blueprint.opportunities]
    .sort(
      (a, b) =>
        b.hoursSavedPerMonth.low +
        b.hoursSavedPerMonth.high -
        (a.hoursSavedPerMonth.low + a.hoursSavedPerMonth.high),
    )
    .slice(0, 3);

  const found: Array<{ icon: IconName; title: string; detail?: string }> = [];
  if (audit?.reachable) {
    found.push({
      icon: "gauge",
      title: t(
        `Website health ${audit.scores.overall}/100 on ${audit.host}`,
        `Site-ul ${audit.host} are scorul ${audit.scores.overall}/100`,
      ),
      detail: t(
        `${urgent} high-priority issue${urgent === 1 ? "" : "s"}, ${quickFixes.length} quick fix${quickFixes.length === 1 ? "" : "es"}`,
        `${urgent} ${urgent === 1 ? "problemă importantă" : "probleme importante"}, ${quickFixes.length} ${quickFixes.length === 1 ? "rezolvare rapidă" : "rezolvări rapide"}`,
      ),
    });
  } else if (!audit) {
    found.push({
      icon: "globe",
      title: t("No website analysed", "Niciun site analizat"),
      detail: t(
        "We couldn't find or reach a website for this business.",
        "Nu am găsit un site pentru această afacere sau nu am putut să-l accesăm.",
      ),
    });
  }
  // A headline over two lines or a summary over three leaves room for one
  // finding instead of two, and the plan line (the offer page repeats it) goes.
  const tight =
    estimateLines(pick(blueprint.headline, lang).length, 470, 21, 0.56) > 2 ||
    estimateLines(pick(blueprint.summary, lang).length, 470, 8.8, 0.49) > 3;
  for (const finding of findings.slice(0, tight ? 1 : 2)) {
    found.push({
      icon: "alert",
      title: pick(finding.title, lang),
      detail: truncate(pick(finding.detail, lang), 140),
    });
  }
  if (blueprint.presence) {
    found.push({
      icon: "users",
      title: t(
        `${activeChannels.length} of ${blueprint.presence.profiles.length} online channels found`,
        `${activeChannels.length} din ${blueprint.presence.profiles.length} canale online găsite`,
      ),
    });
  }
  found.push({
    icon: "zap",
    title: !blueprint.opportunities.length
      ? t("No automation opportunities sized yet", "Încă nu am estimat automatizări")
      : t(
          `${blueprint.opportunities.length} automation opportunit${blueprint.opportunities.length === 1 ? "y" : "ies"} for a ${typeEn}`,
          `${blueprint.opportunities.length} ${blueprint.opportunities.length === 1 ? "proces care poate fi automatizat" : "procese care pot fi automatizate"} (${typeRo})`,
        ),
  });

  return (
    <LightPage ctx={ctx} label={t("Summary", "Rezumat")}>
      <SectionTitle
        index={ctx.section("summary")}
        eyebrow={sectionName("summary", lang)}
        title={pick(blueprint.headline, lang)}
        intro={pick(blueprint.summary, lang)}
      />

      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
        {tiles.map((tile, index) => (
          <KpiTile key={tile.label} tile={tile} index={index} />
        ))}
      </View>

      <View style={{ marginTop: GAP }}>
        <ScoreBand ctx={ctx} />
      </View>

      <View style={{ flexDirection: "row", marginTop: 14, justifyContent: "space-between" }}>
        <View style={{ width: COL2 - 6 }}>
          <BlockTitle>{t("What we found", "Ce am găsit")}</BlockTitle>
          {found.slice(0, 5).map((item, index) => (
            <IconRow key={index} icon={item.icon} style={{ marginBottom: 6.5 }}>
              <Text
                style={{
                  fontFamily: FONT.body,
                  fontWeight: 700,
                  fontSize: 8.2,
                  color: INK.strong,
                  lineHeight: 1.32,
                }}
              >
                {item.title}
              </Text>
              {item.detail ? (
                <Text style={{ ...text.small, marginTop: 1 }}>{item.detail}</Text>
              ) : null}
            </IconRow>
          ))}
        </View>

        <Panel tone="violet" style={{ width: COL2, padding: 14 }}>
          <BlockTitle>{t("What we recommend", "Ce recomandăm")}</BlockTitle>
          {strategy ? (
            <View>
              <Chip
                label={t("Recommended direction", "Direcția recomandată")}
                tone="dark"
                icon="sparkles"
                style={{ alignSelf: "flex-start" }}
              />
              <Text style={{ ...text.h2, fontSize: 12, marginTop: 7 }}>
                {pick(strategy.title, lang)}
              </Text>
              <Text style={{ ...text.small, color: INK.body, marginTop: 2 }}>
                {pick(strategy.summary, lang)}
              </Text>
              <View style={{ flexDirection: "row", alignItems: "flex-end", marginTop: 9 }}>
                <Text
                  style={{ ...text.number, fontSize: 20, color: INK.violetText, lineHeight: 1 }}
                >
                  {formatRange(strategy.outcome.range, lang)}
                  {strategy.outcome.unit === "%" ? "%" : ""}
                </Text>
                <Text
                  style={{
                    ...text.small,
                    color: INK.body,
                    marginLeft: 6,
                    marginBottom: 1,
                    flex: 1,
                  }}
                >
                  {strategy.outcome.unit === "RON" ? t("RON ", "lei ") : ""}
                  {pick(strategy.outcome.label, lang)}
                </Text>
              </View>
            </View>
          ) : null}
          <View style={{ height: 0.7, backgroundColor: "#dcd9ff", marginVertical: 10 }} />
          {firstPhase ? (
            <IconRow icon="rocket" style={{ marginBottom: 6 }}>
              <Text style={{ ...text.small, color: INK.body }}>
                <Text style={{ fontFamily: FONT.body, fontWeight: 700, color: INK.strong }}>
                  {t("First step", "Primul pas")}:{" "}
                </Text>
                {pick(firstPhase.title, lang)}
              </Text>
            </IconRow>
          ) : null}
          {!tight || !firstPhase ? (
            <IconRow icon="layers">
              <Text style={{ ...text.small, color: INK.body }}>
                <Text style={{ fontFamily: FONT.body, fontWeight: 700, color: INK.strong }}>
                  {t("Plan", "Pachet")}:{" "}
                </Text>
                {pick(blueprint.offer.title, lang)}
              </Text>
            </IconRow>
          ) : null}
        </Panel>
      </View>

      {quickFixes.length ? (
        <View style={{ marginTop: 12 }} wrap={false}>
          <BlockTitle
            icon="zap"
            note={t(
              "Website fixes that take hours, not weeks",
              "Remedieri pentru site care durează ore, nu săptămâni",
            )}
          >
            {t("Quick fixes for this month", "De rezolvat luna aceasta")}
          </BlockTitle>
          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
            {quickFixes.slice(0, 3).map((finding) => (
              <View
                key={finding.id}
                style={{
                  width: COL3,
                  borderLeftWidth: 2,
                  borderLeftColor: BRAND.violet,
                  paddingLeft: 8,
                  paddingVertical: 1,
                }}
              >
                <Text
                  style={{
                    fontFamily: FONT.body,
                    fontWeight: 700,
                    fontSize: 7.8,
                    color: INK.strong,
                  }}
                >
                  {pick(finding.title, lang)}
                </Text>
                <Text style={{ ...text.small, marginTop: 1.5 }}>
                  {pick(finding.recommendation, lang)}
                </Text>
                <Text style={{ ...text.tiny, marginTop: 2, color: INK.violetText }}>
                  {effortLabel(finding.effort, lang)}
                </Text>
              </View>
            ))}
            {/* Keep the three-column grid when there are fewer fixes. */}
            {Array.from({ length: Math.max(0, 3 - Math.min(3, quickFixes.length)) }, (_, i) => (
              <View key={`pad-${i}`} style={{ width: COL3 }} />
            ))}
          </View>
        </View>
      ) : null}

      {!quickFixes.length && topSavers.length ? (
        <View style={{ marginTop: 12 }} wrap={false}>
          <BlockTitle
            icon="clock"
            note={t(
              "Estimates from the automation opportunities",
              "Estimări din secțiunea de automatizări",
            )}
          >
            {t("Biggest time savers", "Unde câștigi cel mai mult timp")}
          </BlockTitle>
          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
            {topSavers.map((o) => (
              <View
                key={o.id}
                style={{
                  width: COL3,
                  borderLeftWidth: 2,
                  borderLeftColor: BRAND.violet,
                  paddingLeft: 8,
                  paddingVertical: 1,
                }}
              >
                <Text
                  style={{
                    fontFamily: FONT.body,
                    fontWeight: 700,
                    fontSize: 7.8,
                    color: INK.strong,
                  }}
                >
                  {pick(o.title, lang)}
                </Text>
                <Text style={{ ...text.tiny, marginTop: 2, color: INK.violetText }}>
                  {t(
                    `${formatRange(o.hoursSavedPerMonth, lang)} h / month · pays back in ${formatRange(o.paybackMonths, lang, formatDecimal)} months`,
                    `${formatRange(o.hoursSavedPerMonth, lang)} ore / lună · se recuperează în ${formatRange(o.paybackMonths, lang, formatDecimal)} luni`,
                  )}
                </Text>
              </View>
            ))}
            {Array.from({ length: 3 - topSavers.length }, (_, i) => (
              <View key={`pad-${i}`} style={{ width: COL3 }} />
            ))}
          </View>
        </View>
      ) : null}

      {/* Contents as one slim row of numbered cells, so long summaries still fit the page. */}
      <View style={{ marginTop: "auto", paddingTop: 12 }} wrap={false}>
        <Label style={{ marginBottom: 5 }}>{t("Inside this blueprint", "În acest plan")}</Label>
        <View style={{ flexDirection: "row" }}>
          {contents.map((key, i) => (
            <View
              key={key}
              style={{
                flex: 1,
                marginLeft: i ? 6 : 0,
                borderTopWidth: 1,
                borderTopColor: i === 0 ? BRAND.violet : INK.hairline,
                paddingTop: 4,
              }}
            >
              <Text
                style={{
                  fontFamily: FONT.display,
                  fontWeight: 700,
                  fontSize: 7,
                  color: INK.violetText,
                }}
              >
                {pad2(ctx.section(key))}
              </Text>
              <Text
                style={{
                  fontFamily: FONT.body,
                  fontSize: 6.8,
                  lineHeight: 1.3,
                  color: INK.body,
                  marginTop: 1,
                }}
              >
                {sectionName(key, lang)}
              </Text>
            </View>
          ))}
        </View>
      </View>

      <View
        wrap={false}
        style={{
          marginTop: 8,
          flexDirection: "row",
          alignItems: "flex-start",
          borderTopWidth: 0.6,
          borderTopColor: INK.hairline,
          paddingTop: 8,
        }}
      >
        <View style={{ marginTop: 1, marginRight: 6 }}>
          <PdfIcon name="fileText" size={8.5} color={INK.faint} />
        </View>
        <Text style={{ ...text.tiny, flex: 1, color: INK.muted }}>
          {t(
            `Money and time figures are ranges, not promises. They combine public data, typical volumes for a ${typeEn} and a full staff cost of ${blueprint.assumptions.hourlyCostRon} RON an hour. Every assumption is listed in the methodology.`,
            `Cifrele de timp și bani sunt intervale, nu promisiuni. Ele combină date publice, volume obișnuite pentru o afacere ca a ta (${typeRo}) și un cost total al angajatului de ${blueprint.assumptions.hourlyCostRon} ${roDe(blueprint.assumptions.hourlyCostRon)}lei pe oră. Toate ipotezele sunt în secțiunea de metodologie.`,
          )}
        </Text>
      </View>
    </LightPage>
  );
}
