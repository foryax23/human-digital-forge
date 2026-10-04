import { useEffect, useId, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

import { useAuth } from "@/components/auth/AuthProvider";
import {
  buildAccountExport,
  exportFileName,
  isPasswordless,
  type ExportDb,
} from "@/components/dashboard/account-export";
import { deletionRequest } from "@/components/dashboard/account-requests";
import { formatDay } from "@/components/dashboard/format";
import { useTeamRequest } from "@/components/dashboard/team-request";
import { TurnstileField } from "@/components/forms/TurnstileField";
import { Button, Field, Panel, PanelBody, PanelHeader, Status } from "@/components/system";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useI18n } from "@/i18n";
import { supabase } from "@/integrations/supabase/client";
import { getMyTeamHeldData } from "@/lib/account.functions";
import { COMPANY } from "@/lib/scan/legal/company";

/*
 * GDPR self-service on /dashboard/settings: change the password, download the account's data,
 * ask for the account to be deleted. Everything runs with the account's own session.
 */

const MIN_PASSWORD = 8;
const MAX_PASSWORD = 72; // bcrypt's limit in Supabase Auth

type T = (en: string, ro: string) => string;

/** Supabase Auth error codes, in words the client can act on. */
function passwordError(error: { code?: string; message?: string; status?: number }, t: T) {
  switch (error.code) {
    case "same_password":
      return t(
        "The new password must differ from the current one.",
        "Parola nouă trebuie să fie diferită de cea actuală.",
      );
    case "weak_password":
      return t(
        "This password is too easy to guess. Use a longer one, with letters and numbers.",
        "Parola e prea ușor de ghicit. Alege una mai lungă, cu litere și cifre.",
      );
    case "reauthentication_needed":
    case "session_expired":
    case "session_not_found":
      return t(
        "For safety, log out, log back in and change the password right after.",
        "Din motive de siguranță, ieși din cont, intră din nou și schimbă parola imediat după.",
      );
    case "over_request_rate_limit":
    case "over_email_send_rate_limit":
      return t(
        "Too many attempts. Wait a few minutes and try again.",
        "Prea multe încercări. Așteaptă câteva minute și încearcă din nou.",
      );
    default:
      return error.status === 429
        ? t(
            "Too many attempts. Wait a few minutes and try again.",
            "Prea multe încercări. Așteaptă câteva minute și încearcă din nou.",
          )
        : t(
            "The password was not changed. Please try again.",
            "Parola nu a fost schimbată. Încearcă din nou.",
          );
  }
}

