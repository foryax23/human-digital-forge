import { useCallback, useEffect, useImperativeHandle, useRef, useState, type Ref } from "react";

import { useI18n } from "@/i18n";
import { getIntakeConfig } from "@/lib/contact.functions";

/*
 * Cloudflare Turnstile for the contact form and the scan's lead gate. Renders nothing, and
 * loads nothing from Cloudflare, until the server says Turnstile is on (getIntakeConfig
 * returns a site key only when TURNSTILE_SITE_KEY and TURNSTILE_SECRET_KEY are both set).
 * "interaction-only": most visitors never see it; when Cloudflare wants a click, the box
 * appears where this field sits.
 *
 * The form asks `check()` on submit: { needed: false } (off), a token, or why there is none.
 * A token works once, so the form calls `reset()` after every attempt that did not succeed.
 */

type TurnstileApi = {
  render(element: HTMLElement, options: Record<string, unknown>): string;
  reset(widgetId: string): void;
  remove(widgetId: string): void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

const SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

let siteKeyRequest: Promise<string | null> | null = null;

/** The site key, asked once per page load (null: Turnstile is off or the server did not answer). */
function loadSiteKey(): Promise<string | null> {
  siteKeyRequest ??= getIntakeConfig().then(
    (config) => config.turnstileSiteKey ?? null,
    () => {
      siteKeyRequest = null;
      return null;
    },
  );
  return siteKeyRequest;
}

let scriptRequest: Promise<TurnstileApi> | null = null;

function loadScript(): Promise<TurnstileApi> {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  scriptRequest ??= new Promise<TurnstileApi>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = SCRIPT_SRC;
    script.async = true;
    script.onload = () =>
      window.turnstile ? resolve(window.turnstile) : reject(new Error("turnstile_missing"));
    script.onerror = () => {
      scriptRequest = null;
      script.remove();
      reject(new Error("turnstile_blocked"));
    };
    document.head.appendChild(script);
  });
  return scriptRequest;
}

export type TurnstileCheck =
  | { needed: false }
  | { needed: true; token: string }
  /** interaction: the box is waiting for a click; unavailable: it could not load or failed. */
  | { needed: true; token: null; problem: "interaction" | "unavailable" };

export type TurnstileHandle = {
  check(waitMs?: number): Promise<TurnstileCheck>;
  reset(): void;
};

type Status = "loading" | "idle" | "interactive" | "ready" | "error";

export function TurnstileField({
  action,
  ref,
  className,
}: {
  /** What the token is for; the server checks the same name. */
  action: "contact" | "lead";
  ref?: Ref<TurnstileHandle>;
  className?: string;
}) {
  const { lang } = useI18n();
  const [siteKey, setSiteKey] = useState<string | null | undefined>(undefined);
  const container = useRef<HTMLDivElement>(null);
  const widget = useRef<{ api: TurnstileApi; id: string } | null>(null);
  const token = useRef<string | null>(null);
  const status = useRef<Status>("loading");
  const waiters = useRef(new Set<() => void>());

  const settle = useCallback((next: Status, value: string | null = null) => {
    status.current = next;
    token.current = value;
    for (const wake of waiters.current) wake();
  }, []);

  useEffect(() => {
    let live = true;
    void loadSiteKey().then((key) => {
      if (live) setSiteKey(key);
    });
    return () => {
      live = false;
    };
  }, []);

  useEffect(() => {
    if (!siteKey || !container.current) return;
    let live = true;
    const element = container.current;
    loadScript().then(
      (api) => {
        if (!live) return;
        const id = api.render(element, {
          sitekey: siteKey,
          action,
          theme: "dark",
          language: lang,
          size: "flexible",
          appearance: "interaction-only",
          callback: (value: string) => settle("ready", value),
          "expired-callback": () => settle("idle"),
          "timeout-callback": () => settle("idle"),
          "before-interactive-callback": () => settle("interactive"),
          "after-interactive-callback": () => {
            if (status.current === "interactive") settle("idle");
          },
          "error-callback": () => {
            settle("error");
            // Handled here: Cloudflare retries on its own; no console noise.
            return true;
          },
          "unsupported-callback": () => settle("error"),
        });
        widget.current = { api, id };
        if (status.current === "loading") settle("idle");
      },
      () => {
        if (live) settle("error");
      },
    );
    return () => {
      live = false;
      if (widget.current) {
        try {
          widget.current.api.remove(widget.current.id);
        } catch {
          /* already gone */
        }
        widget.current = null;
      }
    };
  }, [siteKey, action, lang, settle]);

  useImperativeHandle(
    ref,
    () => ({
      async check(waitMs = 6000) {
        const key = siteKey === undefined ? await loadSiteKey() : siteKey;
        if (!key) return { needed: false };
        const started = Date.now();
        while (!token.current && status.current !== "error") {
          const left = waitMs - (Date.now() - started);
          if (left <= 0) break;
          await new Promise<void>((resolve) => {
            const wake = () => {
              waiters.current.delete(wake);
              clearTimeout(timer);
              resolve();
            };
            const timer = setTimeout(wake, left);
            waiters.current.add(wake);
          });
        }
        if (token.current) return { needed: true, token: token.current };
        return {
          needed: true,
          token: null,
          // A box on screen waits for the click; anything else did not get going in time.
          problem: status.current === "interactive" ? "interaction" : "unavailable",
        };
      },
      reset() {
        token.current = null;
        if (!widget.current) return;
        try {
          widget.current.api.reset(widget.current.id);
          status.current = "idle";
        } catch {
          status.current = "error";
        }
      },
    }),
    [siteKey],
  );

  if (!siteKey) return null;
  return <div ref={container} className={className} />;
}
