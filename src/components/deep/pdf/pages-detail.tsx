import { Text, View } from "@react-pdf/renderer";

import { INK, STATUS } from "@/components/scan/pdf/theme";
import type { Fact } from "@/lib/deep/contracts";
import { leiShort } from "@/lib/deep/parse/format";
import { factLabel } from "@/lib/deep/parse/labels";
import { rivalEdge } from "@/lib/deep/report";

import { Block, Dash, DeepPage, P, PageTitle, Row, Tag } from "./blocks";
import {
  countText,
  factText,
  lcFirst,
  moneyTable,
  peerScopeLine,
  peerSentences,
  WEBSITE_STATUS_TEXT,
  whyTheseRivals,
  type DeepPdfContext,
} from "./model";
import { T, WIDTH } from "./styles";

/*
 * The detail pages (A11 §3 to §5): "Cifre și comparații" for accountants and
 * banks, "Site și prezență" as a new customer sees it, and "Risc, registre și
 * echipă". Every row prints a fact's own label and display, so the page says
 * what the "Dovezi" tab says; absences are worded as observations ("pe cele
 * 14 pagini citite"), never as facts about the firm.
 */

const ucFirst = (s: string) => (s ? s[0].toLocaleUpperCase("ro") + s.slice(1) : s);

/** All facts of a predicate, their displays joined ("Asistent medical, Recepționer"). */
function joined(ctx: DeepPdfContext, predicate: string, max = 6): string {
  const list = ctx.byPredicate(predicate).map((f) => factText(ctx, f));
  const unique = [...new Set(list.filter(Boolean))];
  if (!unique.length) return "";
  const rest = unique.length - max;
  return (
    unique.slice(0, max).join(", ") +
    (rest > 0 ? ctx.t(` and ${rest} more`, ` și încă ${rest}`) : "")
  );
}

/** Rows for the facts that exist, in order, with their own label and display. */
function FactRows({
  ctx,
  ids,
  labelWidth,
}: {
  ctx: DeepPdfContext;
  ids: Array<string | { id: string; label: string } | { predicate: string; label?: string }>;
  labelWidth?: number;
}) {
  const rows: Array<{ key: string; label: string; value: string; note?: string; link?: string }> =
    [];
  for (const spec of ids) {
    if (typeof spec === "string" || "id" in spec) {
      const f = ctx.fact(typeof spec === "string" ? spec : spec.id);
      if (!f) continue;
      const row = rowOf(ctx, f);
      rows.push(typeof spec === "string" ? row : { ...row, label: spec.label });
    } else {
      const value = joined(ctx, spec.predicate);
      if (!value) continue;
      const first = ctx.byPredicate(spec.predicate)[0];
      rows.push({
        key: spec.predicate,
        label: spec.label ?? factLabel(first, ctx.lang),
        value,
        note: confidenceNote(ctx, first),
      });
    }
  }
  if (!rows.length) return null;
  return (
    <View>
      {rows.map((r, i) => (
        <Row
          key={r.key}
          label={r.label}
          value={r.value}
          note={r.note}
          link={r.link}
          labelWidth={labelWidth}
          last={i === rows.length - 1}
        />
      ))}
    </View>
  );
}

function confidenceNote(ctx: DeepPdfContext, f: Fact): string | undefined {
  if (f.confidence === "declarat") return ctx.t("Declared by you", "Declarat de tine");
  if (f.confidence === "probabil")
    return ctx.t("Likely: a good match, not certain", "Probabil: potrivire bună, nu sigură");
  if (f.confidence === "estimare") return ctx.t("Estimate", "Estimare");
  return undefined;
}

function rowOf(ctx: DeepPdfContext, f: Fact) {
  // Adverse facts below 0.9 are not stated: the reader checks at the source (A9).
  if (f.adverse && f.score < 0.9) {
    return {
      key: f.id,
      label: factLabel(f, ctx.lang),
      value: ctx.t("Check at the source", "Verifică la sursă"),
      link: f.evidence?.url ?? "https://portal.just.ro",
    };
  }
  return {
    key: f.id,
    label: factLabel(f, ctx.lang),
    value: factText(ctx, f),
    note: confidenceNote(ctx, f),
  };
}

