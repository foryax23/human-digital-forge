import type { DeepReport, StepResult } from "./contracts";

/*
 * Trust between steps (plan A5), WebCrypto only so it runs on Workers and Node:
 * - attestation of a whole StepResult: HMAC(secret, runId | uid | sha256(canonical JSON without att));
 * - sealed cursors: AES-GCM (key derived from the run secret), so the client can neither read
 *   nor steer the crawl;
 * - the report attestation and its printed verification code.
 * The secret is DEEP_RUN_SECRET, or for the first test only an HKDF of the Supabase
 * service-role key ("vortex-deep-v1"); see env.server.ts.
 */

const enc = new TextEncoder();
const dec = new TextDecoder();
const subtle = () => globalThis.crypto.subtle;

/** JSON with sorted keys and no undefined members: the same bytes for the same data. */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") {
    if (typeof value === "number" && !Number.isFinite(value)) return "null";
    return JSON.stringify(value) ?? "null";
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => (item === undefined ? "null" : canonicalJson(item))).join(",")}]`;
  }
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record)
    .filter((key) => record[key] !== undefined)
    .sort();
  return `{${keys.map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`).join(",")}}`;
}

export function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function fromBase64Url(text: string): Uint8Array<ArrayBuffer> {
  const b64 = text.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(b64 + "=".repeat((4 - (b64.length % 4)) % 4));
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

export async function sha256Hex(text: string): Promise<string> {
  const digest = new Uint8Array(await subtle().digest("SHA-256", enc.encode(text)));
  return [...digest].map((b) => b.toString(16).padStart(2, "0")).join("");
}

const hmacKeys = new Map<string, Promise<CryptoKey>>();
function hmacKey(secret: string): Promise<CryptoKey> {
  let key = hmacKeys.get(secret);
  if (!key) {
    key = subtle().importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, [
      "sign",
    ]);
    hmacKeys.set(secret, key);
    if (hmacKeys.size > 8) hmacKeys.delete(hmacKeys.keys().next().value as string);
  }
  return key;
}

export async function hmac(secret: string, message: string): Promise<Uint8Array> {
  return new Uint8Array(await subtle().sign("HMAC", await hmacKey(secret), enc.encode(message)));
}

export async function hmacB64(secret: string, message: string): Promise<string> {
  return toBase64Url(await hmac(secret, message));
}

/** Constant-time comparison of two strings. */
export function safeEqual(a: string, b: string): boolean {
  const x = enc.encode(a);
  const y = enc.encode(b);
  let diff = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i++) diff |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return diff === 0;
}

/** HKDF-SHA256 of a key material string into a 32-byte base64url secret. */
export async function hkdfSecret(material: string, info: string): Promise<string> {
  const base = await subtle().importKey("raw", enc.encode(material), "HKDF", false, ["deriveBits"]);
  const bits = await subtle().deriveBits(
    { name: "HKDF", hash: "SHA-256", salt: enc.encode("vortex-deep"), info: enc.encode(info) },
    base,
    256,
  );
  return toBase64Url(new Uint8Array(bits));
}

/* ----------------------------------------------------------- attestation */

export type Unattested = Omit<StepResult, "att">;

/** The fingerprint of a sealed cursor carried (attested) in `next.cursorSha`. */
export async function cursorFingerprint(cursor: string): Promise<string> {
  return (await sha256Hex(cursor)).slice(0, 32);
}

/**
 * The crawl cursor is sealed on its own (AES-GCM bound to run, user and purpose),
 * so it is left out of the result attestation: the runner may drop it from
 * results it sends to synthesis and finish, keeping those requests under 256 KB.
 * Its fingerprint (`next.cursorSha`, set by sealResult) is attested, so the
 * cursor can be dropped but never swapped for another one.
 */
export async function attestResult(
  secret: string,
  uid: string,
  result: Unattested,
): Promise<string> {
  const { att: _drop, ...rest } = result as StepResult;
  if (rest.next) {
    const { crawlCursor: _cursor, ...next } = rest.next;
    rest.next = Object.values(next).some((v) => v !== undefined) ? next : undefined;
  }
  const digest = await sha256Hex(canonicalJson(rest));
  return hmacB64(secret, `${result.runId}|${uid}|${digest}`);
}

export async function sealResult(
  secret: string,
  uid: string,
  result: Unattested,
): Promise<StepResult> {
  let out = result;
  if (out.next?.crawlCursor) {
    out = {
      ...out,
      next: { ...out.next, cursorSha: await cursorFingerprint(out.next.crawlCursor) },
    };
  } else if (out.next?.cursorSha) {
    const { cursorSha: _stale, ...next } = out.next;
    out = { ...out, next: Object.keys(next).length ? next : undefined };
  }
  return { ...out, att: await attestResult(secret, uid, out) };
}

