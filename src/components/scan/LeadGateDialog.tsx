import { useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from "react";
import { Download } from "lucide-react";

import { useI18n } from "@/i18n";
import { saveScanLead, type ScanLeadResult } from "@/lib/scan.functions";
import { LEAD_NOTICE, LEAD_NOTICE_VERSION, LEAD_PRIVACY_URL } from "@/lib/scan/legal/lead-notice";
import type { Blueprint, Lang } from "@/lib/scan/types";
import { PDF_GENERATING_VIDEO } from "@/components/landing/media";
import { TurnstileField, type TurnstileHandle } from "@/components/forms/TurnstileField";
import { defaultPdfLang } from "@/components/scan/pdf/language";
import { Button, CheckboxField, Field, keepHyphens, SegmentedControl } from "@/components/system";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Drawer, DrawerContent, DrawerDescription, DrawerTitle } from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import { useScanMotion } from "./report/motion";

type Phase = "form" | "saving" | "generating" | "done" | "error";

/** Why the details were not kept (the PDF is delivered either way). */
type LeadIssue = Exclude<ScanLeadResult, { ok: true }>["reason"];

/** The brand animation stays on screen at least this long, so it reads as a moment, not a flash. */
const MIN_GENERATING_MS = 1200;

const LANG_NAME: Record<Lang, string> = { ro: "Română", en: "English" };

/**
 * Soft edge plus `screen` blend on the media itself, so the video's black
 * background drops out on the dialog surface without a frame.
 */
const BLENDED_MEDIA =
  "h-full w-full object-contain mix-blend-screen [mask-image:radial-gradient(closest-side,#000_62%,transparent)]";

/**
 * The owner's "assemble" animation (ribbon variant) while the PDF is built,
 * 160 px wide in the dialog body. Reduced motion or the page-wide pause shows
 * the final frame instead.
 */
function GeneratingArt({ still }: { still: boolean }) {
  return (
    <div aria-hidden className="aspect-video w-40 shrink-0">
      {still ? (
        <img src={PDF_GENERATING_VIDEO.poster} alt="" className={BLENDED_MEDIA} />
      ) : (
        <video
          autoPlay
          muted
          playsInline
          preload="auto"
          poster={PDF_GENERATING_VIDEO.poster}
          className={BLENDED_MEDIA}
        >
          <source src={PDF_GENERATING_VIDEO.webm} type="video/webm" />
          <source src={PDF_GENERATING_VIDEO.mp4} type="video/mp4" />
        </video>
      )}
    </div>
  );
}

