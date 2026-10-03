import type { ReactNode } from "react";

import { Image, Link, Text, View } from "@react-pdf/renderer";

import type { ProjectionPoint, RoadmapPhase } from "@/lib/scan/types";

import { LOGO_RATIO } from "./assets";
import {
  Glow,
  GradientBar,
  GradientRule,
  LevelDots,
  OrbitLines,
  ProjectionChart,
  RangeBar,
} from "./charts";
import {
  currency,
  formatDate,
  formatDecimal,
  formatInt,
  formatRange,
  formatSignedRange,
  pad2,
  pick,
  roDe,
  truncate,
} from "./format";
import { PdfIcon } from "./icons";
import { localizeBasis, localizeMoney } from "./localize";
import {
  BlockTitle,
  Card,
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
  implementationLevel,
  levelLabel,
  monthsLabel,
  recommendedStrategy,
  scoreBand,
  sectionName,
  strategyIcon,
  tagLabel,
  type PdfContext,
} from "./model";
import { QrCode } from "./qr";
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

/** Column width on a four-column grid. */
const COL4 = (CONTENT_WIDTH - GAP * 3) / 4;

/* --------------------------------------------------------------- strategy */

/** "In short": the fastest, the most affordable and the lightest direction, from the data. */
function StrategyHighlights({ ctx }: { ctx: PdfContext }) {
  const { blueprint, lang, t } = ctx;
  const strategies = blueprint.strategies.slice(0, 3);
  const by = (score: (s: (typeof strategies)[number]) => number) =>
    [...strategies].sort((a, b) => score(a) - score(b))[0];
  const fastest = by((s) => s.timeToValueMonths.low + s.timeToValueMonths.high / 100);
  const cheapest = by((s) => s.investmentRon.low + s.investmentRon.high / 1000);
  const lightest = by(
    (s) => implementationLevel(s.implementation) * 1000 + s.investmentRon.low / 1000,
  );
  // "Lightest" only means something when one direction really needs less effort.
  const effortTie =
    strategies.filter(
      (s) => implementationLevel(s.implementation) === implementationLevel(lightest.implementation),
    ).length > 1;
  const widest = by((s) => -s.opportunityIds.length - (s.recommended ? 0.5 : 0));
  const showWidest = effortTie && widest.opportunityIds.length > 0;
  const items = [
    {
      icon: "zap" as const,
      label: t("Fastest results", "Cele mai rapide rezultate"),
      strategy: fastest,
      value: `${formatRange(fastest.timeToValueMonths, lang)} ${t("months", "luni")}`,
    },
    {
      icon: "wallet" as const,
      label: t("Smallest investment", "Cea mai mică investiție"),
      strategy: cheapest,
      value: `${formatRange(cheapest.investmentRon, lang)} ${currency(lang)}`,
    },
    showWidest
      ? {
          icon: "workflow" as const,
          label: t("Covers the most", "Acoperă cele mai multe procese"),
          strategy: widest,
          value: t(
            `${widest.opportunityIds.length} process${widest.opportunityIds.length === 1 ? "" : "es"} automated`,
            `${widest.opportunityIds.length} ${widest.opportunityIds.length === 1 ? "proces automatizat" : "procese automatizate"}`,
          ),
        }
      : {
          icon: "layers" as const,
          label: t("Lightest to implement", "Cel mai ușor de implementat"),
          strategy: lightest,
          value: t(
            `${levelLabel(lightest.implementation, "en")} effort`,
            `Efort ${levelLabel(lightest.implementation, "ro").toLowerCase()}`,
          ),
        },
  ];
  return (
    <View wrap={false} style={{ marginTop: 14 }}>
      <BlockTitle>{t("In short", "Pe scurt")}</BlockTitle>
      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
        {items.map((item) => (
          <Panel
            key={item.label}
            style={{ width: COL3, flexDirection: "row", alignItems: "flex-start", padding: 10 }}
          >
            <IconBadge name={item.icon} size={20} />
            <View style={{ flex: 1, marginLeft: 8 }}>
              <Label>{item.label}</Label>
              <Text style={{ ...text.h3, fontSize: 9.2, marginTop: 2 }}>
                {pick(item.strategy.title, lang)}
              </Text>
              <Text
                style={{
                  fontFamily: FONT.display,
                  fontWeight: 500,
                  fontSize: 7.6,
                  color: INK.violetText,
                  marginTop: 1,
                }}
              >
                {item.value}
              </Text>
            </View>
          </Panel>
        ))}
      </View>
    </View>
  );
}

