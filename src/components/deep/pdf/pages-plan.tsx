import { Image, Link, Text, View } from "@react-pdf/renderer";

import { QrCode } from "@/components/scan/pdf/qr";
import { FONT, INK } from "@/components/scan/pdf/theme";
import type { Confidence } from "@/lib/deep/contracts";
import { CONFIDENCE_LABELS } from "@/lib/deep/parse/labels";
import { estimateArithmetic } from "@/lib/deep/report/estimates";
import { COMPANY } from "@/lib/scan/legal/company";

import { Block, Dash, DeepPage, P, PageTitle, Row } from "./blocks";
import { ActionRow, DisclosureLine, TotalsBlock } from "./pages-brief";
import {
  aiLabel,
  asOfText,
  BOT_URL,
  CONTACT_URL,
  countText,
  lcFirst,
  lei,
  mandatoryActions,
  planBuckets,
  rankedActions,
  type DeepPdfContext,
} from "./model";
import { T, WIDTH } from "./styles";

/*
 * The plan for 30, 60 and 90 days with the signed offer of a call (A11 §6),
 * and the appendix "Surse și metodă" (A11 §7): every source with its licence,
 * date and attribution, how we worked, what we could not check, the
 * assumptions behind every estimate, the verification code and the AI label.
 * The signature block offers recommendations and a call; it does not certify
 * the data (D19).
 */

