import { Image, Link, Text, View } from "@react-pdf/renderer";

import { tableRows, type DisplayStrategy } from "@/lib/scan/blueprint/display";
import { lcFirst } from "@/lib/scan/blueprint/format";

import { LOGO_RATIO } from "./assets";
import { Gantt, ImpactChart, type GanttRow } from "./charts";
import {
  formatDate,
  formatNumber,
  listOf,
  monthLabel,
  monthsQty,
  pick,
  roNeedsDe,
  truncate,
  ucFirst,
} from "./format";
import { PdfIcon } from "./icons";
import { localizeBasis } from "./localize";
import {
  BlockTitle,
  Dash,
  DarkPage,
  KeyValue,
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
  hasImpact,
  kpiStat,
  planSpan,
  strategyCategory,
  strategyOption,
  type PdfContext,
} from "./model";
import { OpportunitiesSection } from "./pages-findings";
import { QrCode } from "./qr";
import {
  BRAND,
  COL2,
  COL3,
  COMPANY,
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
  type Style,
} from "./theme";

/** "4 lucruri care te fac să pierzi pacienți: …" → the claim and its detail. */
function splitResult(value: string): { head: string; tail: string | null } {
  const at = value.indexOf(": ");
  if (at < 0) return { head: value, tail: null };
  const rest = value.slice(at + 2).trim();
  if (!rest) return { head: value.slice(0, at), tail: null };
  const tail = ucFirst(rest);
  return { head: value.slice(0, at), tail: /[.!?]$/.test(tail) ? tail : `${tail}.` };
}

/** Note ⁴ is the first assumption: the share of questions the assistant takes. */
const ASSUMPTION_NOTE = 4;

const COUNT_RO: Record<number, string> = { 2: "Două", 3: "Trei", 4: "Patru" };
const COUNT_EN: Record<number, string> = { 2: "Two", 3: "Three", 4: "Four" };

/* --------------------------------------------------------------- strategy */

/** The top of a direction's column, on a rule: category, title, reason, what it does. */
function StrategyHead({
  ctx,
  strategy,
  width,
}: {
  ctx: PdfContext;
  strategy: DisplayStrategy;
  width: number;
}) {
  const { blueprint, plan, lang, t } = ctx;
  const option = strategyOption(blueprint, strategy.id);
  const start = strategy.start;
  const titles = new Map(plan.automations.map((a) => [a.id, pick(a.title, lang)]));
  const covers = (option?.opportunityIds ?? [])
    .map((id) => titles.get(id))
    .filter((title): title is string => Boolean(title));
  const site = strategy.phases.some((p) => p.key === "foundation");

  return (
    <View
      style={{
        width,
        borderTopWidth: start ? 2 : 0.75,
        borderTopColor: start ? INK.violet : INK.rule,
        // The 2 pt start rule and the thin one keep the text on one line.
        paddingTop: start ? 7 : 8.25,
      }}
    >
      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
        <Tag>{strategyCategory(strategy.id, site, lang)}</Tag>
        {start ? (
          <Tag variant="start">{t("We start here", "Începem aici")}</Tag>
        ) : strategy.optional ? (
          <Tag>{t("Optional", "Opțional")}</Tag>
        ) : null}
      </View>
      <Text style={{ ...text.h3, marginTop: 6 }}>{pick(strategy.title, lang)}</Text>
      {start ? (
        <Text style={{ ...text.small, color: INK.strong, marginTop: 3 }}>
          {pick(start.reason, lang)}
        </Text>
      ) : null}
      {option ? (
        <Text style={{ ...text.small, marginTop: 3 }}>
          {truncate(pick(option.summary, lang), 170)}
        </Text>
      ) : null}
      {option?.tactics.length ? (
        <View style={{ marginTop: 5 }}>
          {/* Four at most, as on the scan: a site card lists one line per gap it counts. */}
          {option.tactics.slice(0, 4).map((tactic) => (
            <Dash key={tactic.en} size={7.4} style={{ marginBottom: 2 }}>
              {pick(tactic, lang)}
            </Dash>
          ))}
        </View>
      ) : null}
      {covers.length ? (
        <Text style={{ ...text.tiny, marginTop: 4 }}>
          {t("Includes", "Include")}: {listOf(covers, lang, 4)}.
        </Text>
      ) : null}
    </View>
  );
}

/** A direction's facts, the same rows as the strategy card on screen (tops aligned across columns). */
function StrategyFacts({
  ctx,
  strategy,
  width,
}: {
  ctx: PdfContext;
  strategy: DisplayStrategy;
  width: number;
}) {
  const { lang } = ctx;
  return (
    <View style={{ width }}>
      {strategy.facts.map((fact, i) => {
        const last = i === strategy.facts.length - 1;
        const value = pick(fact.value, lang);
        return (
          <KeyValue
            key={fact.label.en}
            label={pick(fact.label, lang)}
            labelWidth={64}
            last={last}
            value={
              last ? (
                <View>
                  <Text
                    style={{
                      fontFamily: FONT.body,
                      fontSize: 7.6,
                      lineHeight: 1.35,
                      color: INK.strong,
                    }}
                  >
                    {ucFirst(splitResult(value).head)}
                    {strategy.assumption ? <NoteRef n={ASSUMPTION_NOTE} /> : null}
                  </Text>
                  {strategy.assumption ? (
                    <Tag variant="dashed" style={{ marginTop: 3 }}>
                      {pick(strategy.assumption, lang)}
                    </Tag>
                  ) : null}
                </View>
              ) : (
                value
              )
            }
          />
        );
      })}
    </View>
  );
}

