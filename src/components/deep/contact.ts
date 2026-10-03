import { COMPANY } from "@/lib/scan/legal/company";

/*
 * Who signs the recommendations and how people reach him (plan A10 "Call to action").
 * OWNER TO FILL: the photo, the phone and the WhatsApp number are not provided yet. Until
 * they are, the photo slot shows the initials "MD" and the WhatsApp and phone buttons stay
 * hidden; nothing is invented.
 * - photo: put the file at public/media/team/mihai-dandea.jpg (the PDF reads the same path),
 *   then set `photo: "/media/team/mihai-dandea.jpg"`.
 * - phone: international format, e.g. "+40 7xx xxx xxx".
 * - whatsapp: digits only with the country code, e.g. "407xxxxxxxx" (for wa.me links).
 */
export const SIGNATORY = {
  name: COMPANY.signatory,
  initials: "MD",
  role: COMPANY.role,
  company: COMPANY.legalName,
  cui: COMPANY.cui,
  city: COMPANY.city,
  email: COMPANY.email,
  photo: null as string | null,
  phone: null as string | null,
  whatsapp: null as string | null,
};

/** "Bună, am făcut raportul pentru FIRMA (CUI X) și aș vrea discuția de 30 de minute". */
export function whatsappLink(company: string, cui: string, lang: "ro" | "en"): string | null {
  if (!SIGNATORY.whatsapp) return null;
  const text =
    lang === "ro"
      ? `Bună, am făcut raportul pentru ${company} (CUI ${cui}) și aș vrea discuția de 30 de minute.`
      : `Hello, I ran the report for ${company} (CUI ${cui}) and would like the 30-minute call.`;
  return `https://wa.me/${SIGNATORY.whatsapp}?text=${encodeURIComponent(text)}`;
}

export function telLink(): string | null {
  return SIGNATORY.phone ? `tel:${SIGNATORY.phone.replace(/[^\d+]/g, "")}` : null;
}