export function PasswordPanel() {
  const { t } = useI18n();
  const { user } = useAuth();
  const titleId = useId();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [again, setAgain] = useState("");
  const [errors, setErrors] = useState<{
    current?: string;
    next?: string;
    again?: string;
    form?: string;
  }>({});
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  if (!user) return null;

  if (isPasswordless(user)) {
    return (
      <Panel as="section" aria-labelledby={titleId}>
        <PanelHeader titleAs="h2" titleId={titleId} title={t("Password", "Parola")} />
        <PanelBody>
          <p className="type-body-sm max-w-[64ch] text-fg-2">
            {t(
              "You sign in with Google, so this account has no password of its own. Your Google account's security settings protect it.",
              "Te conectezi cu Google, așa că acest cont nu are o parolă proprie. Îl protejează setările de securitate ale contului tău Google.",
            )}
          </p>
        </PanelBody>
      </Panel>
    );
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!user?.email) return;
    setDone(false);
    const found: typeof errors = {};
    if (!current) found.current = t("Enter your current password.", "Scrie parola actuală.");
    if (next.length < MIN_PASSWORD)
      found.next = t(
        `At least ${MIN_PASSWORD} characters.`,
        `Cel puțin ${MIN_PASSWORD} caractere.`,
      );
    else if (next === current)
      found.next = t(
        "The new password must differ from the current one.",
        "Parola nouă trebuie să fie diferită de cea actuală.",
      );
    if (!found.next && again !== next)
      found.again = t("The two passwords do not match.", "Cele două parole nu sunt la fel.");
    setErrors(found);
    if (Object.keys(found).length) return;

    setSaving(true);
    // The current password first, so an unlocked session alone cannot change it.
    const check = await supabase.auth.signInWithPassword({ email: user.email, password: current });
    if (check.error) {
      setSaving(false);
      const limited = check.error.status === 429 || check.error.code === "over_request_rate_limit";
      setErrors(
        limited
          ? { form: passwordError(check.error, t) }
          : {
              current: t("That is not your current password.", "Aceasta nu este parola actuală."),
            },
      );
      return;
    }
    const { error } = await supabase.auth.updateUser({ password: next });
    setSaving(false);
    if (error) {
      const message = passwordError(error, t);
      setErrors(
        error.code === "same_password" || error.code === "weak_password"
          ? { next: message }
          : { form: message },
      );
      return;
    }
    setCurrent("");
    setNext("");
    setAgain("");
    setDone(true);
    toast.success(t("Password changed.", "Parola a fost schimbată."));
  }

  return (
    <Panel as="section" aria-labelledby={titleId}>
      <PanelHeader
        titleAs="h2"
        titleId={titleId}
        title={t("Password", "Parola")}
        sub={t(
          "You will use the new password the next time you log in.",
          "Folosești parola nouă de la următoarea conectare.",
        )}
      />
      <PanelBody>
        <form onSubmit={handleSubmit} className="grid max-w-md gap-4" noValidate>
          {/* Lets password managers file the new password under the right account. */}
          <input
            type="email"
            name="username"
            autoComplete="username"
            value={user.email ?? ""}
            readOnly
            hidden
          />
          <Field label={t("Current password", "Parola actuală")} error={errors.current}>
            <Input
              type="password"
              autoComplete="current-password"
              value={current}
              maxLength={MAX_PASSWORD}
              onChange={(e) => setCurrent(e.target.value)}
            />
          </Field>
          <Field
            label={t("New password", "Parola nouă")}
            hint={t(`At least ${MIN_PASSWORD} characters.`, `Cel puțin ${MIN_PASSWORD} caractere.`)}
            error={errors.next}
          >
            <Input
              type="password"
              autoComplete="new-password"
              value={next}
              maxLength={MAX_PASSWORD}
              onChange={(e) => setNext(e.target.value)}
            />
          </Field>
          <Field label={t("New password again", "Parola nouă, încă o dată")} error={errors.again}>
            <Input
              type="password"
              autoComplete="new-password"
              value={again}
              maxLength={MAX_PASSWORD}
              onChange={(e) => setAgain(e.target.value)}
            />
          </Field>
          {errors.form ? (
            <p role="alert" className="type-body-sm text-bad">
              {errors.form}
            </p>
          ) : null}
          {done ? (
            <Status tone="ok">{t("Password changed.", "Parola a fost schimbată.")}</Status>
          ) : null}
          <div>
            <Button type="submit" variant="secondary" size="md" loading={saving} disabled={saving}>
              {t("Change password", "Schimbă parola")}
            </Button>
          </div>
        </form>
      </PanelBody>
    </Panel>
  );
}

