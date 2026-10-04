import { Image, Text, View } from "@react-pdf/renderer";

import { LOGO_RATIO } from "@/components/scan/pdf/assets";
import { StatRow } from "@/components/scan/pdf/layout";
import { FONT, INK } from "@/components/scan/pdf/theme";
import type { Action, Finding } from "@/lib/deep/contracts";
import { rivalEdge } from "@/lib/deep/report";

import { Block, Dash, DeepPage, P, PageTitle, Row, SourceLine, StateWord, Tag } from "./blocks";
import {
  aiLabel,
  costText,
  countText,
  estimateFigure,
  estimateRange,
  hourAssumption,
  lcFirst,
  linesOf,
  mandatoryActions,
  officialFigures,
  peerScopeLine,
  peerSentences,
  rankedActions,
  relationshipText,
  sampleLabel,
  sectionSentences,
  sectionText,
  sourceLine,
  thirdPartyChecks,
  whoText,
  words,
  type DeepPdfContext,
} from "./model";
import { COL3, DEEP_SPACE, GAP, T, WIDTH } from "./styles";
import { COMPANY } from "@/lib/scan/legal/company";

/*
 * Cover, "Pe scurt" (the first two working pages, A1 and A11 §2) and the
 * one-page "Pe scurt" PDF for forwarding. Order as on a phone: the official
 * figures first (owners check their own numbers before they trust the rest),
 * the verdict, the five lines, what that means, the trust strip, three
 * findings, three actions with their value in lei, what rivals do better and
 * what a new customer sees.
 */

const NEW_CUSTOMER: Record<string, { en: string; ro: string }> = {
  health: { en: "What a new patient sees", ro: "Ce vede un pacient nou" },
  accommodation: { en: "What a new guest sees", ro: "Ce vede un oaspete nou" },
  food: { en: "What a new guest sees", ro: "Ce vede un client nou" },
};

function sectionNames(ctx: DeepPdfContext): string[] {
  return [
    ctx.t("In short", "Pe scurt"),
    ctx.t("Figures and comparisons", "Cifre și comparații"),
    ctx.t("Website and presence", "Site și prezență"),
    ctx.t("Risk, registers and team", "Risc, registre și echipă"),
    ctx.owner ? ctx.t("Plan for 30, 60 and 90 days", "Planul pe 30, 60 și 90 de zile") : "",
    ctx.t("Sources and method", "Surse și metodă"),
  ].filter(Boolean);
}

