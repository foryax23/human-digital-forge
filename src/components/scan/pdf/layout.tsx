import type { ReactNode } from "react";

import { Image, Page, Text, View } from "@react-pdf/renderer";

import { LOGO_RATIO } from "./assets";
import { superscript, truncate } from "./format";
import type { PdfContext, PriorityLevel } from "./model";
import {
  BRAND,
  CONTACT,
  FONT,
  INK,
  NIGHT_INK,
  PAGE,
  RADIUS,
  SPACE,
  STATUS,
  text,
  type Style,
  type StatusTone,
} from "./theme";

/*
 * Page chrome and the small building blocks of the blueprint pages, in the
 * site's language (spec §2.2, §6): status squares, the three-bar priority
 * signal and flat tags instead of pills, hairlines instead of boxed cards,
 * sentence-case labels at zero tracking.
 */

/** A brand logo at a given height, keeping the exported file's proportions. */
export function Logo({
  src,
  ratio,
  height,
  style,
}: {
  src: string;
  ratio: number;
  height: number;
  style?: Style;
}) {
  return (
    <Image src={src} style={{ width: height * ratio, height, objectFit: "contain", ...style }} />
  );
}

/** Slim header: the wordmark, then company and section on the right, over a hairline. */
function RunningHeader({ ctx, label, dark }: { ctx: PdfContext; label?: string; dark?: boolean }) {
  const ink = dark ? NIGHT_INK : INK;
  return (
    <View
      fixed
      style={{
        position: "absolute",
        top: SPACE.headerTop,
        left: SPACE.gutter,
        right: SPACE.gutter,
        height: SPACE.headerRule - SPACE.headerTop,
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        borderBottomWidth: 0.6,
        borderBottomColor: ink.hairline,
      }}
    >
      <Logo
        src={ctx.assets.wordmarkSmall}
        ratio={LOGO_RATIO.wordmarkSmall}
        height={15}
        style={{ marginBottom: 3 }}
      />
      <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 2 }}>
        <Text style={{ fontFamily: FONT.body, fontSize: 7, color: ink.muted }}>
          {truncate(ctx.name, 48)}
        </Text>
        {label ? (
          <Text
            style={{
              fontFamily: FONT.body,
              fontWeight: 500,
              fontSize: 7,
              color: ink.strong,
              marginLeft: 12,
            }}
          >
            {label}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

/** Footer: swirl mark and contact on the left, the page number on the right. */
function RunningFooter({ ctx, dark }: { ctx: PdfContext; dark?: boolean }) {
  const ink = dark ? NIGHT_INK : INK;
  return (
    <View
      fixed
      style={{
        position: "absolute",
        bottom: SPACE.footerBottom,
        left: SPACE.gutter,
        right: SPACE.gutter,
        borderTopWidth: 0.6,
        borderTopColor: ink.hairline,
        paddingTop: 6,
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        <Logo src={ctx.assets.swirlSmall} ratio={LOGO_RATIO.swirl} height={10} />
        <Text style={{ fontFamily: FONT.body, fontSize: 6.8, color: ink.muted, marginLeft: 5 }}>
          {CONTACT.site}
        </Text>
        <Text style={{ fontFamily: FONT.body, fontSize: 6.8, color: ink.muted, marginLeft: 10 }}>
          {CONTACT.email}
        </Text>
      </View>
      <Text
        style={{ fontFamily: FONT.body, fontSize: 6.8, color: ink.muted }}
        render={({ pageNumber, totalPages }) =>
          ctx.t(`Page ${pageNumber} of ${totalPages}`, `Pagina ${pageNumber} din ${totalPages}`)
        }
      />
    </View>
  );
}

/** White working page with the running header and footer. */
export function LightPage({
  children,
  ctx,
  label,
}: {
  children: ReactNode;
  ctx: PdfContext;
  label: string;
}) {
  return (
    <Page
      size="A4"
      style={{
        backgroundColor: INK.white,
        paddingTop: SPACE.contentTop,
        paddingBottom: SPACE.contentBottom,
        paddingHorizontal: SPACE.gutter,
        fontFamily: FONT.body,
        color: INK.body,
        fontSize: 8.2,
      }}
    >
      <RunningHeader ctx={ctx} label={label} />
      <RunningFooter ctx={ctx} />
      {children}
    </Page>
  );
}

/**
 * Night page for the cover, the offer and the back cover. `background` art is
 * drawn full-bleed as a fixed layer so it never takes part in pagination.
 */
export function DarkPage({
  children,
  ctx,
  label,
  background,
  chrome = true,
}: {
  children: ReactNode;
  ctx: PdfContext;
  label?: string;
  background?: ReactNode;
  /** Padding, running header and footer; off for the covers. */
  chrome?: boolean;
}) {
  return (
    <Page
      size="A4"
      style={{
        backgroundColor: BRAND.night,
        paddingTop: chrome ? SPACE.contentTop : 0,
        paddingBottom: chrome ? SPACE.contentBottom : 0,
        paddingHorizontal: chrome ? SPACE.gutter : 0,
        fontFamily: FONT.body,
        color: NIGHT_INK.body,
        fontSize: 8.2,
      }}
    >
      {background ? <Layer>{background}</Layer> : null}
      {chrome ? <RunningHeader ctx={ctx} label={label} dark /> : null}
      {children}
      {chrome ? <RunningFooter ctx={ctx} dark /> : null}
    </Page>
  );
}

/** Absolute full-page layer (backgrounds, art). */
export function Layer({ children, style }: { children: ReactNode; style?: Style }) {
  return (
    <View
      fixed
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: PAGE.width,
        height: PAGE.height,
        ...style,
      }}
    >
      {children}
    </View>
  );
}

/** The page title (the page's conclusion) and an optional lead. */
export function SectionTitle({
  title,
  intro,
  aside,
  dark,
  width = 440,
}: {
  title: string;
  intro?: string;
  /** A marker next to the title ("Date de exemplu"). */
  aside?: ReactNode;
  dark?: boolean;
  width?: number;
}) {
  const ink = dark ? NIGHT_INK : INK;
  return (
    <View style={{ marginBottom: 14 }} minPresenceAhead={120}>
      <View style={{ flexDirection: "row", alignItems: "flex-start" }}>
        <Text style={{ ...text.title, color: ink.strong, maxWidth: width }}>{title}</Text>
        {aside ? <View style={{ marginLeft: 10, marginTop: 5 }}>{aside}</View> : null}
      </View>
      {intro ? (
        <Text style={{ ...text.lead, color: ink.body, marginTop: 5, maxWidth: width }}>
          {intro}
        </Text>
      ) : null}
    </View>
  );
}

/**
 * Heading of a block inside a page, with an optional note on the right. `rule`
 * puts the 34% section rule above it (blocks on a rule, not in a box).
 */
export function BlockTitle({
  children,
  note,
  rule,
  style,
}: {
  children: ReactNode;
  note?: string;
  rule?: boolean;
  style?: Style;
}) {
  return (
    <View
      minPresenceAhead={60}
      style={{
        flexDirection: "row",
        alignItems: "baseline",
        justifyContent: "space-between",
        marginBottom: 6,
        ...(rule ? { borderTopWidth: 0.75, borderTopColor: INK.rule, paddingTop: 7 } : {}),
        ...style,
      }}
    >
      <Text style={{ ...text.h3, flexShrink: 0 }}>{children}</Text>
      {note ? (
        <Text style={{ ...text.tiny, textAlign: "right", flex: 1, marginLeft: 12 }}>{note}</Text>
      ) : null}
    </View>
  );
}

/** Small sentence-case label above a value or a column. */
export function Label({
  children,
  color = INK.muted,
  style,
}: {
  children: ReactNode;
  color?: string;
  style?: Style;
}) {
  return <Text style={{ ...text.label, color, ...style }}>{children}</Text>;
}

/** A note reference ("¹") inside a Text, pointing to "Cum am calculat". */
export function NoteRef({ n, dark }: { n: number; dark?: boolean }) {
  return (
    <Text
      style={{
        fontFamily: FONT.display,
        fontWeight: 500,
        color: dark ? NIGHT_INK.muted : INK.muted,
      }}
    >
      {superscript(n)}
    </Text>
  );
}

/**
 * Status: a small square plus a plain word ("Lipsește", "Există", "Bun").
 * `hollow` is the unchecked state ("Neverificat").
 */
export function Status({
  tone = "neutral",
  hollow,
  children,
  dark,
  style,
}: {
  tone?: StatusTone;
  hollow?: boolean;
  children: ReactNode;
  dark?: boolean;
  style?: Style;
}) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", ...style }}>
      <View
        style={{
          width: 4.6,
          height: 4.6,
          borderRadius: 0.8,
          backgroundColor: hollow ? undefined : STATUS[tone],
          borderWidth: hollow ? 0.7 : 0,
          borderColor: dark ? NIGHT_INK.muted : INK.muted,
        }}
      />
      <Text
        style={{
          fontFamily: FONT.body,
          fontWeight: 500,
          fontSize: 7.2,
          color: dark ? NIGHT_INK.body : INK.body,
          marginLeft: 4,
        }}
      >
        {children}
      </Text>
    </View>
  );
}

