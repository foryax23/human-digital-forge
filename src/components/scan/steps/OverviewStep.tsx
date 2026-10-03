import { useId, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { motion, MotionConfig } from "motion/react";
import {
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  Blocks,
  Briefcase,
  Building2,
  CalendarCheck,
  Calendar,
  CircleCheck,
  CircleDashed,
  CircleMinus,
  Code2,
  Compass,
  Cookie,
  CreditCard,
  Gauge,
  Globe,
  Layers,
  LayoutTemplate,
  MapPin,
  Megaphone,
  MessageCircle,
  Pencil,
  Phone,
  Puzzle,
  Route,
  Server,
  ShieldCheck,
  ShoppingCart,
  Star,
  Telescope,
  TriangleAlert,
  Wrench,
} from "lucide-react";

import { useI18n } from "@/i18n";
import { roNeedsDe } from "@/lib/scan/blueprint/format";
import { basisText, listBusinessTypes } from "@/lib/scan/blueprint/taxonomy";
import type {
  AuditFinding,
  Bilingual,
  Blueprint,
  CompanyProfile,
  Competitor,
  DetectedTechnology,
  OnlinePresence,
  PageSpeedResult,
  PresencePlatform,
  WebsiteAudit,
} from "@/lib/scan/types";
import type { ScanState } from "@/components/scan/scan-state";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { SWIRL_ART } from "../report/brand-art";
import { scanButton } from "../report/buttons";
import { displayHost, formatNumber, pick, softenCaps } from "../report/format";
import { GLASS, TILE } from "../report/GlassCard";
import { InfoTip } from "../report/InfoTip";
import { deriveJourney, type JourneyStatus } from "../report/journey";
import { MetricBar } from "../report/MetricBar";
import { EASE_OUT, riseIn, staggerParent } from "../report/motion";
import { PresenceTile, type PresenceView } from "../report/PresenceTile";
import { ScoreRing } from "../report/ScoreRing";
import { StepHeader } from "../report/StepHeader";
import { Tag } from "../report/Tag";
import { scoreTier, useTierLabel } from "../report/tiers";

type EditPatch = { businessTypeId?: string; city?: string; website?: string };
type TabId = "presence" | "technologies" | "market" | "journey";

/**
 * Screen 03a: what the scan found. The company card (editable), then four
 * tabs: digital presence, technologies, market position, customer journey.
 * Only measured data is shown; anything we couldn't check says so.
 */
export function OverviewStep({
  state,
  blueprint,
  onEdit,
  onContinue,
}: {
  state: ScanState;
  blueprint: Blueprint;
  onEdit: (patch: EditPatch) => void;
  onContinue: () => void;
}) {
  const { t, lang } = useI18n();
  const headingId = useId();
  const [tab, setTab] = useState<TabId>("presence");
  const indicatorId = useId();

  const company = blueprint.company ?? state.company ?? undefined;
  const audit = blueprint.audit ?? state.audit ?? undefined;
  const pagespeed = audit?.pagespeed ?? state.pagespeed ?? undefined;
  const presence = blueprint.presence ?? state.presence ?? undefined;
  const competitors = blueprint.competitors ?? state.competitors ?? [];
  const typeLabel = pick(blueprint.businessType.label, lang);

  const tabs: Array<{ id: TabId; label: string; short: string; icon: ReactNode }> = [
    {
      id: "presence",
      label: t("Digital presence", "Prezență digitală"),
      short: t("Presence", "Prezență"),
      icon: <Gauge />,
    },
    {
      id: "technologies",
      label: t("Technologies", "Tehnologii"),
      short: t("Tech stack", "Tehnologii"),
      icon: <Layers />,
    },
    {
      id: "market",
      label: t("Market position", "Poziția pe piață"),
      short: t("Market", "Piață"),
      icon: <Compass />,
    },
    {
      id: "journey",
      label: t("Customer journey", "Parcursul clientului"),
      short: t("Journey", "Parcurs"),
      icon: <Route />,
    },
  ];

  return (
    <MotionConfig reducedMotion="user">
      <section aria-labelledby={headingId} className="w-full">
        <StepHeader
          id={headingId}
          eyebrow={t("03 · Strategy", "03 · Strategie")}
          title={
            <>
              {t("Business ", "Prezentarea ")}
              <span className="heading-accent">{t("overview", "afacerii")}</span>
            </>
          }
          description={t(
            "Here's what we discovered about your business.",
            "Iată ce am descoperit despre afacerea ta.",
          )}
        />

        <div className="mt-8 grid gap-5 lg:grid-cols-[minmax(0,22.5rem)_minmax(0,1fr)] lg:gap-6">
          <CompanyCard
            blueprint={blueprint}
            company={company}
            audit={audit}
            presence={presence}
            onEdit={onEdit}
          />

          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.12, ease: EASE_OUT }}
            className={cn(GLASS, "min-w-0 p-3 sm:p-5 lg:p-6")}
          >
            <Tabs value={tab} onValueChange={(value) => setTab(value as TabId)}>
              <TabsList className="grid h-auto w-full grid-cols-2 gap-1 rounded-2xl border border-white/10 bg-[#04061a]/80 p-1 text-white/60 sm:flex sm:justify-start">
                {tabs.map((item) => (
                  <TabsTrigger
                    key={item.id}
                    value={item.id}
                    className="relative h-10 justify-start gap-2 rounded-xl px-3 text-white/60 transition-colors hover:text-white/90 focus-visible:ring-[#89cbf6]/80 focus-visible:ring-offset-0 data-[state=active]:bg-transparent data-[state=active]:text-white data-[state=active]:shadow-none sm:flex-1 sm:justify-center [&_svg]:h-4 [&_svg]:w-4 [&_svg]:shrink-0"
                  >
                    {tab === item.id && (
                      <motion.span
                        layoutId={indicatorId}
                        aria-hidden
                        className="absolute inset-0 rounded-xl border border-white/15 bg-gradient-to-r from-[#6c63ff]/55 to-[#5b8cf0]/40 shadow-[0_0_24px_rgb(108_99_255/0.35)]"
                        transition={{ type: "spring", stiffness: 380, damping: 34 }}
                      />
                    )}
                    {/* The role sits here: the trigger's own text-sm would win over it. */}
                    <span className="type-button relative z-10 inline-flex min-w-0 items-center gap-2">
                      <span aria-hidden className="text-[#89cbf6]">
                        {item.icon}
                      </span>
                      <span className="truncate xl:hidden">{item.short}</span>
                      <span className="hidden truncate xl:inline">{item.label}</span>
                    </span>
                  </TabsTrigger>
                ))}
              </TabsList>

              <TabsContent value="presence" className="mt-5 focus-visible:ring-0 sm:mt-6">
                <PresencePanel
                  blueprint={blueprint}
                  audit={audit}
                  pagespeed={pagespeed}
                  presence={presence}
                  websiteFailed={
                    state.steps.find((step) => step.id === "website")?.status === "failed"
                  }
                />
              </TabsContent>
              <TabsContent value="technologies" className="mt-5 focus-visible:ring-0 sm:mt-6">
                <TechnologiesPanel audit={audit} />
              </TabsContent>
              <TabsContent value="market" className="mt-5 focus-visible:ring-0 sm:mt-6">
                <MarketPanel
                  competitors={competitors}
                  audit={audit}
                  company={company}
                  typeLabel={typeLabel}
                />
              </TabsContent>
              <TabsContent value="journey" className="mt-5 focus-visible:ring-0 sm:mt-6">
                <JourneyPanel audit={audit} presence={presence} company={company} />
              </TabsContent>
            </Tabs>
          </motion.div>
        </div>

        <div className="mt-8 flex flex-col-reverse gap-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="type-body-sm max-w-md text-white/50">
            {t(
              `Next: three strategies for your ${typeLabel.toLowerCase()}, with what each costs and returns.`,
              `Urmează: trei strategii pentru afacerea ta (${typeLabel.toLowerCase()}), cu costul și câștigul fiecăreia.`,
            )}
          </p>
          <button type="button" onClick={onContinue} className={scanButton("primary", "lg")}>
            {t("See strategy options", "Vezi variantele de strategie")}
            <ArrowRight aria-hidden />
          </button>
        </div>
      </section>
    </MotionConfig>
  );
}

