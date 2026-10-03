import { fromBase64Url, hmacB64, safeEqual, toBase64Url } from "./attest.server";
import type { AccessVia, Lang, OwnerInputs, Relationship, StoreKind } from "./contracts";

/*
 * Run tickets (plan A5): base64url(payload).hmac, issued by startDeepRun and
 * checked by every step (signature, expiry, and that uid is the logged-in
 * user). The ticket also carries the identity summary from ANAF, so later
 * steps never call ANAF again for the name, seat or activity, and the store
 * kind, fixed for the whole run (D16).
 */

export const TICKET_TTL_MS = 2 * 60 * 60 * 1000;

/** What later steps need about the company, from the attested start step. */
export type TicketIdentity = {
  name: string;
  displayName: string;
  regNo?: string;
  caen3?: string;
  city?: string;
  county?: string;
  countyCode?: string;
  /** Website declared in the Trade Register (company index). */
  registrySite?: string;
  /** Website the quick scan verified (a hint; re-verified here). */
  hintSite?: string;
  /** Registered on (ISO date). */
  registeredAt?: string;
};

export type TicketPayload = {
  v: 1;
  runId: string;
  uid: string;
  cui: string;
  via: AccessVia;
  store: StoreKind | "memory";
  budgetUsd: number;
  lang: Lang;
  rel: Relationship;
  ai: "ai" | "rules";
  idn: TicketIdentity;
  /** Earliest time the next ANAF call of this run may start (ms epoch). */
  anafAt: number;
  owner?: OwnerInputs;
  iat: number;
  exp: number;
};

const enc = new TextEncoder();
const dec = new TextDecoder();

export async function issueTicket(
  secret: string,
  payload: Omit<TicketPayload, "v" | "iat" | "exp">,
  now = Date.now(),
): Promise<string> {
  const full: TicketPayload = { v: 1, ...payload, iat: now, exp: now + TICKET_TTL_MS };
  const body = toBase64Url(enc.encode(JSON.stringify(full)));
  return `${body}.${await hmacB64(secret, `ticket|${body}`)}`;
}

export type TicketCheck =
  | { ok: true; payload: TicketPayload }
  | { ok: false; reason: "ticket_invalid" | "ticket_expired" | "user_mismatch" };

export async function readTicket(
  secret: string,
  token: string,
  opts: { uid: string; now?: number; allowExpired?: boolean },
): Promise<TicketCheck> {
  if (typeof token !== "string" || token.length > 8192)
    return { ok: false, reason: "ticket_invalid" };
  const [body, sig, extra] = token.split(".");
  if (!body || !sig || extra !== undefined) return { ok: false, reason: "ticket_invalid" };
  const expected = await hmacB64(secret, `ticket|${body}`);
  if (!safeEqual(expected, sig)) return { ok: false, reason: "ticket_invalid" };
  let payload: TicketPayload;
  try {
    payload = JSON.parse(dec.decode(fromBase64Url(body))) as TicketPayload;
  } catch {
    return { ok: false, reason: "ticket_invalid" };
  }
  if (payload.v !== 1) return { ok: false, reason: "ticket_invalid" };
  if (payload.uid !== opts.uid) return { ok: false, reason: "user_mismatch" };
  if (!opts.allowExpired && (opts.now ?? Date.now()) > payload.exp) {
    return { ok: false, reason: "ticket_expired" };
  }
  return { ok: true, payload };
}