export function CoverPage({ ctx }: { ctx: DeepPdfContext }) {
  const c = ctx.report.company;
  const identity = [ctx.pick(c.activity), c.city, `CUI ${c.cui}`].filter(Boolean).join(" · ");
  const cell = (label: string, value: string) => (
    <View style={{ width: COL3 }}>
      <Text style={T.label}>{label}</Text>
      <Text style={{ ...T.strong, marginTop: 3 }}>{value}</Text>
    </View>
  );
  return (
    <DeepPage ctx={ctx} label="" header={false}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <Image
          src={ctx.assets.wordmarkSmall}
          style={{ width: 22 * LOGO_RATIO.wordmarkSmall, height: 22, objectFit: "contain" }}
        />
        {ctx.sample ? <Tag>{sampleLabel(ctx)}</Tag> : null}
      </View>
      <View style={{ marginTop: 150 }}>
        <Text style={{ ...T.label, fontSize: 9.4 }}>{ctx.t("Deep Research", "Deep Research")}</Text>
        <Text
          style={{
            fontFamily: FONT.display,
            fontWeight: 700,
            fontSize: 30,
            lineHeight: 1.12,
            color: INK.strong,
            marginTop: 8,
          }}
        >
          {ctx.name}
        </Text>
        <Text style={{ ...T.lead, marginTop: 8 }}>{identity}</Text>
        {ctx.report.aiMode === "rules" ? (
          <Tag style={{ marginTop: 10 }}>
            {ctx.t("Rule-based analysis, no AI", "Analiză pe reguli, fără AI")}
          </Tag>
        ) : null}
      </View>
      <View
        style={{
          marginTop: 34,
          paddingTop: 12,
          borderTopWidth: 0.75,
          borderTopColor: INK.rule,
          flexDirection: "row",
          justifyContent: "space-between",
        }}
      >
        {cell(ctx.t("Report generated on", "Raport generat la"), ctx.generated)}
        {cell(ctx.t("Data valid at", "Date valabile la"), ctx.validAt)}
        {cell(ctx.t("Verification code", "Cod de verificare"), ctx.code || "–")}
      </View>
      <Text style={{ ...T.small, marginTop: 14 }}>
        {ctx.t(`Written ${relationshipText(ctx)}.`, `Scris ${relationshipText(ctx)}.`)}
      </Text>
      <View style={{ marginTop: 40 }}>
        <Text style={T.label}>{ctx.t("In this report", "În acest raport")}</Text>
        <Text style={{ ...T.body, marginTop: 4 }}>{sectionNames(ctx).join(" · ")}</Text>
      </View>
      <View
        style={{
          position: "absolute",
          left: DEEP_SPACE.gutter,
          right: DEEP_SPACE.gutter,
          bottom: DEEP_SPACE.contentBottom + 6,
        }}
      >
        {ctx.owner ? (
          <Text style={T.strong}>
            {ctx.t(
              `Recommendations from ${ctx.signatory.name}, ${ctx.signatory.role.en}, ${COMPANY.legalName}`,
              `Recomandări de la ${ctx.signatory.name}, ${ctx.signatory.role.ro}, ${COMPANY.legalName}`,
            )}
          </Text>
        ) : null}
        <Text style={{ ...T.small, marginTop: 4, maxWidth: WIDTH }}>{aiLabel(ctx)}</Text>
        <Text style={{ ...T.tiny, marginTop: 4 }}>
          {`${COMPANY.legalName}, CUI ${COMPANY.cui}, ${COMPANY.regNo}, ${COMPANY.city}`}
        </Text>
      </View>
    </DeepPage>
  );
}

function FiguresStrip({ ctx }: { ctx: DeepPdfContext }) {
  const cells = officialFigures(ctx);
  if (!cells.length) return null;
  return (
    <View>
      <StatRow cells={cells.map((c) => ({ label: c.label, value: c.value, sub: c.source }))} />
      <Text style={{ ...T.tiny, marginTop: 4 }}>
        {ctx.owner
          ? ctx.t(
              "Your own official figures, as filed. Check them at the source: mfinante.gov.ro, the company's fiscal record.",
              "Cifrele tale oficiale, așa cum au fost depuse. Le poți verifica la sursă: mfinante.gov.ro, fișa fiscală a firmei.",
            )
          : ctx.t(
              "The firm's official figures, as filed. Check them at the source: mfinante.gov.ro.",
              "Cifrele oficiale ale firmei, așa cum au fost depuse. Le poți verifica la sursă: mfinante.gov.ro.",
            )}
      </Text>
    </View>
  );
}

export function LinesBlock({ ctx, compact }: { ctx: DeepPdfContext; compact?: boolean }) {
  const lines = linesOf(ctx);
  if (!lines.length) return null;
  return (
    <View>
      {lines.map((l, i) => (
        <View
          key={l.area}
          wrap={false}
          style={{
            flexDirection: "row",
            alignItems: "center",
            paddingVertical: compact ? 3.5 : 5,
            borderBottomWidth: i === lines.length - 1 ? 0 : 0.5,
            borderBottomColor: INK.hairline,
          }}
        >
          <Text style={{ ...T.h4, width: 92 }}>{ctx.pick(l.label)}</Text>
          <StateWord ctx={ctx} state={l.state} width={88} />
          <Text style={{ ...T.body, flex: 1 }}>{ctx.pick(l.reason)}</Text>
          {l.provisional ? <Tag dashed>{ctx.t("provisional", "provizoriu")}</Tag> : null}
        </View>
      ))}
    </View>
  );
}