function StrategySection({
  ctx,
  style,
  planBelow,
}: {
  ctx: PdfContext;
  style?: Style;
  /** The plan follows on the same page (light plans). */
  planBelow?: boolean;
}) {
  const { blueprint, plan, lang, t } = ctx;
  const strategies = plan.strategies.slice(0, 3);
  const count = strategies.length;
  const colW = count >= 3 ? COL3 : count === 2 ? COL2 : CONTENT_WIDTH;
  const starting = strategies.find((s) => s.start);

  // Title and columns move together: a direction is never split from its heading.
  return (
    <View wrap={false} style={style}>
      <SectionTitle
        title={
          count === 1
            ? t("One direction, with its cost and gain", "O direcție, cu costul și câștigul ei")
            : t(
                `${COUNT_EN[count] ?? count} directions, each with its cost and gain`,
                `${COUNT_RO[count] ?? count} direcții, fiecare cu cost și câștig`,
              )
        }
        intro={[
          count > 1
            ? t("You can do them one at a time or together.", "Le poți face pe rând sau împreună.")
            : "",
          starting
            ? t(
                `We'd start with “${pick(starting.title, "en")}”. The plan ${planBelow ? "below" : "on the next page"} shows each stage with its hours and cost.`,
                `Începem cu „${pick(starting.title, "ro")}”. Planul de ${planBelow ? "mai jos" : "pe pagina următoare"} arată fiecare etapă, cu orele și costul ei.`,
              )
            : "",
        ]
          .filter(Boolean)
          .join(" ")}
      />

      {!blueprint.opportunities.length ? (
        <View style={{ marginBottom: 12 }}>
          <Text style={{ ...text.h4 }}>
            {t("No automations sized yet", "Încă nu am estimat automatizări")}
          </Text>
          <Text style={{ ...text.small, marginTop: 2 }}>
            {t(
              "We didn't find routine work we could size with confidence. A short call usually brings it to light.",
              "Nu am găsit muncă repetitivă pe care să o putem estima sigur. De obicei, o discuție scurtă o scoate la iveală.",
            )}
          </Text>
        </View>
      ) : null}

      <View
        style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "stretch" }}
        wrap={false}
      >
        {strategies.map((strategy) => (
          <StrategyHead key={strategy.id} ctx={ctx} strategy={strategy} width={colW} />
        ))}
      </View>
      <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 8 }}>
        {strategies.map((strategy) => (
          <StrategyFacts key={strategy.id} ctx={ctx} strategy={strategy} width={colW} />
        ))}
      </View>
    </View>
  );
}

/* ------------------------------------------------------------------- plan */

function PlanSection({ ctx, breakBefore }: { ctx: PdfContext; breakBefore?: boolean }) {
  const { plan, lang, t } = ctx;
  const months = planSpan(plan);
  const rows: GanttRow[] = plan.phases.map((phase) => ({
    key: phase.key,
    name: pick(phase.title, lang),
    months: phase.months,
    start: Boolean(phase.start),
    milestone: phase.siteMilestone,
    hours: phase.hoursPerMonth,
    cost: phase.setupLei,
  }));

  return (
    <View break={breakBefore}>
      <SectionTitle
        title={pick(plan.text.roadmapTitle, lang)}
        intro={pick(plan.text.roadmapLead, lang)}
      />
      <Gantt
        rows={rows}
        months={months}
        width={CONTENT_WIDTH}
        lang={lang}
        total={{
          hours: plan.totals.hoursPerMonth,
          cost: plan.totals.setupLei,
          note: pick(plan.text.totalNote, lang),
        }}
      />

      <View style={{ marginTop: 14, borderTopWidth: 0.75, borderTopColor: INK.rule }}>
        {plan.phases.map((phase, i) => (
          <View
            key={phase.key}
            wrap={false}
            style={{
              flexDirection: "row",
              paddingVertical: 8,
              borderTopWidth: i ? 0.5 : 0,
              borderTopColor: INK.hairline,
            }}
          >
            <Text
              style={{
                fontFamily: FONT.display,
                fontSize: 7.8,
                color: INK.muted,
                width: 70,
                paddingTop: 1,
              }}
            >
              {pick(phase.dateLabel, lang)}
            </Text>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <Text style={{ ...text.h4 }}>{pick(phase.title, lang)}</Text>
                {phase.start ? (
                  <Tag variant="start" style={{ marginLeft: 8 }}>
                    {t("We start here", "Începem aici")}
                  </Tag>
                ) : null}
              </View>
              {phase.start ? (
                <Text style={{ ...text.small, color: INK.strong, marginTop: 2 }}>
                  {pick(phase.start.reason, lang)}
                </Text>
              ) : null}
              <View style={{ flexDirection: "row", marginTop: 2 }}>
                <Text style={{ ...text.small, marginRight: 14 }}>
                  {pick(phase.hoursText, lang)}
                </Text>
                <Text style={{ ...text.small }}>{pick(phase.costText, lang)}</Text>
              </View>
              {phase.items.length ? (
                <View style={{ marginTop: 3 }}>
                  {phase.items.slice(0, 4).map((item) => (
                    <Dash key={item.en} size={7.6} style={{ marginBottom: 1.5 }}>
                      {pick(item, lang)}
                    </Dash>
                  ))}
                </View>
              ) : null}
              {phase.brings ? (
                <Text style={{ ...text.small, color: INK.body, marginTop: 2 }}>
                  {pick(phase.brings, lang)}
                </Text>
              ) : null}
              {phase.tools.length ? (
                <Text style={{ ...text.tiny, marginTop: 2 }}>
                  {t("Tools", "Instrumente")}:{" "}
                  {/* The first four, no "și încă N" (same as the scan's tools line). */}
                  {listOf(
                    phase.tools.slice(0, 4).map((tool) => pick(tool, lang)),
                    lang,
                  )}
                  .
                </Text>
              ) : null}
            </View>
          </View>
        ))}
      </View>
      <Text
        style={{
          ...text.small,
          marginTop: 4,
          paddingTop: 6,
          borderTopWidth: 0.5,
          borderTopColor: INK.hairline,
        }}
      >
        {pick(plan.text.footer, lang)}{" "}
        {t(
          "The notes behind the figures are on the last working page.",
          "Notele din spatele cifrelor sunt pe ultima pagină de lucru.",
        )}
      </Text>
    </View>
  );
}

