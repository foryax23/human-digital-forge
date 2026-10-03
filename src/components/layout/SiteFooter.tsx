import { ContactFooter } from "@/components/landing/ContactFooter";

/**
 * Footer of the pages in SiteLayout: the homepage footer without its closing line (each
 * page ends with its own call to action, CtaBand): the brand sign-off, the link columns,
 * the e-mail and the legal bar with the CUI.
 */
export function SiteFooter() {
  return <ContactFooter compact />;
}
