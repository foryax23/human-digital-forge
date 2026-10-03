import { useEffect, useId, useState, type FormEvent } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowRight, Download, FileText, Languages, RotateCcw } from "lucide-react";

import { useI18n } from "@/i18n";
import { saveScanLead } from "@/lib/scan.functions";
import type { Blueprint, Lang } from "@/lib/scan/types";
import { PDF_GENERATING_VIDEO } from "@/components/landing/media";
import { defaultPdfLang } from "@/components/scan/pdf/language";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { scanButton } from "./report/buttons";
import { EASE_OUT, useScanMotion } from "./report/motion";
import { SegmentedControl } from "./report/SegmentedControl";

type Phase = "form" | "saving" | "generating" | "done" | "error";

const FIELD =
  "type-body mt-1.5 h-11 w-full rounded-xl border border-white/12 bg-[#04061a]/80 px-3.5 text-white outline-none transition-colors placeholder:text-white/35 focus:border-[#89cbf6]/60 focus:ring-2 focus:ring-[#89cbf6]/25";

/** The brand animation stays on screen at least this long, so it reads as a moment, not a flash. */
const MIN_GENERATING_MS = 1200;

const LANG_NAME: Record<Lang, string> = { ro: "Română", en: "English" };

/**
 * Soft edge plus `screen` blend on the media itself. A mask, an opacity
 * below 1 or a transform on any wrapper isolates the media, and the video's
 * black background would show as a patch, so the media fades on its own.
 */
const BLENDED_MEDIA =
  "h-full w-full object-contain mix-blend-screen [mask-image:radial-gradient(closest-side,#000_62%,transparent)]";

/**
 * The owner's "assemble" animation (ribbon variant) while the PDF is built,
 * blended into the dialog: its black background drops out with `screen`.
 * Reduced motion or the page-wide pause shows the final frame instead.
 */
function GeneratingArt({ still }: { still: boolean }) {
  const fade = {
    initial: { opacity: 0, scale: still ? 1 : 0.96 },
    animate: { opacity: 1, scale: 1 },
    exit: { opacity: 0 },
    transition: { duration: still ? 0.15 : 0.3, ease: EASE_OUT },
  };
  return (
    <div aria-hidden className="relative mx-auto aspect-video w-56 max-w-full sm:w-64">
      {still ? (
        <motion.img {...fade} src={PDF_GENERATING_VIDEO.poster} alt="" className={BLENDED_MEDIA} />
      ) : (
        <motion.video
          {...fade}
          autoPlay
          muted
          playsInline
          preload="auto"
          poster={PDF_GENERATING_VIDEO.poster}
          className={BLENDED_MEDIA}
        >
          <source src={PDF_GENERATING_VIDEO.webm} type="video/webm" />
          <source src={PDF_GENERATING_VIDEO.mp4} type="video/mp4" />
        </motion.video>
      )}
    </div>
  );
}

