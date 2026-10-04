import process from "node:process";

import { getRequest } from "@tanstack/react-start/server";

import { dailyCapAllows, limitByKey } from "@/lib/abuse/index.server";

import type { IntakeEvent } from "./messages.server";
import { anyChannel, deliverIntake, readNotifyEnv } from "./send.server";

export type { IntakeEvent } from "./messages.server";

/*
 * notifyIntake(event): the team's alert (Telegram and/or e-mail) and the visitor's
 * confirmation, in the background. Server only.
 *
 * On Cloudflare the work is handed to the request's waitUntil (set by the Worker runtime),
 * so the visitor's response does not wait for Telegram or Resend. Where there is no
 * waitUntil, the returned promise settles when delivery ends or after MAX_WAIT_MS, whichever
 * comes first. It never rejects. With no secrets set it does nothing at all.
 */

const MAX_WAIT_MS = 1500;

type WaitUntil = (promise: Promise<unknown>) => void;

function waitUntilOfRequest(): WaitUntil | null {
  try {
    const request = getRequest() as
      | (Request & {
          waitUntil?: WaitUntil;
          runtime?: { cloudflare?: { context?: { waitUntil?: WaitUntil } } };
        })
      | undefined;
    const direct = request?.waitUntil;
    if (typeof direct === "function") return direct.bind(request);
    const context = request?.runtime?.cloudflare?.context;
    if (typeof context?.waitUntil === "function") return context.waitUntil.bind(context);
  } catch {
    // Outside a request (tests, scripts).
  }
  return null;
}

export function notifyIntake(event: IntakeEvent): Promise<void> {
  try {
    const env = readNotifyEnv(process.env as Record<string, string | undefined>);
    if (!anyChannel(env)) return Promise.resolve();
    const task = deliverIntake(event, env, {
      allowEmail: () => dailyCapAllows("email"),
      allowConfirmation: async (to) => (await limitByKey("confirmation", to)).ok,
    }).then(
      () => undefined,
      () => undefined,
    );
    const waitUntil = waitUntilOfRequest();
    if (waitUntil) {
      waitUntil(task);
      return Promise.resolve();
    }
    return Promise.race([task, new Promise<void>((resolve) => setTimeout(resolve, MAX_WAIT_MS))]);
  } catch {
    return Promise.resolve();
  }
}