function TrustStrip({ ctx }: { ctx: DeepPdfContext }) {
  const c = ctx.report.counts;
  const gaps = (ctx.report.gaps ?? []).length + (ctx.report.registers?.notChecked ?? []).length;
  const parts = [
    ctx.t(
      `Checked on ${ctx.generated.split(",")[0]}`,
      `Verificat la ${ctx.generated.split(",")[0]}`,
    ),
    ctx.latestYear ? ctx.t(`accounts ${ctx.latestYear}`, `bilanț ${ctx.latestYear}`) : "",
    countText(
      ctx,
      c.officialSources,
      ["official source", "official sources"],
      ["sursă oficială", "surse oficiale"],
    ),
    countText(ctx, ctx.pagesRead, ["page read", "pages read"], ["pagină citită", "pagini citite"]),
    countText(ctx, c.estimates, ["estimate", "estimates"], ["estimare", "estimări"]),
    gaps
      ? ctx.t(
          `${gaps} things we could not check (see Sources and method)`,
          `${countText(ctx, gaps, ["lucru", "lucruri"], ["lucru", "lucruri"])} pe care nu le-am putut verifica (vezi Surse și metodă)`,
        )
      : "",
  ].filter(Boolean);
  return <Text style={{ ...T.small, marginTop: 10 }}>{parts.join(" · ")}</Text>;
}

function FindingCell({
  ctx,
  finding,
  text,
}: {
  ctx: DeepPdfContext;
  finding: Finding;
  text?: string;
}) {
  return (
    <View style={{ width: COL3 }} wrap={false}>
      {/* A figure is a number; a long one (a status sentence) is set smaller so it stays a line or two. */}
      <Text style={{ ...T.figure, fontSize: ctx.pick(finding.figure).length > 14 ? 11 : 15 }}>
        {ctx.pick(finding.figure)}
      </Text>
      <Text style={{ ...T.body, marginTop: 4 }}>{text || ctx.pick(finding.sentence)}</Text>
      <SourceLine>{sourceLine(ctx, finding.factIds)}</SourceLine>
    </View>
  );
}

function FindingsBlock({ ctx }: { ctx: DeepPdfContext }) {
  const findings = [...(ctx.report.findings ?? [])].sort((a, b) => a.rank - b.rank).slice(0, 3);
  if (!findings.length) return null;
  const prose = ctx.report.brief?.findings ?? [];
  return (
    <Block title={ctx.t("What we found", "Ce am găsit")}>
      <View style={{ flexDirection: "row", gap: GAP }}>
        {findings.map((f, i) => (
          <FindingCell
            key={f.id}
            ctx={ctx}
            finding={f}
            // AI prose when it passed the checks; the rules sentence repeats the figure, so not that.
            text={prose[i]?.source === "ai" ? sectionText(prose[i]) || undefined : undefined}
          />
        ))}
      </View>
    </Block>
  );
}

/**
 * One action: title, why, the effect in lei with its range, what it costs, who,
 * when. "full" in "Pe scurt", "plan" (no tag, cost and who on one line) on the
 * plan page, "compact" (title, effect, who) on the one-page PDF.
 */