/** Phones (< 640 px) get the dialog as a bottom sheet. */
function useSheet() {
  const [sheet, setSheet] = useState(false);
  useEffect(() => {
    const query = window.matchMedia("(max-width: 639px)");
    const update = () => setSheet(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  return sheet;
}

/**
 * The blueprint PDF behind a short form: name and email go to `audit_leads`
 * with a record of the information notice shown (lib/scan/legal) and the
 * optional marketing choice, then the PDF is designed in the browser, in the
 * language the visitor picks (Romanian by default for Romanian sites), and
 * downloaded. Marketing consent is never a condition of the download. If
 * saving the lead fails (e.g. local dev without the service key, too many
 * requests, a failed anti-spam check) the download still happens, with a quiet
 * note that says why. When Turnstile is on and Cloudflare asks for a click, the
 * form waits for it.
 */
export function LeadGateDialog({
  blueprint,
  open,
  onOpenChange,
}: {
  blueprint: Blueprint;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t, lang } = useI18n();
  const { still } = useScanMotion();
  const sheet = useSheet();
  const notice = LEAD_NOTICE[lang];
  const formId = useId();
  const [phase, setPhase] = useState<Phase>("form");
  const [leadIssue, setLeadIssue] = useState<LeadIssue | null>(null);
  const leadSaved = leadIssue === null;
  const [error, setError] = useState<string | null>(null);
  const [checkError, setCheckError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const turnstile = useRef<TurnstileHandle>(null);
  const [marketing, setMarketing] = useState(false);
  // The visitor's own pick; until they make one, the PDF follows the site's language.
  const [picked, setPicked] = useState<Lang | null>(null);
  const [lastLang, setLastLang] = useState<Lang>("en");
  const suggested = defaultPdfLang(blueprint, lang);
  const pdfLang = picked ?? suggested.lang;
  const emailRef = useRef<HTMLInputElement>(null);
  const primaryRef = useRef<HTMLButtonElement>(null);

  // The focused submit button goes away when the form turns into the result: put focus
  // on the result's main action ("Gata" / "Încearcă din nou"), not on the dialog itself.
  useEffect(() => {
    if (phase === "done" || phase === "error") primaryRef.current?.focus();
  }, [phase]);

  // A new blueprint (edited scan) asks again, with a fresh default language.
  useEffect(() => {
    setPhase("form");
    setError(null);
    setCheckError(null);
    setPicked(null);
  }, [blueprint.id]);

  const generate = async (target: Lang = pdfLang) => {
    setLastLang(target);
    setPhase("generating");
    const started = Date.now();
    try {
      // Browser-only; the SSR guard keeps the PDF renderer out of the Worker bundle.
      if (!import.meta.env.SSR) {
        const { downloadBlueprintPdf } = await import("@/components/scan/pdf/download");
        await downloadBlueprintPdf(blueprint, target);
      }
      const rest = MIN_GENERATING_MS - (Date.now() - started);
      if (rest > 0) await new Promise((resolve) => window.setTimeout(resolve, rest));
      setPhase("done");
    } catch (err) {
      console.error("[scan] PDF generation failed", err);
      setPhase("error");
    }
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const fullName = String(form.get("fullName") ?? "").trim();
    const email = String(form.get("email") ?? "").trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      // Back to the field, which now reads its fix-it line.
      (event.currentTarget.elements.namedItem("email") as HTMLInputElement | null)?.focus();
      setError(
        t(
          "Enter the full address, for example name@company.com.",
          "Scrie adresa completă, de exemplu nume@firma.ro.",
        ),
      );
      return;
    }
    const marketingConsent = marketing;
    setError(null);
    setCheckError(null);

    // Turnstile, when it is on. The form stays up while it answers (the box lives in it).
    // Only a click it is waiting for stops the download; a check that cannot load lets it
    // go on, and the server then keeps no details.
    setChecking(true);
    const check = (await turnstile.current?.check()) ?? { needed: false as const };
    setChecking(false);
    if (check.needed && check.token === null && check.problem === "interaction") {
      setCheckError(
        t(
          "Tick the check box above, then download again.",
          "Bifează caseta de verificare de mai sus, apoi descarcă din nou.",
        ),
      );
      return;
    }
    setPhase("saving");

    const cui = blueprint.company?.cui;
    const website = blueprint.audit?.finalUrl ?? blueprint.company?.website ?? blueprint.target.url;
    let issue: LeadIssue | null = null;
    try {
      const result = await saveScanLead({
        data: {
          email,
          fullName: fullName ? fullName.slice(0, 120) : undefined,
          company: blueprint.company?.displayName?.slice(0, 200),
          noticeVersion: LEAD_NOTICE_VERSION,
          marketingConsent,
          lang,
          blueprintId: blueprint.id.slice(0, 80),
          summary: {
            businessType: blueprint.businessType.label.en.slice(0, 120),
            digitalMaturity: Math.max(0, Math.min(100, blueprint.scores.digitalMaturity)),
            monthlySavingsRon: blueprint.totals.monthlySavingsRon,
            recommendedPlan: blueprint.offer.planId,
            website: website ? website.slice(0, 2048) : undefined,
            cui: cui && /^\d{2,10}$/.test(cui) ? cui : undefined,
          },
          turnstileToken: check.needed && check.token ? check.token : undefined,
        },
      });
      if (!result.ok) {
        console.warn(`[scan] lead not saved (${result.reason}); continuing with the download`);
        issue = result.reason;
      }
    } catch (err) {
      console.warn("[scan] lead not saved; continuing with the download", err);
      issue = "unavailable";
    }
    setLeadIssue(issue);
    await generate(pdfLang);
  };

  const busy = phase === "saving" || phase === "generating";
  const otherLang: Lang = lastLang === "ro" ? "en" : "ro";
  const Title = sheet ? DrawerTitle : DialogTitle;
  const Description = sheet ? DrawerDescription : DialogDescription;
  const close = () => onOpenChange(false);

  let title: string;
  let description: string;
  let body: ReactNode = null;
  let footer: ReactNode;

  if (phase === "done") {
    title = t("The report is downloading", "Raportul se descarcă");
    description = t(
      `The ${lastLang === "ro" ? "Romanian" : "English"} edition is in your downloads folder. Share it with your team, then book a call when you're ready.`,
      `Varianta în ${lastLang === "ro" ? "română" : "engleză"} e în folderul de descărcări. Arat-o echipei și programează o discuție când ești gata.`,
    );
    body = (
      <div className="flex flex-col items-start gap-3">
        {leadIssue ? (
          <p className="text-[0.8125rem] leading-[1.45] text-fg-3">
            {leadIssue === "rate_limited"
              ? t(
                  "Too many requests in the last few minutes, so this time we didn't save your details and won't follow up. The PDF is yours either way.",
                  "Prea multe cereri în ultimele minute, așa că de data aceasta nu am salvat datele și nu te vom contacta. PDF-ul rămâne al tău.",
                )
              : leadIssue === "verification"
                ? t(
                    "The anti-spam check didn't go through, so we didn't save your details and won't follow up. The PDF is yours either way.",
                    "Verificarea anti-spam nu a trecut, așa că nu am salvat datele și nu te vom contacta. PDF-ul rămâne al tău.",
                  )
                : t(
                    "We couldn't save your details just now, so we won't follow up. The PDF is yours either way.",
                    "Nu am putut salva datele acum, așa că nu te vom contacta. PDF-ul rămâne al tău.",
                  )}
          </p>
        ) : null}
        <Button
          variant="link"
          size="sm"
          className="text-fg-2"
          onClick={() => {
            setPicked(otherLang);
            void generate(otherLang);
          }}
        >
          {otherLang === "ro"
            ? t("Also get it in Romanian", "Descarcă și varianta în română")
            : t("Also get it in English", "Descarcă și varianta în engleză")}
        </Button>
      </div>
    );
    footer = (
      <>
        <Button
          variant="secondary"
          className="w-full sm:w-auto"
          icon={<Download aria-hidden />}
          onClick={() => generate(lastLang)}
        >
          {t("Download again", "Descarcă din nou")}
        </Button>
        <Button ref={primaryRef} className="w-full sm:w-auto" onClick={close}>
          {t("Done", "Gata")}
        </Button>
      </>
    );
  } else if (phase === "error") {
    title = t("We couldn't create the PDF", "Nu am putut crea PDF-ul");
    description = leadSaved
      ? t(
          "Something went wrong while creating it. Try again; your details are already saved.",
          "Ceva nu a mers la generare. Încearcă din nou, datele tale sunt deja salvate.",
        )
      : t(
          "Something went wrong while creating it. Please try again.",
          "Ceva nu a mers la generare. Te rugăm să încerci din nou.",
        );
    footer = (
      <>
        <Button variant="ghost" className="w-full sm:w-auto" onClick={close}>
          {t("Close", "Închide")}
        </Button>
        <Button ref={primaryRef} className="w-full sm:w-auto" onClick={() => generate(lastLang)}>
          {t("Try again", "Încearcă din nou")}
        </Button>
      </>
    );
  } else {
    title = t("The full report, as a PDF", "Raportul complet, în PDF");
    description = t(
      "The analysis, the three directions, the 6-month plan and the estimated impact, in one file.",
      "Analiza, cele trei direcții, planul pe 6 luni și impactul estimat, într-un singur fișier.",
    );
    body = busy ? (
      <div role="status" aria-live="polite" className="flex items-center gap-4">
        <GeneratingArt still={still} />
        <p className="text-sm leading-[1.5] text-fg-2">
          {phase === "saving"
            ? t("Saving your details…", "Salvăm datele…")
            : lastLang === "ro"
              ? t(
                  "Designing the PDF in Romanian. It takes a few seconds, right here in your browser.",
                  "Pregătim PDF-ul în română. Durează câteva secunde și se creează direct în browserul tău.",
                )
              : t(
                  "Designing the PDF in English. It takes a few seconds, right here in your browser.",
                  "Pregătim PDF-ul în engleză. Durează câteva secunde și se creează direct în browserul tău.",
                )}
        </p>
      </div>
    ) : (
      <form id={formId} onSubmit={submit} noValidate className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-4">
          <p
            id={`${formId}-lang`}
            className="text-[0.8125rem] font-medium leading-[1.35] text-fg-2"
          >
            {t("Report language", "Limba raportului")}
          </p>
          <SegmentedControl<Lang>
            value={pdfLang}
            onChange={setPicked}
            label={t("Report language", "Limba raportului")}
            options={[
              { value: "ro", label: LANG_NAME.ro },
              { value: "en", label: LANG_NAME.en },
            ]}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2 sm:gap-3">
          <Field label={t("Name", "Nume")} optional>
            <Input
              name="fullName"
              autoComplete="name"
              maxLength={120}
              placeholder="Ana Popescu"
              className="h-10"
            />
          </Field>
          <Field label={t("Email", "E-mail")} error={error}>
            <Input
              ref={emailRef}
              name="email"
              type="email"
              required
              autoComplete="email"
              inputMode="email"
              maxLength={200}
              placeholder={t("name@company.com", "nume@firma.ro")}
              className="h-10"
            />
          </Field>
        </div>
        {/* The information notice: always shown, nothing to tick. Same text as the
            stored consent record (lib/scan/legal/lead-notice). */}
        <p id={`${formId}-notice`} className="text-xs leading-[1.45] text-fg-3">
          {/* Hyphenated words ("e-mail", "PDF-ul") never break; the stored text is unchanged. */}
          {keepHyphens(notice.notice)} {keepHyphens(notice.moreBefore)}{" "}
          <a
            href={LEAD_PRIVACY_URL}
            target="_blank"
            rel="noopener"
            className="text-fg-2 underline decoration-fg/30 underline-offset-2 hover:decoration-fg"
          >
            {notice.moreLink}
          </a>
          .
        </p>
        {/* Optional and unticked: the download never depends on it. */}
        <CheckboxField
          name="marketing"
          checked={marketing}
          onCheckedChange={(value) => setMarketing(value === true)}
          label={keepHyphens(notice.marketing)}
        />
        {/* Nothing here unless Turnstile is on (TURNSTILE_SITE_KEY); usually invisible even then. */}
        <TurnstileField ref={turnstile} action="lead" />
        {checkError ? (
          <p role="alert" className="text-[0.8125rem] leading-[1.45] text-bad">
            {checkError}
          </p>
        ) : null}
      </form>
    );
    footer = (
      <>
        <Button variant="ghost" className="w-full sm:w-auto" onClick={close}>
          {t("Cancel", "Anulează")}
        </Button>
        <Button
          type="submit"
          form={formId}
          loading={busy || checking}
          disabled={busy || checking}
          aria-describedby={busy ? undefined : `${formId}-notice`}
          icon={<Download aria-hidden />}
          className="w-full sm:w-auto"
        >
          {busy
            ? t("Generating…", "Se generează…")
            : pdfLang === "en"
              ? "Download the PDF"
              : "Descarcă PDF-ul"}
        </Button>
      </>
    );
  }

  // On the form the description stays for screen readers only: the title says what the
  // file is, and the dialog keeps to its height target with the notice in full.
  const quietDescription = phase === "form" || busy;
  const content = (
    <>
      <div className="px-4 pt-4 pr-12 sm:px-5 sm:pt-5 sm:pr-12">
        <Title className="text-lg">{keepHyphens(title)}</Title>
        <Description className={quietDescription ? "sr-only" : "mt-1.5 max-w-[48ch]"}>
          {keepHyphens(description)}
        </Description>
      </div>
      {body ? <div className="px-4 pt-4 pb-5 sm:px-5">{body}</div> : <div className="h-5" />}
      <div className="flex flex-col-reverse gap-2 border-t border-line-1 px-4 py-3 sm:flex-row sm:justify-end sm:px-5">
        {footer}
      </div>
    </>
  );

  if (sheet) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange} shouldScaleBackground={false}>
        <DrawerContent className="cinematic max-h-[92dvh]">
          <div className="overflow-y-auto">{content}</div>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        closeLabel={t("Close", "Închide")}
        className="cinematic block gap-0 p-0 sm:max-w-[440px]"
        // Straight to the one required field (the language already has a default).
        onOpenAutoFocus={(event) => {
          if (!emailRef.current) return;
          event.preventDefault();
          emailRef.current.focus();
        }}
      >
        {content}
      </DialogContent>
    </Dialog>
  );
}
