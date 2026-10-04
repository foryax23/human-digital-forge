/**
 * The browser Supabase client on demand. supabase-js is about a quarter of the entry bundle,
 * and an anonymous visitor on a public page never uses it, so it loads only when this visit
 * can have a session:
 *  - a session is stored (supabase-js keeps it in localStorage as `sb-<ref>-auth-token`);
 *  - the URL carries auth tokens (Google sign-in return, email confirmation, password reset);
 *  - the page runs in Lovable's preview, where the session lives in the editor
 *    (previewAuthStorage.ts), not in this page's storage.
 * Pages that sign people in (login, register, dashboard) still import ./client directly;
 * dynamic imports of it share that one module, so there is only ever one client.
 */
type Client = (typeof import("./client"))["supabase"];

/** supabase-js's default storage key for the session (`sb-<project ref>-auth-token`). */
export const AUTH_STORAGE_KEY = /^sb-.+-auth-token$/;

// Same hosts as previewAuthStorage.ts.
const PREVIEW_ZONES = [
  "lovableproject.com",
  "lovableproject-dev.com",
  "lovable.app",
  "gpt-eng.com",
  "gptengineer.run",
];

function hasStoredSession(): boolean {
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && AUTH_STORAGE_KEY.test(key)) return true;
    }
  } catch {
    // Storage blocked: supabase-js could not have stored a session either.
  }
  return false;
}

/** Tokens or codes supabase-js reads from the URL when it starts (detectSessionInUrl). */
function urlHasAuthParams(): boolean {
  return /[#?&](access_token|refresh_token|code|token_hash|error_description)=/.test(
    location.hash + location.search,
  );
}

function onLovablePreview(): boolean {
  const host = location.hostname;
  const framed = window.parent !== window;
  return framed && PREVIEW_ZONES.some((zone) => host === zone || host.endsWith(`.${zone}`));
}

/** Whether this browser may be signed in, so the client is worth loading. False on the server. */
export function mayHaveSession(): boolean {
  if (typeof window === "undefined") return false;
  return hasStoredSession() || urlHasAuthParams() || onLovablePreview();
}

let pending: Promise<Client> | undefined;

/** The shared browser client, importing supabase-js on first use. */
export function loadSupabase(): Promise<Client> {
  pending ??= import("./client").then((m) => m.supabase);
  return pending;
}