/* ------------------------------------------------------------ company card */

function CompanyCard({
  blueprint,
  company,
  audit,
  presence,
  onEdit,
}: {
  blueprint: Blueprint;
  company?: CompanyProfile;
  audit?: WebsiteAudit;
  presence?: OnlinePresence;
  onEdit: (patch: EditPatch) => void;
}) {
  const { t, lang } = useI18n();
  const [imageFailed, setImageFailed] = useState(false);
  const [faviconFailed, setFaviconFailed] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  const website = company?.website ?? audit?.finalUrl ?? blueprint.target.url;
  const host = displayHost(audit?.finalUrl ?? website);
  const titleName = audit?.meta.title?.split(/\s[|–—-]\s/)[0]?.trim();
  const name =
    company?.displayName ??
    titleName ??
    host ??
    blueprint.target.query ??
    t("Your business", "Afacerea ta");
  const legalName =
    company?.name && company.name !== company.displayName ? company.name : undefined;
  const city = company?.city ? softenCaps(company.city) : undefined;
  const rating = presence?.googleRating;

  const image = useMemo(() => {
    if (audit?.screenshot) return audit.screenshot;
    if (audit?.meta.ogImage) {
      try {
        return new URL(audit.meta.ogImage, audit.finalUrl || audit.url).href;
      } catch {
        return undefined;
      }
    }
    return undefined;
  }, [audit]);

  const favicon = useMemo(() => {
    if (!audit?.meta.favicon) return undefined;
    try {
      return new URL(audit.meta.favicon, audit.finalUrl || audit.url).href;
    } catch {
      return undefined;
    }
  }, [audit]);

  const initials = name
    .replace(/\b(S\.?R\.?L\.?|S\.?A\.?|PFA|II)\b/gi, "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase())
    .join("");

  const rows: Array<{ icon: ReactNode; label: string; value: ReactNode }> = [];
  if (website) {
    rows.push({
      icon: <Globe />,
      label: t("Website", "Site"),
      value: (
        <a
          href={/^https?:\/\//i.test(website) ? website : `https://${website}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex max-w-full items-center gap-1 text-[#bfe3fb] underline-offset-4 hover:underline"
        >
          <span className="truncate">{displayHost(website)}</span>
          <ArrowUpRight aria-hidden className="h-3.5 w-3.5 shrink-0" />
          <span className="sr-only">
            {t(" (opens in a new tab)", " (se deschide într-o filă nouă)")}
          </span>
        </a>
      ),
    });
  }
  if (company?.phone) {
    rows.push({
      icon: <Phone />,
      label: t("Phone", "Telefon"),
      value: (
        <a href={`tel:${company.phone.replace(/[^\d+]/g, "")}`} className="hover:underline">
          {company.phone}
        </a>
      ),
    });
  }
  if (company?.address) {
    rows.push({
      icon: <MapPin />,
      label: t("Address", "Adresă"),
      value: softenCaps(company.address),
    });
  }
  // The activity in words; the tag above keeps only the CAEN code, so a long
  // label never gets cut off inside a pill.
  if (company?.caenLabel) {
    rows.push({
      icon: <Layers />,
      label: t("Activity", "Activitate"),
      value: pick(company.caenLabel, lang),
    });
  }
  if (company?.cui) {
    rows.push({
      icon: <Building2 />,
      label: t("Fiscal code", "Cod fiscal"),
      value: (
        <>
          CUI {company.cui}
          {company.regNo ? <span className="text-white/45"> · {company.regNo}</span> : null}
        </>
      ),
    });
  }
  if (company?.registeredAt) {
    const year = company.registeredAt.slice(0, 4);
    rows.push({ icon: <Calendar />, label: t("Registered", "Înființată"), value: year });
  }

  const sources = [
    company?.sources.includes("anaf") ? "ANAF" : null,
    company?.sources.includes("index") ? t("Trade Register", "Registrul Comerțului") : null,
    audit?.reachable ? t("website scan", "scanarea site-ului") : null,
    presence?.googleRating ? "Google" : null,
  ].filter(Boolean);

  const basis = blueprint.businessType.basis;

  return (
    <motion.article
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.7, ease: EASE_OUT }}
      className={cn(
        GLASS,
        "flex min-w-0 flex-col self-start p-3 sm:p-4 lg:top-24 lg:[@media(min-height:860px)]:sticky",
      )}
    >
      {/* Preview: the site's own first screen, its share image, or brand art. */}
      <div className="relative aspect-[16/10] overflow-hidden rounded-2xl border border-white/10 bg-[#04061a]">
        {image && !imageFailed ? (
          <img
            src={image}
            alt={t(`First screen of ${host ?? name}`, `Primul ecran de pe ${host ?? name}`)}
            onError={() => setImageFailed(true)}
            ref={(img) => {
              // An error before hydration never reaches onError.
              if (img?.complete && img.naturalWidth === 0) setImageFailed(true);
            }}
            referrerPolicy="no-referrer"
            decoding="async"
            className="h-full w-full object-cover object-top"
          />
        ) : (
          <div className="relative h-full w-full">
            <img
              src={SWIRL_ART.src}
              alt=""
              aria-hidden
              decoding="async"
              className="absolute inset-0 h-full w-full scale-125 object-cover opacity-80"
              style={{ objectPosition: SWIRL_ART.position }}
            />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,transparent_20%,#04061a_85%)]" />
            <span
              aria-hidden
              className="type-h2 absolute inset-0 grid place-items-center text-white/95 drop-shadow-[0_4px_24px_rgb(108_99_255/0.8)]"
            >
              {initials || "V"}
            </span>
          </div>
        )}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-[#04061a]/90 to-transparent" />
        {host && (
          <span className="type-micro absolute bottom-3 left-3 inline-flex max-w-[calc(100%-1.5rem)] items-center gap-2 rounded-full border border-white/15 bg-[#04061a]/75 px-2.5 py-1 text-white/85 backdrop-blur">
            {favicon && !faviconFailed ? (
              <img
                src={favicon}
                alt=""
                aria-hidden
                width={14}
                height={14}
                referrerPolicy="no-referrer"
                onError={() => setFaviconFailed(true)}
                ref={(img) => {
                  if (img?.complete && img.naturalWidth === 0) setFaviconFailed(true);
                }}
                className="h-3.5 w-3.5 rounded-sm"
              />
            ) : (
              <Globe aria-hidden className="h-3.5 w-3.5 text-[#89cbf6]" />
            )}
            <span className="truncate">{host}</span>
          </span>
        )}
      </div>

      <div className="px-1.5 pb-1.5 pt-4 sm:px-2">
        <h3 className="type-h3 text-white">{name}</h3>
        {legalName && <p className="type-label mt-1 text-white/40">{legalName}</p>}

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-0.5">
            <Tag tone="violet" icon={<Briefcase />}>
              {pick(blueprint.businessType.label, lang)}
            </Tag>
            {basis.length > 0 && (
              <InfoTip label={t("Why this business type?", "De ce acest tip de afacere?")}>
                <p className="font-medium text-white">
                  {t(
                    `Matched with ${Math.round(blueprint.businessType.confidence * 100)}% confidence from:`,
                    `Stabilit cu o încredere de ${Math.round(blueprint.businessType.confidence * 100)}%, pe baza:`,
                  )}
                </p>
                <ul className="mt-1 list-disc space-y-0.5 pl-4">
                  {basis.map((item) => (
                    <li key={item}>{basisText(item, lang, company?.caenLabel)}</li>
                  ))}
                </ul>
                <p className="mt-1.5 text-white/55">
                  {t(
                    "Not right? Use “Edit business”.",
                    "Nu e corect? Folosește „Editează afacerea”.",
                  )}
                </p>
              </InfoTip>
            )}
          </span>
          {company?.caenLabel && (
            <Tag tone="neutral" icon={<Layers />}>
              CAEN {company.caen}
            </Tag>
          )}
          {city && (
            <Tag tone="sky" icon={<MapPin />}>
              {city}
            </Tag>
          )}
          {company?.inactive && (
            <Tag tone="outline" icon={<TriangleAlert />}>
              {t("Inactive in ANAF records", "Inactivă în evidențele ANAF")}
            </Tag>
          )}
        </div>

        {rating && (
          <a
            href={rating.mapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-3.5 py-2.5 transition-colors hover:bg-white/[0.07]"
          >
            <span className="type-h3 text-white">{formatNumber(rating.rating, lang, 1)}</span>
            <span className="flex flex-col">
              <span aria-hidden className="flex gap-0.5 text-[#5fe3d0]">
                {Array.from({ length: 5 }, (_, i) => (
                  <Star
                    key={i}
                    className={cn(
                      "h-3.5 w-3.5",
                      i < Math.round(rating.rating) ? "fill-current" : "opacity-35",
                    )}
                  />
                ))}
              </span>
              <span className="type-micro text-white/60">
                {t(
                  `${formatNumber(rating.reviews, lang)} Google reviews`,
                  `${formatNumber(rating.reviews, lang)} ${roNeedsDe(rating.reviews) ? "de " : ""}recenzii Google`,
                )}
              </span>
            </span>
            <ArrowUpRight aria-hidden className="ml-auto h-4 w-4 text-white/40" />
          </a>
        )}

        {rows.length > 0 && (
          <dl className="mt-4 divide-y divide-white/[0.07] border-y border-white/[0.07]">
            {rows.map((row) => (
              <div key={row.label} className="type-body-sm flex items-start gap-3 py-2.5">
                <dt className="flex w-24 shrink-0 items-center gap-2 text-white/45 [&_svg]:h-3.5 [&_svg]:w-3.5">
                  <span aria-hidden>{row.icon}</span>
                  {row.label}
                </dt>
                <dd className="min-w-0 break-words text-white/85">{row.value}</dd>
              </div>
            ))}
          </dl>
        )}

        {sources.length > 0 && (
          <p className="type-micro mt-3 text-white/40">
            {t("Sources", "Surse")}: {sources.join(" · ")}
          </p>
        )}

        <button
          type="button"
          onClick={() => setEditOpen(true)}
          className={scanButton("secondary", "md", "mt-4 w-full")}
        >
          <Pencil aria-hidden />
          {t("Edit business", "Editează afacerea")}
        </button>
      </div>

      <EditBusinessDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        initial={{
          businessTypeId: blueprint.businessType.id,
          businessTypeLabel: blueprint.businessType.label,
          city: company?.city ?? "",
          website: website ?? "",
        }}
        onSave={onEdit}
      />
    </motion.article>
  );
}

type TypeOption = { id: string; label: Bilingual; sector?: Bilingual };

function EditBusinessDialog({
  open,
  onOpenChange,
  initial,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial: { businessTypeId: string; businessTypeLabel: Bilingual; city: string; website: string };
  onSave: (patch: EditPatch) => void;
}) {
  const { t, lang } = useI18n();
  const formId = useId();
  const [error, setError] = useState<string | null>(null);

  const options = useMemo(() => {
    let list: TypeOption[] = listBusinessTypes();
    if (!list.some((item) => item.id === initial.businessTypeId)) {
      list = [{ id: initial.businessTypeId, label: initial.businessTypeLabel }, ...list];
    }
    return [...list].sort((a, b) => pick(a.label, lang).localeCompare(pick(b.label, lang), lang));
  }, [initial.businessTypeId, initial.businessTypeLabel, lang]);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const businessTypeId = String(form.get("businessType") ?? "");
    const city = String(form.get("city") ?? "").trim();
    let website = String(form.get("website") ?? "").trim();

    const patch: EditPatch = {};
    if (businessTypeId && businessTypeId !== initial.businessTypeId)
      patch.businessTypeId = businessTypeId;
    if (city && city !== initial.city.trim()) patch.city = city;
    if (website && website !== initial.website.trim()) {
      if (!/^https?:\/\//i.test(website)) website = `https://${website}`;
      try {
        const url = new URL(website);
        if (!url.hostname.includes(".")) throw new Error("no tld");
        patch.website = url.href;
      } catch {
        setError(
          t("That doesn't look like a website address.", "Nu pare o adresă de site validă."),
        );
        return;
      }
    }
    setError(null);
    if (Object.keys(patch).length) onSave(patch);
    onOpenChange(false);
  };

  const field =
    "type-body mt-1.5 h-11 w-full rounded-xl border border-white/12 bg-[#04061a]/80 px-3.5 text-white outline-none transition-colors placeholder:text-white/35 focus:border-[#89cbf6]/60 focus:ring-2 focus:ring-[#89cbf6]/25 [color-scheme:dark]";

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setError(null);
        onOpenChange(next);
      }}
    >
      <DialogContent
        closeLabel={t("Close", "Închide")}
        className="cinematic max-w-[calc(100vw-2rem)] rounded-3xl border-white/10 bg-[#070a1f]/95 p-6 text-white backdrop-blur-xl sm:max-w-md sm:rounded-3xl sm:p-7"
      >
        <DialogHeader>
          {/* Roles on inner spans: the dialog primitives' own sizes would win. */}
          <DialogTitle className="text-white">
            <span className="type-h3 block">{t("Edit business", "Editează afacerea")}</span>
          </DialogTitle>
          <DialogDescription className="text-white/60">
            <span className="type-body-sm">
              {t(
                "Correct anything we got wrong. We'll re-run only the steps your change affects.",
                "Corectează ce am înțeles greșit. Reluăm doar pașii afectați de modificare.",
              )}
            </span>
          </DialogDescription>
        </DialogHeader>
        <form id={formId} onSubmit={submit} className="mt-2 space-y-4" noValidate>
          <label className="type-body-sm block text-white/75">
            {t("Business type", "Tipul afacerii")}
            <select name="businessType" defaultValue={initial.businessTypeId} className={field}>
              {options.map((option) => (
                <option key={option.id} value={option.id} className="bg-[#070a1f]">
                  {pick(option.label, lang)}
                  {option.sector ? ` (${pick(option.sector, lang)})` : ""}
                </option>
              ))}
            </select>
          </label>
          <label className="type-body-sm block text-white/75">
            {t("City", "Oraș")}
            <input
              name="city"
              defaultValue={initial.city}
              autoComplete="address-level2"
              placeholder={t("e.g. Timișoara", "de ex. Timișoara")}
              className={field}
            />
          </label>
          <label className="type-body-sm block text-white/75">
            {t("Website", "Site")}
            <input
              name="website"
              type="url"
              inputMode="url"
              defaultValue={initial.website}
              placeholder="www.example.ro"
              autoComplete="url"
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? `${formId}-error` : undefined}
              className={field}
            />
          </label>
          {error && (
            <p id={`${formId}-error`} role="alert" className="type-body-sm text-[#b3acff]">
              {error}
            </p>
          )}
          <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className={scanButton("ghost", "md")}
            >
              {t("Cancel", "Anulează")}
            </button>
            <button type="submit" className={scanButton("primary", "md")}>
              {t("Update the scan", "Actualizează scanarea")}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* --------------------------------------------------------- shared bits */