/** True when the result carries a cursor and it is the one the server sealed with it. */
export async function cursorMatches(result: StepResult): Promise<boolean> {
  const cursor = result.next?.crawlCursor;
  if (!cursor || typeof result.next?.cursorSha !== "string") return false;
  return safeEqual(await cursorFingerprint(cursor), result.next.cursorSha);
}

/** True only for a result attested by this server for this run and user, unchanged. */
export async function verifyResult(
  secret: string,
  uid: string,
  runId: string,
  result: StepResult | undefined | null,
): Promise<boolean> {
  if (!result || typeof result !== "object" || typeof result.att !== "string") return false;
  if (result.runId !== runId) return false;
  const expected = await attestResult(secret, uid, result);
  return safeEqual(expected, result.att);
}

/* -------------------------------------------------------- sealed cursors */

const aesKeys = new Map<string, Promise<CryptoKey>>();
async function aesKey(secret: string): Promise<CryptoKey> {
  let key = aesKeys.get(secret);
  if (!key) {
    key = (async () => {
      const raw = fromBase64Url(await hkdfSecret(secret, "vortex-deep-cursor-v1"));
      return subtle().importKey("raw", raw, "AES-GCM", false, ["encrypt", "decrypt"]);
    })();
    aesKeys.set(secret, key);
  }
  return key;
}

type Bytes = Uint8Array<ArrayBuffer>;

async function gzip(bytes: Bytes): Promise<Bytes> {
  if (typeof CompressionStream === "undefined") return bytes;
  const stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream("gzip"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function gunzip(bytes: Bytes): Promise<Bytes> {
  if (typeof DecompressionStream === "undefined") return bytes;
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/** What a sealed cursor is for: part of the AES-GCM associated data, so one kind never opens as another. */
export type CursorPurpose = "site-snapshot" | "crawl";

const aad = (bind: { runId: string; uid: string }, purpose: CursorPurpose) =>
  enc.encode(`${bind.runId}|${bind.uid}|${purpose}`);

/**
 * Encrypts and authenticates a cursor bound to its run, user and purpose. Opaque to
 * the client: it can neither read the state (page snapshots, robots rules) nor change it.
 */
export async function sealCursor(
  secret: string,
  bind: { runId: string; uid: string },
  state: unknown,
  purpose: CursorPurpose,
): Promise<string> {
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));
  const plain = await gzip(enc.encode(JSON.stringify(state)));
  const cipher = new Uint8Array(
    await subtle().encrypt(
      { name: "AES-GCM", iv, additionalData: aad(bind, purpose) },
      await aesKey(secret),
      plain,
    ),
  );
  const out = new Uint8Array(1 + iv.length + cipher.length);
  out[0] = typeof CompressionStream === "undefined" ? 0 : 1;
  out.set(iv, 1);
  out.set(cipher, 1 + iv.length);
  return toBase64Url(out);
}

export async function openCursor<T>(
  secret: string,
  bind: { runId: string; uid: string },
  token: string,
  purpose: CursorPurpose,
): Promise<T | null> {
  try {
    const bytes = fromBase64Url(token);
    const compressed = bytes[0] === 1;
    const iv = bytes.subarray(1, 13);
    const cipher = bytes.subarray(13);
    const plain = new Uint8Array(
      await subtle().decrypt(
        { name: "AES-GCM", iv, additionalData: aad(bind, purpose) },
        await aesKey(secret),
        cipher,
      ),
    );
    return JSON.parse(dec.decode(compressed ? await gunzip(plain) : plain)) as T;
  } catch {
    return null;
  }
}

/* ------------------------------------------------------- report code */

const CROCKFORD = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

/** reportAtt = HMAC(secret, runId | sha256(canonical report)). */
export async function reportAttestation(
  secret: string,
  runId: string,
  report: DeepReport,
): Promise<string> {
  const { verifyCode: _code, ...rest } = report;
  const digest = await sha256Hex(canonicalJson(rest));
  return hmacB64(secret, `${runId}|${digest}`);
}

/** The first 8 Crockford base32 characters of the report attestation: "7KQ4-M2XD". */
export function verificationCode(reportAtt: string): string {
  const bytes = fromBase64Url(reportAtt);
  let bits = 0;
  let value = 0;
  let out = "";
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5 && out.length < 8) {
      out += CROCKFORD[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
    if (out.length >= 8) break;
  }
  return `${out.slice(0, 4)}-${out.slice(4, 8)}`;
}

/** Normalises a typed code ("7kq4 m2xd", "7KQ4M2XD", O→0, I/L→1) for lookup. */
export function normalizeVerificationCode(input: string): string | null {
  const clean = input
    .toUpperCase()
    .replace(/[^0-9A-Z]/g, "")
    .replace(/O/g, "0")
    .replace(/[IL]/g, "1");
  if (clean.length !== 8 || [...clean].some((c) => !CROCKFORD.includes(c))) return null;
  return `${clean.slice(0, 4)}-${clean.slice(4)}`;
}