export function DataExportPanel() {
  const { t, lang } = useI18n();
  const { user } = useAuth();
  const titleId = useId();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ rows: number; tables: number } | null>(null);
  const fetchTeamHeld = useServerFn(getMyTeamHeldData);

  async function handleExport() {
    if (!user) return;
    setBusy(true);
    setResult(null);
    try {
      const now = new Date();
      // The team-held rows come from the server; without them the file says how to ask.
      const team = await fetchTeamHeld().catch((error: unknown) => {
        console.warn("[settings] team-held export unavailable", error);
        return { status: "unavailable" } as const;
      });
      const file = await buildAccountExport(supabase as unknown as ExportDb, user, lang, now, team);
      const blob = new Blob([JSON.stringify(file, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = exportFileName(now, lang);
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
      const tables = Object.values(file.tables);
      setResult({
        rows: tables.reduce((n, rows) => n + (rows?.length ?? 0), 0),
        tables: tables.length,
      });
    } catch (err) {
      console.error("[settings] export failed", err);
      toast.error(
        t(
          "The file was not created. Please try again.",
          "Fișierul nu a fost creat. Încearcă din nou.",
        ),
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <Panel as="section" aria-labelledby={titleId}>
      <PanelHeader titleAs="h2" titleId={titleId} title={t("Your data", "Datele tale")} />
      <PanelBody className="grid gap-4">
        <div className="type-body-sm grid max-w-[64ch] gap-2 text-fg-2">
          <p>
            {t(
              "Download a JSON file with your account's data: profile, projects, messages, the list of files, consultations, invoices and plan, plus the account's Deep Research reports and the form requests sent from your confirmed e-mail address.",
              "Descarci un fișier JSON cu datele contului: profilul, proiectele, mesajele, lista fișierelor, consultațiile, facturile și abonamentul, plus rapoartele Deep Research ale contului și cererile trimise prin formulare de pe adresa ta de e-mail confirmată.",
            )}
          </p>
          <p>
            {t(
              "For any other request about your data, write to ",
              "Pentru orice altă cerere despre datele tale, scrie\u2011ne la ",
            )}
            <Email address={COMPANY.email} />
            {t(". We reply within 30 days at most.", ". Răspundem în cel mult 30 de zile.")}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <Button
            variant="secondary"
            size="md"
            onClick={handleExport}
            loading={busy}
            disabled={busy}
          >
            {t("Download my data", "Descarcă datele mele")}
          </Button>
          {result ? (
            <Status tone="ok">
              {t(
                `Downloaded: ${result.rows} records from ${result.tables} tables.`,
                `Descărcat: ${result.rows} înregistrări din ${result.tables} tabele.`,
              )}
            </Status>
          ) : null}
        </div>
      </PanelBody>
    </Panel>
  );
}

/** An address inside running text: moves to the next line whole rather than split at a hyphen. */
function Email({ address }: { address: string }) {
  return <span className="inline-block max-w-full break-all align-bottom">{address}</span>;
}

const sentKey = (userId: string) => `vortex-deletion-request:${userId}`;

function readSent(userId: string): string | null {
  try {
    const value = window.localStorage.getItem(sentKey(userId));
    return value && !Number.isNaN(new Date(value).getTime()) ? value : null;
  } catch {
    return null;
  }
}

export function DeletionPanel() {
  const { t, lang } = useI18n();
  const { user, profile } = useAuth();
  const { submit, turnstile } = useTeamRequest();
  const titleId = useId();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [sending, setSending] = useState(false);
  const [sentAt, setSentAt] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (user) setSentAt(readSent(user.id));
  }, [user]);

  if (!user) return null;
  const email = user.email ?? null;

  async function handleSend(event: React.FormEvent) {
    event.preventDefault();
    if (!user) return;
    const payload = deletionRequest(
      {
        id: user.id,
        email: user.email,
        fullName: profile?.full_name,
        company: profile?.company,
        clientType: profile?.client_type,
      },
      reason.slice(0, 1000),
    );
    if (!payload) return;
    setFormError(null);
    setSending(true);
    const sent = await submit(payload);
    if (!sent.ok) {
      setFormError(sent.message);
      setSending(false);
      return;
    }
    const now = new Date().toISOString();
    try {
      window.localStorage.setItem(sentKey(user.id), now);
    } catch {
      /* the confirmation below still shows in this tab */
    }
    setSentAt(now);
    setSending(false);
    setOpen(false);
    setReason("");
  }

  return (
    <Panel as="section" aria-labelledby={titleId}>
      <PanelHeader
        titleAs="h2"
        titleId={titleId}
        title={t("Delete the account", "Ștergerea contului")}
      />
      <PanelBody className="grid gap-4">
        <div className="type-body-sm grid max-w-[64ch] gap-2 text-fg-2">
          <p>
            {t(
              "You can ask us to delete your account at any time. We delete the account, the profile, projects, messages, files and consultations, and the account's Deep Research reports. We handle the request within 30 days at most.",
              "Poți cere oricând ștergerea contului. Ștergem contul, profilul, proiectele, mesajele, fișierele și consultațiile, plus rapoartele Deep Research ale contului. Rezolvăm cererea în cel mult 30 de zile.",
            )}
          </p>
          <p>
            {t(
              "Invoices and accounting records are kept for as long as the law requires, also after the account is deleted. A plan under contract ends under the terms of that contract.",
              "Facturile și documentele contabile le păstrăm cât timp cere legea, și după ștergerea contului. Un abonament în derulare se încheie după condițiile din contract.",
            )}
          </p>
          {email ? (
            <p>
              {t(
                "Before deleting anything we write to ",
                "Înainte să ștergem ceva, îți scriem pe ",
              )}
              <Email address={email} />
              {t(
                " to confirm the request is yours. Download your data first if you want a copy.",
                " ca să confirmi că cererea e a ta. Dacă vrei o copie, descarcă\u2011ți întâi datele.",
              )}
            </p>
          ) : (
            <p>
              {t(
                "This account has no e-mail address, so ask for the deletion by writing to ",
                "Contul nu are o adresă de e-mail, așa că cere ștergerea scriindu\u2011ne la ",
              )}
              <Email address={COMPANY.email} />.
            </p>
          )}
        </div>

        {sentAt ? (
          <Status tone="ok">
            {t(
              `Request sent on ${formatDay(sentAt, lang)}. We will write to you to confirm it.`,
              `Cererea a fost trimisă pe ${formatDay(sentAt, lang)}. Îți scriem ca să o confirmăm.`,
            )}
          </Status>
        ) : null}

        {email ? (
          <Dialog open={open} onOpenChange={setOpen}>
            <div>
              <DialogTrigger asChild>
                <Button variant="secondary" size="md">
                  {sentAt
                    ? t("Send the request again", "Trimite din nou cererea")
                    : t("Ask to delete the account", "Cere ștergerea contului")}
                </Button>
              </DialogTrigger>
            </div>
            <DialogContent>
              <form onSubmit={handleSend}>
                <DialogHeader>
                  <DialogTitle>{t("Delete the account?", "Ștergem contul?")}</DialogTitle>
                  <DialogDescription>
                    {t(
                      `The request goes to the Vortex Hub team. We confirm it with you at ${email} before deleting anything; invoices are kept as the law requires.`,
                      `Cererea ajunge la echipa Vortex Hub. O confirmăm cu tine pe ${email} înainte să ștergem ceva; facturile le păstrăm cum cere legea.`,
                    )}
                  </DialogDescription>
                </DialogHeader>
                <div className="mt-4 grid gap-4">
                  <Field label={t("Reason", "Motivul")} optional>
                    <Textarea
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      rows={3}
                      maxLength={1000}
                    />
                  </Field>
                  <TurnstileField ref={turnstile} action="contact" />
                  {formError ? (
                    <p role="alert" className="type-body-sm text-bad">
                      {formError}
                    </p>
                  ) : null}
                </div>
                <DialogFooter className="mt-6 gap-2">
                  <Button type="button" variant="ghost" size="lg" onClick={() => setOpen(false)}>
                    {t("Cancel", "Renunță")}
                  </Button>
                  <Button type="submit" size="lg" loading={sending} disabled={sending}>
                    {t("Send the request", "Trimite cererea")}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        ) : null}
      </PanelBody>
    </Panel>
  );
}