function SectionTitle({ children, aside }: { children: ReactNode; aside?: ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <h3 className="type-label text-white/70">{children}</h3>
      {aside}
    </div>
  );
}

function EmptyState({ icon, title, body }: { icon: ReactNode; title: string; body: string }) {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-dashed border-white/12 px-6 py-10 text-center">
      <span
        aria-hidden
        className="grid h-12 w-12 place-items-center rounded-2xl border border-white/10 bg-white/[0.04] text-[#89cbf6] [&_svg]:h-5 [&_svg]:w-5"
      >
        {icon}
      </span>
      <p className="type-h3 mt-4 text-white">{title}</p>
      <p className="type-body-sm mt-1.5 max-w-sm text-white/55">{body}</p>
    </div>
  );
}

/* -------------------------------------------------------- presence tab */

const PRESENCE_PLATFORMS: PresencePlatform[] = [
  "google-business",
  "facebook",
  "instagram",
  "linkedin",
  "youtube",
];

const SOCIAL_HOSTS: Partial<Record<PresencePlatform, RegExp>> = {
  facebook: /facebook\.com|fb\.com/i,
  instagram: /instagram\.com/i,
  linkedin: /linkedin\.com/i,
  youtube: /youtube\.com|youtu\.be/i,
  tiktok: /tiktok\.com/i,
  x: /(^|\/\/|\.)(x|twitter)\.com/i,
};