const LIT: Record<PriorityLevel, number> = { high: 3, medium: 2, low: 1 };

/** Priority: a three-bar signal plus "Prioritate mare / medie / mică". */
export function Priority({ level, children }: { level: PriorityLevel; children: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center" }}>
      <View style={{ flexDirection: "row", alignItems: "flex-end", height: 7.5 }}>
        {[3, 5.25, 7.5].map((height, i) => (
          <View
            key={height}
            style={{
              width: 1.5,
              height,
              borderRadius: 0.4,
              marginLeft: i ? 1.5 : 0,
              backgroundColor: i < LIT[level] ? INK.body : INK.faint,
            }}
          />
        ))}
      </View>
      <Text
        style={{
          fontFamily: FONT.body,
          fontWeight: 500,
          fontSize: 7.2,
          color: INK.body,
          marginLeft: 4,
        }}
      >
        {children}
      </Text>
    </View>
  );
}

export type TagVariant = "outline" | "dashed" | "start";

/**
 * Tag: flat, 2 pt corners, sentence case. `outline` for categories, `dashed`
 * for assumptions ("De confirmat"), `start` for "Începem aici" (once per page,
 * always followed by its reason).
 */
export function Tag({
  variant = "outline",
  children,
  dark,
  style,
}: {
  variant?: TagVariant;
  children: string;
  dark?: boolean;
  style?: Style;
}) {
  const line = dark ? NIGHT_INK.faint : INK.line;
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        alignSelf: "flex-start",
        height: 12,
        paddingHorizontal: 4,
        borderRadius: RADIUS.sm,
        backgroundColor: variant === "start" ? INK.violetTint : undefined,
        borderWidth: variant === "start" ? 0 : 0.6,
        borderColor: line,
        borderStyle: variant === "dashed" ? "dashed" : "solid",
        ...style,
      }}
    >
      <Text
        style={{
          fontFamily: FONT.body,
          fontWeight: 500,
          fontSize: 6.6,
          color:
            variant === "start"
              ? INK.violet
              : dark
                ? NIGHT_INK.body
                : variant === "dashed"
                  ? INK.muted
                  : INK.body,
        }}
      >
        {children}
      </Text>
    </View>
  );
}

