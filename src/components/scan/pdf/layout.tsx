import type { ReactNode } from "react";

import { Image, Page, Text, View } from "@react-pdf/renderer";

import { LOGO_RATIO } from "./assets";
import { CornerRings, GradientRule } from "./charts";
import { pad2, truncate } from "./format";
import { PdfIcon, type IconName } from "./icons";
import type { PdfContext } from "./model";
import {
  BRAND,
  CONTACT,
  CONTENT_WIDTH,
  FONT,
  INK,
  NIGHT_INK,
  PAGE,
  RADIUS,
  SPACE,
  text,
  type Style,
} from "./theme";

/* Shared page chrome and small building blocks for the blueprint pages. */

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
        borderBottomColor: dark ? NIGHT_INK.hairline : INK.hairline,
      }}
    >
      <Logo
        src={ctx.assets.wordmarkSmall}
        ratio={LOGO_RATIO.wordmarkSmall}
        height={17}
        style={{ marginBottom: 3 }}
      />
      <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 2 }}>
        <Text style={{ ...text.eyebrow, fontSize: 6, letterSpacing: 1.2, color: ink.muted }}>
          {truncate(ctx.name, 44)}
        </Text>
        {label ? (
          <>
            <View
              style={{
                width: 3,
                height: 3,
                borderRadius: 2,
                backgroundColor: BRAND.violet,
                marginHorizontal: 6,
              }}
            />
            <Text
              style={{
                ...text.eyebrow,
                fontSize: 6,
                letterSpacing: 1.2,
                color: dark ? BRAND.sky : INK.violetText,
              }}
            >
              {label}
            </Text>
          </>
        ) : null}
      </View>
    </View>
  );
}

/** Footer: swirl mark and contact, the honesty note, page x / y. */
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
      }}
    >
      <GradientRule id={dark ? "rule-dark" : "rule-light"} width={CONTENT_WIDTH} height={0.7} />
      <View
        style={{
          marginTop: 7,
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", width: 200 }}>
          <Logo src={ctx.assets.swirl} ratio={LOGO_RATIO.swirl} height={11} />
          <Text style={{ fontFamily: FONT.body, fontSize: 6.6, color: ink.muted, marginLeft: 5 }}>
            {CONTACT.site} · {CONTACT.email}
          </Text>
        </View>
        <Text style={{ fontFamily: FONT.body, fontSize: 6.6, color: ink.faint }}>
          {ctx.t("Estimates, not guarantees", "Estimări, nu garanții")}
        </Text>
        <Text
          style={{
            width: 200,
            textAlign: "right",
            fontFamily: FONT.display,
            fontWeight: 500,
            fontSize: 6.8,
            color: ink.strong,
            letterSpacing: 0.6,
          }}
          render={({ pageNumber, totalPages }) => `${pad2(pageNumber)} / ${pad2(totalPages)}`}
        />
      </View>
    </View>
  );
}

/** White working page with the running header, footer and corner rings. */
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
        fontSize: 8.5,
      }}
    >
      <View fixed style={{ position: "absolute", top: 0, right: 0 }}>
        <CornerRings size={170} />
      </View>
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
        fontSize: 8.5,
      }}
    >
      {background ? (
        <View
          fixed
          style={{ position: "absolute", top: 0, left: 0, width: PAGE.width, height: PAGE.height }}
        >
          {background}
        </View>
      ) : null}
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

/** "02 ── EYEBROW" + title + optional intro at the top of a section. */
export function SectionTitle({
  index,
  eyebrow,
  title,
  intro,
  dark,
  width = 470,
}: {
  index: number;
  eyebrow: string;
  title: string;
  intro?: string;
  dark?: boolean;
  width?: number;
}) {
  const ink = dark ? NIGHT_INK : INK;
  return (
    <View style={{ marginBottom: 14 }} minPresenceAhead={120}>
      <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 7 }}>
        <Text style={{ ...text.eyebrow, color: dark ? BRAND.sky : INK.violetText }}>
          {pad2(index)}
        </Text>
        <View
          style={{
            width: 16,
            height: 0.8,
            backgroundColor: dark ? BRAND.sky : BRAND.violet,
            marginHorizontal: 6,
            opacity: 0.7,
          }}
        />
        <Text style={{ ...text.eyebrow, color: ink.muted }}>{eyebrow}</Text>
      </View>
      <Text style={{ ...text.h1, color: ink.strong, maxWidth: width }}>{title}</Text>
      {intro ? (
        <Text
          style={{
            ...text.body,
            fontSize: 8.8,
            color: ink.muted,
            marginTop: 5,
            maxWidth: width,
          }}
        >
          {intro}
        </Text>
      ) : null}
    </View>
  );
}

/** Small heading inside a section, with an optional note on the right. */
export function BlockTitle({
  children,
  note,
  icon,
  style,
}: {
  children: string;
  note?: string;
  icon?: IconName;
  style?: Style;
}) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: 6,
        ...style,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", flexShrink: 0 }}>
        {icon ? (
          <View style={{ marginRight: 5 }}>
            <PdfIcon name={icon} size={9.5} color={INK.violetText} />
          </View>
        ) : null}
        <Text style={{ ...text.h3 }}>{children}</Text>
      </View>
      {note ? (
        <Text style={{ ...text.tiny, textAlign: "right", flex: 1, marginLeft: 12 }}>{note}</Text>
      ) : null}
    </View>
  );
}