function channelViews(
  presence: OnlinePresence | undefined,
  audit: WebsiteAudit | undefined,
): PresenceView[] {
  const rating = presence?.googleRating;
  const ratingMetric = rating
    ? {
        label: { en: "Rating", ro: "Notă" },
        value: `${formatNumber(rating.rating, "en", 1)} ★ · ${rating.reviews}`,
      }
    : undefined;

  const views: PresenceView[] = PRESENCE_PLATFORMS.map((platform) => {
    const found = presence?.profiles.find((p) => p.platform === platform);
    if (found) {
      if (platform === "google-business" && ratingMetric && !found.metric) {
        return { ...found, metric: ratingMetric, url: found.url ?? rating?.mapsUrl };
      }
      return found;
    }
    if (platform === "google-business" && rating) {
      return { platform, status: "active", url: rating.mapsUrl, metric: ratingMetric };
    }
    if (presence) return { platform, status: "missing" };
    // No presence check ran: fall back to the links on the site itself.
    const pattern = SOCIAL_HOSTS[platform];
    const link = pattern ? audit?.signals.socialLinks.find((url) => pattern.test(url)) : undefined;
    if (link) return { platform, status: "detected", url: link };
    return { platform, status: platform === "google-business" || !audit ? "unchecked" : "missing" };
  });

  // Extra channels we did find (TikTok, X) earn a tile too.
  for (const profile of presence?.profiles ?? []) {
    if (
      !PRESENCE_PLATFORMS.includes(profile.platform) &&
      profile.platform !== "website" &&
      profile.status !== "missing"
    ) {
      views.push(profile);
    }
  }
  return views;
}

const SEVERITY_RANK = { critical: 0, high: 1, medium: 2, low: 3 } as const;

