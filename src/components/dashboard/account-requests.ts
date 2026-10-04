/*
 * Requests the client workspace sends to the team through the existing contact pipeline
 * (submitContactEnquiry in src/lib/contact.functions.ts, the table the admin panel lists as
 * enquiries). Built here as plain data so the tests can check them; the pages only send them.
 *
 * The pipeline is public, so the team treats these as requests, not proof: for a deletion it
 * confirms by writing to the account's own e-mail before deleting anything.
 */

/** The fields submitContactEnquiry accepts (its zod schema). */
export interface EnquiryPayload {
  fullName: string;
  email: string;
  clientType?: string | null;
  service?: string | null;
  description: string;
  budget?: string | null;
  timeline?: string | null;
}

export interface Requester {
  id: string;
  email: string | null | undefined;
  fullName?: string | null;
  company?: string | null;
  clientType?: string | null;
}

/** The service value the team filters on for each kind of request. */
export const REQUEST_SERVICE = {
  deletion: "account-deletion",
  consultation: "consultation",
} as const;

const clip = (text: string, max: number) => (text.length > max ? text.slice(0, max) : text);

function nameOf(r: Requester): string {
  const name = (r.fullName ?? "").trim() || (r.email ?? "").split("@")[0] || "Client";
  return clip(name, 120);
}

function accountLines(r: Requester): string[] {
  return [
    `Cont: ${r.email ?? "-"}`,
    `ID cont: ${r.id}`,
    ...(r.company?.trim() ? [`Firmă: ${r.company.trim()}`] : []),
  ];
}

/** Null when the account has no e-mail (the pipeline needs one to answer). */
export function deletionRequest(r: Requester, reason: string): EnquiryPayload | null {
  if (!r.email) return null;
  const why = reason.trim();
  const description = [
    "Cerere de ștergere a contului, trimisă din pagina Setări a contului.",
    ...accountLines(r),
    "",
    "De făcut: confirmă cererea prin e-mail la adresa contului, apoi șterge contul și datele lui (proiecte, mesaje, fișiere, consultații). Facturile și documentele contabile se păstrează cât cere legea.",
    ...(why ? ["", `Motivul clientului: ${why}`] : []),
  ].join("\n");
  return {
    fullName: nameOf(r),
    email: clip(r.email, 200),
    clientType: r.clientType ? clip(r.clientType, 40) : null,
    service: REQUEST_SERVICE.deletion,
    description: clip(description, 4000),
    budget: null,
    timeline: null,
  };
}

export interface ConsultationAsk {
  title: string;
  /** The preferred time as the client typed it, already formatted for reading. */
  preferred: string | null;
  notes: string | null;
}

export function consultationRequest(r: Requester, ask: ConsultationAsk): EnquiryPayload | null {
  if (!r.email || !ask.title.trim()) return null;
  const description = [
    `Cerere de consultație din cont: ${ask.title.trim()}`,
    `Ora propusă: ${ask.preferred ?? "de stabilit"}`,
    ...accountLines(r),
    ...(ask.notes?.trim() ? ["", ask.notes.trim()] : []),
  ].join("\n");
  return {
    fullName: nameOf(r),
    email: clip(r.email, 200),
    clientType: r.clientType ? clip(r.clientType, 40) : null,
    service: REQUEST_SERVICE.consultation,
    description: clip(description, 4000),
    budget: null,
    timeline: ask.preferred ? clip(ask.preferred, 120) : null,
  };
}
