import { useId, useState, type FormEvent } from "react";

import { Button, Status } from "@/components/system";
import { Input } from "@/components/ui/input";
import type { Correction } from "@/lib/deep/contracts";
import { useI18n } from "@/i18n";
import { cn } from "@/lib/utils";

import { useReport } from "./context";

/*
 * The owner's one-tap correction (D25): "Am asta: [link]" on an absence or a status finding.
 * It becomes a typed "declarat de tine" fact (never free text), the lines, actions and totals
 * are recomputed at once, and sentences citing the corrected fact are hidden.
 */

const COPY: Record<
  Correction["predicate"],
  { button: [string, string]; field: [string, string]; what: [string, string] }
> = {
  "site.booking.present": {
    button: ["I have this", "Am asta"],
    field: ["Link to the booking page (optional)", "Linkul paginii de programare (opțional)"],
    what: ["online booking", "programare online"],
  },
  "site.cui.present": {
    button: ["The tax code is on the site", "CUI-ul e pe site"],
    field: ["Page where it appears (optional)", "Pagina unde apare (opțional)"],
    what: ["the tax code on the site", "codul fiscal pe site"],
  },
  "site.contact.present": {
    button: ["I have this", "Am asta"],
    field: ["Link to the contact page (optional)", "Linkul paginii de contact (opțional)"],
    what: ["a way to get in touch", "o cale de contact"],
  },
  "presence.social_only": {
    button: ["I only have a social page", "Am doar pagină pe rețele sociale"],
    field: ["Link to the page", "Linkul paginii"],
    what: ["only a social media page", "doar o pagină pe rețele sociale"],
  },
  "site.url": {
    button: ["The website is another one", "Site-ul firmei e altul"],
    field: ["The company's website", "Site-ul firmei"],
    what: ["the company's website", "site-ul firmei"],
  },
};

const REQUIRED: Correction["predicate"][] = ["site.url", "presence.social_only"];

export function CorrectButton({
  predicate,
  className,
}: {
  predicate: Correction["predicate"];
  className?: string;
}) {
  const { t } = useI18n();
  const { corrections, onCorrect, report } = useReport();
  const id = useId();
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");
  if (report.audience !== "owner") return null;
  const done = corrections.some((c) => c.predicate === predicate);
  const copy = COPY[predicate];
  if (done)
    return (
      <Status tone="neutral" className={className}>
        {t("Declared by you", "Declarat de tine")}
      </Status>
    );
  if (!open)
    return (
      <Button
        variant="ghost"
        size="sm"
        className={cn("-ml-2 h-11 sm:h-8", className)}
        aria-label={`${t(copy.button[0], copy.button[1])}: ${t(copy.what[0], copy.what[1])}`}
        onClick={() => setOpen(true)}
      >
        {t(copy.button[0], copy.button[1])}
      </Button>
    );
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const raw = url.trim();
    const normal = raw && !/^https?:\/\//i.test(raw) ? `https://${raw}` : raw;
    if (normal && !/^https?:\/\/[^\s/]+\.[^\s]{2,}/i.test(normal)) {
      setError(
        t(
          "Write a full address, e.g. https://firma.ro/programari",
          "Scrie o adresă completă, de exemplu https://firma.ro/programari",
        ),
      );
      return;
    }
    if (!normal && REQUIRED.includes(predicate)) {
      setError(t("The link is needed here.", "Aici e nevoie de link."));
      return;
    }
    onCorrect({ predicate, ...(normal ? { url: normal.slice(0, 300) } : {}) });
    setOpen(false);
  };
  return (
    <form onSubmit={submit} className={cn("mt-2 flex w-full max-w-md flex-col gap-2", className)}>
      <label htmlFor={id} className="text-[0.8125rem] font-medium text-fg-2">
        {t(copy.field[0], copy.field[1])}
      </label>
      <Input
        id={id}
        type="url"
        inputMode="url"
        autoComplete="url"
        placeholder="https://"
        value={url}
        onChange={(e) => {
          setUrl(e.target.value);
          setError("");
        }}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        className="h-11 text-base"
      />
      {error ? (
        <p id={`${id}-error`} className="text-[0.8125rem] text-bad">
          {error}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" variant="secondary" className="h-11">
          {t("Save", "Salvează")}
        </Button>
        <Button type="button" variant="ghost" className="h-11" onClick={() => setOpen(false)}>
          {t("Cancel", "Renunță")}
        </Button>
      </div>
    </form>
  );
}