function PresencePanel({
  blueprint,
  audit,
  pagespeed,
  presence,
  websiteFailed,
}: {
  blueprint: Blueprint;
  audit?: WebsiteAudit;
  pagespeed?: PageSpeedResult;
  presence?: OnlinePresence;
  websiteFailed?: boolean;
}) {
  const { t, lang } = useI18n();
  const site = audit?.reachable ? audit : undefined;
  const channels = channelViews(presence, audit);

  const bars = site
    ? [
        {
          key: "performance",
          label: t("Performance", "Performanță"),
          value: site.scores.performance ?? pagespeed?.performance,
          hint: pagespeed ? t("Lighthouse, mobile", "Lighthouse, mobil") : undefined,
        },
        { key: "seo", label: "SEO", value: site.scores.seo },
        {
          key: "accessibility",
          label: t("Accessibility", "Accesibilitate"),
          value: site.scores.accessibility,
        },
        {
          key: "security",
          label: t("Security & privacy", "Securitate și confidențialitate"),
          value: site.scores.security,
        },
        { key: "conversion", label: t("Conversion", "Conversie"), value: site.scores.conversion },
        {
          key: "content",
          label: t("Content", "Conținut"),
          value: (site.scores as Record<string, number | undefined>).content,
        },
      ].filter((bar): bar is typeof bar & { value: number } => typeof bar.value === "number")
    : [];

  const findings = site
    ? [...site.findings]
        .sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity])
        .slice(0, 3)
    : [];

  return (
    <div className="space-y-8">
      {site ? (
        <div className="grid items-center gap-6 md:grid-cols-[auto_minmax(0,1fr)] md:gap-8">
          <div className="flex flex-col items-center">
            <ScoreRing
              value={site.scores.overall}
              caption={t("Website score", "Scorul site-ului")}
            />
            <p className="type-micro mt-2 max-w-[13rem] text-center text-white/45">
              {t(
                `${site.pages.length} ${site.pages.length === 1 ? "page" : "pages"} of ${site.host} checked`,
                `${site.pages.length} ${site.pages.length === 1 ? "pagină verificată" : "pagini verificate"} pe ${site.host}`,
              )}
            </p>
          </div>
          <div className="space-y-4">
            {bars.map((bar, i) => (
              <MetricBar
                key={bar.key}
                label={bar.label}
                value={bar.value}
                hint={bar.hint}
                delay={0.08 * i}
              />
            ))}
          </div>
        </div>
      ) : (
        <EmptyState
          icon={<Globe />}
          title={
            (audit && !audit.reachable) || websiteFailed
              ? t("We couldn't open the website", "Nu am putut deschide site-ul")
              : t("No website analysed", "Niciun site analizat")
          }
          body={
            audit && !audit.reachable
              ? t(
                  `${audit.host} didn't respond${audit.statusCode ? ` (status ${audit.statusCode})` : ""}, so there's no website score. Use “Edit business” to try another address.`,
                  `${audit.host} nu a răspuns${audit.statusCode ? ` (cod ${audit.statusCode})` : ""}, deci nu există un scor al site-ului. Folosește „Editează afacerea” pentru altă adresă.`,
                )
              : websiteFailed
                ? t(
                    "We tried to scan the website but it didn't respond. Use “Edit business” to try another address.",
                    "Am încercat să scanăm site-ul, dar nu a răspuns. Folosește „Editează afacerea” pentru altă adresă.",
                  )
                : t(
                    "We didn't find a website for this business. Add one with “Edit business” to get a full website score.",
                    "Nu am găsit un site pentru această afacere. Adaugă-l din „Editează afacerea” pentru un scor complet.",
                  )
          }
        />
      )}

      {pagespeed && <VitalsRow pagespeed={pagespeed} />}

      <div>
        <SectionTitle>{t("Where customers find you", "Unde te găsesc clienții")}</SectionTitle>
        <motion.ul
          variants={staggerParent}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "0px 0px -40px 0px" }}
          className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-5"
        >
          {channels.map((profile) => (
            <PresenceTile key={profile.platform} profile={profile} />
          ))}
        </motion.ul>
        {!presence && (
          <p className="type-micro mt-2 text-white/40">
            {site
              ? t(
                  "Based on the links on your website; we didn't run a separate profile search.",
                  "Pe baza linkurilor de pe site; nu am căutat separat profilurile.",
                )
              : t(
                  "Profiles are found through your website's links, so we couldn't check them this time.",
                  "Profilurile sunt găsite prin linkurile de pe site, așa că nu le-am putut verifica de data aceasta.",
                )}
          </p>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <ScoreStat
          label={t("Digital maturity", "Maturitate digitală")}
          value={blueprint.scores.digitalMaturity}
          info={t(
            "A blend of your website score (45%), the online channels we found (25%) and the digital tools on your site (30%).",
            "O combinație între scorul site-ului (45%), canalele online găsite (25%) și instrumentele digitale de pe site (30%).",
          )}
        />
        <ScoreStat
          label={t("Automation potential", "Potențial de automatizare")}
          value={blueprint.scores.automationPotential}
          info={t(
            "How much of your team's working time the plan could free up; saving 8% of working hours or more scores 100.",
            "Cât timp de lucru poate elibera planul pentru echipă; dacă economisește cel puțin 8% din orele lucrate, scorul este 100.",
          )}
        />
      </div>

      {findings.length > 0 && (
        <div>
          <SectionTitle>{t("Fix these first", "De rezolvat mai întâi")}</SectionTitle>
          <motion.ol
            variants={staggerParent}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: "0px 0px -40px 0px" }}
            className="space-y-2.5"
          >
            {findings.map((finding) => (
              <FindingRow key={finding.id} finding={finding} lang={lang} />
            ))}
          </motion.ol>
        </div>
      )}
    </div>
  );
}

function ScoreStat({ label, value, info }: { label: string; value: number; info: string }) {
  const { t } = useI18n();
  const tierLabel = useTierLabel();
  const tier = tierLabel(scoreTier(value));
  return (
    <div className={cn(TILE, "flex items-center gap-4 p-3.5")}>
      <ScoreRing value={value} size={64} stroke={7} showTier={false} />
      <div className="min-w-0">
        <p className="type-body-sm flex items-center gap-1 text-white/80">
          {label}
          <InfoTip label={t(`About ${label}`, `Despre ${label}`)}>{info}</InfoTip>
        </p>
        <p className={cn("type-micro mt-0.5 font-medium", tier.text)}>{tier.label}</p>
      </div>
    </div>
  );
}