export function ActionRow({
  ctx,
  action,
  n,
  last,
  variant = "full",
}: {
  ctx: DeepPdfContext;
  action: Action;
  n?: number;
  last?: boolean;
  variant?: "full" | "plan" | "compact";
}) {
  const fig = action.effect ? estimateFigure(ctx, action.effect) : null;
  const range = action.effect ? estimateRange(ctx, action.effect) : "";
  const hour = hourAssumption(ctx);
  const cost = costText(ctx, action.cost);
  const who = `${ctx.t("Who", "Cine")}: ${whoText(ctx, action)}`;
  const when = action.firstEffect
    ? `${ctx.t("Effect", "Efect")}: ${lcFirst(ctx.pick(action.firstEffect))}`
    : "";
  // The one-page PDF goes to a partner: it keeps the price of every action.
  const meta = (variant === "full" ? [who, when] : [cost, who, when]).filter(Boolean).join(" · ");
  const full = variant === "full";
  return (
    <View
      wrap={false}
      style={{
        flexDirection: "row",
        paddingVertical: full ? 7 : 4.5,
        borderBottomWidth: last ? 0 : 0.5,
        borderBottomColor: INK.hairline,
      }}
    >
      {n !== undefined ? (
        <Text style={{ ...T.h3, width: 18, color: INK.muted }}>{String(n)}</Text>
      ) : null}
      <View style={{ flex: 1, paddingRight: 12 }}>
        <Text style={T.h4}>{ctx.pick(action.title)}</Text>
        {variant !== "compact" ? (
          <Text style={{ ...T.small, marginTop: 1.5 }}>{ctx.pick(action.why)}</Text>
        ) : null}
        {full && cost ? (
          <Text style={{ ...T.small, marginTop: 2, color: INK.body }}>{cost}</Text>
        ) : null}
        <Text style={{ ...T.tiny, marginTop: 1.5 }}>{meta}</Text>
      </View>
      <View style={{ width: variant === "compact" ? 150 : 172 }}>
        {fig ? (
          <>
            <Text style={{ ...T.figure, fontSize: full ? 14 : 12 }}>
              {fig.value}
              <Text
                style={{ fontFamily: FONT.body, fontWeight: 400, fontSize: 7.4, color: INK.muted }}
              >
                {` ${fig.unit}`}
              </Text>
            </Text>
            {range && variant !== "compact" ? (
              <Text style={{ ...T.tiny, marginTop: 1.5 }}>{range}</Text>
            ) : null}
            {full && hour && hour.actionId === action.id ? (
              <Text style={{ ...T.tiny, marginTop: 1 }}>{hour.text}</Text>
            ) : null}
            {full ? (
              <Tag dashed style={{ marginTop: 3 }}>
                {ctx.t("Estimate", "Estimare")}
              </Tag>
            ) : null}
          </>
        ) : !action.mandatory && action.comparison ? (
          <Text style={{ ...T.body, fontSize: 8.2, color: INK.strong }}>
            {ctx.pick(action.comparison)}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

/** The plan's totals, one line per kind of money, never added together. */
export function TotalsBlock({ ctx, compact }: { ctx: DeepPdfContext; compact?: boolean }) {
  const { timeValueMonth, profitYearPretax } = ctx.report.totals ?? {};
  const lines = [
    timeValueMonth
      ? {
          label: ctx.t("Value of the hours won", "Valoarea orelor câștigate"),
          e: timeValueMonth,
        }
      : null,
    profitYearPretax
      ? {
          label: ctx.t(
            "Extra profit a year, before tax",
            "Profit în plus pe an, înainte de impozit",
          ),
          e: profitYearPretax,
        }
      : null,
  ].filter((l): l is NonNullable<typeof l> => l !== null);
  if (!lines.length) return null;
  return (
    <View style={{ marginTop: 8 }} wrap={false}>
      {lines.map((l) => {
        const fig = estimateFigure(ctx, l.e, true);
        const range = estimateRange(ctx, l.e);
        return (
          <View
            key={l.label}
            style={{ flexDirection: "row", alignItems: "baseline", paddingVertical: 2 }}
          >
            <Text style={{ ...T.small, width: 190, color: INK.body }}>{l.label}</Text>
            <Text style={{ ...T.num, fontSize: 9.4 }}>{`${fig.value} ${fig.unit}`}</Text>
            {range ? <Text style={{ ...T.tiny, marginLeft: 8 }}>{range}</Text> : null}
          </View>
        );
      })}
      <Text style={{ ...T.tiny, marginTop: 3 }}>
        {compact
          ? ctx.t(
              "Two different kinds of money, never added up. Figures with ≈ are estimates; the assumptions are in the full report.",
              "Două feluri diferite de bani, pe care nu le adunăm. Sumele cu ≈ sunt estimări; ipotezele sunt în raportul complet.",
            )
          : ctx.t(
              "Two different kinds of money: the value of time and profit before tax. We never add them up. Figures with ≈ are estimates; the assumptions are in the appendix.",
              "Două feluri diferite de bani: valoarea timpului și profitul înainte de impozit. Nu le adunăm niciodată. Sumele cu ≈ sunt estimări; ipotezele sunt în anexă.",
            )}
      </Text>
    </View>
  );
}

export function DisclosureLine({ ctx }: { ctx: DeepPdfContext }) {
  return (
    <Text style={{ ...T.small, marginTop: 8 }}>
      {ctx.t(
        "Vortex Hub can do some of this; you can also do it yourself or with someone else.",
        "Vortex Hub poate face o parte din aceste lucruri; le poți face și singur sau cu altcineva.",
      )}
    </Text>
  );
}

function ActionsBlock({ ctx }: { ctx: DeepPdfContext }) {
  const must = mandatoryActions(ctx);
  const top = rankedActions(ctx).slice(0, 3);
  if (!must.length && !top.length) {
    return (
      <Block title={ctx.t("What to do in the next 30 days", "Ce faci în următoarele 30 de zile")}>
        <P>
          {ctx.t(
            "We found nothing that clearly pays off from the data we could check. The free call is the place to look at it together.",
            "Din datele pe care le-am putut verifica nu reiese o acțiune care să merite clar. În discuția gratuită ne uităm împreună.",
          )}
        </P>
      </Block>
    );
  }
  return (
    <Block
      title={ctx.t("What to do in the next 30 days", "Ce faci în următoarele 30 de zile")}
      note={
        ctx.adjusted
          ? ctx.t("with the figures you entered", "cu cifrele introduse de tine")
          : undefined
      }
    >
      {top.map((a, i) => (
        <ActionRow key={a.id} ctx={ctx} action={a} n={i + 1} last={i === top.length - 1} />
      ))}
      {must.length ? (
        <View style={{ marginTop: 6 }}>
          <Text style={{ ...T.label, marginBottom: 1 }}>
            {ctx.t("Also required by law", "Obligatoriu prin lege, pe lângă acestea")}
          </Text>
          {must.map((a, i) => (
            <ActionRow key={a.id} ctx={ctx} action={a} last={i === must.length - 1} />
          ))}
        </View>
      ) : null}
      <TotalsBlock ctx={ctx} />
      <DisclosureLine ctx={ctx} />
    </Block>
  );
}

function ChecksBlock({ ctx }: { ctx: DeepPdfContext }) {
  const rows = thirdPartyChecks(ctx);
  if (!rows.length) return null;
  return (
    <Block
      title={ctx.t(
        "What to check before working with them",
        "Ce să verifici înainte să lucrezi cu ei",
      )}
    >
      {rows.map((r, i) => (
        <Row
          key={`${r.label}${i}`}
          label={r.label}
          value={r.value}
          link={r.link}
          last={i === rows.length - 1}
        />
      ))}
    </Block>
  );
}

function RivalsBlock({ ctx }: { ctx: DeepPdfContext }) {
  // What a rival does better, checked against this company's own facts (never a rival that
  // grows more slowly or keeps less).
  const better = (ctx.report.competitors ?? [])
    .map((c) => ({ ...c, betterAt: rivalEdge(c, ctx.report.facts ?? [], ctx.report.audience) }))
    .filter((c) => c.betterAt)
    .slice(0, 3);
  const prose =
    ctx.report.brief?.rivals?.source === "ai" ? sectionSentences(ctx.report.brief.rivals) : [];
  const gap = (ctx.report.gaps ?? []).find(
    (g) => g.section === "peers" || g.section === "competitors",
  );
  const title = ctx.owner
    ? ctx.t("Where rivals do better than you", "Unde te depășesc concurenții")
    : ctx.t("Where rivals do better", "Unde o depășesc concurenții");
  if (!better.length && !prose.length && !gap) return null;
  return (
    <Block title={better.length ? title : ctx.t("Rivals", "Concurenți")}>
      {better.map((c, i) => (
        <Row
          key={c.cui}
          label={`${c.name}${c.city ? `, ${c.city}` : ""}`}
          value={ctx.pick(c.betterAt)}
          last={i === better.length - 1 && !prose.length}
        />
      ))}
      {prose.length ? <P style={{ marginTop: better.length ? 6 : 0 }}>{prose.join(" ")}</P> : null}
      {!better.length && !prose.length && gap ? (
        <P>
          {ctx.t(
            "The comparison with similar firms is not ready yet; it appears once we load their annual accounts.",
            "Comparația cu firme similare nu e încă gata; apare când încărcăm bilanțurile lor.",
          )}
        </P>
      ) : null}
    </Block>
  );
}

function CustomerBlock({ ctx }: { ctx: DeepPdfContext }) {
  const lines = sectionSentences(ctx.report.brief?.customerView).slice(0, 3);
  if (!lines.length) return null;
  const title = NEW_CUSTOMER[ctx.report.vocab] ?? {
    en: "What a new customer sees",
    ro: "Ce vede un client nou",
  };
  return (
    <Block title={ctx.pick(title)}>
      {lines.map((s, i) => (
        <Dash key={i}>{s}</Dash>
      ))}
    </Block>
  );
}

function IfNothingBlock({ ctx }: { ctx: DeepPdfContext }) {
  const text = sectionText(ctx.report.brief?.ifNothing);
  if (!text) return null;
  return (
    <Block title={ctx.t("If the trend continues", "Dacă tendința continuă")}>
      <View style={{ flexDirection: "row", alignItems: "flex-start" }}>
        <P style={{ flex: 1, paddingRight: 10 }}>{text}</P>
        <Tag dashed>{ctx.t("Estimate", "Estimare")}</Tag>
      </View>
    </Block>
  );
}

function NewFirmBlock({ ctx }: { ctx: DeepPdfContext }) {
  if (!ctx.newFirm) return null;
  const bands = peerSentences(ctx).filter(
    (s) => s.metric === "turnover" || s.metric === "employees",
  );
  const gap = (ctx.report.gaps ?? []).find((g) => g.section === "peers");
  const none = ctx.owner
    ? ctx.t("You have no filed annual accounts yet.", "Încă nu ai bilanț depus.")
    : ctx.t("The firm has no filed annual accounts yet.", "Firma nu are încă bilanț depus.");
  const intro = bands.length
    ? `${none} ${
        ctx.owner
          ? ctx.t(
              "Here is how firms in your activity look.",
              "Iată cum arată firmele din activitatea ta.",
            )
          : ctx.t(
              "Here is how firms in its activity look.",
              "Iată cum arată firmele din activitatea ei.",
            )
      }`
    : none;
  return (
    <Block title={ctx.t("A new firm", "O firmă nouă")}>
      <P>{intro}</P>
      {bands.map((b, i) => (
        <Row key={b.metric} label={b.label} value={b.typical} last={i === bands.length - 1} />
      ))}
      {bands.length ? <Text style={{ ...T.tiny, marginTop: 3 }}>{peerScopeLine(ctx)}</Text> : null}
      {!bands.length ? (
        <P style={{ marginTop: 4, color: INK.muted }}>
          {gap
            ? ctx.pick(gap.where)
            : ctx.t(
                "The comparison with firms in the same activity appears once we load the Ministry of Finance annual accounts.",
                "Comparația cu firmele din aceeași activitate apare după ce încărcăm bilanțurile Ministerului Finanțelor.",
              )}
        </P>
      ) : null}
    </Block>
  );
}

export function BriefPages({ ctx }: { ctx: DeepPdfContext }) {
  const headline =
    sectionText(ctx.report.brief?.headline) ||
    ctx.t(`What we found about ${ctx.name}`, `Ce am găsit despre ${ctx.name}`);
  const meaning = words(sectionText(ctx.report.brief?.meaning), 60);
  return (
    <DeepPage ctx={ctx} label={ctx.t("In short", "Pe scurt")}>
      <PageTitle kicker={ctx.t("In short", "Pe scurt")} title={headline} />
      <FiguresStrip ctx={ctx} />
      <NewFirmBlock ctx={ctx} />
      <Block
        title={ctx.t("Five lines", "Pe cinci linii")}
        note={ctx.t("How the firm stands", "Cum stă firma")}
      >
        <LinesBlock ctx={ctx} />
      </Block>
      {meaning ? (
        <View style={{ marginTop: 12 }}>
          <Text style={T.label}>
            {ctx.owner
              ? ctx.t("What it means for you", "Ce înseamnă pentru tine")
              : ctx.t("What it means", "Ce înseamnă")}
          </Text>
          <Text style={{ ...T.lead, marginTop: 3 }}>{meaning}</Text>
        </View>
      ) : null}
      <TrustStrip ctx={ctx} />
      <FindingsBlock ctx={ctx} />
      {ctx.owner ? <ActionsBlock ctx={ctx} /> : <ChecksBlock ctx={ctx} />}
      <RivalsBlock ctx={ctx} />
      <CustomerBlock ctx={ctx} />
      <IfNothingBlock ctx={ctx} />
    </DeepPage>
  );
}

/** "Trimite pe scurt": one page for a manager or partner. */
export function OnePage({ ctx }: { ctx: DeepPdfContext }) {
  const c = ctx.report.company;
  const headline = words(
    sectionText(ctx.report.brief?.headline) ||
      ctx.t(`What we found about ${ctx.name}`, `Ce am găsit despre ${ctx.name}`),
    32,
  );
  const must = mandatoryActions(ctx).slice(0, 1);
  const top = rankedActions(ctx).slice(0, 3);
  const checks = thirdPartyChecks(ctx).slice(0, 6);
  return (
    <DeepPage ctx={ctx} label={ctx.t("Deep Research · in short", "Deep Research · pe scurt")}>
      <Text style={T.label}>
        {[ctx.pick(c.activity), c.city, `CUI ${c.cui}`].filter(Boolean).join(" · ")}
      </Text>
      <Text style={{ ...T.h2, fontSize: 15, marginTop: 3 }}>{ctx.name}</Text>
      <Text style={{ ...T.headline, fontSize: 13.5, marginTop: 8 }}>{headline}</Text>
      <View style={{ marginTop: 10 }}>
        <FiguresStrip ctx={ctx} />
      </View>
      <View style={{ marginTop: 10 }}>
        <LinesBlock ctx={ctx} compact />
      </View>
      {ctx.owner ? (
        <Block title={ctx.t("What to do in the next 30 days", "Ce faci în următoarele 30 de zile")}>
          {[...must, ...top].map((a, i, all) => (
            <ActionRow
              key={a.id}
              ctx={ctx}
              action={a}
              variant="compact"
              last={i === all.length - 1}
            />
          ))}
          <TotalsBlock ctx={ctx} compact />
        </Block>
      ) : (
        <Block
          title={ctx.t(
            "What to check before working with them",
            "Ce să verifici înainte să lucrezi cu ei",
          )}
        >
          {checks.map((r, i) => (
            <Row
              key={`${r.label}${i}`}
              label={r.label}
              value={r.value}
              last={i === checks.length - 1}
            />
          ))}
        </Block>
      )}
      <View
        style={{ marginTop: 12, borderTopWidth: 0.75, borderTopColor: INK.rule, paddingTop: 8 }}
        wrap={false}
      >
        <Text style={T.small}>
          {ctx.t(
            "The full report has the figures for every year, the comparison with similar firms, the website checks, the risk registers and every source.",
            "Raportul complet are cifrele pe fiecare an, comparația cu firmele similare, verificările site-ului, registrele de risc și toate sursele.",
          )}
        </Text>
        {ctx.owner ? (
          <Text style={{ ...T.strong, marginTop: 4, color: INK.violet }}>
            {ctx.t(
              `A free 30-minute call with ${ctx.signatory.name}: ${ctx.signatory.email}`,
              `Discuție gratuită de 30 de minute cu ${ctx.signatory.name}: ${ctx.signatory.email}`,
            )}
          </Text>
        ) : null}
        <Text style={{ ...T.tiny, marginTop: 4 }}>{aiLabel(ctx)}</Text>
      </View>
    </DeepPage>
  );
}
