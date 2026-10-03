import type { ReactNode } from "react";

import { Image, Link, Page, Text, View } from "@react-pdf/renderer";

import { LOGO_RATIO } from "@/components/scan/pdf/assets";
import { FONT, INK, RADIUS, STATUS, type Style } from "@/components/scan/pdf/theme";
import type { LightState } from "@/lib/deep/contracts";

import { PRIVACY_URL, sampleLabel, STATE_TONE, STATE_WORD, type DeepPdfContext } from "./model";
import { DEEP_SPACE, T } from "./styles";

/*
 * Page chrome and the small blocks of the deep report PDF: the light page
 * with its running header and the two-line footer that carries the dates and
 * the verification code on every page, the line shapes (■ ◆ ● □ drawn as
 * views, never glyphs), source lines, tags and rows on hairlines.
 */

function RunningHeader({ ctx, label }: { ctx: DeepPdfContext; label: string }) {
  return (
    <View
      fixed
      style={{
        position: "absolute",
        top: DEEP_SPACE.headerTop,
        left: DEEP_SPACE.gutter,
        right: DEEP_SPACE.gutter,
        height: DEEP_SPACE.headerRule - DEEP_SPACE.headerTop,
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        borderBottomWidth: 0.6,
        borderBottomColor: INK.hairline,
      }}
    >
      <Image
        src={ctx.assets.wordmarkSmall}
        style={{
          width: 15 * LOGO_RATIO.wordmarkSmall,
          height: 15,
          objectFit: "contain",
          marginBottom: 3,
        }}
      />
      <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 2 }}>
        <Text style={{ fontFamily: FONT.body, fontSize: 7.2, color: INK.muted, maxWidth: 260 }}>
          {ctx.name}
        </Text>
        <Text
          style={{
            fontFamily: FONT.body,
            fontWeight: 500,
            fontSize: 7.2,
            color: INK.strong,
            marginLeft: 12,
          }}
        >
          {label}
        </Text>
      </View>
    </View>
  );
}

/** Two lines on every page: dates and the code, then the disclaimer and the page number. */
function RunningFooter({ ctx }: { ctx: DeepPdfContext }) {
  const line = { fontFamily: FONT.body, fontSize: 6.6, lineHeight: 1.45, color: INK.muted };
  const first = [
    ctx.t(`Data valid at: ${ctx.validAt}`, `Date valabile la: ${ctx.validAt}`),
    ctx.t(`Report generated on ${ctx.generated}`, `Raport generat la ${ctx.generated}`),
    ctx.code ? ctx.t(`Verification code: ${ctx.code}`, `Cod de verificare: ${ctx.code}`) : "",
  ]
    .filter(Boolean)
    .join(" · ");
  const second = [
    ctx.t("Not legal or financial advice", "Nu este consultanță juridică sau financiară"),
    ctx.t(`Wrong data? ${PRIVACY_URL}`, `Date greșite? ${PRIVACY_URL}`),
    ctx.sample ? sampleLabel(ctx) : "",
  ]
    .filter(Boolean)
    .join(" · ");
  return (
    <View
      fixed
      style={{
        position: "absolute",
        bottom: DEEP_SPACE.footerBottom,
        left: DEEP_SPACE.gutter,
        right: DEEP_SPACE.gutter,
        borderTopWidth: 0.6,
        borderTopColor: INK.hairline,
        paddingTop: 5,
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "flex-end",
      }}
    >
      <View style={{ flex: 1, paddingRight: 12 }}>
        <Text style={line}>{first}</Text>
        <Text style={line}>{second}</Text>
      </View>
      <Text
        style={line}
        render={({ pageNumber, totalPages }) =>
          ctx.t(`Page ${pageNumber} of ${totalPages}`, `Pagina ${pageNumber} din ${totalPages}`)
        }
      />
    </View>
  );
}

