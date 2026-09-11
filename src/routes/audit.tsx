import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, ArrowRight, Check, Loader2, Sparkles, Target } from "lucide-react";
import { toast } from "sonner";

import { SiteLayout } from "@/components/layout/SiteLayout";
import { Band } from "@/components/site/Band";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { useI18n } from "@/i18n";
import { auditQuestions, scoreAudit, type AuditAnswers } from "@/lib/audit";
import { submitAuditLead } from "@/lib/audit.functions";

const title = "Free Infrastructure Audit | Vortex Hub";
const description =
  "Answer seven short questions and get a realistic picture of where your business infrastructure leaks time, plus the first three moves to fix it.";

export const Route = createFileRoute("/audit")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: "/audit" }],
  }),
  component: AuditPage,
});

type Step = number | "contact" | "result";

function AuditPage() {
  const { t, lang } = useI18n();
  const save = useServerFn(submitAuditLead);

  const [step, setStep] = useState<Step>(0);
  const [answers, setAnswers] = useState<AuditAnswers>({});
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [company, setCompany] = useState("");
  const [saving, setSaving] = useState(false);

  const result = useMemo(() => scoreAudit(answers), [answers]);
  const total = auditQuestions.length + 1;
  const stepIndex = step === "result" ? total : step === "contact" ? total - 1 : step;

  const pick = (questionId: string, value: string) => {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
    setStep((prev) =>
      typeof prev === "number" ? (prev + 1 < auditQuestions.length ? prev + 1 : "contact") : prev,
    );
  };

  const back = () => {
    setStep((prev) => {
      if (prev === "result") return "contact";
      if (prev === "contact") return auditQuestions.length - 1;
      return Math.max(0, prev - 1);
    });
  };

  const submit = async () => {
    if (!email.includes("@")) {
      toast.error(t("Please enter a valid email.", "Introdu o adresă de email validă."));
      return;
    }
    setSaving(true);
    try {
      await save({
        data: {
          fullName: fullName || null,
          email,
          company: company || null,
          answers,
          score: result.score,
          recommendedTier: result.recommendedTier,
          recommendation: [result.headline[lang], ...result.moves.map((m) => m[lang])].join(
            " · ",
          ),
          language: lang,
        },
      });
      setStep("result");
    } catch {
      toast.error(t("Something went wrong. Please try again.", "Ceva a mers greșit. Încearcă din nou."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <SiteLayout>
      <Band tone="dark" innerClassName="max-w-3xl py-20 sm:py-24">
        <div
          aria-hidden
          className="flow-orb flow-orb-indigo -top-24 left-1/4 h-72 w-72"
        />

        <div className="relative">
          <div className="flex items-center justify-between gap-4">
            <span className="inline-flex items-center gap-2 rounded-full border border-border glass-panel px-4 py-1.5 text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
              <Sparkles className="h-3.5 w-3.5" />
              {t("Free infrastructure audit", "Audit gratuit de infrastructură")}
            </span>
            {step !== "result" && (
              <span className="text-sm text-muted-foreground">
                {Math.min(stepIndex + 1, total)} / {total}
              </span>
            )}
          </div>

          <Progress
            value={(stepIndex / total) * 100}
            className="mt-6 h-1.5 bg-secondary"
          />

          {typeof step === "number" && (
            <div className="mt-12">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-teal">
                {auditQuestions[step]!.eyebrow[lang]}
              </p>
              <h1 className="mt-4 text-3xl font-bold leading-tight sm:text-4xl">
                {auditQuestions[step]!.question[lang]}
              </h1>
              <p className="mt-3 text-base text-muted-foreground">
                {auditQuestions[step]!.help[lang]}
              </p>

              <div className="mt-8 grid gap-3">
                {auditQuestions[step]!.options.map((option) => {
                  const active = answers[auditQuestions[step]!.id] === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => pick(auditQuestions[step]!.id, option.value)}
                      className={`group flex items-center justify-between gap-4 rounded-xl border px-5 py-4 text-left text-base transition-all ${
                        active
                          ? "border-primary bg-accent glow-soft"
                          : "border-border glass-panel hover:border-primary/50 hover:bg-accent"
                      }`}
                    >
                      <span>{option.label[lang]}</span>
                      <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-1" />
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {step === "contact" && (
            <div className="mt-12">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-teal">
                {t("Last step", "Ultimul pas")}
              </p>
              <h1 className="mt-4 text-3xl font-bold leading-tight sm:text-4xl">
                {t("Where should we send your plan?", "Unde să îți trimitem planul?")}
              </h1>
              <p className="mt-3 text-base text-muted-foreground">
                {t(
                  "You see the result on screen straight away. We keep a copy so we can walk you through it if you want.",
                  "Vezi rezultatul pe loc. Păstrăm o copie ca să îl parcurgem împreună, dacă vrei.",
                )}
              </p>

              <div className="mt-8 grid gap-5">
                <div className="grid gap-2">
                  <Label htmlFor="audit-email">{t("Email", "Email")}</Label>
                  <Input
                    id="audit-email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@company.com"
                  />
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <div className="grid gap-2">
                    <Label htmlFor="audit-name">{t("Name", "Nume")}</Label>
                    <Input
                      id="audit-name"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="audit-company">{t("Company", "Companie")}</Label>
                    <Input
                      id="audit-company"
                      value={company}
                      onChange={(e) => setCompany(e.target.value)}
                    />
                  </div>
                </div>
                <Button
                  size="lg"
                  onClick={submit}
                  disabled={saving}
                  className="bg-gradient-brand text-primary-foreground glow-soft hover:opacity-90"
                >
                  {saving ? <Loader2 className="animate-spin" /> : <Target />}
                  {t("Show my plan", "Arată-mi planul")}
                </Button>
              </div>
            </div>
          )}

          {step === "result" && (
            <div className="mt-12">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-teal">
                {t("Your result", "Rezultatul tău")}
              </p>
              <h1 className="mt-4 text-3xl font-bold leading-tight sm:text-4xl">
                {result.headline[lang]}
              </h1>
              <p className="mt-4 text-lg leading-relaxed text-muted-foreground">
                {result.summary[lang]}
              </p>

              <div className="mt-8 rounded-2xl bento-panel p-6">
                <div className="flex items-end justify-between gap-4">
                  <span className="text-sm text-muted-foreground">
                    {t("Infrastructure risk score", "Scor de risc al infrastructurii")}
                  </span>
                  <span className="text-3xl font-bold">
                    {result.score}
                    <span className="text-base text-muted-foreground">/{result.maxScore}</span>
                  </span>
                </div>
                <Progress
                  value={(result.score / result.maxScore) * 100}
                  className="mt-4 h-2 bg-secondary"
                />
              </div>

              {result.gaps.length > 0 && (
                <div className="mt-10">
                  <h2 className="text-xl font-semibold">
                    {t("What we spotted", "Ce am observat")}
                  </h2>
                  <ul className="mt-4 grid gap-3">
                    {result.gaps.map((gap) => (
                      <li
                        key={gap.en}
                        className="rounded-xl border border-border glass-panel px-5 py-4 text-base text-muted-foreground"
                      >
                        {gap[lang]}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="mt-10">
                <h2 className="text-xl font-semibold">
                  {t("Your first three moves", "Primele trei mișcări")}
                </h2>
                <ol className="mt-4 grid gap-3">
                  {result.moves.map((move, i) => (
                    <li key={move.en} className="flex gap-4 rounded-xl bento-panel px-5 py-4">
                      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-gradient-brand text-sm font-bold text-primary-foreground">
                        {i + 1}
                      </span>
                      <span className="text-base">{move[lang]}</span>
                    </li>
                  ))}
                </ol>
              </div>

              <div className="mt-10 rounded-2xl bento-panel p-6">
                <div className="flex items-center gap-3">
                  <Check className="h-5 w-5 text-teal" />
                  <span className="text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    {t("Recommended next step", "Pasul recomandat")}
                  </span>
                </div>
                <p className="mt-3 text-lg font-semibold">{result.tierLabel[lang]}</p>
                <div className="mt-6 flex flex-wrap gap-3">
                  <Button
                    asChild
                    size="lg"
                    className="bg-gradient-brand text-primary-foreground hover:opacity-90"
                  >
                    <Link to="/consultancy">
                      {t("Book the call", "Programează apelul")}
                      <ArrowRight />
                    </Link>
                  </Button>
                  <Button asChild size="lg" variant="outline" className="border-border glass-panel">
                    <Link to="/contact">{t("Send details instead", "Trimite detalii")}</Link>
                  </Button>
                </div>
              </div>
            </div>
          )}

          {step !== "result" && step !== 0 && (
            <button
              type="button"
              onClick={back}
              className="mt-10 inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4" />
              {t("Back", "Înapoi")}
            </button>
          )}
        </div>
      </Band>
    </SiteLayout>
  );
}
