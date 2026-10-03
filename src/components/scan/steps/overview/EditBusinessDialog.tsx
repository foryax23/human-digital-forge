import {
  forwardRef,
  useId,
  useMemo,
  useState,
  type FormEvent,
  type SelectHTMLAttributes,
} from "react";
import { ChevronDown } from "lucide-react";

import { Button, Field } from "@/components/system";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useI18n } from "@/i18n";
import { listBusinessTypes } from "@/lib/scan/blueprint/taxonomy";
import { localizeBasis } from "@/lib/scan/localize";
import type { Bilingual, CompanyProfile, Lang } from "@/lib/scan/types";
import { cn } from "@/lib/utils";
import { pick } from "../../report/format";
import type { EditPatch } from "./shared";

type TypeOption = { id: string; label: Bilingual; sector?: Bilingual };

/** A native select in the input's box (40 px, 8 px corners) with a 14 px chevron. */
const NativeSelect = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, children, ...props }, ref) => (
    <div className="relative">
      <select
        ref={ref}
        className={cn(
          "h-10 w-full min-w-0 cursor-pointer appearance-none rounded-lg border border-line-3 bg-fill-1 pl-3 pr-9 text-base text-fg outline-none transition-[border-color,box-shadow] duration-150 [color-scheme:dark] sm:text-sm",
          "focus-visible:border-brand-line/75 focus-visible:ring-3 focus-visible:ring-brand-line/18",
          className,
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDown
        aria-hidden
        className="pointer-events-none absolute right-3 top-1/2 size-3.5 -translate-y-1/2 text-fg-3"
      />
    </div>
  ),
);
NativeSelect.displayName = "NativeSelect";

/**
 * Why we picked this business type, in one sentence, for the field's help line: the reason
 * moved here from the overview (no confidence figure anywhere).
 */
function classificationReason(basis: string[], lang: Lang, company?: CompanyProfile) {
  const caen = basis.some((line) => /^CAEN \d+/.test(line));
  const site = basis.some((line) => line.startsWith("Words on the site"));
  const name = basis.some((line) => line.startsWith("Words in the name"));
  const visitor = basis.some((line) => line === "Chosen by the visitor");
  const ro = lang === "ro";
  let sentence: string;
  if (visitor) sentence = ro ? "Tipul ales de tine." : "The type you chose.";
  else if (caen && site)
    sentence = ro
      ? "Am ales acest tip după codul CAEN și cuvintele de pe site."
      : "We chose this type from the CAEN code and the words on the website.";
  else if (caen)
    sentence = ro
      ? "Am ales acest tip după codul CAEN al firmei."
      : "We chose this type from the company's CAEN code.";
  else if (site || name)
    sentence = ro
      ? `Am ales acest tip după cuvintele ${site ? "de pe site" : "din denumire"}.`
      : `We chose this type from the words ${site ? "on the website" : "in the name"}.`;
  else
    sentence = ro
      ? "Nu am avut destule informații: alege tipul potrivit."
      : "We didn't have enough information: pick the right type.";
  // Each piece is its own short sentence ("CAEN 8623 (…). Cuvinte de pe site: …."), so a
  // capital never follows a semicolon.
  const parts = basis
    .filter((line) => line !== "Chosen by the visitor")
    .map((line) => localizeBasis(line, lang, company).trim())
    .filter(Boolean);
  const detail = parts.map((part) => (/[.!?]$/.test(part) ? part : `${part}.`)).join(" ");
  return { sentence, detail };
}

/**
 * Corrections to the scan: business type, city and website. Only the steps the change
 * affects run again.
 */
export function EditBusinessDialog({
  open,
  onOpenChange,
  initial,
  basis,
  company,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial: { businessTypeId: string; businessTypeLabel: Bilingual; city: string; website: string };
  /** What the classification rests on (blueprint.businessType.basis). */
  basis: string[];
  company?: CompanyProfile;
  onSave: (patch: EditPatch) => void;
}) {
  const { t, lang } = useI18n();
  const formId = useId();
  const [error, setError] = useState<string | null>(null);
  const reason = classificationReason(basis, lang, company);

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
          t(
            "Add the full domain, for example firma.ro.",
            "Adaugă domeniul complet, de exemplu firma.ro.",
          ),
        );
        return;
      }
    }
    setError(null);
    if (Object.keys(patch).length) onSave(patch);
    onOpenChange(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setError(null);
        onOpenChange(next);
      }}
    >
      <DialogContent closeLabel={t("Close", "Închide")} className="cinematic sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="type-h3 text-fg">
            {t("Edit the business", "Editează afacerea")}
          </DialogTitle>
          <DialogDescription className="text-sm leading-[1.5] text-fg-2">
            {t(
              "Correct anything we got wrong. Only the steps your change affects run again.",
              "Corectează ce am înțeles greșit. Reluăm doar pașii afectați de modificare.",
            )}
          </DialogDescription>
        </DialogHeader>
        <form id={formId} onSubmit={submit} className="flex flex-col gap-4" noValidate>
          <Field
            label={t("Business type", "Tipul afacerii")}
            hint={
              <>
                {reason.sentence}
                {reason.detail ? <span className="block">{reason.detail}</span> : null}
              </>
            }
          >
            <NativeSelect name="businessType" defaultValue={initial.businessTypeId}>
              {options.map((option) => (
                <option key={option.id} value={option.id} className="bg-s2">
                  {pick(option.label, lang)}
                  {option.sector ? ` (${pick(option.sector, lang)})` : ""}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field label={t("City", "Oraș")}>
            <Input
              name="city"
              defaultValue={initial.city}
              autoComplete="address-level2"
              placeholder={t("e.g. Timișoara", "de exemplu Timișoara")}
              className="h-10"
            />
          </Field>
          <Field label={t("Website", "Site")} error={error}>
            <Input
              name="website"
              type="url"
              inputMode="url"
              defaultValue={initial.website}
              placeholder="www.firma.ro"
              autoComplete="url"
              className="h-10"
            />
          </Field>
          <DialogFooter className="pt-1">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              {t("Cancel", "Anulează")}
            </Button>
            <Button type="submit">{t("Update the analysis", "Actualizează analiza")}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