/** A white A4 page with the running header and footer. */
export function DeepPage({
  ctx,
  label,
  children,
  header = true,
}: {
  ctx: DeepPdfContext;
  label: string;
  children: ReactNode;
  header?: boolean;
}) {
  return (
    <Page
      size="A4"
      style={{
        backgroundColor: INK.white,
        paddingTop: header ? DEEP_SPACE.contentTop : 48,
        paddingBottom: DEEP_SPACE.contentBottom,
        paddingHorizontal: DEEP_SPACE.gutter,
        fontFamily: FONT.body,
        color: INK.body,
        fontSize: 8.8,
      }}
    >
      {header ? <RunningHeader ctx={ctx} label={label} /> : null}
      <RunningFooter ctx={ctx} />
      {children}
    </Page>
  );
}

/** The page's title (its conclusion) with an optional lead and marker. */
export function PageTitle({
  kicker,
  title,
  intro,
  aside,
}: {
  kicker?: string;
  title: string;
  intro?: string;
  aside?: ReactNode;
}) {
  return (
    <View style={{ marginBottom: 10 }} minPresenceAhead={140}>
      {kicker ? <Text style={{ ...T.label, marginBottom: 4 }}>{kicker}</Text> : null}
      <View style={{ flexDirection: "row", alignItems: "flex-start" }}>
        <Text style={{ ...T.title, flex: 1 }}>{title}</Text>
        {aside ? <View style={{ marginLeft: 12, marginTop: 4 }}>{aside}</View> : null}
      </View>
      {intro ? <Text style={{ ...T.lead, marginTop: 6 }}>{intro}</Text> : null}
    </View>
  );
}

/** A block heading on the 34% section rule, with an optional note on the right. */
export function Block({
  title,
  note,
  children,
  style,
  first,
  keep = 110,
}: {
  title: string;
  note?: string;
  children: ReactNode;
  style?: Style;
  /** No rule above (the first block under a page title). */
  first?: boolean;
  /** Space (pt) the title needs below it on the same page, so it is never left alone. */
  keep?: number;
}) {
  return (
    <View style={{ marginTop: first ? 0 : 13, ...style }}>
      <View
        minPresenceAhead={keep}
        style={{
          flexDirection: "row",
          alignItems: "baseline",
          justifyContent: "space-between",
          marginBottom: 5,
          borderTopWidth: first ? 0 : 0.75,
          borderTopColor: INK.rule,
          paddingTop: first ? 0 : 7,
        }}
      >
        <Text style={{ ...T.h3, flexShrink: 0, maxWidth: 330 }}>{title}</Text>
        {note ? (
          <Text style={{ ...T.tiny, flex: 1, textAlign: "right", marginLeft: 12 }}>{note}</Text>
        ) : null}
      </View>
      {children}
    </View>
  );
}

/**
 * The line shape: ■ Bine (square), ◆ Atenție (diamond), ● De rezolvat
 * (circle), □ Neverificat (hollow square). Shape and word carry the state,
 * so it never depends on colour alone.
 */
export function Shape({ state, size = 6.4 }: { state: LightState; size?: number }) {
  const color = STATUS[STATE_TONE[state]];
  const base: Style = { width: size, height: size };
  if (state === "atentie") {
    const side = size * 0.78;
    return (
      <View style={{ ...base, alignItems: "center", justifyContent: "center" }}>
        <View
          style={{ width: side, height: side, backgroundColor: color, transform: "rotate(45deg)" }}
        />
      </View>
    );
  }
  if (state === "de_rezolvat")
    return <View style={{ ...base, borderRadius: size / 2, backgroundColor: color }} />;
  if (state === "neverificat")
    return (
      <View style={{ ...base, borderWidth: 0.9, borderColor: INK.muted, borderRadius: 0.6 }} />
    );
  return <View style={{ ...base, borderRadius: 0.6, backgroundColor: color }} />;
}