/**
 * The blueprint PDF behind a short form: name, email and explicit consent go
 * to `audit_leads`, then the PDF is designed in the browser, in the language
 * the visitor picks (Romanian by default for Romanian sites), and downloaded.
 * If saving the lead fails (e.g. local dev without the service key) the
 * download still happens, with a quiet note.
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
  const formId = useId();
  const [phase, setPhase] = useState<Phase>("form");
  const [leadSaved, setLeadSaved] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // The visitor's own pick; until they make one, the PDF follows the site's language.
  const [picked, setPicked] = useState<Lang | null>(null);
  const [lastLang, setLastLang] = useState<Lang>("en");
  const suggested = defaultPdfLang(blueprint, lang);
  const pdfLang = picked ?? suggested.lang;

  // A new blueprint (edited scan) asks again, with a fresh default language.
  useEffect(() => {
    setPhase("form");
    setError(null);
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
      setError(
        t("Please enter a valid email address.", "Te rugăm să introduci o adresă de email validă."),
      );
      return;
    }
    if (form.get("consent") !== "on") {
      setError(
        t(
          "Please confirm you agree, so we can send and store your blueprint.",
          "Te rugăm să confirmi acordul, ca să putem trimite și păstra planul.",
        ),
      );
      return;
    }
    setError(null);
    setPhase("saving");

    const cui = blueprint.company?.cui;
    const website = blueprint.audit?.finalUrl ?? blueprint.company?.website ?? blueprint.target.url;
    let saved = true;
    try {
      await saveScanLead({
        data: {
          email,
          fullName: fullName ? fullName.slice(0, 120) : undefined,
          company: blueprint.company?.displayName?.slice(0, 200),
          consent: true,
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
        },
      });
    } catch (err) {
      console.warn("[scan] lead not saved; continuing with the download", err);
      saved = false;
    }
    setLeadSaved(saved);
    await generate(pdfLang);
  };

  const busy = phase === "saving" || phase === "generating";
  const otherLang: Lang = lastLang === "ro" ? "en" : "ro";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        closeLabel={t("Close", "Închide")}
        className="cinematic max-w-[calc(100vw-2rem)] overflow-hidden rounded-3xl border-white/10 bg-[#070a1f]/95 p-0 text-white backdrop-blur-xl sm:max-w-md sm:rounded-3xl"
      >
        {/* Top glow strip in the brand gradient. */}
        <span
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#89cbf6]/80 to-transparent"
        />
        <span
          aria-hidden
          className="pointer-events-none absolute -top-20 left-1/2 h-40 w-64 -translate-x-1/2 rounded-full bg-[#6c63ff]/25 blur-3xl"
        />

        <div className="relative p-6 sm:p-7">
          <AnimatePresence mode="wait" initial={false}>
            {phase === "form" && (
              <motion.div
                key="form"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.25, ease: EASE_OUT }}
              >
                <DialogHeader className="text-left">
                  <span
                    aria-hidden
                    className="mb-3 grid h-11 w-11 place-items-center rounded-2xl border border-white/10 bg-gradient-to-br from-[#6c63ff]/40 to-[#5b8cf0]/15 text-white"
                  >
                    <FileText className="h-5 w-5" />
                  </span>
                  {/* Roles on inner spans: the dialog primitives' own sizes would win. */}
                  <DialogTitle className="text-white">
                    <span className="type-h3 block">
                      {t("Download your blueprint", "Descarcă planul digital")}
                    </span>
                  </DialogTitle>
                  <DialogDescription className="text-white/60">
                    <span className="type-body-sm">
                      {t(
                        "A designed PDF with your scan, strategies, roadmap and estimated impact. Tell us where to find you if you have questions later.",
                        "Un PDF cu analiza, direcțiile strategice, planul de implementare și impactul estimat. Lasă-ne datele de contact, ca să te putem ajuta dacă ai întrebări.",
                      )}
                    </span>
                  </DialogDescription>
                </DialogHeader>

                <form id={formId} onSubmit={submit} noValidate className="mt-5 space-y-4">
                  <div>
                    <p
                      id={`${formId}-lang`}
                      className="type-body-sm flex items-center gap-1.5 text-white/75"
                    >
                      <Languages aria-hidden className="h-4 w-4 text-[#89cbf6]" />
                      {t("PDF language", "Limba PDF-ului")}
                    </p>
                    <SegmentedControl<Lang>
                      value={pdfLang}
                      onChange={setPicked}
                      label={t("PDF language", "Limba PDF-ului")}
                      size="sm"
                      className="mt-2"
                      options={[
                        { value: "ro", label: LANG_NAME.ro },
                        { value: "en", label: LANG_NAME.en },
                      ]}
                    />
                    {suggested.fromSite && !picked ? (
                      <p className="type-micro mt-1.5 text-white/45">
                        {blueprint.company
                          ? t(
                              "Romanian, because the business and its website are Romanian.",
                              "Română, pentru că firma și site-ul sunt din România.",
                            )
                          : t(
                              "Romanian, because the website is in Romanian.",
                              "Română, pentru că site-ul este în limba română.",
                            )}
                      </p>
                    ) : null}
                  </div>
                  <label className="type-body-sm block text-white/75">
                    {t("Name", "Nume")}{" "}
                    <span className="text-white/40">{t("(optional)", "(opțional)")}</span>
                    <input name="fullName" autoComplete="name" maxLength={120} className={FIELD} />
                  </label>
                  <label className="type-body-sm block text-white/75">
                    {t("Email", "Email")}
                    <input
                      name="email"
                      type="email"
                      required
                      autoComplete="email"
                      inputMode="email"
                      maxLength={200}
                      aria-invalid={error ? true : undefined}
                      aria-describedby={error ? `${formId}-error` : undefined}
                      className={FIELD}
                    />
                  </label>
                  <label className="type-body-sm flex items-start gap-3 text-white/70">
                    <input
                      name="consent"
                      type="checkbox"
                      required
                      className="mt-1 h-4 w-4 shrink-0 cursor-pointer rounded border-white/30 accent-[#6c63ff]"
                    />
                    <span>
                      {t(
                        "I agree that Vortex Hub keeps my name, email and this scan summary to send the blueprint and follow up about it. ",
                        "Sunt de acord ca Vortex Hub să păstreze numele, emailul și rezumatul scanării, ca să îmi trimită planul și să revină cu detalii despre el. ",
                      )}
                      <a
                        href="/privacy"
                        target="_blank"
                        rel="noopener"
                        className="text-[#bfe3fb] underline underline-offset-4 hover:text-white"
                      >
                        {t("Privacy policy", "Politica de confidențialitate")}
                      </a>
                    </span>
                  </label>
                  {error && (
                    <p id={`${formId}-error`} role="alert" className="type-body-sm text-[#b3acff]">
                      {error}
                    </p>
                  )}
                  <button type="submit" className={scanButton("primary", "lg", "w-full")}>
                    <Download aria-hidden />
                    {pdfLang === "ro"
                      ? t("Get the PDF in Romanian", "Descarcă PDF-ul în română")
                      : t("Get the PDF in English", "Descarcă PDF-ul în engleză")}
                  </button>
                </form>
              </motion.div>
            )}

            {busy && (
              // No fade or scale on this wrapper (it would isolate the blended
              // art); the art and the text animate on their own, and
              // AnimatePresence still waits for their exits.
              <motion.div
                key="busy"
                role="status"
                aria-live="polite"
                className="flex flex-col items-center py-4 text-center"
              >
                <DialogTitle className="sr-only">
                  {t("Preparing your blueprint", "Pregătim planul")}
                </DialogTitle>
                <GeneratingArt still={still} />
                <motion.div
                  initial={{ opacity: 0, y: still ? 0 : 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.25, ease: EASE_OUT }}
                  className="flex flex-col items-center"
                >
                  <p className="type-h3 mt-3 text-white">
                    {phase === "saving"
                      ? t("Saving your details…", "Salvăm datele…")
                      : lastLang === "ro"
                        ? t("Designing your blueprint in Romanian…", "Pregătim PDF-ul în română…")
                        : t("Designing your blueprint…", "Pregătim PDF-ul în engleză…")}
                  </p>
                  <p className="type-body-sm mt-1.5 max-w-xs text-white/55">
                    {t(
                      "This takes a few seconds. The PDF is built right here in your browser.",
                      "Durează câteva secunde. PDF-ul se creează direct în browserul tău.",
                    )}
                  </p>
                </motion.div>
              </motion.div>
            )}

            {phase === "done" && (
              <motion.div
                key="done"
                role="status"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3, ease: EASE_OUT }}
                className="flex flex-col items-center py-4 text-center"
              >
                <svg aria-hidden viewBox="0 0 64 64" className="h-20 w-20">
                  <motion.circle
                    cx="32"
                    cy="32"
                    r="28"
                    fill="rgb(95 227 208 / 0.08)"
                    stroke="#5fe3d0"
                    strokeWidth="2.5"
                    initial={{ pathLength: still ? 1 : 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{ duration: still ? 0 : 0.6, ease: EASE_OUT }}
                  />
                  <motion.path
                    d="M20 33 L28.5 41 L44 24"
                    fill="none"
                    stroke="#5fe3d0"
                    strokeWidth="3.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    initial={{ pathLength: still ? 1 : 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{
                      duration: still ? 0 : 0.45,
                      delay: still ? 0 : 0.45,
                      ease: EASE_OUT,
                    }}
                  />
                </svg>
                <DialogTitle className="mt-4 text-white">
                  <span className="type-h3 block">
                    {t("Your blueprint is downloading", "Planul tău se descarcă")}
                  </span>
                </DialogTitle>
                <DialogDescription className="mt-1.5 max-w-xs text-white/60">
                  <span className="type-body-sm">
                    {t(
                      `The ${lastLang === "ro" ? "Romanian" : "English"} edition is in your downloads folder. Share it with your team, then book a call when you're ready.`,
                      `Varianta în ${lastLang === "ro" ? "română" : "engleză"} e în folderul de descărcări. Arată-o echipei și programează o discuție când ești gata.`,
                    )}
                  </span>
                </DialogDescription>
                {!leadSaved && (
                  <p className="type-micro mt-3 max-w-xs text-white/45">
                    {t(
                      "We couldn't save your details just now, so we won't follow up. The PDF is yours either way.",
                      "Nu am putut salva datele acum, așa că nu te vom contacta. PDF-ul rămâne al tău.",
                    )}
                  </p>
                )}
                <div className="mt-6 flex w-full flex-col gap-2 sm:flex-row">
                  <button
                    type="button"
                    onClick={() => generate(lastLang)}
                    className={scanButton("secondary", "md", "sm:flex-1")}
                  >
                    <Download aria-hidden />
                    {t("Download again", "Descarcă din nou")}
                  </button>
                  <button
                    type="button"
                    onClick={() => onOpenChange(false)}
                    className={scanButton("primary", "md", "sm:flex-1")}
                  >
                    {t("Done", "Gata")}
                    <ArrowRight aria-hidden />
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setPicked(otherLang);
                    void generate(otherLang);
                  }}
                  className={scanButton("ghost", "sm", "mt-2")}
                >
                  <Languages aria-hidden />
                  {otherLang === "ro"
                    ? t("Also get it in Romanian", "Descarcă și varianta în română")
                    : t("Also get it in English", "Descarcă și varianta în engleză")}
                </button>
              </motion.div>
            )}

            {phase === "error" && (
              <motion.div
                key="error"
                role="alert"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col items-center py-4 text-center"
              >
                <DialogTitle className="text-white">
                  <span className="type-h3 block">
                    {t("We couldn't create the PDF", "Nu am putut crea PDF-ul")}
                  </span>
                </DialogTitle>
                <DialogDescription className="mt-1.5 max-w-xs text-white/60">
                  <span className="type-body-sm">
                    {leadSaved
                      ? t(
                          "Something went wrong while creating it. Try again; your details are already saved.",
                          "Ceva nu a mers la generare. Încearcă din nou, datele tale sunt deja salvate.",
                        )
                      : t(
                          "Something went wrong while creating it. Please try again.",
                          "Ceva nu a mers la generare. Te rugăm să încerci din nou.",
                        )}
                  </span>
                </DialogDescription>
                <button
                  type="button"
                  onClick={() => generate(lastLang)}
                  className={scanButton("primary", "md", "mt-6")}
                >
                  <RotateCcw aria-hidden />
                  {t("Try again", "Încearcă din nou")}
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </DialogContent>
    </Dialog>
  );
}
