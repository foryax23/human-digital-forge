import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";

import { SiteLayout } from "@/components/layout/SiteLayout";
import { PageHero } from "@/components/shared/PageHero";
import { FOCUS_RING } from "@/components/system";
import { useI18n } from "@/i18n";
import { cn } from "@/lib/utils";

/** Prose links: the site's underline, as on the other legal pages. */
export const LEGAL_LINK = cn(
  "rounded-sm text-fg underline decoration-fg/30 decoration-1 underline-offset-4 transition-colors hover:decoration-fg",
  FOCUS_RING,
);

export const VORTEXPOINT_EMAIL = "hello@vortexhub.dev";

/** The contact address as a mailto link. */
export function ContactEmail() {
  return (
    <a className={LEGAL_LINK} href={`mailto:${VORTEXPOINT_EMAIL}`}>
      {VORTEXPOINT_EMAIL}
    </a>
  );
}

/** A numbered or plain section, in the layout of /terms and /privacy. */
export function LegalSection({ heading, children }: { heading?: string; children: ReactNode }) {
  return (
    <div className="space-y-3">
      {heading && <h2 className="type-h3 text-fg">{heading}</h2>}
      <div className="type-body space-y-3 text-fg-2">{children}</div>
    </div>
  );
}

/** Bold run inside legal text. */
export function B({ children }: { children: ReactNode }) {
  return <strong className="font-semibold text-fg">{children}</strong>;
}

export function BulletList({ children }: { children: ReactNode }) {
  return <ul className="list-disc space-y-1.5 pl-5 marker:text-fg-3">{children}</ul>;
}

/** The "when / what / to" table of the privacy policy. Stacks on phones. */
export function LegalTable({ head, rows }: { head: string[]; rows: ReactNode[][] }) {
  return (
    <div className="overflow-x-auto">
      <table className="type-body-sm w-full min-w-[34rem] border-collapse text-left">
        <thead>
          <tr className="border-b border-rule">
            {head.map((cell) => (
              <th key={cell} scope="col" className="py-2 pr-4 align-baseline font-medium text-fg-3">
                {cell}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={index} className="border-b border-line-1">
              {row.map((cell, cellIndex) => (
                <td
                  key={cellIndex}
                  className="py-3 pr-4 align-baseline text-pretty text-fg-2 last:pr-0"
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * The frame of the VortexPoint legal pages: PageHero, a note that the document is English
 * only, then the document. The text is the final document from the app (App/Legal), word
 * for word.
 */
export function LegalPage({
  title,
  updated,
  children,
}: {
  title: string;
  updated: string;
  children: ReactNode;
}) {
  const { t } = useI18n();
  return (
    <SiteLayout>
      <PageHero kicker="VortexPoint" title={title} description={updated} />
      <section className="container-vx section-y">
        <div className="max-w-3xl space-y-10">
          <p className="type-body-sm text-pretty text-fg-3">
            {t(
              "This document is in English only, as in the app.",
              "Documentul este disponibil doar în engleză, ca în aplicație.",
            )}{" "}
            <Link to="/vortexpoint" className={LEGAL_LINK}>
              {t("Back to VortexPoint", "Înapoi la VortexPoint")}
            </Link>
          </p>
          {children}
        </div>
      </section>
    </SiteLayout>
  );
}