/** Shape plus its word ("◆ Atenție"). */
export function StateWord({
  ctx,
  state,
  width = 70,
}: {
  ctx: DeepPdfContext;
  state: LightState;
  width?: number;
}) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", width }}>
      <Shape state={state} />
      <Text style={{ ...T.strong, fontSize: 8.4, marginLeft: 5 }}>
        {ctx.pick(STATE_WORD[state])}
      </Text>
    </View>
  );
}

/** Flat tag, 2 pt corners, sentence case; `dashed` for estimates and declared values. */
export function Tag({
  children,
  dashed,
  style,
}: {
  children: string;
  dashed?: boolean;
  style?: Style;
}) {
  return (
    <View
      style={{
        alignSelf: "flex-start",
        paddingHorizontal: 4,
        paddingVertical: 1.5,
        borderRadius: RADIUS.sm,
        borderWidth: 0.6,
        borderColor: INK.line,
        borderStyle: dashed ? "dashed" : "solid",
        ...style,
      }}
    >
      <Text
        style={{
          fontFamily: FONT.body,
          fontWeight: 500,
          fontSize: 6.8,
          color: dashed ? INK.muted : INK.body,
        }}
      >
        {children}
      </Text>
    </View>
  );
}

/** "Sursa: …" under a figure or a finding. */
export function SourceLine({ children, style }: { children: string; style?: Style }) {
  if (!children) return null;
  return <Text style={{ ...T.tiny, marginTop: 3, ...style }}>{children}</Text>;
}

/** Label and value on one line, split by a hairline; a link sits under the value or after it. */
export function Row({
  label,
  value,
  note,
  labelWidth = 170,
  last,
  link,
  linkInline,
}: {
  label: string;
  value: ReactNode;
  note?: string;
  labelWidth?: number;
  last?: boolean;
  link?: string;
  linkInline?: boolean;
}) {
  const linkText = link?.replace(/^https?:\/\//, "").replace(/\/$/, "");
  return (
    <View
      wrap={false}
      style={{
        flexDirection: "row",
        paddingVertical: 2.8,
        borderBottomWidth: last ? 0 : 0.5,
        borderBottomColor: INK.hairline,
      }}
    >
      <Text
        style={{ ...T.small, fontSize: 7.5, color: INK.muted, width: labelWidth, paddingRight: 8 }}
      >
        {label}
      </Text>
      <View style={{ flex: 1 }}>
        {typeof value === "string" ? (
          <Text style={{ ...T.body, fontSize: 8.4, color: INK.strong }}>
            {value}
            {link && linkInline ? (
              <Link src={link} style={{ ...T.tiny, color: INK.violet, textDecoration: "none" }}>
                {`  ${linkText}`}
              </Link>
            ) : null}
          </Text>
        ) : (
          value
        )}
        {note ? <Text style={{ ...T.tiny, marginTop: 1 }}>{note}</Text> : null}
        {link && !linkInline ? (
          <Link
            src={link}
            style={{ ...T.tiny, color: INK.violet, textDecoration: "none", marginTop: 1 }}
          >
            {linkText}
          </Link>
        ) : null}
      </View>
    </View>
  );
}

/** A dash bullet (the site's list marker). */
export function Dash({
  children,
  style,
  size = 8.8,
}: {
  children: ReactNode;
  style?: Style;
  size?: number;
}) {
  return (
    <View
      wrap={false}
      style={{ flexDirection: "row", alignItems: "flex-start", marginBottom: 3, ...style }}
    >
      <View
        style={{
          width: 5,
          height: 0.7,
          backgroundColor: INK.muted,
          marginTop: size * 0.74,
          marginRight: 7,
        }}
      />
      <Text style={{ ...T.body, fontSize: size, flex: 1 }}>{children}</Text>
    </View>
  );
}

/** Plain paragraph. */
export function P({ children, style }: { children: ReactNode; style?: Style }) {
  return <Text style={{ ...T.body, ...style }}>{children}</Text>;
}