function VitalsRow({ pagespeed }: { pagespeed: PageSpeedResult }) {
  const { t, lang } = useI18n();
  const vitals = [
    pagespeed.lcpMs !== undefined && {
      key: "lcp",
      label: t("Largest paint", "Afișarea conținutului principal"),
      value: `${formatNumber(pagespeed.lcpMs / 1000, lang, 1)} s`,
      good: pagespeed.lcpMs <= 2500,
      fair: pagespeed.lcpMs <= 4000,
    },
    pagespeed.cls !== undefined && {
      key: "cls",
      label: t("Layout shift", "Deplasarea elementelor"),
      value: formatNumber(pagespeed.cls, lang, 2),
      good: pagespeed.cls <= 0.1,
      fair: pagespeed.cls <= 0.25,
    },
    pagespeed.tbtMs !== undefined && {
      key: "tbt",
      label: t("Blocking time", "Timp de blocare"),
      value: `${formatNumber(pagespeed.tbtMs, lang)} ms`,
      good: pagespeed.tbtMs <= 200,
      fair: pagespeed.tbtMs <= 600,
    },
    pagespeed.fieldLcpMs !== undefined && {
      key: "field-lcp",
      label: t("Real visitors' paint", "Afișare la vizitatorii reali"),
      value: `${formatNumber(pagespeed.fieldLcpMs / 1000, lang, 1)} s`,
      good: pagespeed.fieldLcpMs <= 2500,
      fair: pagespeed.fieldLcpMs <= 4000,
    },
  ].filter(Boolean) as Array<{
    key: string;
    label: string;
    value: string;
    good: boolean;
    fair: boolean;
  }>;

  if (!vitals.length) return null;
  return (
    <div>
      <SectionTitle
        aside={
          <span className="type-tech text-white/40">
            {pagespeed.strategy === "mobile"
              ? t("Lighthouse · mobile", "Lighthouse · mobil")
              : t("Lighthouse · desktop", "Lighthouse · desktop")}
          </span>
        }
      >
        {t("Speed on a phone", "Viteza pe telefon")}
      </SectionTitle>
      <ul className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        {vitals.map((vital) => {
          const tone = vital.good
            ? "text-[#5fe3d0]"
            : vital.fair
              ? "text-[#89cbf6]"
              : "text-[#b3acff]";
          const Icon = vital.good ? CircleCheck : vital.fair ? CircleDashed : TriangleAlert;
          const word = vital.good
            ? t("Good", "Bun")
            : vital.fair
              ? t("Fair", "Acceptabil")
              : t("Slow", "Lent");
          return (
            <li key={vital.key} className={cn(TILE, "px-3.5 py-3")}>
              <p className="type-micro text-white/55">{vital.label}</p>
              <p className="type-h3 mt-1 tabular-nums text-white">{vital.value}</p>
              <p className={cn("type-micro mt-0.5 inline-flex items-center gap-1", tone)}>
                <Icon aria-hidden className="h-3.5 w-3.5" />
                {word}
              </p>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function FindingRow({ finding, lang }: { finding: AuditFinding; lang: "en" | "ro" }) {
  const { t } = useI18n();
  const severity = {
    critical: { tone: "violet" as const, label: t("Critical", "Critic") },
    high: { tone: "violet" as const, label: t("High priority", "Prioritate mare") },
    medium: { tone: "blue" as const, label: t("Medium", "Medie") },
    low: { tone: "neutral" as const, label: t("Low", "Mică") },
  }[finding.severity];
  const effort = {
    quick: t("Quick fix", "Rezolvare rapidă"),
    medium: t("Medium effort", "Efort mediu"),
    project: t("Project", "Proiect"),
  }[finding.effort];

  return (
    <motion.li variants={riseIn} className={cn(TILE, "p-4")}>
      <div className="flex flex-wrap items-center gap-2">
        <Tag tone={severity.tone}>{severity.label}</Tag>
        <Tag tone="neutral" icon={<Wrench />}>
          {effort}
        </Tag>
      </div>
      <p className="type-h3 mt-2.5 text-white">{pick(finding.title, lang)}</p>
      <p className="type-body-sm mt-1 text-white/60">{pick(finding.recommendation, lang)}</p>
      {finding.evidence && <p className="type-tech mt-2 text-white/40">{finding.evidence}</p>}
    </motion.li>
  );
}

/* ---------------------------------------------------- technologies tab */

const TECH_GROUPS: Array<{
  id: DetectedTechnology["category"];
  label: Bilingual;
  icon: ReactNode;
}> = [
  {
    id: "cms",
    label: { en: "Content management", ro: "Administrare conținut (CMS)" },
    icon: <LayoutTemplate />,
  },
  {
    id: "builder",
    label: { en: "Site builder", ro: "Platformă de creare a site-ului" },
    icon: <Blocks />,
  },
  { id: "ecommerce", label: { en: "E-commerce", ro: "Comerț online" }, icon: <ShoppingCart /> },
  { id: "framework", label: { en: "Framework", ro: "Framework" }, icon: <Code2 /> },
  { id: "analytics", label: { en: "Analytics", ro: "Statistici de trafic" }, icon: <BarChart3 /> },
  { id: "marketing", label: { en: "Marketing", ro: "Marketing" }, icon: <Megaphone /> },
  { id: "chat", label: { en: "Chat", ro: "Chat" }, icon: <MessageCircle /> },
  { id: "booking", label: { en: "Booking", ro: "Programări" }, icon: <CalendarCheck /> },
  { id: "payments", label: { en: "Payments", ro: "Plăți" }, icon: <CreditCard /> },
  {
    id: "consent",
    label: { en: "Cookie consent", ro: "Acord pentru cookie-uri" },
    icon: <Cookie />,
  },
  {
    id: "hosting",
    label: { en: "Hosting & delivery", ro: "Găzduire și CDN" },
    icon: <Server />,
  },
  { id: "other", label: { en: "Other", ro: "Altele" }, icon: <Puzzle /> },
];

function TechnologiesPanel({ audit }: { audit?: WebsiteAudit }) {
  const { t, lang } = useI18n();
  if (!audit?.reachable) {
    return (
      <EmptyState
        icon={<Layers />}
        title={t("No website to inspect", "Niciun site de analizat")}
        body={t(
          "Technologies are read from the website's code, so this needs a site we can open.",
          "Tehnologiile sunt citite din codul site-ului, deci avem nevoie de un site pe care să-l putem deschide.",
        )}
      />
    );
  }

  const groups = TECH_GROUPS.map((group) => ({
    ...group,
    items: audit.technologies
      .filter((tech) => tech.category === group.id)
      .sort((a, b) => b.confidence - a.confidence),
  })).filter((group) => group.items.length);

  const s = audit.signals;
  const signals: Array<{ ok: boolean; label: string; icon: ReactNode }> = [
    { ok: s.hasAnalytics, label: t("Analytics", "Statistici de trafic"), icon: <BarChart3 /> },
    {
      ok: s.hasCookieConsent,
      label: t("Cookie consent", "Acord pentru cookie-uri"),
      icon: <ShieldCheck />,
    },
    {
      ok: s.hasOnlineBooking,
      label: t("Online booking", "Programare online"),
      icon: <CalendarCheck />,
    },
    { ok: s.hasLiveChat, label: t("Live chat", "Chat live"), icon: <MessageCircle /> },
    { ok: s.hasWhatsApp, label: "WhatsApp", icon: <Phone /> },
    {
      ok: s.hasMarketingPixel,
      label: t("Marketing pixel", "Pixel de marketing"),
      icon: <Megaphone />,
    },
    { ok: s.hasStructuredData, label: t("Structured data", "Date structurate"), icon: <Code2 /> },
    { ok: s.hasNewsletter, label: t("Newsletter", "Newsletter"), icon: <Globe /> },
    { ok: s.hasEcommerce, label: t("Online shop", "Magazin online"), icon: <ShoppingCart /> },
  ];

  return (
    <div className="space-y-8">
      <div>
        <SectionTitle
          aside={
            <span className="type-tech text-white/40">
              {t(`${audit.technologies.length} detected`, `${audit.technologies.length} detectate`)}
            </span>
          }
        >
          {t("Your stack", "Tehnologiile tale")}
        </SectionTitle>
        {groups.length ? (
          <motion.ul
            variants={staggerParent}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true }}
            className="grid gap-2.5 sm:grid-cols-2"
          >
            {groups.map((group) => (
              <motion.li key={group.id} variants={riseIn} className={cn(TILE, "p-4")}>
                <p className="type-label flex items-center gap-2 text-white/50 [&_svg]:h-4 [&_svg]:w-4">
                  <span aria-hidden className="text-[#89cbf6]">
                    {group.icon}
                  </span>
                  {pick(group.label, lang)}
                </p>
                <ul className="mt-3 flex flex-wrap gap-2">
                  {group.items.map((tech) => (
                    <li
                      key={tech.name}
                      className="type-body-sm inline-flex items-center gap-2 rounded-full border border-white/12 bg-gradient-to-r from-[#6c63ff]/20 to-[#5b8cf0]/10 px-3 py-1.5 text-white"
                    >
                      {tech.name}
                      {tech.confidence < 0.7 && (
                        <span className="type-micro text-white/45">{t("likely", "probabil")}</span>
                      )}
                    </li>
                  ))}
                </ul>
              </motion.li>
            ))}
          </motion.ul>
        ) : (
          <EmptyState
            icon={<Puzzle />}
            title={t("Nothing recognisable", "Nicio tehnologie recunoscută")}
            body={t(
              "We didn't recognise a CMS, analytics or marketing tool, so the site may be custom-built.",
              "Nu am recunoscut un CMS, un instrument de statistici sau unul de marketing, deci site-ul poate fi făcut la comandă.",
            )}
          />
        )}
      </div>

      <div>
        <SectionTitle>{t("What the site can do", "Ce poate face site-ul")}</SectionTitle>
        <ul className="grid grid-cols-1 gap-2 min-[420px]:grid-cols-2 lg:grid-cols-3">
          {signals.map((signal) => (
            <li
              key={signal.label}
              className={cn(
                "type-body-sm flex items-center gap-2.5 rounded-xl border px-3 py-2.5",
                signal.ok
                  ? "border-[#5fe3d0]/25 bg-[#5fe3d0]/[0.06] text-white"
                  : "border-dashed border-white/12 text-white/50",
              )}
            >
              {signal.ok ? (
                <CircleCheck aria-hidden className="h-4 w-4 shrink-0 text-[#5fe3d0]" />
              ) : (
                <CircleMinus aria-hidden className="h-4 w-4 shrink-0 text-white/35" />
              )}
              <span className="min-w-0 truncate">{signal.label}</span>
              <span className="sr-only">
                {signal.ok ? t(": found", ": găsit") : t(": not detected", ": nedetectat")}
              </span>
              {!signal.ok && (
                <span aria-hidden className="type-micro ml-auto shrink-0 text-white/35">
                  {t("not detected", "nedetectat")}
                </span>
              )}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------- market tab */

function MarketPanel({
  competitors,
  audit,
  company,
  typeLabel,
}: {
  competitors: Competitor[];
  audit?: WebsiteAudit;
  company?: CompanyProfile;
  typeLabel: string;
}) {
  const { t, lang } = useI18n();
  const yourScore = audit?.reachable ? audit.scores.overall : undefined;
  const sorted = [...competitors].sort((a, b) => (b.websiteScore ?? -1) - (a.websiteScore ?? -1));
  const scored = competitors.filter((c) => typeof c.websiteScore === "number");
  const average = scored.length
    ? Math.round(scored.reduce((sum, c) => sum + (c.websiteScore ?? 0), 0) / scored.length)
    : undefined;
  const city = company?.city ? softenCaps(company.city) : undefined;

  if (!competitors.length) {
    return (
      <EmptyState
        icon={<Telescope />}
        title={t("No local competitors matched", "Nu am găsit concurenți locali")}
        body={t(
          `We look for businesses with a similar name and activity${city ? ` in ${city}` : ""} in the Trade Register. None matched this time, which can also mean a less crowded market.`,
          `Căutăm firme cu nume și activitate similare${city ? ` în ${city}` : ""} în Registrul Comerțului. Nu a apărut niciuna de data aceasta, ceea ce poate însemna și o piață mai puțin aglomerată.`,
        )}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-3">
        <MarketStat
          label={t("Local matches", "Firme similare din zonă")}
          value={String(competitors.length)}
        />
        <MarketStat
          label={t("Your website score", "Scorul site-ului tău")}
          value={yourScore !== undefined ? String(yourScore) : "—"}
        />
        <MarketStat
          label={t("Their average", "Media lor")}
          value={average !== undefined ? String(average) : "—"}
          note={
            average !== undefined
              ? t(
                  `from ${scored.length} audited sites`,
                  `din ${scored.length} ${roNeedsDe(scored.length) ? "de " : ""}site-uri analizate`,
                )
              : t("no sites audited", "niciun site analizat")
          }
        />
      </div>

      <div>
        <SectionTitle>
          {t("Website score, side by side", "Scorul site-ului, față în față")}
        </SectionTitle>
        <ol className="space-y-2.5">
          <li className={cn(TILE, "border-[#6c63ff]/35 bg-[#6c63ff]/[0.08] p-4")}>
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <span className="type-body-sm font-medium text-white">
                {company?.displayName ?? audit?.host ?? t("Your business", "Afacerea ta")}
              </span>
              <Tag tone="violet">{t("You", "Tu")}</Tag>
            </div>
            {yourScore !== undefined ? (
              <MetricBar
                label={t("Website score", "Scorul site-ului")}
                value={yourScore}
                highlight
              />
            ) : (
              <p className="type-body-sm text-white/50">
                {t("No website analysed", "Niciun site analizat")}
              </p>
            )}
          </li>
          {sorted.map((competitor, i) => {
            const host = displayHost(competitor.website);
            return (
              <motion.li
                key={competitor.cui}
                initial={{ opacity: 0, x: -10 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: 0.06 * i, ease: EASE_OUT }}
                className={cn(TILE, "p-4")}
              >
                <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="type-body-sm font-medium text-white">{competitor.name}</span>
                  {competitor.city && (
                    <span className="type-micro inline-flex items-center gap-1 text-white/45">
                      <MapPin aria-hidden className="h-3 w-3" />
                      {softenCaps(competitor.city)}
                    </span>
                  )}
                  {host && competitor.website && (
                    <a
                      href={
                        /^https?:\/\//i.test(competitor.website)
                          ? competitor.website
                          : `https://${competitor.website}`
                      }
                      target="_blank"
                      rel="noopener noreferrer nofollow"
                      className="type-micro inline-flex items-center gap-1 text-[#bfe3fb] underline-offset-4 hover:underline"
                    >
                      {host}
                      <ArrowUpRight aria-hidden className="h-3 w-3" />
                    </a>
                  )}
                </div>
                {typeof competitor.websiteScore === "number" ? (
                  <MetricBar
                    label={t("Website score", "Scorul site-ului")}
                    value={competitor.websiteScore}
                    delay={0.06 * i}
                  />
                ) : (
                  <p className="type-micro text-white/45">
                    {competitor.website
                      ? t("Website not audited", "Site neanalizat")
                      : t("No website found", "Nu am găsit un site")}
                  </p>
                )}
              </motion.li>
            );
          })}
        </ol>
      </div>

      <p className="type-micro flex items-start gap-2 text-white/45">
        <Telescope aria-hidden className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        {t(
          `Matched by name and city in the Trade Register (businesses like a ${typeLabel.toLowerCase()}${city ? ` in ${city}` : ""}). Scores come from the same checks we ran on your site; they are not a ranking of the businesses themselves.`,
          `Găsite după nume și oraș în Registrul Comerțului (afaceri de tipul „${typeLabel.toLowerCase()}”${city ? ` din ${city}` : ""}). Scorurile vin din aceleași verificări pe care le-am rulat pe site-ul tău și nu sunt un clasament al afacerilor.`,
        )}
      </p>
    </div>
  );
}

function MarketStat({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className={cn(TILE, "px-4 py-3")}>
      <p className="type-micro text-white/55">{label}</p>
      <p className="type-h3 mt-1 tabular-nums text-white">{value}</p>
      {note && <p className="type-micro text-white/40">{note}</p>}
    </div>
  );
}

/* --------------------------------------------------------- journey tab */

const JOURNEY_ICONS = {
  discover: <Telescope />,
  consider: <Star />,
  contact: <MessageCircle />,
  book: <CalendarCheck />,
  return: <Route />,
} as const;

function useJourneyStatus() {
  const { t } = useI18n();
  return (status: JourneyStatus) =>
    ({
      strong: {
        label: t("Strong", "Solid"),
        icon: CircleCheck,
        text: "text-[#5fe3d0]",
        node: "border-[#5fe3d0]/60 bg-[#5fe3d0]/15 text-[#5fe3d0] shadow-[0_0_18px_rgb(95_227_208/0.35)]",
      },
      weak: {
        label: t("Needs work", "De îmbunătățit"),
        icon: CircleDashed,
        text: "text-[#89cbf6]",
        node: "border-[#89cbf6]/50 bg-[#89cbf6]/10 text-[#89cbf6]",
      },
      missing: {
        label: t("Missing", "Lipsește"),
        icon: CircleMinus,
        text: "text-[#b3acff]",
        node: "border-dashed border-[#b3acff]/50 bg-transparent text-[#b3acff]",
      },
    })[status];
}

function JourneyPanel({
  audit,
  presence,
  company,
}: {
  audit?: WebsiteAudit;
  presence?: OnlinePresence;
  company?: CompanyProfile;
}) {
  const { t, lang } = useI18n();
  const statusOf = useJourneyStatus();
  const stages = useMemo(
    () => deriveJourney({ audit, presence, company }),
    [audit, presence, company],
  );
  const strong = stages.filter((stage) => stage.status === "strong").length;

  return (
    <div className="space-y-6">
      <p className="type-body-sm text-white/60">
        {t(
          `How a new customer moves from finding you to coming back: ${strong} of 5 stages are strong today.`,
          `Drumul unui client nou, de la prima căutare până revine: ${strong} din 5 etape sunt solide azi.`,
        )}
      </p>

      {/* Summary rail; the list below carries the same information as text. */}
      <div aria-hidden className="relative px-2">
        <div className="absolute left-[10%] right-[10%] top-5 h-px bg-gradient-to-r from-[#6c63ff]/60 via-[#5b8cf0]/50 to-[#89cbf6]/40" />
        <motion.ol
          variants={staggerParent}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true }}
          className="relative grid grid-cols-5 gap-1"
        >
          {stages.map((stage) => {
            const status = statusOf(stage.status);
            return (
              <motion.li
                key={stage.id}
                variants={riseIn}
                className="flex flex-col items-center text-center"
              >
                <span
                  className={cn(
                    "grid h-10 w-10 place-items-center rounded-full border-2 bg-[#070a1f] [&_svg]:h-4 [&_svg]:w-4",
                    status.node,
                  )}
                >
                  {JOURNEY_ICONS[stage.id]}
                </span>
                {/* A no-break space keeps "Programare /" together on narrow rails. */}
                <span className="type-micro mt-2 text-white/75">
                  {pick(stage.label, lang).replace(" / ", "\u00a0/ ")}
                </span>
              </motion.li>
            );
          })}
        </motion.ol>
      </div>

      <motion.ol
        variants={staggerParent}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, margin: "0px 0px -40px 0px" }}
        className="space-y-2.5"
      >
        {stages.map((stage, i) => {
          const status = statusOf(stage.status);
          const StatusIcon = status.icon;
          return (
            <motion.li key={stage.id} variants={riseIn} className={cn(TILE, "p-4")}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="type-label text-white/40">
                    {String(i + 1).padStart(2, "0")} · {pick(stage.question, lang)}
                  </p>
                  <h4 className="type-h3 mt-1 text-white">{pick(stage.label, lang)}</h4>
                </div>
                <span
                  className={cn(
                    "type-micro inline-flex items-center gap-1.5 font-medium",
                    status.text,
                  )}
                >
                  <StatusIcon aria-hidden className="h-4 w-4" />
                  {status.label}
                </span>
              </div>
              {stage.found.length > 0 && (
                <ul className="type-body-sm mt-2 space-y-1 text-white/60">
                  {stage.found.map((line) => (
                    <li key={line.en} className="flex gap-2">
                      <span
                        aria-hidden
                        className="mt-2 h-1 w-1 shrink-0 rounded-full bg-white/35"
                      />
                      {pick(line, lang)}
                    </li>
                  ))}
                </ul>
              )}
              {stage.fix && (
                <p className="type-body-sm mt-3 flex gap-2 rounded-xl border border-[#5b8cf0]/25 bg-[#5b8cf0]/[0.07] px-3 py-2 text-white/85">
                  <Wrench aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-[#89cbf6]" />
                  <span>
                    <span className="sr-only">{t("Fix: ", "Soluție: ")}</span>
                    {pick(stage.fix, lang)}
                  </span>
                </p>
              )}
            </motion.li>
          );
        })}
      </motion.ol>
    </div>
  );
}