/* ----------------------------------------------------------------- impact */

function WhatChanges({ ctx }: { ctx: PdfContext }) {
  const { plan, lang, t } = ctx;
  if (!plan.strategies.length) return null;
  const strategies = plan.strategies.slice(0, 3);
  const colW = (CONTENT_WIDTH - GAP * (strategies.length - 1)) / strategies.length;
  return (
    <View wrap={false} style={{ marginTop: 16 }}>
      <BlockTitle rule note={pick(plan.text.team, lang)}>
        {t("What changes", "Ce se schimbă")}
      </BlockTitle>
      <View style={{ flexDirection: "row" }}>
        {strategies.map((strategy, i) => {
          const { head, tail } = splitResult(pick(strategy.result, lang));
          return (
            <View
              key={strategy.id}
              style={{
                width: colW,
                marginLeft: i ? GAP : 0,
                borderTopWidth: strategy.start ? 2 : 0.5,
                borderTopColor: strategy.start ? INK.violet : INK.hairline,
                paddingTop: strategy.start ? 5 : 6.5,
              }}
            >
              <Label>{pick(strategy.label, lang)}</Label>
              <Text
                style={{
                  fontFamily: FONT.display,
                  fontWeight: 700,
                  fontSize: 10,
                  lineHeight: 1.3,
                  color: INK.strong,
                  marginTop: 2,
                }}
              >
                {ucFirst(head)}
                {strategy.assumption ? <NoteRef n={ASSUMPTION_NOTE} /> : null}
              </Text>
              {strategy.assumption ? (
                <Tag variant="dashed" style={{ marginTop: 3 }}>
                  {pick(strategy.assumption, lang)}
                </Tag>
              ) : null}
              <Text style={{ ...text.small, color: INK.body, marginTop: 3 }}>
                {tail ?? pick(strategy.support, lang)}
              </Text>
              <Text style={{ ...text.tiny, marginTop: 3 }}>
                {pick(strategy.title, lang)}
                {strategy.optional ? t(" (optional)", " (opțional)") : ""}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

function ImpactSection({ ctx }: { ctx: PdfContext }) {
  const { plan, lang, t, horizon } = ctx;
  const rows = tableRows(plan, horizon);
  const span = monthsQty(horizon);
  const cols = { value: 92, cost: 70, net: 70, status: 92 };
  const head = { ...text.label, fontSize: 6.8 };
  return (
    <View>
      <SectionTitle
        title={pick(plan.text.conclusion, lang)}
        intro={`${pick(plan.text.chartLead, lang)} ${t(`The first ${span.en}, base estimate.`, `Primele ${span.ro}, cu estimarea de bază.`)}`}
      />
      <ImpactChart plan={plan} horizon={horizon} width={CONTENT_WIDTH} height={206} lang={lang} />
      <StatRow cells={kpiStat(ctx)} style={{ marginTop: 8 }} />

      <View wrap={false} style={{ marginTop: 16 }}>
        <BlockTitle rule note={t("Cumulative, in RON", "Cumulat, în lei")}>
          {t("Month by month", "Lună de lună")}
        </BlockTitle>
        <View
          style={{
            flexDirection: "row",
            paddingBottom: 3,
            borderBottomWidth: 0.75,
            borderBottomColor: INK.rule,
          }}
        >
          <Text style={{ ...head, flex: 1 }}>{t("Month", "Luna")}</Text>
          <Text style={{ ...head, width: cols.value, textAlign: "right" }}>
            {t("Value of hours", "Valoarea orelor")}
          </Text>
          <Text style={{ ...head, width: cols.cost, textAlign: "right" }}>{t("Cost", "Cost")}</Text>
          <Text style={{ ...head, width: cols.net, textAlign: "right" }}>{t("Net", "Net")}</Text>
          <Text style={{ ...head, width: cols.status, paddingLeft: 16 }}>
            {t("Status", "Stare")}
          </Text>
        </View>
        {rows.map((row) => (
          <View
            key={row.month}
            style={{
              flexDirection: "row",
              alignItems: "center",
              paddingVertical: 3.6,
              paddingHorizontal: row.breakEven ? 4 : 0,
              marginHorizontal: row.breakEven ? -4 : 0,
              backgroundColor: row.breakEven ? INK.violetTint : undefined,
              borderBottomWidth: 0.5,
              borderBottomColor: INK.hairline,
            }}
          >
            <Text style={{ fontFamily: FONT.display, fontSize: 7.8, color: INK.body, flex: 1 }}>
              {pick(row.label, lang)}
            </Text>
            <Text style={{ ...text.num, width: cols.value, textAlign: "right" }}>
              {formatNumber(row.value, lang)}
            </Text>
            <Text style={{ ...text.num, width: cols.cost, textAlign: "right" }}>
              {formatNumber(row.cost, lang)}
            </Text>
            <Text style={{ ...text.num, width: cols.net, textAlign: "right" }}>
              {row.net > 0 ? "+" : ""}
              {formatNumber(row.net, lang)}
            </Text>
            <Text
              style={{
                fontFamily: FONT.body,
                fontSize: 7.4,
                width: cols.status,
                paddingLeft: 16,
                color: row.breakEven ? INK.violet : INK.muted,
              }}
            >
              {row.breakEven ? t("pays back", "se recuperează") : pick(row.status, lang)}
            </Text>
          </View>
        ))}
      </View>

      <WhatChanges ctx={ctx} />
    </View>
  );
}

/**
 * What can be automated, then the directions that group it, on flowing pages:
 * the directions follow the last automation instead of starting a half-empty page.
 */
export function WorkPage({ ctx }: { ctx: PdfContext }) {
  const automations = ctx.blueprint.opportunities.length > 0;
  return (
    <LightPage
      ctx={ctx}
      label={
        automations
          ? ctx.t("Automation and directions", "Automatizări și direcții")
          : ctx.t("Directions", "Direcții")
      }
    >
      {automations ? <OpportunitiesSection ctx={ctx} /> : null}
      <StrategySection ctx={ctx} style={automations ? { marginTop: 22 } : undefined} />
    </LightPage>
  );
}

/** What can be automated on its own pages (light plans put the directions with the plan). */
export function OpportunitiesPage({ ctx }: { ctx: PdfContext }) {
  return (
    <LightPage ctx={ctx} label={ctx.t("Automation", "Automatizări")}>
      <OpportunitiesSection ctx={ctx} />
    </LightPage>
  );
}

export function RoadmapPage({ ctx }: { ctx: PdfContext }) {
  return (
    <LightPage ctx={ctx} label={ctx.t("Plan", "Plan")}>
      <PlanSection ctx={ctx} />
    </LightPage>
  );
}

export function ImpactPage({ ctx }: { ctx: PdfContext }) {
  if (!hasImpact(ctx)) return null;
  return (
    <LightPage ctx={ctx} label={ctx.t("Impact", "Impact")}>
      <ImpactSection ctx={ctx} />
    </LightPage>
  );
}

/** Strategy and plan on one flowing page, for light plans that would leave pages half empty. */
export function PlanPage({ ctx }: { ctx: PdfContext }) {
  return (
    <LightPage ctx={ctx} label={ctx.t("Directions and plan", "Direcții și plan")}>
      <StrategySection ctx={ctx} planBelow />
      <View style={{ height: 20 }} />
      <PlanSection ctx={ctx} />
    </LightPage>
  );
}

/* ------------------------------------------------------------------ offer */

export function OfferPage({ ctx }: { ctx: PdfContext }) {
  const { blueprint, plan, lang, t } = ctx;
  const { offer } = blueprint;
  const start = plan.phases.find((p) => p.start) ?? plan.phases[0];
  const price = pick(offer.priceNote, lang);
  const amount = /(\d[\d.,]*\s?(?:lei|RON))/.exec(price);
  const steps = [
    {
      title: t("Book a call", "Programează o discuție"),
      // No duration: the homepage names none either (one figure, agreed with the owner, later).
      body: t(
        "We walk through this report with you and answer your questions. The call is free.",
        "Trecem împreună prin acest raport și îți răspundem la întrebări. Discuția e gratuită.",
      ),
    },
    {
      title: t("Confirm the numbers", "Confirmăm cifrele"),
      body: t(
        "We swap typical volumes for yours, so the estimates fit your business.",
        "Înlocuim volumele obișnuite cu ale tale, ca estimările să se potrivească afacerii tale.",
      ),
    },
    {
      title: start
        ? t("Start the first stage", "Începem prima etapă")
        : t("Start together", "Începem împreună"),
      body: start
        ? `${pick(start.dateLabel, lang)}: ${lcFirst(pick(start.title, lang))}.`
        : t("We set up the first improvements together.", "Facem împreună primele îmbunătățiri."),
    },
  ];

  // The plan in four figures, the same as the plan and impact pages.
  const hours = plan.totals.hoursPerMonth;
  const n = plan.breakEven.month;
  const figures: StatCell[] = [
    ...(hours > 0
      ? [
          {
            label: t("Time won back", "Timp câștigat"),
            value: formatNumber(hours, lang),
            unit: t("hours a month", `${roNeedsDe(hours) ? "de " : ""}ore pe lună`),
            sub: ucFirst(pick(plan.text.fte, lang)),
          },
        ]
      : []),
    {
      label: t("Setup", "Implementare"),
      value: formatNumber(plan.totals.setupLei, lang),
      unit: t("RON", "lei"),
      sub: plan.totals.siteLei
        ? plan.phases.some((p) => p.siteMilestone)
          ? t(
              `one-off, of which the website ${formatNumber(plan.totals.siteLei, "en")} RON`,
              `o singură dată, din care site-ul ${formatNumber(plan.totals.siteLei, "ro")} lei`,
            )
          : t(
              `one-off, of which the website work ${formatNumber(plan.totals.siteLei, "en")} RON`,
              `o singură dată, din care lucrările la site ${formatNumber(plan.totals.siteLei, "ro")} lei`,
            )
        : t("one-off", "o singură dată"),
    },
    ...(plan.totals.toolsLeiPerMonth > 0
      ? [
          {
            label: t("Tools", "Instrumente"),
            value: formatNumber(plan.totals.toolsLeiPerMonth, lang),
            unit: t("RON a month", "lei pe lună"),
            sub: t("once the automations run", "după lansarea automatizărilor"),
          },
        ]
      : []),
    ...(hasImpact(ctx)
      ? [
          {
            label: t("Pays back in", "Se recuperează în"),
            value: n === null ? "–" : pick(monthLabel(n), lang),
            note: 1,
            sub:
              n === null
                ? t("not within 24 months", "nu în primele 24 de luni")
                : t("the investment in automations", "investiția în automatizări"),
          },
        ]
      : []),
  ];

  return (
    // No swirl behind the offer: the brand art stays on the covers, away from content.
    <DarkPage ctx={ctx} label={t("Offer", "Oferta")}>
      <View style={{ flexGrow: 1 }}>
        <View>
          <Label color={NIGHT_INK.muted}>
            {t("The subscription that fits this plan", "Abonamentul potrivit pentru acest plan")}
          </Label>
          <SectionTitle
            title={pick(offer.title, lang)}
            intro={pick(offer.why, lang)}
            width={300}
            dark
          />

          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
            <View style={{ width: 300 }}>
              <Label color={NIGHT_INK.muted}>{t("What's included", "Ce include")}</Label>
              <View style={{ marginTop: 5 }}>
                {offer.includes.map((item) => (
                  <View key={item.en} style={{ flexDirection: "row", marginBottom: 4 }}>
                    <View
                      style={{
                        width: 4.5,
                        height: 0.6,
                        backgroundColor: NIGHT_INK.muted,
                        marginTop: 6,
                        marginRight: 6,
                      }}
                    />
                    <Text
                      style={{
                        fontFamily: FONT.body,
                        fontSize: 8.6,
                        lineHeight: 1.4,
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
                  marginTop: 10,
                  paddingTop: 10,
                  borderTopWidth: 0.6,
                  borderTopColor: NIGHT_INK.hairline,
                }}
              >
                <Text
                  style={{
                    fontFamily: FONT.body,
                    fontSize: 9.6,
                    lineHeight: 1.45,
                    color: NIGHT_INK.body,
                  }}
                >
                  {amount ? (
                    <>
                      {price.slice(0, amount.index)}
                      <Text
                        style={{
                          fontFamily: FONT.display,
                          fontWeight: 700,
                          color: NIGHT_INK.strong,
                        }}
                      >
                        {amount[1]}
                      </Text>
                      {price.slice(amount.index + amount[1].length)}
                    </>
                  ) : (
                    price
                  )}
                </Text>
                {plan.text.feePayback ? (
                  <Text style={{ ...text.small, color: NIGHT_INK.body, marginTop: 4 }}>
                    {pick(plan.text.feePayback, lang)}
                  </Text>
                ) : null}
                <Text style={{ ...text.small, color: NIGHT_INK.muted, marginTop: 4 }}>
                  {t(
                    "The setup below is this plan's estimate; the final quote follows the call.",
                    "Implementarea de mai jos e estimarea acestui plan; oferta finală vine după discuție.",
                  )}
                </Text>
              </View>
            </View>

            <View style={{ width: 176 }}>
              <View
                style={{
                  backgroundColor: INK.white,
                  borderRadius: RADIUS.md,
                  // At least 4 modules of quiet zone around the code for reliable scans.
                  paddingTop: 14,
                  paddingHorizontal: 14,
                  paddingBottom: 10,
                  alignItems: "center",
                }}
              >
                <QrCode value={CONTACT.consultUrl} size={112} color={BRAND.night} />
                <Text
                  style={{
                    fontFamily: FONT.display,
                    fontWeight: 700,
                    fontSize: 8.6,
                    color: INK.strong,
                    marginTop: 8,
                    textAlign: "center",
                  }}
                >
                  {t("Scan to book a call", "Scanează și programează o discuție")}
                </Text>
                <Link src={CONTACT.consultUrl} style={{ textDecoration: "none" }}>
                  <Text
                    style={{
                      fontFamily: FONT.body,
                      fontWeight: 500,
                      fontSize: 7.2,
                      color: INK.violet,
                      marginTop: 2,
                    }}
                  >
                    {CONTACT.consultUrl.replace(/^https:\/\//, "")}
                  </Text>
                </Link>
              </View>
            </View>
          </View>
        </View>

        <View style={{ marginTop: 26 }}>
          <Label color={NIGHT_INK.muted} style={{ marginBottom: 4 }}>
            {figures.length === 4
              ? t("The plan in four figures", "Planul în patru cifre")
              : t("The plan in figures", "Planul în cifre")}
          </Label>
          <StatRow cells={figures} dark />
        </View>

        <View style={{ marginTop: 26 }}>
          <Label color={NIGHT_INK.muted}>{t("Next steps", "Pașii următori")}</Label>
          <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 6 }}>
            {steps.map((step, i) => (
              <View
                key={step.title}
                style={{
                  width: COL3,
                  borderTopWidth: i === 0 ? 2 : 0.6,
                  borderTopColor: i === 0 ? BRAND.violetLine : NIGHT_INK.hairline,
                  paddingTop: i === 0 ? 7 : 8.4,
                }}
              >
                <Text
                  style={{
                    fontFamily: FONT.display,
                    fontWeight: 700,
                    fontSize: 9.4,
                    color: NIGHT_INK.strong,
                  }}
                >
                  <Text style={{ fontWeight: 500, color: NIGHT_INK.muted }}>{`${i + 1}  `}</Text>
                  {step.title}
                </Text>
                <Text style={{ ...text.small, color: NIGHT_INK.body, marginTop: 3 }}>
                  {step.body}
                </Text>
              </View>
            ))}
          </View>
        </View>

        <View style={{ marginTop: 26 }}>
          <View style={{ paddingTop: 12, borderTopWidth: 0.6, borderTopColor: NIGHT_INK.hairline }}>
            <Text
              style={{
                fontFamily: FONT.display,
                fontWeight: 500,
                fontSize: 10,
                color: NIGHT_INK.strong,
              }}
            >
              {t(
                `Recommendations by ${COMPANY.signatory}, ${COMPANY.role.en}, ${COMPANY.legalName}`,
                `Recomandări de la ${COMPANY.signatory}, ${COMPANY.role.ro}, ${COMPANY.legalName}`,
              )}
            </Text>
            <View style={{ flexDirection: "row", marginTop: 6 }}>
              <Link src={`mailto:${CONTACT.email}`} style={{ textDecoration: "none" }}>
                <Text
                  style={{
                    fontFamily: FONT.body,
                    fontWeight: 500,
                    fontSize: 8.4,
                    color: BRAND.violetText,
                  }}
                >
                  {CONTACT.email}
                </Text>
              </Link>
              <Link src={CONTACT.siteUrl} style={{ textDecoration: "none", marginLeft: 18 }}>
                <Text
                  style={{
                    fontFamily: FONT.body,
                    fontWeight: 500,
                    fontSize: 8.4,
                    color: BRAND.violetText,
                  }}
                >
                  {CONTACT.site}
                </Text>
              </Link>
            </View>
            <Text style={{ ...text.tiny, color: NIGHT_INK.muted, marginTop: 4 }}>
              {`${COMPANY.legalName}, CUI ${COMPANY.cui}, ${COMPANY.regNo}, ${COMPANY.city}`}
            </Text>
          </View>
        </View>

        <View style={{ marginTop: "auto", paddingTop: 16 }}>
          <Link src={ctx.reportUrl} style={{ textDecoration: "none" }}>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                borderWidth: 0.6,
                borderColor: NIGHT_INK.faint,
                borderRadius: RADIUS.md,
                paddingVertical: 9,
                paddingHorizontal: 12,
              }}
            >
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    fontFamily: FONT.display,
                    fontWeight: 700,
                    fontSize: 9.2,
                    color: NIGHT_INK.strong,
                  }}
                >
                  {t("Open the online report", "Deschide raportul online")}
                </Text>
                <Text style={{ ...text.tiny, color: NIGHT_INK.muted, marginTop: 1 }}>
                  {t(
                    "The same plan, with the simulation where you set your own team size and volumes.",
                    "Același plan, cu simularea în care îți pui mărimea echipei și volumele tale.",
                  )}
                </Text>
                <Text
                  style={{
                    fontFamily: FONT.body,
                    fontSize: 7,
                    color: BRAND.violetText,
                    marginTop: 2,
                  }}
                >
                  {truncate(ctx.reportUrl.replace(/^https?:\/\//, ""), 80)}
                </Text>
              </View>
              <PdfIcon name="arrowUpRight" size={12} color={BRAND.violetText} />
            </View>
          </Link>
        </View>
      </View>
    </DarkPage>
  );
}

/* ------------------------------------------------------------ methodology */

export function MethodologyPage({ ctx }: { ctx: PdfContext }) {
  const { blueprint, plan, lang, t } = ctx;
  const { company, audit, presence, competitors, businessType } = blueprint;
  const checked = presence?.profiles.filter((p) => p.platform !== "website").length ?? 0;
  const competitorCount = competitors?.length ?? 0;
  const notes = [
    pick(plan.notes.payback, lang),
    pick(plan.notes.scope, lang),
    pick(plan.notes.hourValue, lang),
    ...plan.notes.assumptions.map((note) => pick(note, lang)),
  ];

  const steps: Array<[string, string]> = [
    [
      t("The business", "Firma"),
      company
        ? t(
            `Registry data for CUI ${company.cui} from ${company.sources.includes("anaf") ? "ANAF's public data" : "the Trade Register open data"}${company.caen ? `, main activity CAEN ${company.caen}` : ""}.`,
            `Datele din registru pentru CUI ${company.cui}, din ${company.sources.includes("anaf") ? "datele publice ANAF" : "datele deschise ale Registrului Comerțului"}${company.caen ? `, cu activitatea principală CAEN ${company.caen}` : ""}.`,
          )
        : t(
            "Website-only scan: no registry record was attached.",
            "Am scanat doar site-ul, fără date din registru.",
          ),
    ],
    [
      t("The website", "Site-ul"),
      audit
        ? t(
            `${audit.pages.length} page${audit.pages.length === 1 ? "" : "s"} of ${audit.host} read on ${formatDate(audit.fetchedAt, lang)} and run through automated checks${audit.pagespeed ? ", plus Google Lighthouse" : ""}.`,
            `Am citit ${audit.pages.length} ${audit.pages.length === 1 ? "pagină" : "pagini"} de pe ${audit.host} pe ${formatDate(audit.fetchedAt, lang)} și le-am trecut prin verificări automate${audit.pagespeed ? " și prin Google Lighthouse" : ""}.`,
          )
        : t(
            "No website could be analysed for this business.",
            "Nu am putut analiza un site pentru această afacere.",
          ),
    ],
    [
      t("Presence and market", "Prezență și concurență"),
      t(
        `${checked} online channel${checked === 1 ? "" : "s"} checked; ${competitorCount} local competitor${competitorCount === 1 ? "" : "s"} from the company index.`,
        `Am verificat ${checked} ${checked === 1 ? "canal online" : "canale online"} și am găsit ${competitorCount} ${competitorCount === 1 ? "concurent local" : "concurenți locali"} în registrul firmelor.`,
      ),
    ],
    [
      t("The plan", "Planul"),
      `${t(
        `Work model for a ${pick(businessType.label, "en").toLowerCase()}, chosen from: `,
        `Model de lucru pentru ${pick(businessType.label, "ro").toLowerCase()}, ales după: `,
      )}${businessType.basis.map((b) => localizeBasis(b, lang, company)).join("; ")}. ${
        blueprint.engine === "ai"
          ? t(
              "Wording refined with AI (Claude, by Anthropic); the money math stays fixed.",
              "Textele au fost ajustate cu AI (Claude, de la Anthropic), iar calculele rămân aceleași.",
            )
          : t(
              "Fixed rules only, with no AI rewriting.",
              "Doar reguli fixe, fără texte rescrise de AI.",
            )
      }`,
    ],
  ];

  const sources = [
    {
      label: t("ANAF public data", "Datele publice ANAF"),
      used: Boolean(company?.sources.includes("anaf")),
    },
    {
      label: t("Trade Register index", "Registrul ONRC"),
      used: Boolean(company?.sources.includes("index")) || Boolean(competitors?.length),
    },
    { label: t("The website itself", "Site-ul firmei"), used: Boolean(audit) },
    { label: "Google Lighthouse", used: Boolean(audit?.pagespeed) },
    { label: t("INS average earnings", "Câștigul salarial mediu INS"), used: true },
    {
      label: t("AI wording (Claude)", "Texte ajustate cu AI (Claude)"),
      used: blueprint.engine === "ai",
    },
  ];
  const used = sources.filter((s) => s.used).map((s) => s.label);
  const unused = sources.filter((s) => !s.used).map((s) => s.label);

  const glossary: Array<[string, string]> = [
    [
      t("Pays back in month N", "Se recuperează în luna N"),
      t(
        "The first month whose cumulative value of the hours won back is at least the cumulative cost.",
        "Prima lună în care valoarea cumulată a orelor câștigate ajunge cel puțin la costul cumulat.",
      ),
    ],
    [
      t("Value of the hours won back", "Valoarea orelor câștigate"),
      t(
        "Hours your team no longer spends on routine work, at the cost of an hour of work. Time, not cash in the bank.",
        "Orele pe care echipa nu le mai pierde cu munca de rutină, la costul unei ore de muncă. Timp, nu bani încasați.",
      ),
    ],
    [
      t("Base estimate", "Estimarea de bază"),
      t(
        "The central figure from typical volumes; the range is in note 1.",
        "Cifra centrală, din volume obișnuite; intervalul e în nota 1.",
      ),
    ],
    [
      t("Tools", "Instrumente"),
      t(
        "The monthly software an automation runs on (SMS, booking calendar, chat).",
        "Programele plătite lunar pe care rulează o automatizare (SMS, calendar de programări, chat).",
      ),
    ],
    [
      t("Website score", "Scorul site-ului"),
      t(
        "Out of 100: Good from 75, Fair from 50, Poor under 50.",
        "Din 100: Bun de la 75, Acceptabil de la 50, Slab sub 50.",
      ),
    ],
    [
      t("First screen", "Primul ecran"),
      t(
        "How long a phone takes to show the main content (Google's LCP); good under 2.5 s.",
        "Cât îi ia unui telefon să arate conținutul principal (LCP la Google); bine sub 2,5 s.",
      ),
    ],
  ];

  return (
    <LightPage ctx={ctx} label={t("Method", "Metodologie")}>
      <SectionTitle
        title={t("How we worked it out", "Cum am calculat")}
        intro={t(
          "Measured facts come from public sources and your website. Time and money are base estimates, calculated the same way for every business; the notes say where each one comes from.",
          "Datele măsurate vin din surse publice și de pe site-ul tău. Timpul și banii sunt estimări de bază, calculate la fel pentru orice afacere; notele spun de unde vine fiecare.",
        )}
      />

      <BlockTitle rule>{t("Notes", "Note")}</BlockTitle>
      {notes.map((note, i) => (
        <View key={i} wrap={false} style={{ flexDirection: "row", marginBottom: 4 }}>
          <Text style={{ fontFamily: FONT.display, fontSize: 7.8, color: INK.muted, width: 13 }}>
            {i + 1}
          </Text>
          <Text style={{ ...text.small, color: INK.body, fontSize: 7.8, flex: 1 }}>{note}</Text>
        </View>
      ))}
      <Text style={{ ...text.small, color: INK.strong, marginTop: 3, marginLeft: 13 }}>
        {pick(plan.notes.disclaimer, lang)}{" "}
        <Text style={{ color: INK.muted }}>
          {t(
            "This report is not financial, legal or tax advice.",
            "Raportul nu este consultanță financiară, juridică sau fiscală.",
          )}
        </Text>
      </Text>

      <View wrap={false} style={{ marginTop: 16 }}>
        <BlockTitle rule>{t("Where the data comes from", "De unde vin datele")}</BlockTitle>
        {steps.map(([label, value], i) => (
          <KeyValue
            key={label}
            label={label}
            value={value}
            labelWidth={96}
            last={i === steps.length - 1}
          />
        ))}
        <View style={{ flexDirection: "row", marginTop: 6 }}>
          <View style={{ width: 96 }}>
            <Status tone="ok">{t("Used", "Folosite")}</Status>
          </View>
          <Text style={{ ...text.small, color: INK.body, flex: 1 }}>{listOf(used, lang)}.</Text>
        </View>
        {unused.length ? (
          <View style={{ flexDirection: "row", marginTop: 3 }}>
            <View style={{ width: 96 }}>
              <Status hollow>{t("Not used this time", "Nefolosite acum")}</Status>
            </View>
            <Text style={{ ...text.small, flex: 1 }}>{listOf(unused, lang)}.</Text>
          </View>
        ) : null}
      </View>

      <View wrap={false} style={{ marginTop: 16 }}>
        <BlockTitle rule>{t("Words used in this report", "Termeni folosiți în raport")}</BlockTitle>
        <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between" }}>
          {glossary.map(([term, meaning]) => (
            <View
              key={term}
              style={{
                width: COL2,
                paddingVertical: 3.5,
                borderTopWidth: 0.5,
                borderTopColor: INK.hairline,
              }}
            >
              <Text style={{ ...text.small, color: INK.body }}>
                <Text style={{ fontFamily: FONT.body, fontWeight: 500, color: INK.strong }}>
                  {term}.{" "}
                </Text>
                {meaning}
              </Text>
            </View>
          ))}
        </View>
      </View>

      <Text style={{ ...text.tiny, marginTop: "auto", paddingTop: 12 }}>
        {t(
          `Report ${blueprint.id}, generated on ${formatDate(blueprint.generatedAt, lang)} from public information available that day.`,
          `Raportul ${blueprint.id}, generat pe ${formatDate(blueprint.generatedAt, lang)} din informațiile publice disponibile în acea zi.`,
        )}
      </Text>
    </LightPage>
  );
}

/* ------------------------------------------------------------- back cover */

export function BackCover({ ctx }: { ctx: PdfContext }) {
  const { t, assets } = ctx;
  const logoW = 300;
  const logoH = logoW / LOGO_RATIO.chrome;
  const centerY = 360;
  return (
    <DarkPage ctx={ctx} chrome={false}>
      <Layer>
        <Image
          src={assets.coverArt}
          style={{ width: PAGE.width, height: PAGE.height, objectFit: "cover", opacity: 0.4 }}
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
          top: centerY + logoH / 2 + 30,
          alignItems: "center",
        }}
      >
        <Text
          style={{
            fontFamily: FONT.display,
            fontWeight: 500,
            fontSize: 10.5,
            color: NIGHT_INK.body,
            textAlign: "center",
          }}
        >
          {t("Let's talk about your business.", "Hai să vorbim despre afacerea ta.")}
        </Text>
        <View style={{ flexDirection: "row", marginTop: 12 }}>
          <Link src={CONTACT.siteUrl} style={{ textDecoration: "none" }}>
            <Text
              style={{
                fontFamily: FONT.body,
                fontWeight: 500,
                fontSize: 9,
                color: BRAND.violetText,
              }}
            >
              {CONTACT.site}
            </Text>
          </Link>
          <Link src={`mailto:${CONTACT.email}`} style={{ textDecoration: "none", marginLeft: 20 }}>
            <Text
              style={{
                fontFamily: FONT.body,
                fontWeight: 500,
                fontSize: 9,
                color: BRAND.violetText,
              }}
            >
              {CONTACT.email}
            </Text>
          </Link>
        </View>
      </View>
      <View
        style={{
          position: "absolute",
          bottom: 34,
          left: 0,
          right: 0,
          flexDirection: "row",
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <Logo src={assets.swirlSmall} ratio={LOGO_RATIO.swirl} height={11} />
        <Text
          style={{ fontFamily: FONT.body, fontSize: 6.8, color: NIGHT_INK.muted, marginLeft: 6 }}
        >
          {`© ${new Date(ctx.blueprint.generatedAt).getFullYear()} ${COMPANY.legalName}, CUI ${COMPANY.cui}, ${COMPANY.regNo}, ${COMPANY.city}`}
        </Text>
      </View>
    </DarkPage>
  );
}