function Signature({ ctx }: { ctx: DeepPdfContext }) {
  const s = ctx.signatory;
  const size = 58;
  const contacts: Array<{ label: string; value: string; href?: string }> = [
    { label: ctx.t("E-mail", "E-mail"), value: s.email, href: `mailto:${s.email}` },
    ...(s.phone
      ? [
          {
            label: ctx.t("Phone", "Telefon"),
            value: s.phone,
            href: `tel:${s.phone.replace(/\s+/g, "")}`,
          },
        ]
      : []),
    ...(s.whatsapp
      ? [
          {
            label: "WhatsApp",
            value: s.whatsapp,
            href: `https://wa.me/${s.whatsapp.replace(/\D/g, "")}`,
          },
        ]
      : []),
    {
      label: ctx.t("Book a call", "Programează"),
      value: CONTACT_URL.replace(/^https:\/\//, ""),
      href: CONTACT_URL,
    },
  ];
  return (
    <View
      wrap={false}
      style={{
        marginTop: 14,
        paddingTop: 10,
        borderTopWidth: 0.75,
        borderTopColor: INK.rule,
        flexDirection: "row",
      }}
    >
      {ctx.photo ? (
        <Image
          src={ctx.photo}
          style={{ width: size, height: size, borderRadius: size / 2, objectFit: "cover" }}
        />
      ) : (
        <View
          style={{
            width: size,
            height: size,
            borderRadius: size / 2,
            borderWidth: 0.75,
            borderColor: INK.line,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text
            style={{ fontFamily: FONT.display, fontWeight: 700, fontSize: 17, color: INK.muted }}
          >
            {s.initials}
          </Text>
        </View>
      )}
      <View style={{ flex: 1, marginLeft: 14, paddingRight: 12 }}>
        <Text style={T.h3}>
          {ctx.t(
            `Recommendations from ${s.name}, ${s.role.en}, ${COMPANY.legalName}`,
            `Recomandări de la ${s.name}, ${s.role.ro}, ${COMPANY.legalName}`,
          )}
        </Text>
        <Text style={T.tiny}>{`CUI ${COMPANY.cui} · ${COMPANY.regNo} · ${COMPANY.city}`}</Text>
        <Text style={{ ...T.h4, color: INK.violet, marginTop: 8 }}>
          {ctx.t(
            "A free 30-minute call: we check the numbers together",
            "Discuție gratuită de 30 de minute: verificăm cifrele împreună",
          )}
        </Text>
        <Text style={{ ...T.small, marginTop: 2, color: INK.body }}>
          {ctx.t(
            "We call you back within one working day. No cost, no obligation.",
            "Te sunăm în cel mult o zi lucrătoare. Nu te costă nimic și nu te obligă la nimic.",
          )}
        </Text>
        <View style={{ marginTop: 6 }}>
          {contacts.map((c) => (
            <View key={c.label} style={{ flexDirection: "row", marginTop: 2 }}>
              <Text style={{ ...T.small, width: 70 }}>{c.label}</Text>
              {c.href ? (
                <Link
                  src={c.href}
                  style={{ ...T.small, color: INK.strong, textDecoration: "none" }}
                >
                  {c.value}
                </Link>
              ) : (
                <Text style={{ ...T.small, color: INK.strong }}>{c.value}</Text>
              )}
            </View>
          ))}
        </View>
        <Text style={{ ...T.tiny, marginTop: 6 }}>
          {ctx.t(
            "The recommendations rest on the public data in this report; we do not certify the firm's figures.",
            "Recomandările se bazează pe datele publice din acest raport; nu certificăm cifrele firmei.",
          )}
        </Text>
      </View>
      <View style={{ width: 70, alignItems: "flex-end" }}>
        <QrCode value={CONTACT_URL} size={62} color={INK.strong} />
        <Text style={{ ...T.tiny, marginTop: 3, textAlign: "right" }}>
          {CONTACT_URL.replace(/^https:\/\//, "")}
        </Text>
      </View>
    </View>
  );
}

export function PlanPage({ ctx }: { ctx: DeepPdfContext }) {
  const buckets = planBuckets(ctx);
  const total = mandatoryActions(ctx).length + rankedActions(ctx).length;
  return (
    <DeepPage ctx={ctx} label={ctx.t("Plan", "Plan")}>
      <PageTitle
        kicker={
          buckets.length > 1
            ? ctx.t("Plan for 30, 60 and 90 days", "Planul pe 30, 60 și 90 de zile")
            : ctx.t("Plan for the next 30 days", "Planul pe 30 de zile")
        }
        title={
          total === 1
            ? ctx.t("One step", "Un singur pas")
            : total
              ? ctx.t(
                  `${countText(ctx, total, ["step", "steps"], ["pas", "pași"])}, in order of value`,
                  `${countText(ctx, total, ["pas", "pași"], ["pas", "pași"])}, în ordinea valorii`,
                )
              : ctx.t("Let's look at it together", "Ne uităm împreună")
        }
        intro={ctx.t(
          "The order comes from the value in lei; what the law requires comes first. Each step says what it costs and who does it.",
          "Ordinea vine din valoarea în lei; ce cere legea e primul. Fiecare pas spune cât costă și cine îl face.",
        )}
      />
      {buckets.map((b, i) => (
        <Block
          key={b.title}
          first={i === 0}
          title={b.title}
          note={
            i === 0 && ctx.adjusted
              ? ctx.t("with the figures you entered", "cu cifrele introduse de tine")
              : undefined
          }
        >
          {b.actions.map((a, j) => (
            <ActionRow
              key={a.id}
              ctx={ctx}
              action={a}
              variant="plan"
              last={j === b.actions.length - 1}
            />
          ))}
        </Block>
      ))}
      {total ? (
        <View style={{ marginTop: 6 }}>
          <TotalsBlock ctx={ctx} />
          <DisclosureLine ctx={ctx} />
        </View>
      ) : null}
      <Signature ctx={ctx} />
    </DeepPage>
  );
}

/* ------------------------------------------------------------ appendix */

const LEGEND: Array<{ id: Confidence; en: string; ro: string }> = [
  {
    id: "confirmat",
    en: "an official source or the firm's own website",
    ro: "o sursă oficială sau site-ul firmei",
  },
  { id: "probabil", en: "a good match, not certain", ro: "potrivire bună, nu sigură" },
  {
    id: "calculat",
    en: "our arithmetic on official figures",
    ro: "calculul nostru pe cifre oficiale",
  },
  {
    id: "estimare",
    en: "our estimate; the assumptions are below",
    ro: "estimarea noastră; ipotezele sunt mai jos",
  },
  { id: "declarat", en: "a value you gave us", ro: "o valoare dată de tine" },
];

/** "Cu cifrele introduse de tine: …": the owner's own inputs the estimates use (D11, A11). */
function OwnerInputsLine({ ctx }: { ctx: DeepPdfContext }) {
  const o = ctx.report.ownerInputs ?? {};
  const parts = [
    o.turnover2026
      ? ctx.t(
          `turnover 2026: ${lei(o.turnover2026, "en")}`,
          `cifra de afaceri 2026: ${lei(o.turnover2026, "ro")}`,
        )
      : "",
    o.clientsPerMonth
      ? countText(
          ctx,
          o.clientsPerMonth,
          ["client a month", "clients a month"],
          ["client pe lună", "clienți pe lună"],
        )
      : "",
    o.avgTicket
      ? ctx.t(`average ticket ${lei(o.avgTicket, "en")}`, `bon mediu ${lei(o.avgTicket, "ro")}`)
      : "",
    o.hourValue
      ? ctx.t(`${lei(o.hourValue, "en")} an hour`, `${lei(o.hourValue, "ro")} pe oră`)
      : "",
  ].filter(Boolean);
  if (!parts.length) return null;
  return (
    <Text style={{ ...T.small, color: INK.body, marginBottom: 6 }}>
      {ctx.t(
        `With the figures you entered: ${parts.join(", ")}. The official figures on the first pages stay as filed.`,
        `Cu cifrele introduse de tine: ${parts.join(", ")}. Cifrele oficiale de pe primele pagini rămân cele depuse.`,
      )}
    </Text>
  );
}

export function AppendixPage({ ctx }: { ctx: DeepPdfContext }) {
  const r = ctx.report;
  const sources = r.sources ?? [];
  const attributions = [
    sources.some((s) => s.id === "anaf_bilant" || s.id === "mf_bulk") && ctx.latestYear
      ? ctx.t(
          `Source: Ministry of Finance, annual financial statements ${ctx.latestYear}, data.gov.ro, CC BY 4.0`,
          `Sursa: Ministerul Finanțelor, situații financiare ${ctx.latestYear}, data.gov.ro, CC BY 4.0`,
        )
      : "",
    sources.some((s) => s.id === "onrc")
      ? ctx.t(
          "Source: Trade Register (ONRC), registered companies, data.gov.ro, CC BY 4.0",
          "Sursa: Registrul Comerțului (ONRC), firme înregistrate, data.gov.ro, CC BY 4.0",
        )
      : "",
  ].filter(Boolean);
  const gaps = r.gaps ?? [];
  const estimated = (r.actions ?? []).filter((a) => a.effect);
  return (
    <DeepPage ctx={ctx} label={ctx.t("Sources and method", "Surse și metodă")}>
      <PageTitle
        kicker={ctx.t("Appendix", "Anexă")}
        title={ctx.t("Sources and method", "Surse și metodă")}
      />
      <Block
        first
        title={ctx.t("Sources", "Surse")}
        note={countText(
          ctx,
          r.counts.facts,
          ["checked item", "checked items"],
          ["dată verificată", "date verificate"],
        )}
      >
        {sources.map((s, i) => (
          <Row
            key={`${s.id}${i}`}
            label={ctx.pick(s.label)}
            labelWidth={220}
            value={[asOfText(s.asOf, ctx.lang), s.licence].filter(Boolean).join(" · ")}
            link={s.url}
            linkInline
            last={i === sources.length - 1}
          />
        ))}
        {attributions.map((a, i) => (
          <Text key={i} style={{ ...T.tiny, marginTop: 3 }}>
            {a}
          </Text>
        ))}
      </Block>
      <Block title={ctx.t("How we worked", "Cum am lucrat")}>
        {ctx.pagesRead ? (
          <Dash>
            {ctx.t(
              `We read ${countText(ctx, ctx.pagesRead, ["page", "pages"], ["pagină", "pagini"])} of the firm's website, robots.txt first, one page at a time and at least a second apart, as VortexScan (${BOT_URL}).`,
              `Am citit ${countText(ctx, ctx.pagesRead, ["page", "pages"], ["pagină", "pagini"])} de pe site-ul firmei, întâi robots.txt, câte o pagină pe rând, la cel puțin o secundă distanță, ca VortexScan (${BOT_URL}).`,
            )}
          </Dash>
        ) : null}
        <Dash>
          {ctx.t(
            "Every number is calculated by code from official sources; the text never computes numbers.",
            "Toate cifrele sunt calculate de cod din surse oficiale; textul nu calculează cifre.",
          )}
        </Dash>
        {r.aiMode === "ai" ? (
          <Dash>
            {ctx.t(
              `Every AI sentence cites a fact; code checks its numbers and a second model checks that the fact supports it, otherwise the sentence is removed. Models: ${r.models?.synthesis ?? "Claude"} (text), ${r.models?.extraction ?? "Claude"} (reading pages).`,
              `Fiecare propoziție scrisă cu AI citează un fapt; codul îi verifică cifrele, iar un al doilea model verifică dacă faptul o susține, altfel propoziția e ștearsă. Modele: ${r.models?.synthesis ?? "Claude"} (text), ${r.models?.extraction ?? "Claude"} (citirea paginilor).`,
            )}
          </Dash>
        ) : (
          <Dash>
            {ctx.t(
              "The text comes from rule-based templates; no AI was used in this report.",
              "Textul vine din șabloane pe reguli; nu am folosit AI în acest raport.",
            )}
          </Dash>
        )}
        <Dash>
          {ctx.t(
            "People: counts and roles only. No personal names, no shareholders, no profiles of people.",
            "Oameni: doar numere și roluri. Fără nume, fără asociați, fără profiluri despre persoane.",
          )}
        </Dash>
        <View style={{ marginTop: 4 }}>
          {LEGEND.map((l) => (
            <Text key={l.id} style={{ ...T.small, marginTop: 1 }}>
              <Text style={{ fontFamily: FONT.body, fontWeight: 500, color: INK.strong }}>
                {ctx.pick(CONFIDENCE_LABELS[l.id])}
              </Text>
              {`: ${ctx.t(l.en, l.ro)}`}
            </Text>
          ))}
        </View>
      </Block>
      {gaps.length || r.registers?.notChecked.length ? (
        <Block title={ctx.t("What we could not check", "Ce nu am putut verifica")}>
          {gaps.map((g, i) => (
            <Row
              key={`${g.section}${i}`}
              label={ctx.pick(g.what)}
              value={lcFirst(ctx.pick(g.where))}
              link={g.link}
              linkInline
              last={i === gaps.length - 1 && !r.registers?.notChecked.length}
            />
          ))}
          {(r.registers?.notChecked ?? []).map((n, i, all) => (
            <Row
              key={n.link}
              label={ctx.pick(n.name)}
              value={ctx.t("Not checked: see it at the source", "Neverificat: vezi la sursă")}
              link={n.link}
              linkInline
              last={i === all.length - 1}
            />
          ))}
        </Block>
      ) : null}
      {estimated.length ? (
        <Block
          keep={220}
          title={ctx.t("Assumptions behind the estimates", "Ipotezele estimărilor")}
        >
          {ctx.adjusted ? <OwnerInputsLine ctx={ctx} /> : null}
          {estimated.map((a) => (
            <View key={a.id} wrap={false} style={{ marginBottom: 6 }}>
              <Text style={T.h4}>{ctx.pick(a.title)}</Text>
              <Text style={{ ...T.small, color: INK.body, marginTop: 1 }}>
                {ctx.pick(a.effect!.method)}
              </Text>
              {a.effect!.assumptions.map((s, i) => (
                <Dash key={i} size={7.8} style={{ marginBottom: 1 }}>
                  {ctx.pick(s)}
                </Dash>
              ))}
              {estimateArithmetic(a.effect!) ? (
                <Text style={{ ...T.small, color: INK.body, marginTop: 1 }}>
                  {ctx.pick(estimateArithmetic(a.effect!)!)}
                </Text>
              ) : null}
            </View>
          ))}
        </Block>
      ) : null}
      <Block title={ctx.t("Verification code", "Codul de verificare")}>
        <P>
          {ctx.code
            ? ctx.verifiable
              ? ctx.t(
                  `Code ${ctx.code}. Anyone can check that this report came from Vortex Hub at vortexhub.dev/scan/deep?verify=${ctx.code}.`,
                  `Cod ${ctx.code}. Oricine poate verifica faptul că raportul vine de la Vortex Hub, la vortexhub.dev/scan/deep?verify=${ctx.code}.`,
                )
              : ctx.t(
                  `Code ${ctx.code}. It identifies this report; online checking starts once reports are stored on our server.`,
                  `Cod ${ctx.code}. Identifică acest raport; verificarea online pornește odată cu salvarea rapoartelor pe serverul nostru.`,
                )
            : ctx.t(
                "This report has no verification code.",
                "Acest raport nu are cod de verificare.",
              )}
        </P>
      </Block>
      <Block title={ctx.t("About this report", "Despre acest raport")}>
        <Text style={T.small}>{aiLabel(ctx)}</Text>
        <Text style={{ ...T.small, marginTop: 3 }}>
          {ctx.t(
            "Information, not legal, tax or financial advice; estimates are estimates. Your report is not public and we don't show it to other users. We don't sell data. We don't profile people.",
            "Informații, nu consultanță juridică, fiscală sau financiară; estimările sunt estimări. Raportul tău nu e public și nu îl arătăm altor utilizatori. Nu vindem date. Nu facem profiluri despre persoane.",
          )}
        </Text>
        <Text style={{ ...T.small, marginTop: 3 }}>
          {ctx.t(
            `Wrong data, or want it removed? ${BOT_URL}`,
            `Date greșite sau vrei să le scoatem? ${BOT_URL}`,
          )}
        </Text>
        <Text style={{ ...T.tiny, marginTop: 6, maxWidth: WIDTH }}>
          {`${ctx.t("Prepared by", "Raport pregătit de")} ${COMPANY.legalName}, CUI ${COMPANY.cui}, ${COMPANY.regNo}, ${COMPANY.city} · ${COMPANY.email}`}
        </Text>
      </Block>
    </DeepPage>
  );
}