/** A list item with a short dash marker (the site's bullet). */
export function Dash({
  children,
  color = INK.body,
  size = 7.8,
  style,
}: {
  children: ReactNode;
  color?: string;
  size?: number;
  style?: Style;
}) {
  return (
    <View style={{ flexDirection: "row", alignItems: "flex-start", ...style }}>
      <View
        style={{
          width: 4.5,
          height: 0.6,
          backgroundColor: INK.muted,
          marginTop: size * 0.72,
          marginRight: 6,
        }}
      />
      <Text style={{ fontFamily: FONT.body, fontSize: size, lineHeight: 1.42, color, flex: 1 }}>
        {children}
      </Text>
    </View>
  );
}

/** Label and value on one line, divided by a hairline (registry-style lists). */
export function KeyValue({
  label,
  value,
  labelWidth = 80,
  last,
}: {
  label: string;
  value: ReactNode;
  labelWidth?: number;
  last?: boolean;
}) {
  return (
    <View
      style={{
        flexDirection: "row",
        paddingVertical: 3.2,
        borderBottomWidth: last ? 0 : 0.5,
        borderBottomColor: INK.hairline,
      }}
    >
      <Text style={{ ...text.label, width: labelWidth, paddingRight: 6 }}>{label}</Text>
      {typeof value === "string" ? (
        <Text
          style={{
            fontFamily: FONT.body,
            fontSize: 7.6,
            lineHeight: 1.35,
            color: INK.strong,
            flex: 1,
          }}
        >
          {value}
        </Text>
      ) : (
        <View style={{ flex: 1 }}>{value}</View>
      )}
    </View>
  );
}