function StrategySection({ ctx }: { ctx: PdfContext }) {
  const { blueprint, lang, t } = ctx;
  const strategies = blueprint.strategies.slice(0, 3);
  const recommended = recommendedStrategy(blueprint);
  const count = strategies.length;
  const colW = count >= 3 ? COL3 : count === 2 ? COL2 : CONTENT_WIDTH;
  const titleById = new Map(blueprint.opportunities.map((o) => [o.id, pick(o.title, lang)]));
  const maxInvestment = Math.max(1, ...strategies.map((s) => s.investmentRon.high));
  const maxMonths = Math.max(1, ...strategies.map((s) => s.timeToValueMonths.high));
  const money = currency(lang);

  return (
    <View>
      <SectionTitle
        index={ctx.section("strategy")}
        eyebrow={sectionName("strategy", lang)}
        title={
          count === 3
            ? t("Three ways forward", "Trei direcții posibile")
            : count === 1
              ? t("The way forward", "Direcția propusă")
              : t("Ways forward", "Direcții posibile")
        }
        intro={t(
          "Each direction is timed and costed from your data. They can be combined; the roadmap puts them in order.",
          "Fiecare direcție are timp și cost calculate din datele tale. Se pot combina, iar planul de implementare le pune în ordine.",
        )}
      />

      {!blueprint.opportunities.length ? (
        <Panel style={{ marginBottom: 12, flexDirection: "row", alignItems: "flex-start" }}>
          <IconBadge name="zap" size={20} />
          <View style={{ flex: 1, marginLeft: 9 }}>
            <Text style={{ ...text.h3 }}>
              {t("No automation opportunities sized yet", "Încă nu am estimat automatizări")}
            </Text>
            <Text style={{ ...text.small, color: INK.body, marginTop: 2 }}>
              {t(
                "We didn't find routine work we could size with confidence. A short discovery call usually brings it to light.",
                "Nu am găsit muncă repetitivă pe care să o putem estima sigur. De obicei, o discuție scurtă de evaluare o scoate la iveală.",
              )}
            </Text>
          </View>
        </Panel>
      ) : null}

      <View
        style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "stretch" }}
        wrap={false}
      >
        {strategies.map((s, index) => {
          const dark = s.id === recommended?.id;
          const ink = dark ? NIGHT_INK : INK;
          const covers = s.opportunityIds
            .map((id) => titleById.get(id))
            .filter(Boolean) as string[];
          return (
            <View
              key={s.id}
              style={{
                width: colW,
                borderRadius: RADIUS.xl,
                backgroundColor: dark ? BRAND.night : INK.white,
                borderWidth: dark ? 1.2 : 0.7,
                borderColor: dark ? BRAND.violet : INK.hairline,
                padding: 12,
                overflow: "hidden",
                position: "relative",
              }}
            >
              {dark ? (
                <View style={{ position: "absolute", top: 0, left: 0 }}>
                  <Glow
                    id={`strategy-glow-${index}`}
                    width={colW}
                    height={420}
                    color={BRAND.violet}
                    opacity={0.6}
                    cx={0.85}
                    cy={0.05}
                    r={0.95}
                  />
                </View>
              ) : null}
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <IconBadge name={strategyIcon(s)} size={22} tone={dark ? "glass" : "violet"} />
                {dark ? (
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      backgroundColor: BRAND.violet,
                      borderRadius: RADIUS.pill,
                      paddingVertical: 2.6,
                      paddingHorizontal: 7,
                    }}
                  >
                    <PdfIcon name="sparkles" size={6.5} color={INK.white} />
                    <Text
                      style={{
                        fontFamily: FONT.body,
                        fontWeight: 700,
                        fontSize: 6.4,
                        color: INK.white,
                        marginLeft: 3,
                      }}
                    >
                      {t("Recommended", "Recomandat")}
                    </Text>
                  </View>
                ) : (
                  <Text
                    style={{
                      fontFamily: FONT.display,
                      fontWeight: 700,
                      fontSize: 13,
                      color: INK.hairline,
                    }}
                  >
                    {pad2(index + 1)}
                  </Text>
                )}
              </View>
              <Text style={{ ...text.h2, fontSize: 11.5, color: ink.strong, marginTop: 9 }}>
                {pick(s.title, lang)}
              </Text>
              <Text style={{ ...text.small, color: ink.muted, marginTop: 2, minHeight: 30 }}>
                {truncate(pick(s.summary, lang), 130)}
              </Text>

              <View
                style={{
                  marginTop: 7,
                  paddingTop: 7,
                  borderTopWidth: 0.6,
                  borderTopColor: ink.hairline,
                }}
              >
                <Text
                  style={{
                    ...text.number,
                    fontSize: 21,
                    color: dark ? NIGHT_INK.strong : INK.violetText,
                    lineHeight: 1,
                  }}
                >
                  {formatRange(s.outcome.range, lang)}
                  {s.outcome.unit === "%" ? "%" : ""}
                </Text>
                <Text
                  style={{
                    fontFamily: FONT.body,
                    fontWeight: 500,
                    fontSize: 7.8,
                    color: dark ? BRAND.sky : INK.strong,
                    marginTop: 3,
                  }}
                >
                  {s.outcome.unit === "RON" ? `${money} ` : ""}
                  {pick(s.outcome.label, lang)}
                </Text>
                <Text style={{ ...text.tiny, color: ink.faint, marginTop: 2 }}>
                  {truncate(pick(s.outcome.basis, lang), 110)}
                </Text>
              </View>

              <View style={{ marginTop: 8 }}>
                {s.tactics.slice(0, 4).map((tactic, i) => (
                  <IconRow
                    key={i}
                    icon="check"
                    color={dark ? BRAND.mint : INK.violetText}
                    style={{ marginBottom: 3 }}
                  >
                    <Text
                      style={{
                        fontFamily: FONT.body,
                        fontSize: 7.6,
                        lineHeight: 1.32,
                        color: ink.body,
                      }}
                    >
                      {pick(tactic, lang)}
                    </Text>
                  </IconRow>
                ))}
              </View>

              <View style={{ marginTop: "auto", paddingTop: 7 }}>
                {covers.length ? (
                  <Text style={{ ...text.tiny, color: ink.faint, marginBottom: 5 }}>
                    <Text style={{ fontFamily: FONT.body, fontWeight: 700 }}>
                      {t("Covers", "Include")}:
                    </Text>{" "}
                    {truncate(covers.join(" · "), 120)}
                  </Text>
                ) : null}
                {[
                  {
                    label: t("Effort", "Efort"),
                    value: (
                      <View style={{ flexDirection: "row", alignItems: "center" }}>
                        <LevelDots
                          level={implementationLevel(s.implementation)}
                          color={dark ? BRAND.sky : BRAND.violet}
                          empty={dark ? NIGHT_INK.hairline : INK.hairline}
                        />
                        <Text
                          style={{
                            fontFamily: FONT.body,
                            fontSize: 7.2,
                            color: ink.strong,
                            marginLeft: 4,
                          }}
                        >
                          {levelLabel(s.implementation, lang)}
                        </Text>
                      </View>
                    ),
                  },
                  {
                    label: t("First results", "Rezultate în"),
                    value: (
                      <Text style={{ fontFamily: FONT.body, fontSize: 7.2, color: ink.strong }}>
                        {formatRange(s.timeToValueMonths, lang)} {t("months", "luni")}
                      </Text>
                    ),
                  },
                  {
                    label: t("Investment", "Investiție"),
                    value: (
                      <Text style={{ fontFamily: FONT.body, fontSize: 7.2, color: ink.strong }}>
                        {formatRange(s.investmentRon, lang)} {money}
                      </Text>
                    ),
                  },
                ].map((row) => (
                  <View
                    key={row.label}
                    style={{
                      flexDirection: "row",
                      justifyContent: "space-between",
                      alignItems: "center",
                      paddingVertical: 3.4,
                      borderTopWidth: 0.5,
                      borderTopColor: ink.hairline,
                    }}
                  >
                    <Label color={ink.faint}>{row.label}</Label>
                    {row.value}
                  </View>
                ))}
              </View>
            </View>
          );
        })}
      </View>

      {recommended ? (
        <View
          wrap={false}
          style={{
            flexDirection: "row",
            alignItems: "flex-start",
            marginTop: GAP,
            backgroundColor: INK.violetTint,
            borderRadius: RADIUS.lg,
            padding: 10,
          }}
        >
          <IconBadge name="compass" size={20} tone="dark" />
          <View style={{ flex: 1, marginLeft: 9 }}>
            <Text style={{ ...text.h3 }}>
              {t("Our recommendation", "Recomandarea noastră")}: {pick(recommended.title, lang)}
            </Text>
            <Text style={{ ...text.small, color: INK.body, marginTop: 2 }}>
              {t(
                `First results in ${formatRange(recommended.timeToValueMonths, lang)} months for an investment of ${formatRange(recommended.investmentRon, lang)} RON, with an expected ${formatRange(recommended.outcome.range, lang)}${recommended.outcome.unit === "%" ? "%" : ""} ${recommended.outcome.unit === "RON" ? "RON " : ""}${pick(recommended.outcome.label, "en")}.`,
                `Primele rezultate apar în ${formatRange(recommended.timeToValueMonths, lang)} luni, cu o investiție de ${formatRange(recommended.investmentRon, lang)} lei. Rezultat estimat: ${formatRange(recommended.outcome.range, lang)}${recommended.outcome.unit === "%" ? "%" : ""} ${recommended.outcome.unit === "RON" ? "lei " : ""}${pick(recommended.outcome.label, "ro")}.`,
              )}
            </Text>
          </View>
        </View>
      ) : null}

      {strategies.length > 1 ? <StrategyHighlights ctx={ctx} /> : null}

      {strategies.length > 1 ? (
        <View wrap={false} style={{ marginTop: 14 }}>
          <BlockTitle
            note={t(
              "Bars share one scale per column, from zero. Dots mark each range's ends.",
              "Barele au aceeași scară pe coloană, de la zero. Punctele marchează capetele intervalului.",
            )}
          >
            {t("Compare at a glance", "Comparație rapidă")}
          </BlockTitle>
          <View
            style={{
              flexDirection: "row",
              paddingBottom: 4,
              borderBottomWidth: 0.7,
              borderBottomColor: INK.hairline,
            }}
          >
            <Label style={{ width: 150 }}>{t("Direction", "Direcție")}</Label>
            <Label style={{ width: 150 }}>{t("Investment, RON", `Investiție, ${money}`)}</Label>
            <Label style={{ width: 118 }}>{t("First results, months", "Rezultate în, luni")}</Label>
            <Label style={{ flex: 1, textAlign: "right" }}>{t("Effort", "Efort")}</Label>
          </View>
          {strategies.map((s) => {
            const isRec = s.id === recommended?.id;
            const color = isRec ? BRAND.violet : "#9aa0c8";
            return (
              <View
                key={s.id}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  paddingVertical: 6,
                  borderBottomWidth: 0.5,
                  borderBottomColor: INK.hairline,
                }}
              >
                <View
                  style={{
                    width: 150,
                    flexDirection: "row",
                    alignItems: "center",
                    paddingRight: 8,
                  }}
                >
                  <PdfIcon
                    name={strategyIcon(s)}
                    size={8.5}
                    color={isRec ? INK.violetText : INK.faint}
                  />
                  <Text
                    style={{
                      fontFamily: FONT.body,
                      fontWeight: isRec ? 700 : 500,
                      fontSize: 7.8,
                      color: INK.strong,
                      marginLeft: 6,
                    }}
                  >
                    {pick(s.title, lang)}
                  </Text>
                </View>
                <View style={{ width: 150, flexDirection: "row", alignItems: "center" }}>
                  <RangeBar range={s.investmentRon} max={maxInvestment} width={82} color={color} />
                  <Text
                    style={{
                      fontFamily: FONT.display,
                      fontWeight: 500,
                      fontSize: 7.4,
                      color: INK.strong,
                      marginLeft: 7,
                    }}
                  >
                    {formatRange(s.investmentRon, lang)}
                  </Text>
                </View>
                <View style={{ width: 118, flexDirection: "row", alignItems: "center" }}>
                  <RangeBar range={s.timeToValueMonths} max={maxMonths} width={76} color={color} />
                  <Text
                    style={{
                      fontFamily: FONT.display,
                      fontWeight: 500,
                      fontSize: 7.4,
                      color: INK.strong,
                      marginLeft: 7,
                    }}
                  >
                    {formatRange(s.timeToValueMonths, lang)}
                  </Text>
                </View>
                <View
                  style={{
                    flex: 1,
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "flex-end",
                  }}
                >
                  <LevelDots
                    level={implementationLevel(s.implementation)}
                    color={isRec ? BRAND.violet : "#9aa0c8"}
                  />
                  <Text
                    style={{
                      fontFamily: FONT.body,
                      fontSize: 7.2,
                      color: INK.strong,
                      marginLeft: 4,
                      width: 34,
                    }}
                  >
                    {levelLabel(s.implementation, lang)}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

/* ---------------------------------------------------------------- roadmap */

const TAG_TONE: Record<RoadmapPhase["tag"], ChipTone> = {
  essential: "dark",
  "high-impact": "violet",
  growth: "mint",
};

const TAG_FILL: Record<RoadmapPhase["tag"], [string, string]> = {
  essential: [BRAND.violet, BRAND.blue],
  "high-impact": [BRAND.blue, BRAND.sky],
  growth: [BRAND.sky, BRAND.mint],
};

function projectionAt(points: ProjectionPoint[], month: number): ProjectionPoint | undefined {
  const sorted = [...points].sort((a, b) => a.month - b.month).filter((p) => p.month <= month);
  return sorted[sorted.length - 1];
}

function LegendItem({ swatch, label }: { swatch: ReactNode; label: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", marginRight: 12, marginBottom: 2 }}>
      {swatch}
      <Text style={{ ...text.tiny, marginLeft: 4, color: INK.muted }}>{label}</Text>
    </View>
  );
}

function RoadmapSection({ ctx, breakBefore }: { ctx: PdfContext; breakBefore?: boolean }) {
  const { blueprint, lang, t } = ctx;
  const phases = blueprint.roadmap;
  const months = Math.max(3, ...phases.map((p) => p.endMonth));
  const labelW = 140;
  // Four or more phases: items run inline so the outlook chart still fits.
  const compact = phases.length >= 4;
  const gridW = CONTENT_WIDTH - labelW;
  const colW = gridW / months;
  const horizon = Math.min(12, Math.max(...blueprint.projection.map((p) => p.month), 0));
  const money = currency(lang);
  // Cumulative position at 3, 6 and 12 months (or the last month projected).
  const checkpoints = [3, 6, 12]
    .filter((m) => m <= horizon)
    .map((m) => projectionAt(blueprint.projection, m))
    .filter((p, i, list): p is ProjectionPoint => Boolean(p) && list.indexOf(p) === i);

  return (
    <View break={breakBefore}>
      <SectionTitle
        index={ctx.section("roadmap")}
        eyebrow={sectionName("roadmap", lang)}
        title={t(`Your next ${months} months`, `Următoarele ${months} luni`)}
        intro={t(
          "Each phase builds on the one before. Tags show what is essential, what has the most impact and what grows the business.",
          "Fiecare etapă pornește de la cea dinainte. Etichetele arată ce este esențial, ce aduce cel mai mult și ce face afacerea să crească.",
        )}
      />

      <View style={{ position: "relative" }}>
        <View style={{ flexDirection: "row", marginBottom: 4 }}>
          <View style={{ width: labelW }} />
          {Array.from({ length: months }, (_, i) => (
            <Text
              key={i}
              style={{
                ...text.eyebrow,
                fontSize: 5.6,
                letterSpacing: 0.8,
                color: INK.faint,
                width: colW,
                textAlign: "center",
              }}
            >
              {t(`M${i + 1}`, `Luna ${i + 1}`)}
            </Text>
          ))}
        </View>
        {Array.from({ length: months + 1 }, (_, i) => (
          <View
            key={i}
            style={{
              position: "absolute",
              left: labelW + i * colW,
              top: 12,
              bottom: 0,
              width: 0,
              borderLeftWidth: 0.5,
              borderLeftColor: INK.track,
              borderStyle: "dashed",
            }}
          />
        ))}
        {phases.map((phase, index) => {
          const [from, to] = TAG_FILL[phase.tag];
          const left = (phase.startMonth - 1) * colW + 3;
          const width = (phase.endMonth - phase.startMonth + 1) * colW - 6;
          // Text starts under its bar, but keeps at least 170 pt to wrap in.
          const textLeft = Math.max(0, Math.min(left, gridW - 170));
          return (
            <View
              key={index}
              wrap={false}
              style={{
                flexDirection: "row",
                paddingVertical: compact ? 5 : 7,
                borderTopWidth: index === 0 ? 0 : 0.5,
                borderTopColor: INK.hairline,
              }}
            >
              <View style={{ width: labelW, paddingRight: 10 }}>
                <View style={{ flexDirection: "row", alignItems: "baseline" }}>
                  <Text
                    style={{
                      fontFamily: FONT.display,
                      fontWeight: 700,
                      fontSize: 8.5,
                      color: INK.violetText,
                      marginRight: 5,
                    }}
                  >
                    {pad2(index + 1)}
                  </Text>
                  <Text style={{ ...text.h3, fontSize: 10.5 }}>{pick(phase.stage, lang)}</Text>
                </View>
                <View style={{ flexDirection: "row", alignItems: "center", marginTop: 3 }}>
                  <Text style={{ ...text.tiny, marginLeft: 16, marginRight: 5 }}>
                    {monthsLabel(phase.startMonth, phase.endMonth, lang)}
                  </Text>
                  <Chip label={tagLabel(phase.tag, lang)} tone={TAG_TONE[phase.tag]} />
                </View>
              </View>
              <View style={{ width: gridW }}>
                <View style={{ marginLeft: left }}>
                  <GradientBar
                    id={`phase-${index}`}
                    width={width}
                    height={10}
                    from={from}
                    to={to}
                  />
                </View>
                <View style={{ marginLeft: textLeft, width: gridW - textLeft }}>
                  <Text
                    style={{
                      fontFamily: FONT.body,
                      fontWeight: 700,
                      fontSize: 8.2,
                      color: INK.strong,
                      marginTop: 4,
                    }}
                  >
                    {pick(phase.title, lang)}
                  </Text>
                </View>
                {compact ? (
                  <Text
                    style={{
                      ...text.small,
                      color: INK.body,
                      marginTop: 1.5,
                      marginLeft: textLeft,
                      width: gridW - textLeft,
                    }}
                  >
                    {phase.items.map((item) => pick(item, lang)).join(" · ")}
                  </Text>
                ) : (
                  <View style={{ marginTop: 1.5, marginLeft: textLeft, width: gridW - textLeft }}>
                    {phase.items.slice(0, 5).map((item, i) => (
                      <View
                        key={i}
                        style={{
                          flexDirection: "row",
                          alignItems: "flex-start",
                          marginBottom: 1,
                          paddingRight: 6,
                        }}
                      >
                        <View
                          style={{
                            width: 3,
                            height: 3,
                            borderRadius: 2,
                            backgroundColor: BRAND.violet,
                            marginTop: 3.6,
                            marginRight: 4,
                          }}
                        />
                        <Text style={{ ...text.small, color: INK.body, flex: 1 }}>
                          {pick(item, lang)}
                        </Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            </View>
          );
        })}
      </View>

      {blueprint.projection.length >= 2 ? (
        <View
          wrap={false}
          style={{
            marginTop: 10,
            borderTopWidth: 0.7,
            borderTopColor: INK.hairline,
            paddingTop: 10,
          }}
        >
          <BlockTitle
            note={t(
              "Savings against what you spend on setup and tools. Bands show the range, lines the midpoint.",
              "Economiile față de ce cheltui pe implementare și aplicații. Benzile arată intervalul, liniile mijlocul.",
            )}
          >
            {t(`The first ${horizon} months, cumulative`, `Primele ${horizon} luni, cumulat`)}
          </BlockTitle>
          {checkpoints.length ? (
            <View style={{ marginTop: 2 }}>
              <View
                style={{
                  flexDirection: "row",
                  paddingBottom: 3,
                  borderBottomWidth: 0.7,
                  borderBottomColor: INK.hairline,
                }}
              >
                <Label style={{ width: 150 }}>{`${t("Cumulative", "Cumulat")}, ${money}`}</Label>
                {checkpoints.map((p) => (
                  <Label key={p.month} style={{ flex: 1, textAlign: "right" }}>
                    {t(`By month ${p.month}`, `Până în luna ${p.month}`)}
                  </Label>
                ))}
              </View>
              {[
                {
                  label: t("Saved", "Economisit"),
                  color: BRAND.violet,
                  value: (p: ProjectionPoint) => p.cumulativeSavingsRon,
                },
                {
                  label: t("Spent", "Cheltuit"),
                  color: INK.muted,
                  value: (p: ProjectionPoint) => p.cumulativeCostRon,
                },
                {
                  label: t(
                    "Net gain, cautious to optimistic",
                    "Câștig net, prudent până la optimist",
                  ),
                  color: INK.mintText,
                  value: (p: ProjectionPoint) => ({
                    low: p.cumulativeSavingsRon.low - p.cumulativeCostRon.high,
                    high: p.cumulativeSavingsRon.high - p.cumulativeCostRon.low,
                  }),
                },
              ].map((row, i) => (
                <View
                  key={row.label}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    paddingVertical: 3.4,
                    borderBottomWidth: 0.5,
                    borderBottomColor: INK.hairline,
                  }}
                >
                  <View style={{ width: 150, flexDirection: "row", alignItems: "center" }}>
                    <View
                      style={{
                        width: 3,
                        height: 9,
                        borderRadius: 1.5,
                        backgroundColor: row.color,
                        marginRight: 6,
                      }}
                    />
                    <Text
                      style={{
                        fontFamily: FONT.body,
                        fontWeight: i === 2 ? 700 : 500,
                        fontSize: 7.4,
                        color: INK.strong,
                      }}
                    >
                      {row.label}
                    </Text>
                  </View>
                  {checkpoints.map((p, j) => (
                    <Text
                      key={p.month}
                      style={{
                        flex: 1,
                        textAlign: "right",
                        fontFamily: FONT.display,
                        fontWeight: j === checkpoints.length - 1 ? 700 : 500,
                        fontSize: j === checkpoints.length - 1 ? 9 : 8,
                        color: i === 2 ? INK.mintText : INK.strong,
                      }}
                    >
                      {formatSignedRange(row.value(p), lang)}
                    </Text>
                  ))}
                </View>
              ))}
            </View>
          ) : null}
          <View style={{ marginTop: 8 }}>
            <ProjectionChart
              id="projection"
              points={blueprint.projection}
              width={CONTENT_WIDTH}
              height={compact ? 190 : 232}
              lang={lang}
              monthLabel={t("month", "luna")}
              breakEvenLabel={(m) =>
                t(`Break-even around month ${m}`, `Pragul de rentabilitate: în jurul lunii ${m}`)
              }
              laterLabel={t(
                `Mid estimate breaks even after month ${horizon}`,
                `Estimarea medie se recuperează după luna ${horizon}`,
              )}
            />
          </View>
          <View style={{ flexDirection: "row", flexWrap: "wrap", marginTop: 6 }}>
            <LegendItem
              swatch={
                <View
                  style={{
                    width: 14,
                    height: 6,
                    borderRadius: 2,
                    backgroundColor: BRAND.violet,
                    opacity: 0.8,
                  }}
                />
              }
              label={t("Cumulative savings", "Economii cumulate")}
            />
            <LegendItem
              swatch={
                <View
                  style={{
                    width: 14,
                    height: 0,
                    borderTopWidth: 1.4,
                    borderTopColor: INK.muted,
                    borderStyle: "dashed",
                  }}
                />
              }
              label={t("Cumulative cost", "Costuri cumulate")}
            />
            <LegendItem
              swatch={
                <View
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 4,
                    borderWidth: 1.4,
                    borderColor: INK.mintText,
                  }}
                />
              }
              label={t("Break-even, mid estimate", "Pragul de rentabilitate, estimare medie")}
            />
            <LegendItem
              swatch={
                <View style={{ width: 14, height: 8, backgroundColor: BRAND.mint, opacity: 0.3 }} />
              }
              label={t(
                "Break-even window, best to worst case",
                "Intervalul în care investiția se recuperează",
              )}
            />
          </View>
        </View>
      ) : null}
    </View>
  );
}

export function StrategyPage({ ctx }: { ctx: PdfContext }) {
  return (
    <LightPage ctx={ctx} label={ctx.t("Strategy", "Strategie")}>
      <StrategySection ctx={ctx} />
    </LightPage>
  );
}

export function RoadmapPage({ ctx }: { ctx: PdfContext }) {
  return (
    <LightPage ctx={ctx} label={ctx.t("Roadmap", "Plan de implementare")}>
      <RoadmapSection ctx={ctx} />
    </LightPage>
  );
}

/**
 * Strategy and roadmap on one flowing page, for light plans (one direction,
 * or a short roadmap without a projection) that would leave pages half empty.
 */
export function PlanPage({ ctx }: { ctx: PdfContext }) {
  return (
    <LightPage ctx={ctx} label={ctx.t("Strategy and roadmap", "Strategie și plan")}>
      <StrategySection ctx={ctx} />
      <View style={{ height: 18 }} />
      <RoadmapSection ctx={ctx} />
    </LightPage>
  );
}

/* ------------------------------------------------------------------ offer */

export function OfferPage({ ctx }: { ctx: PdfContext }) {
  const { blueprint, lang, t } = ctx;
  const { offer } = blueprint;
  const first = blueprint.roadmap[0];
  const sized =
    blueprint.totals.setupCostRon.high > 0 || blueprint.totals.monthlySavingsRon.high > 0;
  const art = { size: 300, left: 340, top: 50 };
  // What the one-off setup buys: the biggest time savers first, by hours.
  const covered = [...blueprint.opportunities].sort(
    (a, b) =>
      b.hoursSavedPerMonth.low +
      b.hoursSavedPerMonth.high -
      (a.hoursSavedPerMonth.low + a.hoursSavedPerMonth.high),
  );
  const steps = [
    {
      title: t("Book a consultation", "Programează o discuție"),
      body: t(
        "We walk through this blueprint with you and answer your questions.",
        "Trecem împreună prin acest plan și îți răspundem la întrebări.",
      ),
    },
    {
      title: t("Confirm the numbers", "Confirmăm cifrele"),
      body: t(
        "We swap typical volumes for yours, so the ranges tighten.",
        "Înlocuim volumele obișnuite cu ale tale, ca estimările să fie mai precise.",
      ),
    },
    {
      title: first
        ? t(
            `Start with the “${pick(first.stage, "en")}” phase`,
            `Începem cu etapa „${pick(first.stage, "ro")}”`,
          )
        : t("Start the first phase", "Începem prima etapă"),
      body: first
        ? `${monthsLabel(first.startMonth, first.endMonth, lang)}: ${pick(first.title, lang)}.`
        : t("We set up the first improvements together.", "Facem împreună primele îmbunătățiri."),
    },
  ];

  const background = (
    <>
      <Glow
        id="offer-g1"
        width={PAGE.width}
        height={PAGE.height}
        color={BRAND.violet}
        opacity={0.42}
        cx={0.86}
        cy={0.12}
        r={0.6}
      />
      <View style={{ position: "absolute", top: 0, left: 0 }}>
        <Glow
          id="offer-g2"
          width={PAGE.width}
          height={PAGE.height}
          color={BRAND.blue}
          opacity={0.22}
          cx={0.06}
          cy={0.98}
          r={0.55}
        />
      </View>
      <View style={{ position: "absolute", top: 0, left: 0 }}>
        <OrbitLines
          width={PAGE.width}
          height={PAGE.height}
          cx={art.left + art.size / 2}
          cy={art.top + art.size / 2}
          orbits={[
            { rx: 236, ry: 72, rotate: -18 },
            { rx: 196, ry: 124, rotate: 24, dashed: true },
          ]}
        />
      </View>
      <Image
        src={ctx.assets.swirl}
        style={{
          position: "absolute",
          left: art.left,
          top: art.top,
          width: art.size,
          height: art.size / LOGO_RATIO.swirl,
          opacity: 0.55,
        }}
      />
    </>
  );

  return (
    <DarkPage ctx={ctx} label={t("Offer", "Oferta")} background={background}>
      <SectionTitle
        index={ctx.section("offer")}
        eyebrow={sectionName("offer", lang)}
        title={pick(offer.title, lang)}
        intro={pick(offer.why, lang)}
        width={300}
        dark
      />

      <View style={{ flexGrow: 1, justifyContent: "space-between" }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 2 }}>
          <View
            style={{
              width: 305,
              backgroundColor: BRAND.glass2,
              borderWidth: 0.7,
              borderColor: NIGHT_INK.hairline,
              borderRadius: RADIUS.xl,
              padding: 16,
            }}
          >
            <Label color={NIGHT_INK.muted}>{t("What's included", "Ce include")}</Label>
            <View style={{ marginTop: 9 }}>
              {offer.includes.map((item, i) => (
                <View
                  key={i}
                  style={{ flexDirection: "row", alignItems: "center", marginBottom: 7 }}
                >
                  <View
                    style={{
                      width: 15,
                      height: 15,
                      borderRadius: 8,
                      backgroundColor: "#0d2b33",
                      alignItems: "center",
                      justifyContent: "center",
                      marginRight: 8,
                    }}
                  >
                    <PdfIcon name="check" size={8.5} color={BRAND.mint} strokeWidth={2.6} />
                  </View>
                  <Text
                    style={{
                      fontFamily: FONT.body,
                      fontWeight: 500,
                      fontSize: 8.8,
                      color: NIGHT_INK.strong,
                      flex: 1,
                    }}
                  >
                    {pick(item, lang)}
                  </Text>
                </View>
              ))}
            </View>
            <View
              style={{
                marginTop: 6,
                borderRadius: RADIUS.lg,
                borderWidth: 1,
                borderColor: BRAND.violet,
                paddingVertical: 10,
                paddingHorizontal: 12,
                backgroundColor: "#0d1035",
              }}
            >
              <Label color={BRAND.sky}>{t("Investment", "Investiție")}</Label>
              <Text
                style={{
                  fontFamily: FONT.display,
                  fontWeight: 700,
                  fontSize: 13.5,
                  color: NIGHT_INK.strong,
                  marginTop: 3,
                }}
              >
                {pick(offer.priceNote, lang)}
              </Text>
              <Text style={{ ...text.tiny, color: NIGHT_INK.muted, marginTop: 3 }}>
                {sized
                  ? t(
                      `Setting up the automations in this plan is estimated at ${formatRange(blueprint.totals.setupCostRon, lang)} RON. The final quote follows the discovery call.`,
                      `Implementarea automatizărilor din acest plan este estimată la ${formatRange(blueprint.totals.setupCostRon, lang)} lei. Oferta finală vine după discuția de evaluare.`,
                    )
                  : t(
                      "The final quote follows the discovery call.",
                      "Oferta finală vine după discuția de evaluare.",
                    )}
              </Text>
            </View>
          </View>

          <View style={{ width: 190 }}>
            <View
              style={{
                backgroundColor: INK.white,
                borderRadius: RADIUS.xl,
                // At least 4 modules of quiet zone around the code for reliable scans.
                paddingTop: 16,
                paddingHorizontal: 16,
                paddingBottom: 12,
                alignItems: "center",
              }}
            >
              <QrCode value={CONTACT.consultUrl} size={120} color={BRAND.night} />
              <Text
                style={{
                  fontFamily: FONT.display,
                  fontWeight: 700,
                  fontSize: 9.2,
                  color: INK.strong,
                  marginTop: 9,
                  textAlign: "center",
                }}
              >
                {t("Scan to book a consultation", "Scanează și programează o discuție")}
              </Text>
              <Link src={CONTACT.consultUrl} style={{ textDecoration: "none" }}>
                <Text
                  style={{
                    fontFamily: FONT.body,
                    fontWeight: 500,
                    fontSize: 7.4,
                    color: INK.violetText,
                    marginTop: 3,
                  }}
                >
                  vortexhub.dev/consultancy
                </Text>
              </Link>
            </View>
          </View>
        </View>

        {sized ? (
          <View
            style={{
              flexDirection: "row",
              paddingVertical: 11,
              borderTopWidth: 0.7,
              borderBottomWidth: 0.7,
              borderColor: NIGHT_INK.hairline,
            }}
          >
            {[
              {
                value: formatRange(blueprint.totals.hoursSavedPerMonth, lang),
                unit: t("hours back a month", "ore câștigate pe lună"),
              },
              {
                value: formatRange(blueprint.totals.monthlySavingsRon, lang),
                unit: t("RON saved a month", "lei economisiți pe lună"),
              },
              {
                value: formatRange(blueprint.totals.paybackMonths, lang, formatDecimal),
                unit: t("months to pay back", "luni până recuperezi investiția"),
              },
            ].map((stat, i) => (
              <View
                key={i}
                style={{
                  flex: 1,
                  paddingLeft: i ? 14 : 0,
                  borderLeftWidth: i ? 0.7 : 0,
                  borderLeftColor: NIGHT_INK.hairline,
                  marginLeft: i ? 14 : 0,
                }}
              >
                <Text
                  style={{
                    fontFamily: FONT.display,
                    fontWeight: 700,
                    fontSize: 16,
                    color: NIGHT_INK.strong,
                  }}
                >
                  {stat.value}
                </Text>
                <Text style={{ ...text.tiny, color: NIGHT_INK.muted, marginTop: 1 }}>
                  {stat.unit} · {t("estimate", "estimare")}
                </Text>
              </View>
            ))}
          </View>
        ) : null}

        {sized && covered.length ? (
          <View>
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <Label color={NIGHT_INK.muted}>
                {t("What the setup automates", "Ce automatizăm la implementare")}
              </Label>
              {covered.length > 4 ? (
                <Text style={{ ...text.tiny, color: NIGHT_INK.muted }}>
                  {t(
                    `+ ${covered.length - 4} more in the plan`,
                    `+ încă ${covered.length - 4} în plan`,
                  )}
                </Text>
              ) : null}
            </View>
            <View style={{ flexDirection: "row", marginTop: 8 }}>
              {covered.slice(0, 4).map((o, i) => (
                <View
                  key={o.id}
                  style={{
                    width: COL4,
                    marginLeft: i ? GAP : 0,
                    backgroundColor: BRAND.glass2,
                    borderWidth: 0.7,
                    borderColor: NIGHT_INK.hairline,
                    borderRadius: RADIUS.md,
                    paddingVertical: 9,
                    paddingHorizontal: 10,
                  }}
                >
                  <Text
                    style={{
                      fontFamily: FONT.body,
                      fontWeight: 700,
                      fontSize: 7.8,
                      lineHeight: 1.3,
                      color: NIGHT_INK.strong,
                      minHeight: 20,
                    }}
                  >
                    {truncate(pick(o.title, lang), 64)}
                  </Text>
                  <Text
                    style={{
                      fontFamily: FONT.display,
                      fontWeight: 700,
                      fontSize: 11,
                      color: BRAND.sky,
                      marginTop: 6,
                    }}
                  >
                    {formatRange(o.hoursSavedPerMonth, lang)}
                    <Text style={{ fontFamily: FONT.body, fontWeight: 500, fontSize: 6.8 }}>
                      {" "}
                      {t("h / month", "ore / lună")}
                    </Text>
                  </Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        <View>
          <Label color={NIGHT_INK.muted}>{t("Next steps", "Pașii următori")}</Label>
          <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 9 }}>
            {steps.map((step, i) => (
              <View
                key={i}
                style={{
                  width: COL3,
                  borderTopWidth: 1,
                  borderTopColor: i === 0 ? BRAND.violet : NIGHT_INK.hairline,
                  paddingTop: 9,
                }}
              >
                <Text
                  style={{
                    fontFamily: FONT.display,
                    fontWeight: 700,
                    fontSize: 17,
                    color: i === 0 ? BRAND.sky : NIGHT_INK.faint,
                  }}
                >
                  {pad2(i + 1)}
                </Text>
                <Text
                  style={{
                    fontFamily: FONT.display,
                    fontWeight: 700,
                    fontSize: 9.8,
                    color: NIGHT_INK.strong,
                    marginTop: 5,
                  }}
                >
                  {step.title}
                </Text>
                <Text style={{ ...text.small, color: NIGHT_INK.body, marginTop: 2 }}>
                  {step.body}
                </Text>
              </View>
            ))}
          </View>
        </View>

        <View>
          <Link src={ctx.reportUrl} style={{ textDecoration: "none" }}>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                backgroundColor: BRAND.glass2,
                borderWidth: 0.7,
                borderColor: NIGHT_INK.hairline,
                borderRadius: RADIUS.lg,
                paddingVertical: 11,
                paddingHorizontal: 13,
              }}
            >
              <IconBadge name="sparkles" size={24} tone="glass" />
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text
                  style={{
                    fontFamily: FONT.display,
                    fontWeight: 700,
                    fontSize: 9.8,
                    color: NIGHT_INK.strong,
                  }}
                >
                  {t("Open your live report", "Deschide raportul online")}
                </Text>
                <Text style={{ ...text.tiny, color: NIGHT_INK.muted, marginTop: 1 }}>
                  {t(
                    "The animated version of this blueprint, with the strategy simulation and the latest data.",
                    "Versiunea animată a acestui plan, cu simularea strategiilor și cele mai noi date.",
                  )}
                </Text>
                <Text
                  style={{
                    fontFamily: FONT.body,
                    fontWeight: 500,
                    fontSize: 7.2,
                    color: BRAND.sky,
                    marginTop: 2,
                  }}
                >
                  {truncate(ctx.reportUrl.replace(/^https?:\/\//, ""), 72)}
                </Text>
              </View>
              <PdfIcon name="arrowUpRight" size={13} color={BRAND.sky} />
            </View>
          </Link>

          <View style={{ flexDirection: "row", marginTop: 10 }}>
            {[
              { icon: "mail" as const, href: `mailto:${CONTACT.email}`, label: CONTACT.email },
              { icon: "globe" as const, href: CONTACT.siteUrl, label: CONTACT.site },
            ].map((item) => (
              <View
                key={item.label}
                style={{ flexDirection: "row", alignItems: "center", marginRight: 20 }}
              >
                <PdfIcon name={item.icon} size={9.5} color={BRAND.sky} />
                <Link src={item.href} style={{ textDecoration: "none" }}>
                  <Text
                    style={{
                      fontFamily: FONT.body,
                      fontWeight: 500,
                      fontSize: 8.4,
                      color: NIGHT_INK.strong,
                      marginLeft: 6,
                    }}
                  >
                    {item.label}
                  </Text>
                </Link>
              </View>
            ))}
          </View>
        </View>
      </View>
    </DarkPage>
  );
}

/* ------------------------------------------------------------ methodology */

/**
 * Extra air between blocks, taken only from room the page has left (capped),
 * so a short page spreads out evenly instead of ending in a blank band.
 */
function Breather() {
  return <View style={{ flexGrow: 1, maxHeight: 24 }} />;
}

export function MethodologyPage({ ctx }: { ctx: PdfContext }) {
  const { blueprint, lang, t } = ctx;
  const { company, audit, presence, competitors, assumptions, businessType } = blueprint;
  const checked = presence?.profiles.length ?? 0;
  const competitorCount = competitors?.length ?? 0;
  const confidence = Math.round(businessType.confidence * 100);
  const steps = [
    {
      icon: "building" as const,
      title: t("Identify the business", "Identificarea afacerii"),
      body: company
        ? t(
            `Registry data for CUI ${company.cui} from ${company.sources.includes("anaf") ? "ANAF's public API" : "the Trade Register open data"}${company.caen ? `, main activity CAEN ${company.caen}` : ""}.`,
            `Datele din registru pentru CUI ${company.cui}, din ${company.sources.includes("anaf") ? "API-ul public ANAF" : "datele deschise ale Registrului Comerțului"}${company.caen ? `, cu activitatea principală CAEN ${company.caen}` : ""}.`,
          )
        : t(
            "Website-only scan: no registry record was attached.",
            "Am scanat doar site-ul, fără date din registru.",
          ),
    },
    {
      icon: "scan" as const,
      title: t("Audit the website", "Analiza site-ului"),
      body: audit
        ? t(
            `${audit.pages.length} page${audit.pages.length === 1 ? "" : "s"} of ${audit.host} read on ${formatDate(audit.fetchedAt, lang)} and run through automated checks${audit.pagespeed ? ", plus Google Lighthouse" : ""}.`,
            `Am citit ${audit.pages.length} ${audit.pages.length === 1 ? "pagină" : "pagini"} de pe ${audit.host} pe ${formatDate(audit.fetchedAt, lang)} și le-am trecut prin verificări automate${audit.pagespeed ? " și prin Google Lighthouse" : ""}.`,
          )
        : t(
            "No website could be analysed for this business.",
            "Nu am putut analiza un site pentru această afacere.",
          ),
    },
    {
      icon: "users" as const,
      title: t("Presence and market", "Prezență online și concurență"),
      body: t(
        `${checked} online channel${checked === 1 ? "" : "s"} checked${presence?.googleRating ? ", with the rating from Google Places" : ""}; ${competitorCount} local competitor${competitorCount === 1 ? "" : "s"} from the company index.`,
        `Am verificat ${checked} ${checked === 1 ? "canal online" : "canale online"}${presence?.googleRating ? ", plus nota din Google Places" : ""} și am găsit ${competitorCount} ${competitorCount === 1 ? "concurent local" : `${roDe(competitorCount)}concurenți locali`} în registrul firmelor.`,
      ),
    },
    {
      icon: "layers" as const,
      title: t("Build the blueprint", "Construirea planului"),
      body:
        t(
          `Playbook for a ${pick(businessType.label, "en").toLowerCase()} (${confidence}% match). `,
          `Model de lucru: ${pick(businessType.label, "ro").toLowerCase()} (potrivire ${confidence}%). `,
        ) +
        (blueprint.engine === "ai"
          ? t(
              "Wording and assumptions refined with Claude (Anthropic); the money math stays fixed.",
              "Textele și ipotezele au fost ajustate cu Claude (Anthropic), iar calculele financiare rămân aceleași.",
            )
          : t(
              "Fixed rules only, with no AI rewriting.",
              "Doar reguli fixe, fără texte rescrise de AI.",
            )),
    },
  ];

  // The simulation's starting inputs only matter in the live report, so they stay there.
  const rows: Array<[string, string]> = [
    [
      t("Staff cost", "Costul muncii"),
      `${formatInt(assumptions.hourlyCostRon, lang)} ${currency(lang)}/${t("hour", "oră")} · ${localizeMoney(pick(assumptions.hourlyCostBasis, lang), lang)}`,
    ],
    [
      t("Team size", "Mărimea echipei"),
      `${formatRange(assumptions.teamSize, lang)} ${t("people", "persoane")}`,
    ],
    [
      t("Classification basis", "De ce acest tip de afacere"),
      businessType.basis.map((b) => localizeBasis(b, lang, company)).join("; "),
    ],
  ];

  const sources = [
    {
      label: t("ANAF public API", "API-ul public ANAF"),
      used: Boolean(company?.sources.includes("anaf")),
    },
    {
      label: t("Trade Register index", "Registrul ONRC"),
      used: Boolean(company?.sources.includes("index")) || Boolean(competitors?.length),
    },
    { label: t("Website crawl", "Analiza site-ului"), used: Boolean(audit) },
    { label: "Google Lighthouse", used: Boolean(audit?.pagespeed) },
    { label: "Google Places", used: Boolean(presence?.googleRating) },
    {
      label: t("AI refinement (Claude)", "Ajustare cu AI (Claude)"),
      used: blueprint.engine === "ai",
    },
  ];

  const glossary: Array<[string, string]> = [
    [
      t("Payback", "Recuperarea investiției"),
      t(
        "Months until the savings cover the setup cost.",
        "În câte luni economiile acoperă costul de implementare.",
      ),
    ],
    [
      t("Break-even", "Pragul de rentabilitate"),
      t(
        "The month when total savings overtake total costs.",
        "Luna în care economiile adunate depășesc costurile adunate.",
      ),
    ],
    [
      t("Range", "Interval"),
      t(
        "Every estimate has a cautious and an optimistic value; reality is usually in between.",
        "Fiecare estimare are o valoare prudentă și una optimistă; realitatea e de obicei între ele.",
      ),
    ],
    [
      "Core Web Vitals",
      t(
        "Google's measures of how fast and stable your pages feel (LCP, CLS, TBT).",
        "Indicatorii Google pentru cât de repede și stabil se încarcă paginile (LCP, CLS, TBT).",
      ),
    ],
    [
      "SEO",
      t(
        "How easily people find you on Google and other search engines.",
        "Cât de ușor te găsesc clienții pe Google și în alte motoare de căutare.",
      ),
    ],
    [
      t("Conversion", "Conversie"),
      t(
        "A visitor taking a step: calling, writing, booking or ordering.",
        "Un vizitator care face un pas concret: sună, scrie, face o programare sau o comandă.",
      ),
    ],
  ];

  const bands = [
    { range: "0–39", label: scoreBand("health", 20, lang), color: BRAND.violet },
    { range: "40–69", label: scoreBand("health", 50, lang), color: BRAND.blue },
    { range: "70–100", label: scoreBand("health", 80, lang), color: BRAND.mint },
  ];

  return (
    <LightPage ctx={ctx} label={t("Methodology", "Metodologie")}>
      <SectionTitle
        index={ctx.section("methodology")}
        eyebrow={sectionName("methodology", lang)}
        title={t("How we built this blueprint", "Cum am realizat acest plan")}
        intro={t(
          "Measured facts come from public sources and your website. Money and time are estimates: ranges from stated assumptions, calculated the same way for every business.",
          "Datele măsurate vin din surse publice și de pe site-ul tău. Banii și timpul sunt estimări: intervale calculate din ipotezele de mai jos, la fel pentru orice afacere.",
        )}
      />

      {/* The four steps as one process strip: numbered nodes on a gradient line. */}
      <View wrap={false} style={{ marginBottom: 14 }}>
        <View style={{ position: "absolute", top: 10, left: 11, right: COL4 - 11 }}>
          <GradientRule id="method-line" width={CONTENT_WIDTH - COL4} height={1} />
        </View>
        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
          {steps.map((step, i) => (
            <View key={i} style={{ width: COL4 }}>
              <IconBadge name={step.icon} size={22} tone={i === 0 ? "dark" : "violet"} />
              <Label style={{ marginTop: 7 }}>{`${t("Step", "Pasul")} ${pad2(i + 1)}`}</Label>
              <Text style={{ ...text.h3, fontSize: 9.4, marginTop: 2 }}>{step.title}</Text>
              <Text style={{ ...text.small, color: INK.body, marginTop: 2 }}>{step.body}</Text>
            </View>
          ))}
        </View>
      </View>

      <Breather />
      <BlockTitle style={{ marginTop: 4 }}>{t("Assumptions", "Ipoteze")}</BlockTitle>
      <View style={{ borderTopWidth: 0.7, borderTopColor: INK.hairline }}>
        {[
          ...rows,
          ...(assumptions.notes.length
            ? ([
                [
                  t("Notes", "Note"),
                  localizeMoney(assumptions.notes.map((n) => pick(n, lang)).join(" "), lang),
                ],
              ] as Array<[string, string]>)
            : []),
        ].map(([label, value]) => (
          <View
            key={label}
            style={{
              flexDirection: "row",
              paddingVertical: 4,
              borderBottomWidth: 0.5,
              borderBottomColor: INK.hairline,
            }}
          >
            <Text
              style={{
                ...text.eyebrow,
                fontSize: 5.8,
                letterSpacing: 0.9,
                color: INK.faint,
                width: 124,
                marginTop: 1.5,
              }}
            >
              {label}
            </Text>
            <Text
              style={{
                fontFamily: FONT.body,
                fontSize: 7.8,
                lineHeight: 1.42,
                color: INK.strong,
                flex: 1,
              }}
            >
              {value}
            </Text>
          </View>
        ))}
      </View>

      <Breather />
      <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 14 }}>
        <View style={{ width: COL2 }}>
          <BlockTitle>{t("Data sources in this report", "Sursele de date folosite")}</BlockTitle>
          <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
            {sources
              .filter((source) => source.used)
              .map((source) => (
                <Chip
                  key={source.label}
                  label={source.label}
                  tone="mint"
                  icon="check"
                  style={{ marginRight: 4, marginBottom: 4 }}
                />
              ))}
          </View>
          {sources.some((source) => !source.used) ? (
            <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center" }}>
              <Text style={{ ...text.tiny, marginRight: 5, marginBottom: 4 }}>
                {t("Not used this time:", "Nefolosite de data aceasta:")}
              </Text>
              {sources
                .filter((source) => !source.used)
                .map((source) => (
                  <Chip
                    key={source.label}
                    label={source.label}
                    tone="outline"
                    icon="x"
                    style={{ marginRight: 4, marginBottom: 4 }}
                  />
                ))}
            </View>
          ) : null}
        </View>
        <View style={{ width: COL2 }}>
          <BlockTitle>{t("How to read the scores", "Cum citești scorurile")}</BlockTitle>
          <View style={{ flexDirection: "row" }}>
            {bands.map((band, i) => (
              <View key={band.range} style={{ flex: 1, marginLeft: i ? 4 : 0 }}>
                <View style={{ height: 4, borderRadius: 2, backgroundColor: band.color }} />
                <Text style={{ ...text.number, fontSize: 8.6, marginTop: 4 }}>{band.range}</Text>
                <Text style={{ ...text.tiny }}>{band.label}</Text>
              </View>
            ))}
          </View>
          <Text style={{ ...text.tiny, marginTop: 5 }}>
            {t(
              "Automation potential reads the other way: a high score means more routine work to take off your team.",
              "Potențialul de automatizare se citește invers: un scor mare înseamnă mai multă muncă repetitivă de luat de pe umerii echipei.",
            )}
          </Text>
        </View>
      </View>

      <Breather />
      <View wrap={false} style={{ marginTop: 12 }}>
        <BlockTitle>
          {t("Words used in this blueprint", "Termeni folosiți în acest plan")}
        </BlockTitle>
        <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between" }}>
          {glossary.map(([term, meaning]) => (
            <View
              key={term}
              style={{
                width: COL3,
                paddingVertical: 4,
                borderTopWidth: 0.5,
                borderTopColor: INK.hairline,
              }}
            >
              <Text style={{ ...text.small, color: INK.body }}>
                <Text style={{ fontFamily: FONT.body, fontWeight: 700, color: INK.strong }}>
                  {term}.{" "}
                </Text>
                {meaning}
              </Text>
            </View>
          ))}
        </View>
      </View>

      <Breather />
      <View
        wrap={false}
        style={{
          marginTop: 12,
          flexDirection: "row",
          backgroundColor: INK.violetTint,
          borderRadius: RADIUS.lg,
          paddingVertical: 10,
          paddingHorizontal: 12,
        }}
      >
        <View
          style={{ width: 3, borderRadius: 2, backgroundColor: BRAND.violet, marginRight: 10 }}
        />
        <View style={{ flex: 1 }}>
          <Text style={{ ...text.h3 }}>
            {t("Estimates, not guarantees", "Estimări, nu garanții")}
          </Text>
          <Text style={{ ...text.body, fontSize: 7.9, marginTop: 2 }}>
            {localizeMoney(pick(blueprint.disclaimer, lang), lang)}
          </Text>
          <Text style={{ ...text.small, fontSize: 7, marginTop: 2 }}>
            {t(
              "This document uses public information available on the date shown and typical figures for similar businesses. It is not financial, legal or tax advice. Real results depend on your volumes, your team and how the changes are adopted.",
              "Documentul folosește informații publice disponibile la data menționată și cifre obișnuite pentru afaceri similare. Nu este consultanță financiară, juridică sau fiscală. Rezultatele reale depind de volumele tale, de echipă și de felul în care sunt adoptate schimbările.",
            )}
          </Text>
          <Text style={{ ...text.tiny, marginTop: 3 }}>
            {t("Blueprint", "Plan")} {blueprint.id} · {t("generated", "generat la")}{" "}
            {formatDate(blueprint.generatedAt, lang)} ·{" "}
            {blueprint.engine === "ai"
              ? t("rules and AI-assisted wording", "reguli fixe și texte ajustate cu AI")
              : t("rules engine", "reguli fixe")}
          </Text>
        </View>
      </View>
    </LightPage>
  );
}

/* ------------------------------------------------------------- back cover */

export function BackCover({ ctx }: { ctx: PdfContext }) {
  const { t, assets } = ctx;
  const logoW = 330;
  const logoH = logoW / LOGO_RATIO.chrome;
  const centerY = 360;
  return (
    <DarkPage ctx={ctx} chrome={false}>
      <Layer>
        <Image
          src={assets.coverArt}
          style={{ width: PAGE.width, height: PAGE.height, objectFit: "cover", opacity: 0.45 }}
        />
      </Layer>
      <Layer>
        <Glow
          id="back-g1"
          width={PAGE.width}
          height={PAGE.height}
          color={BRAND.night}
          opacity={0.2}
          cx={0.5}
          cy={0.43}
          r={0.4}
        />
      </Layer>
      <Layer>
        <OrbitLines
          width={PAGE.width}
          height={PAGE.height}
          cx={PAGE.width / 2}
          cy={centerY}
          orbits={[
            { rx: 250, ry: 70, rotate: -10 },
            { rx: 205, ry: 120, rotate: 16, dashed: true },
          ]}
        />
      </Layer>
      <Logo
        src={assets.chrome}
        ratio={LOGO_RATIO.chrome}
        height={logoH}
        style={{ position: "absolute", left: (PAGE.width - logoW) / 2, top: centerY - logoH / 2 }}
      />
      <View
        style={{
          position: "absolute",
          left: SPACE.gutter,
          right: SPACE.gutter,
          top: centerY + logoH / 2 + 34,
          alignItems: "center",
        }}
      >
        <Text
          style={{
            fontFamily: FONT.display,
            fontWeight: 500,
            fontSize: 10.5,
            letterSpacing: 0.4,
            color: NIGHT_INK.body,
            textAlign: "center",
          }}
        >
          {t(
            "Powered by AI · Built for real business outcomes",
            "Construit cu AI · Pentru rezultate reale",
          )}
        </Text>
        <View style={{ flexDirection: "row", marginTop: 18 }}>
          <Link src={CONTACT.siteUrl} style={{ textDecoration: "none" }}>
            <Text style={{ fontFamily: FONT.body, fontWeight: 500, fontSize: 9, color: BRAND.sky }}>
              {CONTACT.site}
            </Text>
          </Link>
          <Text
            style={{
              fontFamily: FONT.body,
              fontSize: 9,
              color: NIGHT_INK.faint,
              marginHorizontal: 8,
            }}
          >
            ·
          </Text>
          <Link src={`mailto:${CONTACT.email}`} style={{ textDecoration: "none" }}>
            <Text style={{ fontFamily: FONT.body, fontWeight: 500, fontSize: 9, color: BRAND.sky }}>
              {CONTACT.email}
            </Text>
          </Link>
        </View>
      </View>
      <View
        style={{
          position: "absolute",
          bottom: 36,
          left: 0,
          right: 0,
          flexDirection: "row",
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <Logo src={assets.swirl} ratio={LOGO_RATIO.swirl} height={12} />
        <Text
          style={{ fontFamily: FONT.body, fontSize: 6.8, color: NIGHT_INK.muted, marginLeft: 6 }}
        >
          © {new Date(ctx.blueprint.generatedAt).getFullYear()} Vortex Hub
        </Text>
      </View>
    </DarkPage>
  );
}