export type ChipTone = "violet" | "blue" | "mint" | "neutral" | "dark" | "outline";

const CHIP_TONES: Record<ChipTone, { bg: string; fg: string; border?: string }> = {
  violet: { bg: INK.violetTint, fg: INK.violetText },
  blue: { bg: INK.blueTint, fg: INK.blueText },
  mint: { bg: INK.mintTint, fg: INK.mintText },
  neutral: { bg: INK.panel, fg: INK.muted },
  dark: { bg: INK.strong, fg: INK.white },
  outline: { bg: INK.white, fg: INK.muted, border: INK.hairline },
};

export function Chip({
  label,
  tone = "neutral",
  icon,
  style,
}: {
  label: string;
  tone?: ChipTone;
  icon?: IconName;
  style?: Style;
}) {
  const colors = CHIP_TONES[tone];
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: colors.bg,
        borderRadius: RADIUS.pill,
        paddingVertical: 2.2,
        paddingHorizontal: 6,
        borderWidth: colors.border ? 0.7 : 0,
        borderColor: colors.border ?? colors.bg,
        ...style,
      }}
    >
      {icon ? (
        <View style={{ marginRight: 3 }}>
          <PdfIcon name={icon} size={6.5} color={colors.fg} strokeWidth={2.4} />
        </View>
      ) : null}
      <Text style={{ fontFamily: FONT.body, fontWeight: 500, fontSize: 6.5, color: colors.fg }}>
        {label}
      </Text>
    </View>
  );
}

/** Round tinted badge holding an icon. */
export function IconBadge({
  name,
  size = 22,
  tone = "violet",
}: {
  name: IconName;
  size?: number;
  tone?: "violet" | "mint" | "dark" | "glass" | "blue";
}) {
  const palette = {
    violet: { bg: INK.violetTint, fg: INK.violetText },
    blue: { bg: INK.blueTint, fg: INK.blueText },
    mint: { bg: INK.mintTint, fg: INK.mintText },
    dark: { bg: INK.strong, fg: BRAND.sky },
    glass: { bg: "#151a45", fg: BRAND.sky },
  }[tone];
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: palette.bg,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <PdfIcon name={name} size={size * 0.5} color={palette.fg} />
    </View>
  );
}

/** White card with a hairline border. */
export function Card({
  children,
  style,
  wrap = false,
}: {
  children: ReactNode;
  style?: Style;
  wrap?: boolean;
}) {
  return (
    <View
      wrap={wrap}
      style={{
        borderWidth: 0.7,
        borderColor: INK.hairline,
        borderRadius: RADIUS.lg,
        padding: 12,
        backgroundColor: INK.white,
        ...style,
      }}
    >
      {children}
    </View>
  );
}

/** Tinted panel without a border (data blocks, notes). */
export function Panel({
  children,
  style,
  tone = "panel",
}: {
  children: ReactNode;
  style?: Style;
  tone?: "panel" | "violet";
}) {
  return (
    <View
      wrap={false}
      style={{
        borderRadius: RADIUS.lg,
        padding: 12,
        backgroundColor: tone === "violet" ? INK.violetTint : INK.panel,
        ...style,
      }}
    >
      {children}
    </View>
  );
}

/** Small uppercase label above a value. */
export function Label({
  children,
  color = INK.faint,
  style,
}: {
  children: string;
  color?: string;
  style?: Style;
}) {
  return (
    <Text style={{ ...text.eyebrow, fontSize: 5.8, letterSpacing: 1.1, color, ...style }}>
      {children}
    </Text>
  );
}

/** Bulleted row with an icon. */
export function IconRow({
  icon,
  children,
  color = INK.violetText,
  style,
}: {
  icon: IconName;
  children: ReactNode;
  color?: string;
  style?: Style;
}) {
  return (
    <View style={{ flexDirection: "row", alignItems: "flex-start", ...style }}>
      <View style={{ marginTop: 1.5, marginRight: 6 }}>
        <PdfIcon name={icon} size={8} color={color} strokeWidth={2.4} />
      </View>
      <View style={{ flex: 1 }}>{children}</View>
    </View>
  );
}

/** Label and value on one line, divided by a hairline (registry-style tables). */
export function KeyValue({
  label,
  value,
  labelWidth = 74,
}: {
  label: string;
  value: string;
  labelWidth?: number;
}) {
  return (
    <View
      style={{
        flexDirection: "row",
        paddingVertical: 3,
        borderBottomWidth: 0.5,
        borderBottomColor: INK.hairline,
      }}
    >
      <Text
        style={{
          ...text.eyebrow,
          fontSize: 5.5,
          letterSpacing: 0.8,
          color: INK.faint,
          width: labelWidth,
          marginTop: 1.4,
        }}
      >
        {label}
      </Text>
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
    </View>
  );
}