export type StatCell = {
  label: string;
  value: string;
  unit?: string;
  /** Note reference after the value. */
  note?: number;
  sub?: string;
  /** A short line in the series colour: the strip doubles as the chart legend. */
  swatch?: { color: string; dashed?: boolean; opacity?: number };
  /** Status next to the value (a tier word). */
  status?: ReactNode;
};

/** A row of plain figures split by hairlines (KPI strip, snapshot numbers). */
export function StatRow({
  cells,
  dark,
  style,
}: {
  cells: StatCell[];
  dark?: boolean;
  style?: Style;
}) {
  const ink = dark ? NIGHT_INK : INK;
  return (
    <View
      wrap={false}
      style={{
        flexDirection: "row",
        borderTopWidth: 0.6,
        borderBottomWidth: 0.6,
        borderColor: ink.hairline,
        ...style,
      }}
    >
      {cells.map((cell, i) => (
        <View
          key={cell.label}
          style={{
            flex: 1,
            paddingVertical: 8,
            paddingLeft: i ? 10 : 0,
            paddingRight: 8,
            borderLeftWidth: i ? 0.6 : 0,
            borderLeftColor: ink.hairline,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            {cell.swatch ? (
              <View
                style={{
                  width: 8,
                  height: 0,
                  borderTopWidth: 1.6,
                  borderTopColor: cell.swatch.color,
                  borderStyle: cell.swatch.dashed ? "dashed" : "solid",
                  opacity: cell.swatch.opacity ?? 1,
                  marginRight: 4,
                }}
              />
            ) : null}
            <Text style={{ ...text.label, color: ink.muted }}>{cell.label}</Text>
          </View>
          <View style={{ flexDirection: "row", alignItems: "baseline", marginTop: 3 }}>
            <Text style={{ ...text.figure, color: ink.strong }}>
              {cell.value}
              {cell.unit ? (
                <Text
                  style={{
                    fontFamily: FONT.body,
                    fontWeight: 400,
                    fontSize: 7.4,
                    color: ink.muted,
                  }}
                >
                  {` ${cell.unit}`}
                </Text>
              ) : null}
              {cell.note ? (
                <Text style={{ fontSize: 8 }}>
                  <NoteRef n={cell.note} dark={dark} />
                </Text>
              ) : null}
            </Text>
            {cell.status ? <View style={{ marginLeft: 6 }}>{cell.status}</View> : null}
          </View>
          {cell.sub ? (
            <Text style={{ ...text.tiny, color: ink.muted, marginTop: 2 }}>{cell.sub}</Text>
          ) : null}
        </View>
      ))}
    </View>
  );
}