function GapLines({ ctx, sections }: { ctx: DeepPdfContext; sections: string[] }) {
  const gaps = (ctx.report.gaps ?? []).filter((g) => sections.includes(g.section));
  if (!gaps.length) return null;
  return (
    <View style={{ marginTop: 6 }}>
      {gaps.map((g, i) => (
        <Text key={`${g.section}${i}`} style={{ ...T.small, marginTop: 2 }}>
          {`${ctx.pick(g.what)}: ${lcFirst(ctx.pick(g.where))}${g.link ? ` (${g.link.replace(/^https?:\/\//, "")})` : ""}`}
        </Text>
      ))}
    </View>
  );
}

/* ------------------------------------------------------------- figures */

function MoneyTable({ ctx }: { ctx: DeepPdfContext }) {
  const { years, rows } = moneyTable(ctx);
  if (!rows.length) return null;
  const labelWidth = 128;
  const col = (WIDTH - labelWidth) / years.length;
  return (
    <View>
      <View
        style={{
          flexDirection: "row",
          borderBottomWidth: 0.75,
          borderBottomColor: INK.rule,
          paddingBottom: 4,
        }}
      >
        <Text style={{ ...T.label, width: labelWidth }}>{ctx.t("Year", "Anul")}</Text>
        {years.map((y) => (
          <Text key={y} style={{ ...T.label, width: col, textAlign: "right", color: INK.strong }}>
            {String(y)}
          </Text>
        ))}
      </View>
      {rows.map((r, i) => (
        <View
          key={r.label}
          wrap={false}
          style={{
            flexDirection: "row",
            paddingVertical: 4.5,
            borderBottomWidth: i === rows.length - 1 ? 0 : 0.5,
            borderBottomColor: INK.hairline,
          }}
        >
          <Text style={{ ...T.small, color: INK.body, width: labelWidth }}>{r.label}</Text>
          {r.cells.map((c, j) => (
            <Text
              key={years[j]}
              style={{ ...T.num, fontSize: 7.6, width: col, textAlign: "right" }}
            >
              {c}
            </Text>
          ))}
        </View>
      ))}
    </View>
  );
}

function PeersBlock({ ctx }: { ctx: DeepPdfContext }) {
  const sentences = peerSentences(ctx);
  const gap = (ctx.report.gaps ?? []).find((g) => g.section === "peers");
  return (
    <Block
      title={ctx.t("Compared with similar firms", "Comparație cu firme similare")}
      note={sentences.length ? peerScopeLine(ctx) : undefined}
    >
      {sentences.length ? (
        sentences.map((s, i) => (
          <Row
            key={s.metric}
            label={s.label}
            labelWidth={150}
            value={
              <View style={{ flexDirection: "row", alignItems: "flex-start" }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ ...T.body, color: INK.strong }}>{s.typical}</Text>
                  {s.you ? (
                    <Text style={{ ...T.small, color: INK.body, marginTop: 1 }}>{s.you}</Text>
                  ) : null}
                </View>
                {s.estimate ? <Tag dashed>{ctx.t("Estimate", "Estimare")}</Tag> : null}
              </View>
            }
            last={i === sentences.length - 1}
          />
        ))
      ) : (
        <View>
          <P>
            {gap
              ? ctx.pick(gap.where)
              : ctx.t("No comparison in this report.", "Fără comparație în acest raport.")}
          </P>
          <Text style={{ ...T.small, marginTop: 4 }}>
            {ctx.t(
              "We compare only with firms from the Ministry of Finance's official annual accounts, with the same activity and a similar size. Without them we do not guess rivals by name.",
              "Comparăm doar cu firme din bilanțurile oficiale ale Ministerului Finanțelor, cu aceeași activitate și mărime apropiată. Fără ele, nu ghicim concurenți după nume.",
            )}
          </Text>
        </View>
      )}
    </Block>
  );
}

function CompetitorsBlock({ ctx }: { ctx: DeepPdfContext }) {
  const rivals = (ctx.report.competitors ?? []).slice(0, 5);
  if (!rivals.length) return null;
  const edge = (r: (typeof rivals)[number]) =>
    rivalEdge(r, ctx.report.facts ?? [], ctx.report.audience);
  const cols = [
    { key: "name", w: 150, label: ctx.t("Firm", "Firma") },
    { key: "turnover", w: 66, label: ctx.t("Turnover", "Cifra de afaceri"), right: true },
    { key: "profit", w: 66, label: ctx.t("Profit before tax", "Profit brut"), right: true },
    { key: "staff", w: 44, label: ctx.t("Staff", "Salariați"), right: true },
    { key: "site", w: 0, label: ctx.t("On its website", "Pe site") },
  ];
  const fixed = cols.reduce((s, c) => s + c.w, 0);
  const width = (c: (typeof cols)[number]) => c.w || WIDTH - fixed;
  // The same short form as the rivals' facts and the screen ("6,1 mil. lei").
  const money = (v?: number) => (v === undefined ? "–" : leiShort(v)[ctx.lang]);
  const site = (c: (typeof rivals)[number]) =>
    [
      c.booking ? ctx.t("online booking", "programare online") : "",
      c.shop ? ctx.t("online shop", "magazin online") : "",
      c.importantIssues
        ? countText(
            ctx,
            c.importantIssues,
            ["important issue", "important issues"],
            ["problemă importantă", "probleme importante"],
          )
        : "",
      c.website && !c.booking && !c.shop && !c.importantIssues
        ? c.website.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "")
        : "",
    ]
      .filter(Boolean)
      .join(", ") || "–";
  return (
    <Block title={ctx.t("Rivals", "Concurenți")}>
      <View wrap={false}>
        <View
          style={{
            flexDirection: "row",
            borderBottomWidth: 0.75,
            borderBottomColor: INK.rule,
            paddingBottom: 4,
          }}
        >
          {cols.map((c) => (
            <Text
              key={c.key}
              style={{
                ...T.label,
                width: width(c),
                textAlign: c.right ? "right" : "left",
                paddingRight: c.right ? 0 : 6,
                paddingLeft: c.key === "site" ? 12 : 0,
              }}
            >
              {c.label}
            </Text>
          ))}
        </View>
        {rivals.map((r, i) => (
          <View
            key={r.cui}
            wrap={false}
            style={{
              flexDirection: "row",
              paddingVertical: 4.5,
              borderBottomWidth: i === rivals.length - 1 ? 0 : 0.5,
              borderBottomColor: INK.hairline,
            }}
          >
            <View style={{ width: cols[0].w, paddingRight: 6 }}>
              <Text style={{ ...T.body, color: INK.strong }}>{r.name}</Text>
              <Text style={T.tiny}>
                {[
                  r.city,
                  r.origin === "owner_added" ? ctx.t("added by you", "adăugat de tine") : "",
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </Text>
            </View>
            <Text style={{ ...T.num, width: cols[1].w, textAlign: "right" }}>
              {money(r.turnover)}
            </Text>
            <Text style={{ ...T.num, width: cols[2].w, textAlign: "right" }}>
              {money(r.profitPretax)}
            </Text>
            <Text style={{ ...T.num, width: cols[3].w, textAlign: "right" }}>
              {r.employees !== undefined ? String(r.employees) : "–"}
            </Text>
            <View style={{ width: width(cols[4]), paddingLeft: 12 }}>
              <Text style={{ ...T.small, color: INK.body }}>{site(r)}</Text>
              {edge(r) ? <Text style={T.tiny}>{ctx.pick(edge(r))}</Text> : null}
            </View>
          </View>
        ))}
      </View>
      <Text style={{ ...T.tiny, marginTop: 5 }}>{whyTheseRivals(ctx)}</Text>
    </Block>
  );
}

/**
 * "Cheltuielile au crescut mai repede decât cifra de afaceri: 25% față de 17%
 * (2023–2025)". The percentages are taken from the fact's own display, so the
 * title prints exactly the numbers the screen shows; otherwise the display as is.
 */
function expensesTitle(ctx: DeepPdfContext, f: Fact): string {
  const v = f.value as { expenses?: number; revenue?: number; from?: number; to?: number } | null;
  const shown = ctx.pick(f.display);
  const pcts = shown.match(/-?\d+(?:[.,]\d+)?%/g) ?? [];
  if (!v || !(v.expenses! > 0) || !(v.revenue! > 0) || pcts.length < 2 || !v.from || !v.to)
    return ucFirst(shown);
  const [e, r] = pcts;
  const span = `${v.from}–${v.to}`;
  return v.expenses! > v.revenue!
    ? ctx.t(
        `Expenses grew faster than turnover: ${e} against ${r} (${span})`,
        `Cheltuielile au crescut mai repede decât cifra de afaceri: ${e} față de ${r} (${span})`,
      )
    : ctx.t(
        `Turnover grew faster than expenses: ${r} against ${e} (${span})`,
        `Cifra de afaceri a crescut mai repede decât cheltuielile: ${r} față de ${e} (${span})`,
      );
}

export function FiguresPage({ ctx }: { ctx: DeepPdfContext }) {
  const evr = ctx.fact("money.expenses_vs_revenue");
  const g3 = ctx.fact("money.growth_turnover_3y");
  const title = ctx.newFirm
    ? ctx.t("No annual accounts filed yet", "Încă nu există bilanțuri depuse")
    : evr
      ? expensesTitle(ctx, evr)
      : g3
        ? ctx.t(`Turnover: ${g3.display.en}`, `Cifra de afaceri: ${g3.display.ro}`)
        : ctx.t("The firm's figures from its annual accounts", "Cifrele firmei din bilanțuri");
  const { years } = moneyTable(ctx);
  return (
    <DeepPage ctx={ctx} label={ctx.t("Figures and comparisons", "Cifre și comparații")}>
      <PageTitle kicker={ctx.t("Figures and comparisons", "Cifre și comparații")} title={title} />
      {years.length ? (
        <Block
          first
          title={ctx.t(
            `Money over ${years.length} years`,
            `Bani pe ${countText(ctx, years.length, ["an", "ani"], ["an", "ani"])}`,
          )}
          note={ctx.t("Annual accounts, Ministry of Finance", "Bilanțuri, Ministerul Finanțelor")}
        >
          <MoneyTable ctx={ctx} />
        </Block>
      ) : null}
      <PeersBlock ctx={ctx} />
      <CompetitorsBlock ctx={ctx} />
    </DeepPage>
  );
}

/* ---------------------------------------------------------------- site */

function AuditCounts({ ctx }: { ctx: DeepPdfContext }) {
  const imp = ctx.fact("site.audit.important");
  const minor = ctx.fact("site.audit.minor");
  const ok = ctx.fact("site.audit.ok");
  if (!imp && !minor && !ok) return null;
  const cell = (label: string, value: string | undefined, tone: keyof typeof STATUS) => (
    <View style={{ flex: 1, flexDirection: "row", alignItems: "center" }}>
      <View style={{ width: 6, height: 6, borderRadius: 0.6, backgroundColor: STATUS[tone] }} />
      <Text style={{ ...T.h4, marginLeft: 6 }}>{value ?? "–"}</Text>
      <Text style={{ ...T.small, marginLeft: 5 }}>{label}</Text>
    </View>
  );
  return (
    <View
      style={{
        flexDirection: "row",
        paddingVertical: 6,
        borderTopWidth: 0.5,
        borderBottomWidth: 0.5,
        borderColor: INK.hairline,
      }}
    >
      {cell(ctx.t("Important", "Important"), imp ? ctx.pick(imp.display) : undefined, "bad")}
      {cell(ctx.t("Minor", "Mărunt"), minor ? ctx.pick(minor.display) : undefined, "warn")}
      {cell(ctx.t("Fine", "În regulă"), ok ? ctx.pick(ok.display) : undefined, "ok")}
    </View>
  );
}

function IssueList({ ctx }: { ctx: DeepPdfContext }) {
  const issues = ctx
    .byPredicate("site.audit.issue")
    .sort((a, b) => sev(b) - sev(a))
    .slice(0, 8);
  if (!issues.length) return null;
  return (
    <View style={{ marginTop: 8 }}>
      {issues.map((f) => (
        <Dash key={f.id} size={8.4}>
          {ctx.pick(f.display)}
          {sev(f) >= 2 ? ctx.t(" (important)", " (important)") : ""}
        </Dash>
      ))}
    </View>
  );
}

const sev = (f: Fact) => {
  const s = (f.value as { severity?: string } | null)?.severity;
  return s === "high" ? 2 : s === "medium" ? 1 : 0;
};

/** "70 de verificări pe paginile citite": the sum of the counts shown, never a fixed number. */
function checksNote(ctx: DeepPdfContext): string | undefined {
  const n = (id: string) => {
    const v = ctx.fact(id)?.value;
    return typeof v === "number" ? v : 0;
  };
  const total = n("site.audit.important") + n("site.audit.minor") + n("site.audit.ok");
  if (!total) return undefined;
  return ctx.t(
    `${countText(ctx, total, ["check", "checks"], ["verificare", "verificări"])} on the pages read`,
    `${countText(ctx, total, ["check", "checks"], ["verificare", "verificări"])} pe paginile citite`,
  );
}

export function SitePage({ ctx }: { ctx: DeepPdfContext }) {
  const w = ctx.report.company.website;
  const status = w?.status ?? "none";
  const host = w?.url?.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "");
  const read = ctx.pagesRead
    ? ctx.t(
        `We read ${countText(ctx, ctx.pagesRead, ["page", "pages"], ["pagină", "pagini"])}, one at a time, at least a second apart, as a new customer would.`,
        `Am citit ${countText(ctx, ctx.pagesRead, ["page", "pages"], ["pagină", "pagini"])}, una câte una, la cel puțin o secundă distanță, cum ar face un client nou.`,
      )
    : "";
  return (
    <DeepPage ctx={ctx} label={ctx.t("Website and presence", "Site și prezență")}>
      <PageTitle
        kicker={ctx.t("Website and presence", "Site și prezență")}
        title={ctx.pick(WEBSITE_STATUS_TEXT[status])}
        intro={[host, read].filter(Boolean).join(" · ")}
      />
      {ctx.byPredicate("site.audit.important").length ||
      ctx.byPredicate("site.audit.issue").length ? (
        <Block
          first
          title={ctx.t("Website checks", "Verificările site-ului")}
          note={checksNote(ctx)}
        >
          <AuditCounts ctx={ctx} />
          <IssueList ctx={ctx} />
        </Block>
      ) : null}
      <Block title={ctx.t("What the law asks on the site", "Ce cere legea pe site")}>
        <FactRows
          ctx={ctx}
          ids={[
            "site.cui.present",
            "site.reg_no.present",
            "site.legal.privacy",
            "site.legal.terms",
            "site.legal.anpc",
            {
              id: "site.consent.before_analytics",
              label: ctx.t(
                "Visitor consent for statistics",
                "Acordul vizitatorului pentru statistici",
              ),
            },
            "site.analytics.present",
          ]}
        />
      </Block>
      <Block title={ctx.t("How a customer reaches the firm", "Cum ajunge un client la firmă")}>
        <FactRows
          ctx={ctx}
          ids={[
            "site.phone.present",
            "site.email.generic",
            "site.contact_form.present",
            "site.booking.present",
            { predicate: "site.booking.provider" },
            { predicate: "site.chat.provider" },
            { predicate: "site.delivery.provider" },
            "site.shop.present",
            { predicate: "offers.hours" },
          ]}
        />
      </Block>
      <Block title={ctx.t("Presence, e-mail and speed", "Prezență, e-mail și viteză")}>
        <FactRows
          ctx={ctx}
          ids={[
            "presence.social_linked",
            "presence.google_profile_linked",
            "presence.social_only",
            "site.https",
            "site.dns.mx",
            "site.dns.spf",
            "site.dns.dmarc",
            "site.speed.mobile",
            "site.tech",
          ]}
        />
        {ctx.googleOnlineOnly ? (
          <Text style={{ ...T.small, marginTop: 4 }}>
            {ctx.t(
              "The Google rating appears only in the online report, when it is generated.",
              "Nota Google apare doar în raportul online, la generare.",
            )}
          </Text>
        ) : null}
      </Block>
      <GapLines ctx={ctx} sections={["site", "presence", "offers"]} />
    </DeepPage>
  );
}

/* ---------------------------------------------------------------- risk */

export function RiskPage({ ctx }: { ctx: DeepPdfContext }) {
  const risc = (ctx.report.lights ?? []).find((l) => l.area === "risc");
  const title =
    risc?.state === "bine"
      ? ctx.t(
          "No risk signals in the public registers we checked",
          "Nu apar semnale de risc în registrele publice verificate",
        )
      : risc?.state === "neverificat"
        ? ctx.t(
            "Court cases were not checked in this report",
            "Instanțele nu au fost verificate în acest raport",
          )
        : risc
          ? ucFirst(ctx.pick(risc.reason))
          : ctx.t("Registers and team", "Registre și echipă");
  const registers = ctx.report.registers;
  const admins = ctx.fact("people.admin_count");
  return (
    <DeepPage ctx={ctx} label={ctx.t("Risk, registers and team", "Risc, registre și echipă")}>
      <PageTitle
        kicker={ctx.t("Risk, registers and team", "Risc, registre și echipă")}
        title={title}
      />
      <Block first title={ctx.t("The firm in the registers", "Firma în registre")}>
        <FactRows
          ctx={ctx}
          ids={[
            "identity.status",
            "identity.vat_payer",
            "identity.legal_form",
            "identity.reg_no",
            "identity.registered_at",
            "identity.seat",
            "identity.caen",
          ]}
        />
      </Block>
      <Block
        title={ctx.t("Courts and public tenders", "Instanțe și licitații publice")}
        note={ctx.t(
          "Last 36 months; counts by role and type, no case files",
          "Ultimele 36 de luni; număr pe rol și tip, fără dosare",
        )}
      >
        <FactRows
          ctx={ctx}
          ids={[
            "risk.courts.checked",
            "risk.courts.as_plaintiff",
            "risk.courts.as_defendant",
            "risk.courts.insolvency_debtor",
            "risk.courts.as_creditor",
            { predicate: "risk.courts.by_category" },
            "risk.ted.awards",
          ]}
        />
        <GapLines ctx={ctx} sections={["risk"]} />
      </Block>
      {registers ? (
        <Block
          title={ctx.t("Registers checked and not checked", "Registre verificate și neverificate")}
        >
          {registers.checked.length ? (
            <Row
              label={ctx.t("Checked", "Verificate")}
              value={registers.checked.map((r) => ctx.pick(r)).join(", ")}
            />
          ) : null}
          {registers.notChecked.map((r, i) => (
            <Row
              key={r.link}
              label={ctx.t("Not checked", "Neverificat")}
              value={ctx.pick(r.name)}
              link={r.link}
              last={i === registers.notChecked.length - 1}
            />
          ))}
        </Block>
      ) : null}
      <Block
        title={ctx.t("Team", "Echipă")}
        note={ctx.t("Counts and roles only, never names", "Doar numere și roluri, niciodată nume")}
      >
        <FactRows
          ctx={ctx}
          ids={[
            "people.employees_change",
            "people.revenue_per_employee",
            "people.hiring",
            { predicate: "people.job_titles" },
            { predicate: "people.roles" },
            { predicate: "people.departments" },
            { predicate: "people.team_size_published" },
          ]}
        />
        {admins ? null : (
          <Row
            label={ctx.t("Number of administrators", "Numărul de administratori")}
            value={ctx.t(
              "Not in this report: see the Trade Register certificate",
              "Nu e în acest raport: vezi certificatul constatator ONRC",
            )}
            link="https://www.onrc.ro"
            last
          />
        )}
        {admins ? <FactRows ctx={ctx} ids={["people.admin_count"]} /> : null}
        <GapLines ctx={ctx} sections={["people"]} />
      </Block>
    </DeepPage>
  );
}
