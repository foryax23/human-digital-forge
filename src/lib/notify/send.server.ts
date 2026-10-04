import { COMPANY } from "@/lib/scan/legal/company";

import { alertMessage, confirmationMessage, type IntakeEvent } from "./messages.server";

/*
 * Delivery of intake alerts: Telegram (Bot API) and/or e-mail (Resend REST API), plus the
 * visitor's confirmation when Resend is set up. Every channel is off until its secrets exist:
 *
 *   Telegram:      TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID
 *   Alert e-mail:  RESEND_API_KEY + ALERT_EMAIL_FROM + ALERT_EMAIL_TO (comma-separated)
 *   Confirmation:  RESEND_API_KEY + ALERT_EMAIL_FROM (the visitor's address is the recipient)
 *
 * Never throws and never waits longer than `timeoutMs` per channel. Logs one line per intake
 * with the channel outcomes only: no addresses, no message text, no tokens (the Telegram
 * token sits in the request URL, which is never logged).
 */

export type NotifyEnv = {
  telegramToken?: string;
  telegramChatId?: string;
  resendKey?: string;
  alertFrom?: string;
  alertTo: string[];
};

export function readNotifyEnv(env: Record<string, string | undefined>): NotifyEnv {
  const value = (name: string) => env[name]?.trim() || undefined;
  return {
    telegramToken: value("TELEGRAM_BOT_TOKEN"),
    telegramChatId: value("TELEGRAM_CHAT_ID"),
    resendKey: value("RESEND_API_KEY"),
    alertFrom: value("ALERT_EMAIL_FROM"),
    alertTo: (value("ALERT_EMAIL_TO") ?? "")
      .split(",")
      .map((address) => address.trim())
      .filter((address) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address))
      .slice(0, 5),
  };
}

export function channelsOn(env: NotifyEnv) {
  const resend = Boolean(env.resendKey && env.alertFrom);
  return {
    telegram: Boolean(env.telegramToken && env.telegramChatId),
    email: resend && env.alertTo.length > 0,
    confirmation: resend,
  };
}

export function anyChannel(env: NotifyEnv): boolean {
  const on = channelsOn(env);
  return on.telegram || on.email || on.confirmation;
}

/** sent; failed (the service refused or did not answer in time); off (no secrets); skipped (a cap, or nothing to send). */
export type Delivery = "sent" | "failed" | "off" | "skipped";
export type DeliveryReport = { telegram: Delivery; email: Delivery; confirmation: Delivery };

export type DeliverDeps = {
  fetch?: typeof fetch;
  timeoutMs?: number;
  log?: (line: string) => void;
  /** One e-mail against the daily e-mail cap; false skips it. */
  allowEmail?: () => Promise<boolean>;
  /** One confirmation to this address against its own limit; false skips it. */
  allowConfirmation?: (to: string) => Promise<boolean>;
};

async function post(
  doFetch: typeof fetch,
  url: string,
  init: { headers: Record<string, string>; body: string },
  timeoutMs: number,
): Promise<Delivery> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await doFetch(url, {
      method: "POST",
      headers: init.headers,
      body: init.body,
      signal: controller.signal,
    });
    // Drain the body so the connection is released; the content is not needed.
    await response.text().catch(() => "");
    return response.ok ? "sent" : "failed";
  } catch {
    return "failed";
  } finally {
    clearTimeout(timer);
  }
}

const allowAll = async () => true;

export async function deliverIntake(
  event: IntakeEvent,
  env: NotifyEnv,
  deps: DeliverDeps = {},
): Promise<DeliveryReport> {
  const doFetch = deps.fetch ?? fetch;
  const timeoutMs = deps.timeoutMs ?? 4000;
  const allowEmail = deps.allowEmail ?? allowAll;
  const allowConfirmation = deps.allowConfirmation ?? allowAll;
  const on = channelsOn(env);
  const report: DeliveryReport = { telegram: "off", email: "off", confirmation: "off" };

  try {
    const alert = alertMessage(event);
    const resend = (payload: Record<string, unknown>) =>
      post(
        doFetch,
        "https://api.resend.com/emails",
        {
          headers: {
            authorization: `Bearer ${env.resendKey}`,
            "content-type": "application/json",
          },
          body: JSON.stringify(payload),
        },
        timeoutMs,
      );

    const telegram = async (): Promise<Delivery> => {
      if (!on.telegram) return "off";
      return post(
        doFetch,
        `https://api.telegram.org/bot${env.telegramToken}/sendMessage`,
        {
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            chat_id: env.telegramChatId,
            // Plain text: nothing the visitor typed is read as formatting.
            text: alert.text.slice(0, 4000),
            link_preview_options: { is_disabled: true },
          }),
        },
        timeoutMs,
      );
    };

    const email = async (): Promise<Delivery> => {
      if (!on.email) return "off";
      if (!(await allowEmail().catch(() => false))) return "skipped";
      const replyTo = "email" in event && event.email ? event.email : undefined;
      return resend({
        from: env.alertFrom,
        to: env.alertTo,
        subject: alert.subject.slice(0, 200),
        text: alert.text,
        html: alert.html,
        ...(replyTo ? { reply_to: replyTo } : {}),
      });
    };

    const confirmation = async (): Promise<Delivery> => {
      if (!on.confirmation) return "off";
      const message = confirmationMessage(event);
      if (!message) return "skipped";
      if (!(await allowConfirmation(message.to).catch(() => false))) return "skipped";
      if (!(await allowEmail().catch(() => false))) return "skipped";
      return resend({
        from: env.alertFrom,
        to: [message.to],
        subject: message.subject,
        text: message.text,
        html: message.html,
        reply_to: COMPANY.email,
      });
    };

    const [t, e, c] = await Promise.all([
      telegram().catch((): Delivery => "failed"),
      email().catch((): Delivery => "failed"),
      confirmation().catch((): Delivery => "failed"),
    ]);
    report.telegram = t;
    report.email = e;
    report.confirmation = c;
  } catch {
    // A message that could not be built: report what is known, never throw.
  }

  (deps.log ?? ((line: string) => console.log(line)))(
    `[notify] ${event.kind} telegram=${report.telegram} email=${report.email} confirmation=${report.confirmation}`,
  );
  return report;
}
